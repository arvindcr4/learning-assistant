# Learning Assistant Email Service Guide

This guide covers the setup, configuration, and usage of the Resend email service integration for the Learning Assistant application.

## Table of Contents

- [Overview](#overview)
- [Setup and Configuration](#setup-and-configuration)
- [Email Templates](#email-templates)
- [Usage Examples](#usage-examples)
- [Testing](#testing)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Domain Authentication](#domain-authentication)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Learning Assistant uses [Resend](https://resend.com) as its email service provider. The email service supports:

- **Welcome emails** for new user registration
- **Progress updates** with learning analytics
- **Study reminders** to maintain learning streaks
- **System alerts** for maintenance and important notifications
- **Rate limiting** to prevent abuse
- **Template validation** for email content
- **Integration** with the notification system

### Key Features

- ✅ HTML and text email templates
- ✅ Rate limiting (10 emails per minute per recipient)
- ✅ Email validation and sanitization
- ✅ Error handling and logging
- ✅ Integration with notification context
- ✅ Test utilities and API endpoints
- ✅ Environment-based configuration

## Setup and Configuration

### 1. Environment Variables

Create a `.env.local` file with the following variables:

```env
# Required: Resend API Key
RESEND_API_KEY=re_your_api_key_here

# Required: Verified sending email address
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional: Sender name (defaults to "Learning Assistant")
RESEND_FROM_NAME=Learning Assistant

# Optional: Reply-to email address
RESEND_REPLY_TO=support@yourdomain.com

# Optional: Test email for development
TEST_EMAIL=your-test-email@example.com

# Optional: Enable email service (defaults to production only)
ENABLE_EMAIL=true
```

### 2. Resend Account Setup

1. **Create Account**: Sign up at [resend.com](https://resend.com)
2. **Get API Key**: Generate an API key in your Resend dashboard
3. **Verify Domain**: Add and verify your sending domain (recommended for production)
4. **Configure DNS**: Set up SPF, DKIM, and DMARC records for better deliverability

### 3. Domain Verification (Recommended)

For production use, verify your domain in Resend:

#### DNS Records to Add:

```dns
# SPF Record (TXT)
v=spf1 include:_spf.resend.com ~all

# DKIM Record (TXT)
# Add the DKIM record provided by Resend

# DMARC Record (TXT)
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

## Email Templates

The service includes four main email template types:

### 1. Welcome Email

Sent when users register for the platform.

**Usage:**
```typescript
import { sendWelcomeEmail } from '@/lib/email';

const result = await sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'https://yourapp.com/activate?token=...' // optional activation link
);
```

### 2. Progress Update Email

Sent periodically to update users on their learning progress.

**Usage:**
```typescript
import { sendProgressUpdateEmail } from '@/lib/email';

const progressData = {
  completedModules: 5,
  totalModules: 10,
  currentStreak: 7,
  timeSpent: 180, // minutes
  achievements: ['First Module Complete', 'Week Streak'],
  nextGoals: ['Complete Module 6', 'Maintain Streak']
};

const result = await sendProgressUpdateEmail(
  'user@example.com',
  'John Doe',
  progressData
);
```

### 3. Study Reminder Email

Sent to encourage users to continue their learning journey.

**Usage:**
```typescript
import { sendStudyReminderEmail } from '@/lib/email';

const reminderData = {
  nextModule: 'Introduction to React',
  suggestedDuration: 30,
  streakAtRisk: false,
  motivationalMessage: 'Keep up the great work!'
};

const result = await sendStudyReminderEmail(
  'user@example.com',
  'John Doe',
  reminderData
);
```

### 4. System Alert Email

Sent for maintenance notifications and important system updates.

**Usage:**
```typescript
import { sendSystemAlertEmail } from '@/lib/email';

const alertData = {
  type: 'maintenance',
  title: 'Scheduled Maintenance',
  description: 'We will be performing maintenance...',
  actionRequired: false,
  actionUrl: 'https://yourapp.com/status', // optional
  actionText: 'Check Status' // optional
};

const result = await sendSystemAlertEmail(
  'user@example.com',
  'John Doe',
  alertData
);
```

## Usage Examples

### Basic Email Sending

```typescript
import { sendEmail } from '@/lib/email';

const template = {
  to: 'user@example.com',
  subject: 'Custom Email',
  html: '<h1>Hello World!</h1>',
  text: 'Hello World!',
  tags: [
    { name: 'type', value: 'custom' },
    { name: 'user_id', value: 'user123' }
  ]
};

const result = await sendEmail(template);

if (result.success) {
  console.log('Email sent:', result.id);
} else {
  console.error('Email failed:', result.error);
}
```

### Using with Notification Context

```typescript
import { useNotifications } from '@/contexts/NotificationContext';

function MyComponent() {
  const { sendWelcomeNotification } = useNotifications();
  
  const handleUserRegistration = async (email: string, name: string) => {
    // This will send email and show in-app notification
    await sendWelcomeNotification(email, name);
  };
  
  return (
    <button onClick={() => handleUserRegistration('user@example.com', 'John')}>
      Send Welcome
    </button>
  );
}
```

### Template Validation

```typescript
import { validateEmailTemplate } from '@/lib/email';

const template = {
  to: 'invalid-email', // This will fail validation
  subject: '',         // This will fail validation
  html: '<p>Test</p>'
};

const validation = validateEmailTemplate(template);

if (!validation.valid) {
  console.error('Template errors:', validation.errors);
  // Output: ['to: Invalid email', 'subject: String must contain at least 1 character(s)']
}
```

## Testing

### 1. Simple Test Script

Test the email service directly:

```bash
# Test email configuration
node scripts/test-email-simple.js

# With environment variables inline
RESEND_API_KEY=re_xxx TEST_EMAIL=you@example.com node scripts/test-email-simple.js
```

### 2. API Endpoint Testing

Start the development server and test via API:

```bash
npm run dev
```

Test configuration:
```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"type": "config"}'
```

Test welcome email:
```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "userEmail": "test@example.com",
    "userName": "Test User",
    "activationLink": "https://example.com/activate"
  }'
```

### 3. Email Template Testing

The API endpoint provides examples for all email types:

```bash
# Get API documentation
curl http://localhost:3000/api/email/test
```

## Rate Limiting

The email service includes built-in rate limiting:

- **Per Recipient**: 10 emails per minute
- **Global**: Configurable in `src/lib/config.ts`
- **Cleanup**: Automatic cleanup of expired rate limit entries

### Customizing Rate Limits

Edit `src/lib/email.ts`:

```typescript
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_EMAILS = 10;    // 10 emails per minute
```

## Error Handling

The email service provides comprehensive error handling:

### Error Types

1. **Configuration Errors**: Invalid API key or settings
2. **Validation Errors**: Invalid email templates
3. **Rate Limiting**: Too many emails sent
4. **Service Errors**: Resend API issues

### Error Response Format

```typescript
interface EmailSendResult {
  success: boolean;
  id?: string;        // Email ID if successful
  message?: string;   // Success message
  error?: string;     // Error message if failed
}
```

### Logging

All email operations are logged using the application logger:

```typescript
import { logger } from '@/lib/logger';

// Success logs
logger.info('Email sent successfully:', { id, to, subject });

// Error logs
logger.error('Email service error:', error);
```

## Domain Authentication

For production deployment, configure domain authentication:

### 1. Add Domain in Resend Dashboard

1. Go to your Resend dashboard
2. Navigate to "Domains"
3. Click "Add Domain"
4. Enter your domain (e.g., `yourdomain.com`)

### 2. Configure DNS Records

Add the provided DNS records to your domain:

```dns
# Example records (replace with your actual values)
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

Type: CNAME
Name: re._domainkey
Value: re._domainkey.resend.com

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

### 3. Verify Domain

After adding DNS records:
1. Wait for DNS propagation (up to 24 hours)
2. Click "Verify" in Resend dashboard
3. Update `RESEND_FROM_EMAIL` to use your verified domain

## Best Practices

### 1. Email Content

- **Subject Lines**: Keep concise and descriptive
- **HTML Templates**: Include fallback text versions
- **Responsive Design**: Ensure emails work on mobile devices
- **Alt Text**: Include alt text for images
- **Clear CTAs**: Make action buttons obvious

### 2. Sending Practices

- **Rate Limiting**: Respect rate limits and recipient preferences
- **Opt-out**: Include unsubscribe links in marketing emails
- **Timing**: Send emails at appropriate times
- **Personalization**: Use recipient names and relevant content

### 3. Monitoring

- **Logs**: Monitor email logs for errors
- **Deliverability**: Track bounce and complaint rates
- **Analytics**: Monitor open and click rates
- **Testing**: Regularly test email functionality

### 4. Security

- **Environment Variables**: Keep API keys secure
- **Validation**: Validate all email content
- **Sanitization**: Sanitize user input in emails
- **Authentication**: Use verified domains

## Troubleshooting

### Common Issues

#### 1. "API key is invalid"

**Solutions:**
- Verify API key in Resend dashboard
- Check environment variable spelling
- Ensure API key has correct permissions

#### 2. "Domain not verified"

**Solutions:**
- Verify domain in Resend dashboard
- Check DNS record configuration
- Wait for DNS propagation
- Use resend.dev domain for testing

#### 3. "Rate limit exceeded"

**Solutions:**
- Reduce email sending frequency
- Implement user-based rate limiting
- Use email queuing for batch operations

#### 4. "Email not delivered"

**Solutions:**
- Check spam/junk folders
- Verify recipient email address
- Check domain reputation
- Review email content for spam triggers

#### 5. "Template validation failed"

**Solutions:**
- Check email template structure
- Ensure required fields are present
- Validate email addresses
- Review error messages for details

### Debug Mode

Enable detailed logging by setting:

```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Test Email Configuration

Use the test script to verify setup:

```bash
# Check configuration
node scripts/test-email-simple.js

# Send test email
RESEND_API_KEY=your_key TEST_EMAIL=your_email node scripts/test-email-simple.js
```

## Support and Resources

- **Resend Documentation**: [resend.com/docs](https://resend.com/docs)
- **Email Deliverability Guide**: [resend.com/docs/send/with-domains](https://resend.com/docs/send/with-domains)
- **DNS Configuration**: [resend.com/docs/send/with-domains#dns-records](https://resend.com/docs/send/with-domains#dns-records)
- **Rate Limits**: [resend.com/docs/send/rate-limits](https://resend.com/docs/send/rate-limits)

## Changelog

### v1.0.0 (Current)

- ✅ Initial email service implementation
- ✅ Resend integration
- ✅ Four email template types
- ✅ Rate limiting
- ✅ Error handling and logging
- ✅ Test utilities
- ✅ Notification system integration
- ✅ Comprehensive documentation

### Future Enhancements

- 📧 Email queuing system
- 📊 Email analytics dashboard
- 🎨 Visual template editor
- 🔄 Webhook handling for delivery status
- 📱 Push notification integration
- 🌐 Multi-language email templates