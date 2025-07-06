#!/usr/bin/env node

const { getDatabase, checkDatabaseHealth, getConnectionStats } = require('../src/lib/database/connection.ts');
const { migrationManager } = require('../src/lib/database/migrations/index.ts');
const { DatabaseUtils } = require('../src/lib/database/utils.ts');
require('dotenv').config();

async function showDatabaseStatus() {
  console.log('📊 Database Status Report');
  console.log('========================\n');
  
  try {
    // 1. Connection Health
    console.log('🔌 Connection Health:');
    const isHealthy = await checkDatabaseHealth();
    console.log(`   Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    const connectionStats = getConnectionStats();
    console.log(`   Total Connections: ${connectionStats.totalConnections}`);
    console.log(`   Idle Connections: ${connectionStats.idleConnections}`);
    console.log(`   Waiting Clients: ${connectionStats.waitingClients}`);
    console.log(`   Max Connections: ${connectionStats.maxConnections}`);
    
    // 2. Migration Status
    console.log('\n📋 Migration Status:');
    const migrationStatus = await migrationManager.getStatus();
    console.log(`   Current Version: ${migrationStatus.currentVersion || 'None'}`);
    console.log(`   Executed Migrations: ${migrationStatus.executed.length}`);
    console.log(`   Pending Migrations: ${migrationStatus.pending.length}`);
    
    if (migrationStatus.pending.length > 0) {
      console.log('   ⚠️  Pending migrations found:');
      migrationStatus.pending.forEach(migration => {
        console.log(`      - ${migration.version}: ${migration.name}`);
      });
    }
    
    // 3. Database Health Check
    console.log('\n🏥 Database Health Check:');
    const healthCheck = await DatabaseUtils.healthCheck();
    console.log(`   Overall Health: ${healthCheck.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    Object.entries(healthCheck.checks).forEach(([check, status]) => {
      console.log(`   ${check}: ${status ? '✅' : '❌'}`);
    });
    
    // 4. Table Statistics
    console.log('\n📈 Table Statistics:');
    
    const tables = [
      'users',
      'learning_profiles',
      'adaptive_content',
      'content_variants',
      'learning_sessions',
      'adaptive_assessments',
      'assessment_attempts',
      'recommendations'
    ];
    
    for (const table of tables) {
      try {
        const result = await getDatabase().query(`SELECT COUNT(*) FROM ${table}`);
        const count = result.rows[0].count;
        console.log(`   ${table}: ${count} records`);
      } catch (error) {
        console.log(`   ${table}: ❌ Error (${error.message})`);
      }
    }
    
    // 5. Recent Activity
    console.log('\n⏰ Recent Activity (Last 7 Days):');
    
    try {
      const recentSessions = await getDatabase().query(`
        SELECT COUNT(*) as session_count, 
               COUNT(DISTINCT user_id) as active_users
        FROM learning_sessions 
        WHERE start_time >= CURRENT_DATE - INTERVAL '7 days'
      `);
      
      const sessionStats = recentSessions.rows[0];
      console.log(`   Learning Sessions: ${sessionStats.session_count}`);
      console.log(`   Active Users: ${sessionStats.active_users}`);
      
      const recentAssessments = await getDatabase().query(`
        SELECT COUNT(*) as attempt_count,
               COUNT(CASE WHEN passed THEN 1 END) as passed_count
        FROM assessment_attempts 
        WHERE started_at >= CURRENT_DATE - INTERVAL '7 days'
      `);
      
      const assessmentStats = recentAssessments.rows[0];
      console.log(`   Assessment Attempts: ${assessmentStats.attempt_count}`);
      console.log(`   Passed Assessments: ${assessmentStats.passed_count}`);
      
    } catch (error) {
      console.log('   ❌ Could not retrieve activity stats');
    }
    
    // 6. System Configuration
    console.log('\n⚙️  System Configuration:');
    
    try {
      const configs = await getDatabase().query(`
        SELECT config_key, description 
        FROM system_config 
        ORDER BY config_key
      `);
      
      if (configs.rows.length > 0) {
        configs.rows.forEach(config => {
          console.log(`   ${config.config_key}: ${config.description || 'No description'}`);
        });
      } else {
        console.log('   ⚠️  No system configuration found');
      }
      
    } catch (error) {
      console.log('   ❌ Could not retrieve system configuration');
    }
    
    // 7. Performance Metrics
    console.log('\n⚡ Performance Metrics:');
    
    try {
      const avgSessionDuration = await getDatabase().query(`
        SELECT AVG(duration) as avg_duration
        FROM learning_sessions 
        WHERE completed = true AND start_time >= CURRENT_DATE - INTERVAL '30 days'
      `);
      
      const avgDuration = avgSessionDuration.rows[0]?.avg_duration;
      if (avgDuration) {
        console.log(`   Average Session Duration: ${Math.round(avgDuration)} minutes`);
      }
      
      const avgScore = await getDatabase().query(`
        SELECT AVG(CASE WHEN total_questions > 0 THEN correct_answers::DECIMAL / total_questions * 100 ELSE 0 END) as avg_score
        FROM learning_sessions 
        WHERE total_questions > 0 AND start_time >= CURRENT_DATE - INTERVAL '30 days'
      `);
      
      const score = avgScore.rows[0]?.avg_score;
      if (score) {
        console.log(`   Average Score: ${Math.round(score)}%`);
      }
      
    } catch (error) {
      console.log('   ❌ Could not retrieve performance metrics');
    }
    
    console.log('\n✅ Status report completed!');
    
  } catch (error) {
    console.error('\n❌ Status check failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'migrations':
    migrationManager.getStatus().then(status => {
      console.log('📋 Migration Status:');
      console.log(`Current version: ${status.currentVersion || 'None'}`);
      console.log(`Executed migrations: ${status.executed.length}`);
      console.log(`Pending migrations: ${status.pending.length}`);
      
      if (status.executed.length > 0) {
        console.log('\n✅ Executed migrations:');
        status.executed.forEach(migration => {
          console.log(`  - ${migration.version}: ${migration.name}`);
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
    
  case 'health':
    Promise.all([
      checkDatabaseHealth(),
      DatabaseUtils.healthCheck()
    ]).then(([connectionHealth, dbHealth]) => {
      console.log('🏥 Database Health Check:');
      console.log(`Connection Health: ${connectionHealth ? '✅' : '❌'}`);
      console.log(`Database Health: ${dbHealth.healthy ? '✅' : '❌'}`);
      
      Object.entries(dbHealth.checks).forEach(([check, status]) => {
        console.log(`${check}: ${status ? '✅' : '❌'}`);
      });
    }).catch(error => {
      console.error('❌ Health check failed:', error.message);
      process.exit(1);
    });
    break;
    
  case 'help':
    console.log('📊 Database Status Commands:');
    console.log('');
    console.log('  npm run db:status            - Full status report');
    console.log('  npm run db:status migrations - Migration status only');
    console.log('  npm run db:status health     - Health check only');
    console.log('  npm run db:status help       - Show this help');
    console.log('');
    break;
    
  default:
    showDatabaseStatus();
}