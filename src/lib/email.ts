import { Resend } from 'resend';
import { z } from 'zod';
import logger from '@/lib/logger';

// Email configuration schema
const emailConfigSchema = z.object({
  apiKey: z.string().min(1, 'RESEND_API_KEY is required'),
  fromEmail: z.string().email('Invalid from email address'),
  fromName: z.string().min(1, 'From name is required'),
  replyTo: z.string().email('Invalid reply-to email address').optional(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
});

// Email template schema
const emailTemplateSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1, 'Subject is required'),
  html: z.string().min(1, 'HTML content is required'),
  text: z.string().optional(),
  from: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  tags: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
  headers: z.record(z.string()).optional(),
});

// Email service types
export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  environment: 'development' | 'staging' | 'production';
}

export interface EmailTemplate {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  id?: string;
  message?: string;
  error?: string;
}

export interface EmailTrackingData {
  id: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  timestamp: Date;
  recipient: string;
  subject: string;
  metadata?: Record<string, any>;
}

// Email service configuration
const config: EmailConfig = {
  apiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@learningassistant.com',
  fromName: process.env.RESEND_FROM_NAME || 'Learning Assistant',
  replyTo: process.env.RESEND_REPLY_TO,
  environment: (process.env.NODE_ENV as any) || 'development',
};

// Validate configuration
let validatedConfig: EmailConfig;
try {
  validatedConfig = emailConfigSchema.parse(config);
} catch (error) {
  logger.error('Invalid email configuration:', error);
  throw new Error('Email service configuration is invalid');
}

// Initialize Resend client
const resend = new Resend(validatedConfig.apiKey);

// Rate limiting for email sending
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_EMAILS = 10; // 10 emails per minute per recipient

/**
 * Check if email sending is rate limited for a recipient
 */
