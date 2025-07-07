# Email Service Quick Reference

## Setup Checklist

- [ ] Set `RESEND_API_KEY` in `.env.local`
- [ ] Set `RESEND_FROM_EMAIL` with verified email
- [ ] Set `TEST_EMAIL` for testing
- [ ] Verify domain in Resend dashboard (production)
- [ ] Configure DNS records (production)

## Environment Variables

```env
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=Learning Assistant
TEST_EMAIL=test@example.com
```

## Quick Test

```bash
# Test email configuration
node scripts/test-email-simple.js

# Test with specific email
TEST_EMAIL=you@example.com node scripts/test-email-simple.js
```

## Email Functions

### 1. Welcome Email
```typescript
import { sendWelcomeEmail } from '@/lib/email';

await sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'https://app.com/activate' // optional
);
```

### 2. Progress Update
```typescript
import { sendProgressUpdateEmail } from '@/lib/email';

await sendProgressUpdateEmail('user@example.com', 'John Doe', {
  completedModules: 5,
  totalModules: 10,
  currentStreak: 7,
  timeSpent: 180,
  achievements: ['First Complete'],
  nextGoals: ['Module 6']
});
```

### 3. Study Reminder
```typescript
import { sendStudyReminderEmail } from '@/lib/email';

await sendStudyReminderEmail('user@example.com', 'John Doe', {
  nextModule: 'React Basics',
  suggestedDuration: 30,
  streakAtRisk: false,
  motivationalMessage: 'Keep learning!'
});
```

### 4. System Alert
```typescript
import { sendSystemAlertEmail } from '@/lib/email';

await sendSystemAlertEmail('user@example.com', 'John Doe', {
  type: 'maintenance',
  title: 'Scheduled Maintenance',
  description: 'System will be down...',
  actionRequired: false
});
```

## With Notification Context

```typescript
import { useNotifications } from '@/contexts/NotificationContext';

function Component() {
  const { sendWelcomeNotification } = useNotifications();
  
  const handleWelcome = () => {
    sendWelcomeNotification('user@example.com', 'John Doe');
  };
}
```

## API Testing

```bash
# Start server
npm run dev

# Test endpoints
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"type": "config"}'

curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{
    "type": "welcome",
    "userEmail": "test@example.com",
    "userName": "Test User"
  }'
```

## Rate Limits

- **10 emails per minute** per recipient
- Automatic cleanup of rate limit data
- Configurable in `src/lib/email.ts`

## Error Handling

```typescript
const result = await sendWelcomeEmail(email, name);

if (result.success) {
  console.log('Sent:', result.id);
} else {
  console.error('Failed:', result.error);
}
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "API key invalid" | Check RESEND_API_KEY |
| "Domain not verified" | Verify domain in Resend |
| "Rate limit exceeded" | Wait or reduce frequency |
| "Email not delivered" | Check spam folder |

## Production Checklist

- [ ] Use verified domain
- [ ] Configure SPF/DKIM/DMARC
- [ ] Set up monitoring
- [ ] Test all email types
- [ ] Configure rate limits
- [ ] Set up error logging