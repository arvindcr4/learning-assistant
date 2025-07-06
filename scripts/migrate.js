#!/usr/bin/env node

const { migrationManager } = require('../src/lib/database/migrations/index.ts');
require('dotenv').config();

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  try {
    const status = await migrationManager.getStatus();
    
    console.log('\n📊 Migration Status:');
    console.log(`Current version: ${status.currentVersion || 'None'}`);
    console.log(`Pending migrations: ${status.pending.length}`);
    console.log(`Executed migrations: ${status.executed.length}`);
    
    if (status.pending.length === 0) {
      console.log('\n✅ Database is up to date!');
      return;
    }
    
    console.log('\n📋 Pending migrations:');
    status.pending.forEach(migration => {
      console.log(`  - ${migration.version}: ${migration.name}`);
    });
    
    console.log('\n⚡ Running migrations...');
    await migrationManager.migrate();
    
    const newStatus = await migrationManager.getStatus();
    console.log(`\n✅ Migrations completed! Current version: ${newStatus.currentVersion}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'status':
    migrationManager.getStatus().then(status => {
      console.log('📊 Migration Status:');
      console.log(`Current version: ${status.currentVersion || 'None'}`);
      console.log(`Pending migrations: ${status.pending.length}`);
      console.log(`Executed migrations: ${status.executed.length}`);
      
      if (status.executed.length > 0) {
        console.log('\n✅ Executed migrations:');
        status.executed.forEach(migration => {
          console.log(`  - ${migration.version}: ${migration.name} (${migration.executedAt})`);
        });
      }
      
      if (status.pending.length > 0) {
        console.log('\n⏳ Pending migrations:');
        status.pending.forEach(migration => {
          console.log(`  - ${migration.version}: ${migration.name}`);
        });
      }
    }).catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
    break;
    
  case 'rollback':
    const targetVersion = args[1];
    if (!targetVersion) {
      console.error('❌ Please specify target version for rollback');
      console.log('Usage: npm run db:rollback <version>');
      process.exit(1);
    }
    
    migrationManager.rollback(targetVersion).then(() => {
      console.log(`✅ Rolled back to version ${targetVersion}`);
    }).catch(error => {
      console.error('❌ Rollback failed:', error.message);
      process.exit(1);
    });
    break;
    
  case 'reset':
    console.log('⚠️  This will DROP ALL TABLES and reset the database!');
    console.log('Are you sure? This action cannot be undone.');
    
    // In a production environment, you'd want to add a confirmation prompt
    migrationManager.reset().then(() => {
      console.log('✅ Database reset completed');
    }).catch(error => {
      console.error('❌ Reset failed:', error.message);
      process.exit(1);
    });
    break;
    
  default:
    runMigrations();
}