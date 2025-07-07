#!/usr/bin/env node
/**
 * Email Service Test Script
 * 
 * This script tests the email service functionality without requiring a full server setup.
 * It's useful for development and debugging.
 * 
 * Usage:
 *   node scripts/test-email.js [test-type] [options]
 * 
 * Examples:
 *   node scripts/test-email.js config
 *   node scripts/test-email.js welcome test@example.com "John Doe"
 *   node scripts/test-email.js progress test@example.com "John Doe"
 */

const fs = require('fs');
const path = require('path');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('Error: Please run this script from the project root directory');
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

// Mock Next.js environment for testing
process.env.NEXT_RUNTIME = 'nodejs';

async function testEmailService() {
  try {
    // Import after environment setup
    const { 
      testEmailConfiguration, 
      sendWelcomeEmail, 
      sendProgressUpdateEmail, 
      sendStudyReminderEmail, 
      sendSystemAlertEmail 
    } = require('../src/lib/email');

    const testType = process.argv[2] || 'config';
    const userEmail = process.argv[3] || 'test@example.com';
    const userName = process.argv[4] || 'Test User';

    console.log(`🧪 Testing email service: ${testType}`);
    console.log(`📧 Email: ${userEmail}`);
    console.log(`👤 Name: ${userName}`);
    console.log('---');

    let result;

    switch (testType) {
      case 'config':
        console.log('Testing email configuration...');
        result = await testEmailConfiguration();
        break;

      case 'welcome':
        console.log('Testing welcome email...');
        const activationLink = process.argv[5] || 'https://example.com/activate';
        result = await sendWelcomeEmail(userEmail, userName, activationLink);
        break;

      case 'progress':
        console.log('Testing progress update email...');
        const progressData = {
          completedModules: 5,
          totalModules: 10,
          currentStreak: 7,
          timeSpent: 180, // 3 hours in minutes
          achievements: ['First Module Complete', 'Week Streak', 'Quiz Master'],
          nextGoals: ['Complete Module 6', 'Maintain 10-day streak', 'Take advanced quiz'],
        };
        result = await sendProgressUpdateEmail(userEmail, userName, progressData);
        break;

      case 'reminder':
        console.log('Testing study reminder email...');
        const reminderData = {
          nextModule: 'Introduction to React Hooks',
          suggestedDuration: 30,
          streakAtRisk: Math.random() > 0.5, // Random for testing
          motivationalMessage: 'You\'re doing great! Keep up the momentum and continue your learning journey.',
        };
        result = await sendStudyReminderEmail(userEmail, userName, reminderData);
        break;

      case 'alert':
        console.log('Testing system alert email...');
        const alertData = {
          type: 'maintenance',
          title: 'Scheduled Maintenance - Learning Assistant',
          description: 'We will be performing scheduled maintenance on our servers this Sunday from 2:00 AM to 4:00 AM PST. During this time, the service may be temporarily unavailable. We apologize for any inconvenience.',
          actionRequired: false,
        };
        result = await sendSystemAlertEmail(userEmail, userName, alertData);
        break;

      default:
        console.error('❌ Invalid test type. Available types: config, welcome, progress, reminder, alert');
        process.exit(1);
    }

    console.log('📊 Test Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('✅ Email test completed successfully!');
      if (result.id) {
        console.log(`📨 Email ID: ${result.id}`);
      }
    } else {
      console.log('❌ Email test failed:');
      console.log(`🔴 Error: ${result.error}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('🚨 Test execution error:', error);
    
    if (error.message.includes('RESEND_API_KEY')) {
      console.log('\n💡 Tip: Make sure to set your RESEND_API_KEY environment variable');
      console.log('You can create a .env.local file with:');
      console.log('RESEND_API_KEY=your_api_key_here');
      console.log('RESEND_FROM_EMAIL=your_email@example.com');
      console.log('RESEND_FROM_NAME=Your Name');
    }
    
    process.exit(1);
  }
}

// Show usage if no arguments provided
if (process.argv.length < 3) {
  console.log('📧 Learning Assistant Email Service Test');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-email.js <test-type> [email] [name]');
  console.log('');
  console.log('Test Types:');
  console.log('  config   - Test email configuration');
  console.log('  welcome  - Test welcome email');
  console.log('  progress - Test progress update email');
  console.log('  reminder - Test study reminder email');
  console.log('  alert    - Test system alert email');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/test-email.js config');
  console.log('  node scripts/test-email.js welcome test@example.com "John Doe"');
  console.log('  node scripts/test-email.js progress user@example.com "Jane Smith"');
  console.log('');
  console.log('Environment Variables Required:');
  console.log('  RESEND_API_KEY      - Your Resend API key');
  console.log('  RESEND_FROM_EMAIL   - Your from email address');
  console.log('  RESEND_FROM_NAME    - Your from name');
  console.log('');
  process.exit(0);
}

// Run the test
testEmailService();