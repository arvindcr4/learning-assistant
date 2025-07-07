#!/usr/bin/env node

/**
 * Railway Database Setup Script
 * 
 * This script handles PostgreSQL database setup for Railway deployment
 * including connection testing, schema creation, and initial data seeding.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Console colors for better output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

// Logger utility
const logger = {
  info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  debug: (msg) => console.log(`${colors.magenta}[DEBUG]${colors.reset} ${msg}`)
};

// Railway-specific configuration
const getRailwayConfig = () => {
  const config = {
    // Primary database connection
    database: {
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432'),
      database: process.env.PGDATABASE || process.env.DB_NAME || 'learning_assistant',
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      statement_timeout: 30000,
      query_timeout: 30000,
      application_name: 'learning-assistant-setup'
    },
    // Railway environment detection
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    isRailway: !!process.env.RAILWAY_STATIC_URL,
    projectName: process.env.RAILWAY_PROJECT_NAME || 'learning-assistant',
    serviceName: process.env.RAILWAY_SERVICE_NAME || 'web'
  };

  // SSL configuration for Railway
  if (config.database.ssl) {
    config.database.ssl = {
      rejectUnauthorized: config.environment === 'production'
    };
  }

  return config;
};

// Database connection pool
let pool = null;

const createPool = (config) => {
  if (pool) {
    return pool;
  }

  pool = new Pool(config.database);

  // Handle connection errors
  pool.on('error', (err) => {
    logger.error(`Database pool error: ${err.message}`);
  });

  // Log connections in development
  if (config.environment === 'development') {
    pool.on('connect', (client) => {
      logger.debug('New database connection established');
    });
  }

  return pool;
};

// Test database connection
const testConnection = async (config) => {
  logger.info('Testing database connection...');
  
  try {
    const pool = createPool(config);
    const client = await pool.connect();
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    const { current_time, version } = result.rows[0];
    
    logger.success(`Database connection successful`);
    logger.info(`Connected to: ${version.split(' ')[0]} ${version.split(' ')[1]}`);
    logger.info(`Server time: ${current_time}`);
    
    client.release();
    return true;
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    return false;
  }
};

// Check if database exists
const checkDatabaseExists = async (config) => {
  logger.info('Checking if database exists...');
  
  try {
    const pool = createPool(config);
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1)',
      [config.database.database]
    );
    
    const exists = result.rows[0].exists;
    client.release();
    
    if (exists) {
      logger.success(`Database '${config.database.database}' exists`);
    } else {
      logger.warn(`Database '${config.database.database}' does not exist`);
    }
    
    return exists;
  } catch (error) {
    logger.error(`Error checking database existence: ${error.message}`);
    return false;
  }
};

// Run SQL file
const runSQLFile = async (config, filePath) => {
  if (!fs.existsSync(filePath)) {
    logger.warn(`SQL file not found: ${filePath}`);
    return false;
  }

  logger.info(`Running SQL file: ${path.basename(filePath)}`);
  
  try {
    const pool = createPool(config);
    const client = await pool.connect();
    
    const sql = fs.readFileSync(filePath, 'utf8');
    await client.query(sql);
    
    client.release();
    logger.success(`SQL file executed successfully: ${path.basename(filePath)}`);
    return true;
  } catch (error) {
    logger.error(`Error running SQL file ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
};

// Run database migrations
const runMigrations = async (config) => {
  logger.info('Running database migrations...');
  
  const migrationsDir = path.join(__dirname, '..', 'src', 'lib', 'database', 'migrations', 'sql');
  
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('Migrations directory not found');
    return false;
  }
  
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length === 0) {
    logger.warn('No migration files found');
    return false;
  }
  
  logger.info(`Found ${migrationFiles.length} migration files`);
  
  let success = true;
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const result = await runSQLFile(config, filePath);
    if (!result) {
      success = false;
      break;
    }
  }
  
  return success;
};

// Create database indexes
const createIndexes = async (config) => {
  logger.info('Creating database indexes...');
  
  const indexesFile = path.join(__dirname, '..', 'migrations', '002_add_indexes.sql');
  return await runSQLFile(config, indexesFile);
};

// Seed database with initial data
const seedDatabase = async (config) => {
  if (config.environment === 'production') {
    logger.info('Skipping database seeding in production environment');
    return true;
  }
  
  logger.info('Seeding database with initial data...');
  
  const seedFile = path.join(__dirname, 'dev-seed.sql');
  return await runSQLFile(config, seedFile);
};

// Verify database setup
const verifySetup = async (config) => {
  logger.info('Verifying database setup...');
  
  try {
    const pool = createPool(config);
    const client = await pool.connect();
    
    // Check if main tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    if (tables.length === 0) {
      logger.warn('No tables found in database');
      client.release();
      return false;
    }
    
    logger.success(`Found ${tables.length} tables:`);
    tables.forEach(table => logger.info(`  - ${table}`));
    
    // Check if indexes exist
    const indexesResult = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY indexname
    `);
    
    const indexes = indexesResult.rows.map(row => row.indexname);
    logger.success(`Found ${indexes.length} indexes`);
    
    client.release();
    return true;
  } catch (error) {
    logger.error(`Error verifying database setup: ${error.message}`);
    return false;
  }
};

// Railway-specific optimizations
const optimizeForRailway = async (config) => {
  logger.info('Applying Railway-specific optimizations...');
  
  try {
    const pool = createPool(config);
    const client = await pool.connect();
    
    // Set connection parameters for Railway
    const optimizations = [
      "SET shared_preload_libraries = 'pg_stat_statements'",
      "SET log_statement = 'none'",
      "SET log_min_duration_statement = 1000",
      "SET checkpoint_completion_target = 0.9",
      "SET wal_buffers = '16MB'",
      "SET default_statistics_target = 100"
    ];
    
    for (const optimization of optimizations) {
      try {
        await client.query(optimization);
        logger.debug(`Applied: ${optimization}`);
      } catch (error) {
        logger.warn(`Skipped optimization: ${optimization} - ${error.message}`);
      }
    }
    
    client.release();
    logger.success('Railway optimizations applied');
    return true;
  } catch (error) {
    logger.error(`Error applying Railway optimizations: ${error.message}`);
    return false;
  }
};

// Main setup function
const setupDatabase = async () => {
  logger.info('Starting Railway database setup...');
  
  const config = getRailwayConfig();
  
  // Log environment information
  logger.info(`Environment: ${config.environment}`);
  logger.info(`Railway deployment: ${config.isRailway ? 'Yes' : 'No'}`);
  logger.info(`Database host: ${config.database.host}`);
  logger.info(`Database name: ${config.database.database}`);
  
  try {
    // Step 1: Test connection
    const connected = await testConnection(config);
    if (!connected) {
      logger.error('Database connection failed. Please check your configuration.');
      process.exit(1);
    }
    
    // Step 2: Check database existence
    const exists = await checkDatabaseExists(config);
    if (!exists) {
      logger.error('Database does not exist. Please create it first.');
      process.exit(1);
    }
    
    // Step 3: Run migrations
    const migrated = await runMigrations(config);
    if (!migrated) {
      logger.error('Database migrations failed');
      process.exit(1);
    }
    
    // Step 4: Create indexes
    const indexed = await createIndexes(config);
    if (!indexed) {
      logger.warn('Index creation failed or skipped');
    }
    
    // Step 5: Seed database (non-production only)
    const seeded = await seedDatabase(config);
    if (!seeded) {
      logger.warn('Database seeding failed or skipped');
    }
    
    // Step 6: Apply Railway optimizations
    const optimized = await optimizeForRailway(config);
    if (!optimized) {
      logger.warn('Railway optimizations failed or skipped');
    }
    
    // Step 7: Verify setup
    const verified = await verifySetup(config);
    if (!verified) {
      logger.error('Database setup verification failed');
      process.exit(1);
    }
    
    logger.success('Database setup completed successfully!');
    
  } catch (error) {
    logger.error(`Setup failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Close database connection
    if (pool) {
      await pool.end();
    }
  }
};

// CLI interface
const main = async () => {
  const command = process.argv[2];
  
  switch (command) {
    case 'setup':
      await setupDatabase();
      break;
    case 'test':
      const config = getRailwayConfig();
      await testConnection(config);
      break;
    case 'verify':
      const verifyConfig = getRailwayConfig();
      await verifySetup(verifyConfig);
      break;
    case 'migrate':
      const migrateConfig = getRailwayConfig();
      await runMigrations(migrateConfig);
      break;
    case 'seed':
      const seedConfig = getRailwayConfig();
      await seedDatabase(seedConfig);
      break;
    default:
      logger.info('Railway Database Setup Script');
      logger.info('Usage: node railway-db-setup.js <command>');
      logger.info('');
      logger.info('Commands:');
      logger.info('  setup   - Full database setup (migrations, indexes, seeding)');
      logger.info('  test    - Test database connection');
      logger.info('  verify  - Verify database setup');
      logger.info('  migrate - Run database migrations only');
      logger.info('  seed    - Seed database with initial data');
      logger.info('');
      logger.info('Environment variables:');
      logger.info('  DATABASE_URL or PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD');
      logger.info('  RAILWAY_ENVIRONMENT (optional)');
      logger.info('  NODE_ENV (optional)');
      break;
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  setupDatabase,
  testConnection,
  runMigrations,
  seedDatabase,
  verifySetup,
  getRailwayConfig
};