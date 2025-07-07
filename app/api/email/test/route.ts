import { NextRequest, NextResponse } from 'next/server';
import { testEmailConfiguration, sendWelcomeEmail, sendProgressUpdateEmail, sendStudyReminderEmail, sendSystemAlertEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const { type, ...data } = await request.json();

    let result;
    
    switch (type) {
      case 'config':
        result = await testEmailConfiguration();
        break;
      
      case 'welcome':
        const { userEmail, userName, activationLink } = data;
        if (!userEmail || !userName) {
          return NextResponse.json(
            { success: false, error: 'userEmail and userName are required' },
            { status: 400 }
          );
        }
        result = await sendWelcomeEmail(userEmail, userName, activationLink);
        break;
      
      case 'progress':
        const { userEmail: progressEmail, userName: progressName, progressData } = data;
        if (!progressEmail || !progressName || !progressData) {
          return NextResponse.json(
            { success: false, error: 'userEmail, userName, and progressData are required' },
            { status: 400 }
          );
        }
        result = await sendProgressUpdateEmail(progressEmail, progressName, progressData);
        break;
      
      case 'reminder':
        const { userEmail: reminderEmail, userName: reminderName, reminderData } = data;
        if (!reminderEmail || !reminderName || !reminderData) {
          return NextResponse.json(
            { success: false, error: 'userEmail, userName, and reminderData are required' },
            { status: 400 }
          );
        }
        result = await sendStudyReminderEmail(reminderEmail, reminderName, reminderData);
        break;
      
      case 'alert':
        const { userEmail: alertEmail, userName: alertName, alertData } = data;
        if (!alertEmail || !alertName || !alertData) {
          return NextResponse.json(
            { success: false, error: 'userEmail, userName, and alertData are required' },
            { status: 400 }
          );
        }
        result = await sendSystemAlertEmail(alertEmail, alertName, alertData);
        break;
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid test type. Use: config, welcome, progress, reminder, or alert' },
          { status: 400 }
        );
    }

    logger.info('Email test completed:', { type, result });
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Email test error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email Test API',
    endpoints: {
      'POST /api/email/test': {
        description: 'Test email functionality',
        types: {
          config: 'Test email configuration',
          welcome: 'Test welcome email',
          progress: 'Test progress update email',
          reminder: 'Test study reminder email',
          alert: 'Test system alert email'
        },
        examples: {
          config: { type: 'config' },
          welcome: {
            type: 'welcome',
            userEmail: 'test@example.com',
            userName: 'Test User',
            activationLink: 'https://example.com/activate'
          },
          progress: {
            type: 'progress',
            userEmail: 'test@example.com',
            userName: 'Test User',
            progressData: {
              completedModules: 5,
              totalModules: 10,
              currentStreak: 7,
              timeSpent: 180,
              achievements: ['First Module Complete', 'Week Streak'],
              nextGoals: ['Complete Module 6', 'Maintain Streak']
            }
          },
          reminder: {
            type: 'reminder',
            userEmail: 'test@example.com',
            userName: 'Test User',
            reminderData: {
              nextModule: 'Introduction to React',
              suggestedDuration: 30,
              streakAtRisk: true,
              motivationalMessage: 'Keep your streak alive!'
            }
          },
          alert: {
            type: 'alert',
            userEmail: 'test@example.com',
            userName: 'Test User',
            alertData: {
              type: 'maintenance',
              title: 'Scheduled Maintenance',
              description: 'We will be performing maintenance on our servers.',
              actionRequired: false
            }
          }
        }
      }
    }
  });
}