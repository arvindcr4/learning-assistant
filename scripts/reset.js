#!/usr/bin/env node

const { migrationManager } = require('../src/lib/database/migrations/index.ts');
const { DatabaseSeeder } = require('../src/lib/database/seed.ts');
require('dotenv').config();

async function resetDatabase() {
  console.log('🔄 Resetting database...');
  console.log('⚠️  This will DROP ALL TABLES and recreate them with fresh data!');
  
  try {
    // Reset database (drop all tables)
    console.log('\n🗑️  Dropping all tables...');
    await migrationManager.reset();
    
    // Run migrations to recreate schema
    console.log('\n⚡ Running migrations...');
    await migrationManager.migrate();
    
    // Seed with fresh data
    console.log('\n🌱 Seeding fresh data...');
    await DatabaseSeeder.seedAll();
    
    console.log('\n✅ Database reset and seeding completed successfully!');
    console.log('🎉 Your database is now ready with fresh sample data.');
    
  } catch (error) {
    console.error('\n❌ Database reset failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function resetMigrationsOnly() {
  console.log('🔄 Resetting migrations only...');
  
  try {
    // Reset database (drop all tables)
    console.log('\n🗑️  Dropping all tables...');
    await migrationManager.reset();
    
    // Run migrations to recreate schema
    console.log('\n⚡ Running migrations...');
    await migrationManager.migrate();
    
    console.log('\n✅ Database schema reset completed!');
    console.log('💡 Use "npm run db:seed" to add sample data.');
    
  } catch (error) {
    console.error('\n❌ Migration reset failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'migrations-only':
    resetMigrationsOnly();
    break;
    
  case 'help':
    console.log('🔄 Database Reset Commands:');
    console.log('');
    console.log('  npm run db:reset                - Full reset: drop tables, migrate, and seed');
    console.log('  npm run db:reset migrations-only - Reset schema only (no seed data)');
    console.log('  npm run db:reset help           - Show this help');
    console.log('');
    console.log('⚠️  WARNING: These commands will destroy all existing data!');
    console.log('');
    break;
    
  default:
    // Add a safety check in production
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Database reset is disabled in production!');
      console.log('Use individual migration and seeding commands instead.');
      process.exit(1);
    }
    
    resetDatabase();
}