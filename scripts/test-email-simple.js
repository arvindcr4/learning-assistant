#!/usr/bin/env node
/**
 * Simple Email Service Test
 * 
 * This script tests the Resend email service directly without Next.js dependencies.
 */

require('dotenv').config();

async function testResendDirectly() {
  try {
    console.log('🧪 Testing Resend Email Service');
    console.log('---');
    
    // Check environment variables
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@learningassistant.com';
    const fromName = process.env.RESEND_FROM_NAME || 'Learning Assistant';
    const testEmail = process.env.TEST_EMAIL || 'test@example.com';
    
    if (!apiKey) {
      console.error('❌ RESEND_API_KEY environment variable is required');
      console.log('\n💡 Set up your environment variables:');
      console.log('RESEND_API_KEY=your_resend_api_key');
      console.log('RESEND_FROM_EMAIL=your_verified_email@example.com');
      console.log('RESEND_FROM_NAME=Your Name');
      console.log('TEST_EMAIL=recipient@example.com');
      process.exit(1);
    }
    
    console.log(`📧 From Email: ${fromName} <${fromEmail}>`);
    console.log(`📧 Test Email: ${testEmail}`);
    console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
    console.log('---');
    
    // Import Resend
    const { Resend } = require('resend');
    const resend = new Resend(apiKey);
    
    console.log('📬 Sending test email...');
    
    const emailData = {
      from: `${fromName} <${fromEmail}>`,
      to: testEmail,
      subject: 'Learning Assistant Email Service Test ✅',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Email Service Test ✅</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Learning Assistant Email Service</p>
          </div>
          
          <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h2 style="color: #333; margin-top: 0;">Test Successful! 🎉</h2>
            
            <p style="color: #666; line-height: 1.6;">
              This is a test email from the Learning Assistant email service using Resend. 
              If you're seeing this, the email configuration is working correctly!
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Configuration Details:</h3>
              <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li>From: ${fromName} &lt;${fromEmail}&gt;</li>
                <li>Service: Resend</li>
                <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
                <li>Timestamp: ${new Date().toISOString()}</li>
              </ul>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                This is an automated test email from Learning Assistant.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Email Service Test - Learning Assistant

This is a test email from the Learning Assistant email service using Resend.
If you're seeing this, the email configuration is working correctly!

Configuration Details:
- From: ${fromName} <${fromEmail}>
- Service: Resend
- Environment: ${process.env.NODE_ENV || 'development'}
- Timestamp: ${new Date().toISOString()}

This is an automated test email from Learning Assistant.`,
    };
    
    const result = await resend.emails.send(emailData);
    
    if (result.error) {
      console.error('❌ Email sending failed:');
      console.error(result.error);
      process.exit(1);
    }
    
    console.log('✅ Email sent successfully!');
    console.log(`📨 Email ID: ${result.data.id}`);
    console.log(`📧 Sent to: ${testEmail}`);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Check your email inbox for the test message');
    console.log('2. Check spam/junk folder if not found in inbox');
    console.log('3. If using a custom domain, ensure DNS records are configured');
    console.log('4. Set up domain verification in Resend dashboard if needed');
    
  } catch (error) {
    console.error('🚨 Test execution error:', error);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 API Key Issues:');
      console.log('- Ensure your Resend API key is correct');
      console.log('- Check that the API key has the right permissions');
      console.log('- Verify your Resend account is active');
    }
    
    if (error.message.includes('domain')) {
      console.log('\n💡 Domain Issues:');
      console.log('- Verify your sending domain in Resend dashboard');
      console.log('- Configure SPF, DKIM, and DMARC records');
      console.log('- Use a verified domain for production');
    }
    
    process.exit(1);
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('📧 Learning Assistant Email Service Test');
  console.log('');
  console.log('This script tests the Resend email service configuration.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/test-email-simple.js');
  console.log('');
  console.log('Environment Variables Required:');
  console.log('  RESEND_API_KEY      - Your Resend API key (required)');
  console.log('  RESEND_FROM_EMAIL   - Your verified sending email');
  console.log('  RESEND_FROM_NAME    - Your sending name');
  console.log('  TEST_EMAIL          - Recipient email for testing');
  console.log('');
  console.log('Examples:');
  console.log('  RESEND_API_KEY=re_xxx TEST_EMAIL=you@example.com node scripts/test-email-simple.js');
  console.log('');
  process.exit(0);
}

// Run the test
testResendDirectly();