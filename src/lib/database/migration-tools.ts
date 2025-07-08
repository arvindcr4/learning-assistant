// SQLite to PostgreSQL Migration Tools
import { Pool, PoolClient } from 'pg';
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { join } from 'path';

import { DatabaseConnection, getDatabase } from './connection';
import { DatabaseUtils } from './utils';

// Migration configuration
interface MigrationConfig {
  sqlitePath: string;
  batchSize?: number;
  timeout?: number;
  skipTables?: string[];
  validateData?: boolean;
  dryRun?: boolean;
}

// Migration result
interface MigrationResult {
  table: string;
  totalRows: number;
  migratedRows: number;
  errors: string[];
  duration: number;
  success: boolean;
}

// Migration status
interface MigrationStatus {
  totalTables: number;
  completedTables: number;
  totalRows: number;
  migratedRows: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  success: boolean;
}

export class SQLiteToPostgreSQLMigrator {
  private db: DatabaseConnection;
  private utils: DatabaseUtils;
  private config: MigrationConfig;
  private sqliteDb: sqlite3.Database | null = null;

  constructor(config: MigrationConfig) {
    this.db = getDatabase();
    this.utils = new DatabaseUtils();
    this.config = {
      batchSize: 1000,
      timeout: 300000, // 5 minutes
      validateData: true,
      dryRun: false,
      skipTables: ['sqlite_sequence', 'schema_migrations'],
      ...config
    };
  }

