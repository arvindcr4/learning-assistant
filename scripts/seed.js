#!/usr/bin/env node

const { DatabaseSeeder } = require('../src/lib/database/seed.ts');
require('dotenv').config();

async function runSeeding() {
  console.log('🌱 Starting database seeding...');
  
  try {
    await DatabaseSeeder.seedAll();
    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function clearData() {
  console.log('🧹 Clearing existing seed data...');
  
  try {
    await DatabaseSeeder.clearSeedData();
    console.log('\n✅ Seed data cleared successfully!');
  } catch (error) {
    console.error('\n❌ Clearing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function seedSpecific(type) {
  console.log(`🌱 Seeding ${type}...`);
  
  try {
    switch (type) {
      case 'users':
        await DatabaseSeeder.seedUsers();
        break;
      case 'content':
        await DatabaseSeeder.seedContent();
        break;
      case 'assessments':
        await DatabaseSeeder.seedAssessments();
        break;
      case 'sessions':
        await DatabaseSeeder.seedSampleSessions();
        break;
      case 'recommendations':
        await DatabaseSeeder.seedRecommendations();
        break;
      default:
        console.error(`❌ Unknown seed type: ${type}`);
        console.log('Available types: users, content, assessments, sessions, recommendations');
        process.exit(1);
    }
    
    console.log(`\n✅ ${type} seeding completed!`);
  } catch (error) {
    console.error(`\n❌ ${type} seeding failed:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'clear':
    clearData();
    break;
    
  case 'users':
  case 'content':
  case 'assessments':
  case 'sessions':
  case 'recommendations':
    seedSpecific(command);
    break;
    
  case 'help':
    console.log('🌱 Database Seeding Commands:');
    console.log('');
    console.log('  npm run db:seed              - Seed all data');
    console.log('  npm run db:seed clear        - Clear all seed data');
    console.log('  npm run db:seed users        - Seed only users');
    console.log('  npm run db:seed content      - Seed only content');
    console.log('  npm run db:seed assessments  - Seed only assessments');
    console.log('  npm run db:seed sessions     - Seed only sessions');
    console.log('  npm run db:seed recommendations - Seed only recommendations');
    console.log('  npm run db:seed help         - Show this help');
    console.log('');
    break;
    
  default:
    runSeeding();
}