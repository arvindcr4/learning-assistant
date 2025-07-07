import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { PoolClient } from 'pg';

import { query, transaction } from '../connection';

// Migration metadata
export interface Migration {
  version: string;
  name: string;
  description: string;
  filename: string;
  checksum: string;
  executedAt?: Date;
  executionTime?: number;
}

// Migration status
export interface MigrationStatus {
  pending: Migration[];
  executed: Migration[];
  failed: Migration[];
  currentVersion: string | null;
}

// Migration manager
export class MigrationManager {
  private readonly migrationsPath: string;

  constructor(migrationsPath: string = join(__dirname, 'sql')) {
    this.migrationsPath = migrationsPath;
  }

  // Initialize migration tracking table
  private async initializeMigrationTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        filename VARCHAR(255) NOT NULL,
        checksum VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time INTEGER -- milliseconds
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at 
      ON schema_migrations(executed_at);
    `;

    await query(createTableQuery);
  }

  // Get all migration files
  private getMigrationFiles(): Migration[] {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      return files.map(filename => {
        const fullPath = join(this.migrationsPath, filename);
        const content = readFileSync(fullPath, 'utf8');
        
        // Parse migration metadata from comments
        const versionMatch = filename.match(/^(\d{14})_(.+)\.sql$/);
        if (!versionMatch) {
          throw new Error(`Invalid migration filename format: ${filename}`);
        }

        const [, version, name] = versionMatch;
        const descriptionMatch = content.match(/-- Description: (.+)/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';

        return {
          version,
          name: name.replace(/_/g, ' '),
          description,
          filename,
          checksum: this.calculateChecksum(content),
        };
      });
    } catch (error) {
      console.error('Error reading migration files:', error);
      return [];
    }
  }

  // Calculate checksum for migration content
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Get executed migrations from database
  private async getExecutedMigrations(): Promise<Migration[]> {
    const result = await query<Migration>(`
      SELECT version, name, description, filename, checksum, 
             executed_at as "executedAt", execution_time as "executionTime"
      FROM schema_migrations 
      ORDER BY version ASC
    `);

    return result.rows;
  }

  // Get migration status
  public async getStatus(): Promise<MigrationStatus> {
    await this.initializeMigrationTable();

    const allMigrations = this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();
    const executedVersions = new Set(executedMigrations.map(m => m.version));

    const pending = allMigrations.filter(m => !executedVersions.has(m.version));
    const failed: Migration[] = []; // Could be enhanced to track failed migrations

    // Verify checksums of executed migrations
    for (const executed of executedMigrations) {
      const current = allMigrations.find(m => m.version === executed.version);
      if (current && current.checksum !== executed.checksum) {
        console.warn(`Checksum mismatch for migration ${executed.version}`);
      }
    }

    const currentVersion = executedMigrations.length > 0 
      ? executedMigrations[executedMigrations.length - 1].version 
      : null;

    return {
      pending,
      executed: executedMigrations,
      failed,
      currentVersion,
    };
  }

  // Execute a single migration
  private async executeMigration(migration: Migration, client: PoolClient): Promise<void> {
    const startTime = Date.now();
    const migrationPath = join(this.migrationsPath, migration.filename);
    const sql = readFileSync(migrationPath, 'utf8');

    try {
      // Execute migration SQL
      await client.query(sql);

      // Record migration execution
      await client.query(
        `INSERT INTO schema_migrations 
         (version, name, description, filename, checksum, executed_at, execution_time) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          migration.version,
          migration.name,
          migration.description,
          migration.filename,
          migration.checksum,
          new Date(),
          Date.now() - startTime,
        ]
      );

      console.log(`Migration ${migration.version} executed successfully`);
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  // Run all pending migrations
  public async migrate(): Promise<void> {
    const status = await this.getStatus();
    
    if (status.pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${status.pending.length} pending migrations...`);

    for (const migration of status.pending) {
      await transaction(async (client) => {
        await this.executeMigration(migration, client);
      });
    }

    console.log('All migrations completed successfully');
  }

  // Rollback to a specific version (if rollback files exist)
  public async rollback(targetVersion: string): Promise<void> {
    const status = await this.getStatus();
    const currentVersion = status.currentVersion;

    if (!currentVersion) {
      throw new Error('No migrations have been executed');
    }

    if (targetVersion >= currentVersion) {
      throw new Error('Target version must be lower than current version');
    }

    // Find migrations to rollback
    const migrationsToRollback = status.executed
      .filter(m => m.version > targetVersion)
      .reverse(); // Rollback in reverse order

    console.log(`Rolling back ${migrationsToRollback.length} migrations...`);

    for (const migration of migrationsToRollback) {
      await transaction(async (client) => {
        // Look for rollback file
        const rollbackFile = migration.filename.replace('.sql', '.rollback.sql');
        const rollbackPath = join(this.migrationsPath, rollbackFile);

        try {
          const rollbackSql = readFileSync(rollbackPath, 'utf8');
          await client.query(rollbackSql);
          
          // Remove migration record
          await client.query(
            'DELETE FROM schema_migrations WHERE version = $1',
            [migration.version]
          );

          console.log(`Migration ${migration.version} rolled back successfully`);
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            throw new Error(`Rollback file not found for migration ${migration.version}`);
          }
          throw error;
        }
      });
    }

    console.log('Rollback completed successfully');
  }

  // Reset database (rollback all migrations)
  public async reset(): Promise<void> {
    const status = await this.getStatus();
    
    if (status.executed.length === 0) {
      console.log('No migrations to reset');
      return;
    }

    console.log('Resetting database...');
    
    // Drop all tables (be careful with this!)
    await transaction(async (client) => {
      // Get all user tables
      const tablesResult = await client.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename != 'schema_migrations'
      `);

      // Drop all tables
      for (const row of tablesResult.rows) {
        await client.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
      }

      // Clear migration history
      await client.query('DELETE FROM schema_migrations');
    });

    console.log('Database reset completed');
  }
}

// Export singleton instance
export const migrationManager = new MigrationManager();

// Convenience functions
export const migrate = () => migrationManager.migrate();
export const rollback = (version: string) => migrationManager.rollback(version);
export const reset = () => migrationManager.reset();
export const getStatus = () => migrationManager.getStatus();