  // Initialize SQLite connection
  private async initializeSQLite(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sqliteDb = new sqlite3.Database(this.config.sqlitePath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          reject(new Error(`Failed to open SQLite database: ${err.message}`));
        } else {
          console.log('SQLite database opened successfully');
          resolve();
        }
      });
    });
  }

  // Get SQLite table schema
  private async getSQLiteSchema(): Promise<any[]> {
    if (!this.sqliteDb) throw new Error('SQLite database not initialized');

    const all = promisify(this.sqliteDb.all.bind(this.sqliteDb));
    
    const tables = await all(`
      SELECT name, sql 
      FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
    `);

    return tables.filter(table => !this.config.skipTables?.includes(table.name));
  }

  // Get table data from SQLite
  private async getSQLiteTableData(tableName: string, offset: number = 0): Promise<any[]> {
    if (!this.sqliteDb) throw new Error('SQLite database not initialized');

    const all = promisify(this.sqliteDb.all.bind(this.sqliteDb));
    
    const query = `SELECT * FROM "${tableName}" LIMIT ${this.config.batchSize} OFFSET ${offset}`;
    return await all(query);
  }

  // Get table count from SQLite
  private async getSQLiteTableCount(tableName: string): Promise<number> {
    if (!this.sqliteDb) throw new Error('SQLite database not initialized');

    const get = promisify(this.sqliteDb.get.bind(this.sqliteDb));
    
    const result = await get(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return result.count;
  }

  // Map SQLite data types to PostgreSQL
  private mapDataTypes(sqliteType: string): string {
    const typeMap: { [key: string]: string } = {
      'INTEGER': 'BIGINT',
      'TEXT': 'TEXT',
      'REAL': 'DECIMAL',
      'BLOB': 'BYTEA',
      'NULL': 'TEXT'
    };

    return typeMap[sqliteType.toUpperCase()] || 'TEXT';
  }

  // Transform SQLite data for PostgreSQL
  private transformData(data: any[], tableName: string): any[] {
    return data.map(row => {
      const transformed: any = {};
      
      for (const [key, value] of Object.entries(row)) {
        // Handle specific transformations based on table and column
        if (tableName === 'users' && key === 'created_at') {
          // Convert SQLite datetime to PostgreSQL timestamp
          transformed[key] = value ? new Date(value as string) : new Date();
        } else if (typeof value === 'boolean') {
          // Ensure boolean values are properly handled
          transformed[key] = Boolean(value);
        } else if (key.includes('_json') || key.includes('_data')) {
          // Handle JSON columns
          transformed[key] = typeof value === 'string' ? JSON.parse(value) : value;
        } else {
          transformed[key] = value;
        }
      }
      
      return transformed;
    });
  }

  // Create PostgreSQL insert query
  private createInsertQuery(tableName: string, data: any[]): { query: string; values: any[] } {
    if (data.length === 0) {
      throw new Error('No data provided for insert query');
    }

    const columns = Object.keys(data[0]);
    const placeholders = data.map((_, rowIndex) => {
      const rowPlaceholders = columns.map((_, colIndex) => 
        `$${rowIndex * columns.length + colIndex + 1}`
      );
      return `(${rowPlaceholders.join(', ')})`;
    }).join(', ');

    const values = data.flatMap(row => columns.map(col => row[col]));

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;

    return { query, values };
  }

  // Migrate a single table
  private async migrateTable(tableName: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      table: tableName,
      totalRows: 0,
      migratedRows: 0,
      errors: [],
      duration: 0,
      success: false
    };

    try {
      console.log(`Starting migration for table: ${tableName}`);

      // Get total row count
      result.totalRows = await this.getSQLiteTableCount(tableName);
      console.log(`Table ${tableName} has ${result.totalRows} rows`);

      if (result.totalRows === 0) {
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Migrate data in batches
      let offset = 0;
      
      while (offset < result.totalRows) {
        try {
          // Get batch of data from SQLite
          const sqliteData = await this.getSQLiteTableData(tableName, offset);
          
          if (sqliteData.length === 0) break;

          // Transform data for PostgreSQL
          const transformedData = this.transformData(sqliteData, tableName);

          if (!this.config.dryRun) {
            // Insert data into PostgreSQL
            const { query, values } = this.createInsertQuery(tableName, transformedData);
            
            await this.db.query(query, values, {
              timeout: this.config.timeout,
              logQuery: false
            });
          }

          result.migratedRows += sqliteData.length;
          offset += this.config.batchSize!;

          // Progress logging
          const progress = Math.round((result.migratedRows / result.totalRows) * 100);
          console.log(`${tableName}: ${progress}% complete (${result.migratedRows}/${result.totalRows})`);

        } catch (batchError) {
          const errorMsg = `Batch error at offset ${offset}: ${batchError}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
          
          // Continue with next batch on error
          offset += this.config.batchSize!;
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      console.log(`Table ${tableName} migration completed: ${result.migratedRows}/${result.totalRows} rows`);

    } catch (error) {
      result.errors.push(`Table migration failed: ${error}`);
      result.success = false;
      result.duration = Date.now() - startTime;
      console.error(`Table ${tableName} migration failed:`, error);
    }

    return result;
  }

  // Validate migrated data
  private async validateMigration(tableName: string, expectedCount: number): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM ${tableName}`
      );
      
      const actualCount = parseInt(result.rows[0].count);
      const isValid = actualCount === expectedCount;
      
      if (!isValid) {
        console.warn(`Validation failed for ${tableName}: expected ${expectedCount}, got ${actualCount}`);
      }
      
      return isValid;
    } catch (error) {
      console.error(`Validation error for ${tableName}:`, error);
      return false;
    }
  }

  // Run complete migration
  async migrate(): Promise<MigrationStatus> {
    const status: MigrationStatus = {
      totalTables: 0,
      completedTables: 0,
      totalRows: 0,
      migratedRows: 0,
      errors: [],
      startTime: new Date(),
      success: false
    };

    try {
      console.log('Starting SQLite to PostgreSQL migration...');
      
      if (this.config.dryRun) {
        console.log('DRY RUN MODE - No data will be written to PostgreSQL');
      }

      // Initialize SQLite connection
      await this.initializeSQLite();

      // Get SQLite schema
      const tables = await this.getSQLiteSchema();
      status.totalTables = tables.length;

      console.log(`Found ${tables.length} tables to migrate`);

      // Migrate each table
      for (const table of tables) {
        const tableName = table.name;
        
        try {
          const result = await this.migrateTable(tableName);
          
          status.totalRows += result.totalRows;
          status.migratedRows += result.migratedRows;
          status.errors.push(...result.errors);
          
          if (result.success) {
            status.completedTables++;
            
            // Validate migration if enabled
            if (this.config.validateData && !this.config.dryRun) {
              const isValid = await this.validateMigration(tableName, result.totalRows);
              if (!isValid) {
                status.errors.push(`Validation failed for table ${tableName}`);
              }
            }
          }
          
        } catch (tableError) {
          const errorMsg = `Failed to migrate table ${tableName}: ${tableError}`;
          status.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      status.success = status.errors.length === 0 && status.completedTables === status.totalTables;
      status.endTime = new Date();
      status.duration = status.endTime.getTime() - status.startTime.getTime();

      console.log('Migration completed:');
      console.log(`- Tables: ${status.completedTables}/${status.totalTables}`);
      console.log(`- Rows: ${status.migratedRows}/${status.totalRows}`);
      console.log(`- Duration: ${Math.round(status.duration / 1000)}s`);
      console.log(`- Errors: ${status.errors.length}`);

      if (status.errors.length > 0) {
        console.log('Errors encountered:');
        status.errors.forEach(error => console.log(`- ${error}`));
      }

    } catch (error) {
      status.errors.push(`Migration failed: ${error}`);
      status.success = false;
      status.endTime = new Date();
      status.duration = status.endTime.getTime() - status.startTime.getTime();
      console.error('Migration failed:', error);
    } finally {
      // Close SQLite connection
      if (this.sqliteDb) {
        this.sqliteDb.close((err) => {
          if (err) {
            console.error('Error closing SQLite database:', err);
          } else {
            console.log('SQLite database closed');
          }
        });
      }
    }

    return status;
  }

  // Generate migration report
  generateReport(status: MigrationStatus): string {
    const report = `
SQLite to PostgreSQL Migration Report
=====================================

Migration Details:
- Start Time: ${status.startTime.toISOString()}
- End Time: ${status.endTime?.toISOString() || 'N/A'}
- Duration: ${status.duration ? Math.round(status.duration / 1000) : 0} seconds
- Status: ${status.success ? 'SUCCESS' : 'FAILED'}

Statistics:
- Tables Processed: ${status.completedTables}/${status.totalTables}
- Rows Migrated: ${status.migratedRows}/${status.totalRows}
- Success Rate: ${Math.round((status.migratedRows / Math.max(status.totalRows, 1)) * 100)}%

${status.errors.length > 0 ? `
Errors Encountered (${status.errors.length}):
${status.errors.map(error => `- ${error}`).join('\n')}
` : 'No errors encountered.'}

Configuration:
- Batch Size: ${this.config.batchSize}
- Timeout: ${this.config.timeout}ms
- Validate Data: ${this.config.validateData}
- Dry Run: ${this.config.dryRun}
- Skipped Tables: ${this.config.skipTables?.join(', ') || 'None'}
`;

    return report;
  }
}

// Convenience function to run migration
export async function migrateSQLiteToPostgreSQL(
  sqlitePath: string,
  options: Partial<MigrationConfig> = {}
): Promise<MigrationStatus> {
  const migrator = new SQLiteToPostgreSQLMigrator({
    sqlitePath,
    ...options
  });

  return await migrator.migrate();
}

// Generate and save migration scripts
export function generateMigrationScripts(outputDir: string): void {
  const migrationScript = `#!/bin/bash
# SQLite to PostgreSQL Migration Script
# Generated: ${new Date().toISOString()}

set -e

echo "Starting migration from SQLite to PostgreSQL..."

# Check if SQLite file exists
if [ ! -f "$SQLITE_FILE" ]; then
    echo "Error: SQLite file not found: $SQLITE_FILE"
    exit 1
fi

# Check PostgreSQL connection
if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "Error: Cannot connect to PostgreSQL database"
    exit 1
fi

# Run migration
node -e "
const { migrateSQLiteToPostgreSQL } = require('./migration-tools');

async function runMigration() {
    try {
        const result = await migrateSQLiteToPostgreSQL(process.env.SQLITE_FILE, {
            batchSize: parseInt(process.env.BATCH_SIZE || '1000'),
            validateData: process.env.VALIDATE_DATA === 'true',
            dryRun: process.env.DRY_RUN === 'true'
        });
        
        console.log('Migration completed');
        console.log(\`Success: \${result.success}\`);
        console.log(\`Migrated: \${result.migratedRows}/\${result.totalRows} rows\`);
        
        if (!result.success) {
            process.exit(1);
        }
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
"

echo "Migration completed successfully!"
`;

  const rollbackScript = `#!/bin/bash
# PostgreSQL Rollback Script
# Generated: ${new Date().toISOString()}

set -e

echo "Rolling back PostgreSQL migration..."

# Confirm rollback
read -p "Are you sure you want to rollback the migration? This will delete all data. (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Rollback cancelled"
    exit 0
fi

# Drop all tables (except schema_migrations)
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'schema_migrations')
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;
EOF

echo "Rollback completed"
`;

  // Write scripts to files
  const fs = require('fs');
  const path = require('path');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, 'migrate.sh'), migrationScript);
  fs.writeFileSync(path.join(outputDir, 'rollback.sh'), rollbackScript);

  // Make scripts executable
  fs.chmodSync(path.join(outputDir, 'migrate.sh'), '755');
  fs.chmodSync(path.join(outputDir, 'rollback.sh'), '755');

  console.log(`Migration scripts generated in ${outputDir}`);
}

export default SQLiteToPostgreSQLMigrator;