function isRateLimited(recipient: string): boolean {
  const now = Date.now();
  const key = recipient.toLowerCase();
  const limit = rateLimiter.get(key);

  if (!limit) {
    rateLimiter.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (now > limit.resetTime) {
    rateLimiter.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (limit.count >= RATE_LIMIT_MAX_EMAILS) {
    return true;
  }

  limit.count++;
  return false;
}

/**
 * Clean up expired rate limit entries
 */
function cleanupRateLimiter() {
  const now = Date.now();
  for (const [key, limit] of rateLimiter.entries()) {
    if (now > limit.resetTime) {
      rateLimiter.delete(key);
    }
  }
}

// Clean up rate limiter every 5 minutes
setInterval(cleanupRateLimiter, 5 * 60 * 1000);

/**
 * Send email using Resend
 */
export async function sendEmail(template: EmailTemplate): Promise<EmailSendResult> {
  try {
    // Validate template
    const validatedTemplate = emailTemplateSchema.parse(template);

    // Check rate limiting
    const recipients = Array.isArray(validatedTemplate.to) ? validatedTemplate.to : [validatedTemplate.to];
    for (const recipient of recipients) {
      if (isRateLimited(recipient)) {
        logger.warn(`Rate limit exceeded for recipient: ${recipient}`);
        return {
          success: false,
          error: `Rate limit exceeded for recipient: ${recipient}`,
        };
      }
    }

    // Prepare email data
    const emailData = {
      from: validatedTemplate.from || `${validatedConfig.fromName} <${validatedConfig.fromEmail}>`,
      to: validatedTemplate.to,
      subject: validatedTemplate.subject,
      html: validatedTemplate.html,
      text: validatedTemplate.text,
      replyTo: validatedTemplate.replyTo || validatedConfig.replyTo,
      tags: validatedTemplate.tags,
      headers: validatedTemplate.headers,
    };

    // Send email
    const result = await resend.emails.send(emailData);

    if (result.error) {
      logger.error('Failed to send email:', result.error);
      return {
        success: false,
        error: result.error.message,
      };
    }

    logger.info('Email sent successfully:', {
      id: result.data?.id,
      to: validatedTemplate.to,
      subject: validatedTemplate.subject,
    });

    return {
      success: true,
      id: result.data?.id,
      message: 'Email sent successfully',
    };
  } catch (error) {
    logger.error('Email service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  activationLink?: string
): Promise<EmailSendResult> {
  const template: EmailTemplate = {
    to: userEmail,
    subject: 'Welcome to Learning Assistant! 🎉',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Learning Assistant!</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your AI-powered learning companion</p>
        </div>
        
        <div style="background: white; padding: 40px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Hello ${userName}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6;">
            Welcome to Learning Assistant, your personalized AI tutor designed to help you learn more effectively and efficiently.
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">What you can do with Learning Assistant:</h3>
            <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>🎯 Get personalized learning recommendations based on your style</li>
              <li>📚 Access adaptive content that adjusts to your pace</li>
              <li>🤖 Chat with AI tutors for instant help and explanations</li>
              <li>📊 Track your progress with detailed analytics</li>
              <li>🏆 Set and achieve learning goals with reminders</li>
            </ul>
          </div>
          
          ${activationLink ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationLink}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Activate Your Account
              </a>
            </div>
          ` : ''}
          
          <p style="color: #666; line-height: 1.6;">
            Ready to start your learning journey? Log in to your account and begin exploring personalized content tailored just for you.
          </p>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              If you have any questions, feel free to reply to this email or visit our help center.
            </p>
          </div>
        </div>
      </div>
    `,
    text: `Welcome to Learning Assistant, ${userName}!

Your AI-powered learning companion is ready to help you learn more effectively.

What you can do:
- Get personalized learning recommendations
- Access adaptive content
- Chat with AI tutors
- Track your progress
- Set and achieve learning goals

${activationLink ? `Activate your account: ${activationLink}` : ''}

Ready to start learning? Log in to your account and begin exploring!`,
    tags: [
      { name: 'type', value: 'welcome' },
      { name: 'user_id', value: userEmail },
    ],
  };

  return sendEmail(template);
}

/**
 * Send learning progress update email
 */
export async function sendProgressUpdateEmail(
  userEmail: string,
  userName: string,
  progressData: {
    completedModules: number;
    totalModules: number;
    currentStreak: number;
    timeSpent: number;
    achievements: string[];
    nextGoals: string[];
  }
): Promise<EmailSendResult> {
  const progressPercentage = Math.round((progressData.completedModules / progressData.totalModules) * 100);
  const hoursSpent = Math.round(progressData.timeSpent / 60);

  const template: EmailTemplate = {
    to: userEmail,
    subject: `Your Learning Progress Update - ${progressPercentage}% Complete! 📈`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #2E86AB 0%, #A23B72 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Your Learning Progress</h1>
          <div style="background: rgba(255,255,255,0.2); border-radius: 50px; padding: 10px 20px; margin: 15px auto; display: inline-block;">
            <span style="color: white; font-size: 18px; font-weight: bold;">${progressPercentage}% Complete</span>
          </div>
        </div>
        
        <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Great work, ${userName}! 🎉</h2>
          
          <div style="display: flex; justify-content: space-around; margin: 25px 0; flex-wrap: wrap;">
            <div style="text-align: center; margin: 10px;">
              <div style="background: #e8f5e8; color: #2d8f2d; padding: 15px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                <span style="font-size: 24px; font-weight: bold;">${progressData.completedModules}</span>
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">Modules Completed</p>
            </div>
            
            <div style="text-align: center; margin: 10px;">
              <div style="background: #fff3e0; color: #f57c00; padding: 15px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                <span style="font-size: 24px; font-weight: bold;">${progressData.currentStreak}</span>
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">Day Streak</p>
            </div>
            
            <div style="text-align: center; margin: 10px;">
              <div style="background: #e3f2fd; color: #1976d2; padding: 15px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;">
                <span style="font-size: 24px; font-weight: bold;">${hoursSpent}</span>
              </div>
              <p style="margin: 0; color: #666; font-size: 14px;">Hours Learned</p>
            </div>
          </div>
          
          ${progressData.achievements.length > 0 ? `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">🏆 Recent Achievements</h3>
              <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
                ${progressData.achievements.map(achievement => `<li>${achievement}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${progressData.nextGoals.length > 0 ? `
            <div style="background: #e8f5e8; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">🎯 Next Goals</h3>
              <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
                ${progressData.nextGoals.map(goal => `<li>${goal}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Continue Learning
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              Keep up the great work! Consistency is key to achieving your learning goals.
            </p>
          </div>
        </div>
      </div>
    `,
    text: `Your Learning Progress Update - ${progressPercentage}% Complete!

Great work, ${userName}! Here's your progress summary:

📊 Progress: ${progressData.completedModules}/${progressData.totalModules} modules completed
🔥 Current streak: ${progressData.currentStreak} days
⏱️ Time spent learning: ${hoursSpent} hours

${progressData.achievements.length > 0 ? `
🏆 Recent Achievements:
${progressData.achievements.map(achievement => `- ${achievement}`).join('\n')}
` : ''}

${progressData.nextGoals.length > 0 ? `
🎯 Next Goals:
${progressData.nextGoals.map(goal => `- ${goal}`).join('\n')}
` : ''}

Continue your learning journey: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard

Keep up the great work!`,
    tags: [
      { name: 'type', value: 'progress_update' },
      { name: 'user_id', value: userEmail },
      { name: 'progress_percentage', value: progressPercentage.toString() },
    ],
  };

  return sendEmail(template);
}

/**
 * Send study reminder email
 */
export async function sendStudyReminderEmail(
  userEmail: string,
  userName: string,
  reminderData: {
    nextModule: string;
    suggestedDuration: number;
    streakAtRisk: boolean;
    motivationalMessage: string;
  }
): Promise<EmailSendResult> {
  const template: EmailTemplate = {
    to: userEmail,
    subject: reminderData.streakAtRisk 
      ? `Don't break your streak! ⚡ - Learning Reminder`
      : `Time to learn! 📚 - Study Reminder`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: ${reminderData.streakAtRisk ? 'linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%)' : 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)'}; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ${reminderData.streakAtRisk ? 'Don\'t Break Your Streak!' : 'Time to Learn!'}
          </h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">
            ${reminderData.streakAtRisk ? 'Keep your learning momentum going' : 'Your next lesson is waiting'}
          </p>
        </div>
        
        <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Hi ${userName}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; font-size: 16px;">
            ${reminderData.motivationalMessage}
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">📚 Next Up: ${reminderData.nextModule}</h3>
            <p style="color: #666; margin: 10px 0; font-size: 14px;">
              ⏱️ Suggested duration: ${reminderData.suggestedDuration} minutes
            </p>
            ${reminderData.streakAtRisk ? `
              <div style="background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0;">
                <p style="color: #f57c00; margin: 0; font-weight: bold;">
                  ⚡ Your learning streak is at risk! Don't let it break now.
                </p>
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Start Learning Now
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              You can manage your notification preferences in your account settings.
            </p>
          </div>
        </div>
      </div>
    `,
    text: `${reminderData.streakAtRisk ? 'Don\'t Break Your Streak!' : 'Time to Learn!'} 

Hi ${userName}!

${reminderData.motivationalMessage}

Next Up: ${reminderData.nextModule}
Suggested duration: ${reminderData.suggestedDuration} minutes

${reminderData.streakAtRisk ? '⚡ Your learning streak is at risk! Don\'t let it break now.' : ''}

Start learning now: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard

You can manage your notification preferences in your account settings.`,
    tags: [
      { name: 'type', value: 'study_reminder' },
      { name: 'user_id', value: userEmail },
      { name: 'streak_at_risk', value: reminderData.streakAtRisk.toString() },
    ],
  };

  return sendEmail(template);
}

/**
 * Send system alert email
 */
export async function sendSystemAlertEmail(
  userEmail: string,
  userName: string,
  alertData: {
    type: 'maintenance' | 'security' | 'feature' | 'issue';
    title: string;
    description: string;
    actionRequired: boolean;
    actionUrl?: string;
    actionText?: string;
  }
): Promise<EmailSendResult> {
  const alertColors = {
    maintenance: { bg: '#2196F3', accent: '#1976D2' },
    security: { bg: '#F44336', accent: '#D32F2F' },
    feature: { bg: '#4CAF50', accent: '#388E3C' },
    issue: { bg: '#FF9800', accent: '#F57C00' },
  };

  const colors = alertColors[alertData.type];

  const template: EmailTemplate = {
    to: userEmail,
    subject: `${alertData.actionRequired ? '[Action Required] ' : ''}${alertData.title}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: ${colors.bg}; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${alertData.title}</h1>
          ${alertData.actionRequired ? `
            <div style="background: rgba(255,255,255,0.2); border-radius: 20px; padding: 5px 15px; margin: 10px auto; display: inline-block;">
              <span style="color: white; font-size: 12px; font-weight: bold;">ACTION REQUIRED</span>
            </div>
          ` : ''}
        </div>
        
        <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Hello ${userName},</h2>
          
          <div style="color: #666; line-height: 1.6; font-size: 16px;">
            ${alertData.description}
          </div>
          
          ${alertData.actionRequired && alertData.actionUrl ? `
            <div style="background: #f8f9fa; border-left: 4px solid ${colors.accent}; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333; margin-top: 0;">Action Required</h3>
              <p style="color: #666; margin: 10px 0;">
                Please take action to ensure continued access to your Learning Assistant account.
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${alertData.actionUrl}" style="background: ${colors.bg}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                ${alertData.actionText || 'Take Action'}
              </a>
            </div>
          ` : ''}
          
          <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              If you have any questions, please contact our support team.
            </p>
          </div>
        </div>
      </div>
    `,
    text: `${alertData.title}

Hello ${userName},

${alertData.description}

${alertData.actionRequired && alertData.actionUrl ? `
Action Required: ${alertData.actionUrl}
` : ''}

If you have any questions, please contact our support team.`,
    tags: [
      { name: 'type', value: 'system_alert' },
      { name: 'alert_type', value: alertData.type },
      { name: 'user_id', value: userEmail },
      { name: 'action_required', value: alertData.actionRequired.toString() },
    ],
  };

  return sendEmail(template);
}

/**
 * Get email delivery status (if supported by Resend)
 */
export async function getEmailStatus(emailId: string): Promise<EmailTrackingData | null> {
  try {
    // Note: This is a placeholder as Resend's tracking capabilities may be limited
    // You would need to implement webhook handling for delivery status updates
    logger.info(`Checking email status for ID: ${emailId}`);
    
    // For now, return null as we don't have tracking data
    return null;
  } catch (error) {
    logger.error('Error checking email status:', error);
    return null;
  }
}

/**
 * Validate email template before sending
 */
export function validateEmailTemplate(template: EmailTemplate): { valid: boolean; errors: string[] } {
  try {
    emailTemplateSchema.parse(template);
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
      };
    }
    return {
      valid: false,
      errors: ['Invalid template format'],
    };
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<EmailSendResult> {
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  
  const template: EmailTemplate = {
    to: testEmail,
    subject: 'Learning Assistant Email Service Test',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: #667eea; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Email Service Test</h1>
        </div>
        
        <div style="background: white; padding: 30px 20px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-top: 0;">Test Successful! ✅</h2>
          
          <p style="color: #666; line-height: 1.6;">
            This is a test email from the Learning Assistant email service. 
            If you're seeing this, the email configuration is working correctly.
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Configuration Details:</h3>
            <ul style="color: #666; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Environment: ${validatedConfig.environment}</li>
              <li>From: ${validatedConfig.fromName} &lt;${validatedConfig.fromEmail}&gt;</li>
              <li>Service: Resend</li>
              <li>Timestamp: ${new Date().toISOString()}</li>
            </ul>
          </div>
        </div>
      </div>
    `,
    text: `Email Service Test

This is a test email from the Learning Assistant email service. 
If you're seeing this, the email configuration is working correctly.

Configuration Details:
- Environment: ${validatedConfig.environment}
- From: ${validatedConfig.fromName} <${validatedConfig.fromEmail}>
- Service: Resend
- Timestamp: ${new Date().toISOString()}`,
    tags: [
      { name: 'type', value: 'test' },
      { name: 'environment', value: validatedConfig.environment },
    ],
  };

  return sendEmail(template);
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendProgressUpdateEmail,
  sendStudyReminderEmail,
  sendSystemAlertEmail,
  getEmailStatus,
  validateEmailTemplate,
  testEmailConfiguration,
};