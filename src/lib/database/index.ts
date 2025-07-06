// Main database module - exports all database functionality

// Connection and core functionality
export {
  DatabaseConnection,
  getDatabase,
  query,
  transaction,
  checkDatabaseHealth,
  getConnectionStats,
  initializeDatabase,
  shutdownDatabase,
} from './connection';

// Configuration
export {
  getDatabaseConfig,
  getPoolConfig,
  getConnectionString,
  getCurrentEnvironment,
  getEnvironmentSettings,
  DATABASE_ENVIRONMENTS,
  type DatabaseConfig,
  type DatabaseEnvironment,
} from './config';

// Migration system
export {
  MigrationManager,
  migrationManager,
  migrate,
  rollback,
  reset,
  getStatus,
  type Migration,
  type MigrationStatus,
} from './migrations';

// Database utilities
export { DatabaseUtils } from './utils';

// Seeding functionality
export {
  DatabaseSeeder,
  seedAll,
  seedUsers,
  seedContent,
  seedAssessments,
  seedSampleSessions,
  seedRecommendations,
  clearSeedData,
} from './seed';

// TypeScript models and types
export * from './models';

// Database initialization function for Next.js
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🔄 Initializing database connection...');
    
    // Check database health
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    
    // Check migration status
    const migrationStatus = await getStatus();
    if (migrationStatus.pending.length > 0) {
      console.warn('⚠️  Database has pending migrations. Run "npm run db:migrate" to update schema.');
    }
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

// Graceful shutdown function
export async function shutdownDatabase(): Promise<void> {
  try {
    const db = getDatabase();
    await db.close();
    console.log('🔒 Database connections closed');
  } catch (error) {
    console.error('❌ Error during database shutdown:', error);
    throw error;
  }
}

// Health check for monitoring
export async function healthCheck(): Promise<{
  database: boolean;
  migrations: boolean;
  tables: boolean;
}> {
  try {
    const [dbHealth, utilsHealth, migrationStatus] = await Promise.all([
      checkDatabaseHealth(),
      DatabaseUtils.healthCheck(),
      getStatus(),
    ]);
    
    return {
      database: dbHealth,
      migrations: migrationStatus.pending.length === 0,
      tables: utilsHealth.healthy,
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      database: false,
      migrations: false,
      tables: false,
    };
  }
}

// Quick setup for development
export async function setupDevelopmentDatabase(): Promise<void> {
  console.log('🚀 Setting up development database...');
  
  try {
    // Run migrations
    console.log('⚡ Running migrations...');
    await migrate();
    
    // Check if we need seed data
    const userCount = await query('SELECT COUNT(*) FROM users');
    if (userCount.rows[0].count === '0') {
      console.log('🌱 Seeding development data...');
      await seedAll();
    }
    
    console.log('✅ Development database setup complete!');
  } catch (error) {
    console.error('❌ Development setup failed:', error);
    throw error;
  }
}

// Export default configuration for easy imports
export default {
  initialize: initializeDatabase,
  shutdown: shutdownDatabase,
  healthCheck,
  setupDevelopment: setupDevelopmentDatabase,
};