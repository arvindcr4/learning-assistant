import { z } from 'zod';
import { secretsManager, SecretRotationResult, SecretMetadata } from './secrets';
import { randomBytes } from 'crypto';
import cron from 'node-cron';

// Rotation policy schema
const RotationPolicySchema = z.object({
  secretName: z.string(),
  interval: z.number().min(1), // days
  maxVersions: z.number().min(1).default(5),
  enabled: z.boolean().default(true),
  notificationWebhook: z.string().url().optional(),
  preRotationHook: z.string().optional(),
  postRotationHook: z.string().optional(),
});

// Rotation schedule schema
const RotationScheduleSchema = z.object({
  secretName: z.string(),
  cronExpression: z.string(),
  timezone: z.string().default('UTC'),
  enabled: z.boolean().default(true),
});

// Types
export interface RotationPolicy {
  secretName: string;
  interval: number;
  maxVersions: number;
  enabled: boolean;
  notificationWebhook?: string;
  preRotationHook?: string;
  postRotationHook?: string;
}

export interface RotationSchedule {
  secretName: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
}

export interface RotationJob {
  id: string;
  secretName: string;
  policy: RotationPolicy;
  schedule?: RotationSchedule;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused' | 'failed';
  failureCount: number;
  lastResult?: SecretRotationResult;
}

export interface RotationNotification {
  event: 'rotation_started' | 'rotation_completed' | 'rotation_failed' | 'rotation_warning';
  secretName: string;
  timestamp: string;
  result?: SecretRotationResult;
  error?: string;
  metadata?: Record<string, any>;
}

// Secret rotation manager
export class SecretRotationManager {
  private static instance: SecretRotationManager;
  private rotationJobs: Map<string, RotationJob> = new Map();
  private scheduledJobs: Map<string, any> = new Map();
  private rotationHistory: Map<string, SecretRotationResult[]> = new Map();
  private webhookQueue: RotationNotification[] = [];

  private constructor() {
    this.initializeDefaultPolicies();
    this.startWebhookProcessor();
  }

  public static getInstance(): SecretRotationManager {
    if (!SecretRotationManager.instance) {
      SecretRotationManager.instance = new SecretRotationManager();
    }
    return SecretRotationManager.instance;
  }

  private initializeDefaultPolicies(): void {
    // Default rotation policies for critical secrets
    const defaultPolicies: RotationPolicy[] = [
      {
        secretName: 'resend-api-key',
        interval: 30, // 30 days
        maxVersions: 5,
        enabled: true,
      },
      {
        secretName: 'tambo-api-key',
        interval: 30,
        maxVersions: 5,
        enabled: true,
      },
      {
        secretName: 'lingo-dev-api-key',
        interval: 30,
        maxVersions: 5,
        enabled: true,
      },
      // {
      //   secretName: 'firecrawl-api-key',
      //   interval: 30,
      //   maxVersions: 5,
      //   enabled: true,
      // },
      {
        secretName: 'better-auth-secret',
        interval: 90, // 90 days
        maxVersions: 3,
        enabled: true,
      },
      {
        secretName: 'jwt-secret',
        interval: 90,
        maxVersions: 3,
        enabled: true,
      },
      {
        secretName: 'jwt-refresh-secret',
        interval: 90,
        maxVersions: 3,
        enabled: true,
      },
      {
        secretName: 'csrf-secret',
        interval: 90,
        maxVersions: 3,
        enabled: true,
      },
      {
        secretName: 'supabase-service-role-key',
        interval: 180, // 180 days
        maxVersions: 2,
        enabled: true,
      },
    ];

    for (const policy of defaultPolicies) {
      this.addRotationPolicy(policy);
    }
  }

  addRotationPolicy(policy: RotationPolicy): void {
    const validatedPolicy = RotationPolicySchema.parse(policy) as RotationPolicy;
    
    const job: RotationJob = {
      id: randomBytes(16).toString('hex'),
      secretName: validatedPolicy.secretName,
      policy: validatedPolicy,
      status: 'active',
      failureCount: 0,
    };

    this.rotationJobs.set(validatedPolicy.secretName, job);
    this.scheduleRotation(job);
  }

  addRotationSchedule(schedule: RotationSchedule): void {
    const validatedSchedule = RotationScheduleSchema.parse(schedule) as RotationSchedule;
    
    const job = this.rotationJobs.get(validatedSchedule.secretName);
    if (!job) {
      throw new Error(`No rotation policy found for secret: ${validatedSchedule.secretName}`);
    }

    job.schedule = validatedSchedule;
    this.scheduleRotation(job);
  }

  private scheduleRotation(job: RotationJob): void {
    // Remove existing schedule if any
    const existingJob = this.scheduledJobs.get(job.secretName);
    if (existingJob) {
      existingJob.destroy();
    }

    if (!job.policy.enabled) return;

    let cronExpression: string;
    
    if (job.schedule) {
      cronExpression = job.schedule.cronExpression;
    } else {
      // Generate cron expression based on interval
      const days = job.policy.interval;
      cronExpression = `0 2 */${days} * *`; // Every N days at 2 AM
    }

    const scheduledJob = cron.schedule(cronExpression, async () => {
      await this.executeRotation(job);
    }, {
      timezone: job.schedule?.timezone || 'UTC',
    });

    this.scheduledJobs.set(job.secretName, scheduledJob);
    
    // Calculate next run time
    const nextRun = this.getNextRunTime(cronExpression);
    job.nextRun = nextRun.toISOString();
  }

  private async executeRotation(job: RotationJob): Promise<void> {
    try {
      job.status = 'active';
      job.lastRun = new Date().toISOString();

      // Send notification
      await this.sendNotification({
        event: 'rotation_started',
        secretName: job.secretName,
        timestamp: new Date().toISOString(),
      });

      // Execute pre-rotation hook if configured
      if (job.policy.preRotationHook) {
        await this.executeHook(job.policy.preRotationHook, 'pre-rotation', job);
      }

      // Perform rotation
      const result = await secretsManager.rotateSecret(job.secretName, 'rotation-manager');
      
      job.lastResult = result;
      job.failureCount = result.success ? 0 : job.failureCount + 1;

      // Store rotation history
      const history = this.rotationHistory.get(job.secretName) || [];
      history.push(result);
      
      // Keep only last 10 rotation results
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }
      
      this.rotationHistory.set(job.secretName, history);

      // Execute post-rotation hook if configured
      if (job.policy.postRotationHook) {
        await this.executeHook(job.policy.postRotationHook, 'post-rotation', job, result);
      }

      // Send notification
      await this.sendNotification({
        event: result.success ? 'rotation_completed' : 'rotation_failed',
        secretName: job.secretName,
        timestamp: new Date().toISOString(),
        result,
      });

      // Pause job if too many failures
      if (job.failureCount >= 3) {
        job.status = 'failed';
        this.pauseRotation(job.secretName);
        
        await this.sendNotification({
          event: 'rotation_warning',
          secretName: job.secretName,
          timestamp: new Date().toISOString(),
          error: `Rotation failed ${job.failureCount} times. Job has been paused.`,
        });
      }

    } catch (error) {
      job.failureCount++;
      job.lastResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };

      await this.sendNotification({
        event: 'rotation_failed',
        secretName: job.secretName,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      console.error(`Rotation failed for secret ${job.secretName}:`, error);
    }
  }

  private async executeHook(hookCommand: string, hookType: string, job: RotationJob, result?: SecretRotationResult): Promise<void> {
    try {
      // Execute hook command - this could be a script or API call
      console.log(`Executing ${hookType} hook for ${job.secretName}: ${hookCommand}`);
      
      // For now, just log the hook execution
      // In a real implementation, you would execute the actual command
      
    } catch (error) {
      console.error(`Failed to execute ${hookType} hook for ${job.secretName}:`, error);
    }
  }

  private getNextRunTime(cronExpression: string): Date {
    // Simple implementation - in practice, you'd use a proper cron parser
    const now = new Date();
    const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day as fallback
    return nextRun;
  }

  async manualRotation(secretName: string): Promise<SecretRotationResult> {
    const job = this.rotationJobs.get(secretName);
    if (!job) {
      throw new Error(`No rotation policy found for secret: ${secretName}`);
    }

    await this.executeRotation(job);
    return job.lastResult || {
      success: false,
      error: 'No result available',
      timestamp: new Date().toISOString(),
    };
  }

  pauseRotation(secretName: string): void {
    const job = this.rotationJobs.get(secretName);
    if (job) {
      job.status = 'paused';
      
      const scheduledJob = this.scheduledJobs.get(secretName);
      if (scheduledJob) {
        scheduledJob.stop();
      }
    }
  }

  resumeRotation(secretName: string): void {
    const job = this.rotationJobs.get(secretName);
    if (job) {
      job.status = 'active';
      job.failureCount = 0;
      this.scheduleRotation(job);
    }
  }

  removeRotationPolicy(secretName: string): void {
    const scheduledJob = this.scheduledJobs.get(secretName);
    if (scheduledJob) {
      scheduledJob.destroy();
      this.scheduledJobs.delete(secretName);
    }
    
    this.rotationJobs.delete(secretName);
    this.rotationHistory.delete(secretName);
  }

  getRotationJobs(): RotationJob[] {
    return Array.from(this.rotationJobs.values());
  }

  getRotationHistory(secretName: string): SecretRotationResult[] {
    return this.rotationHistory.get(secretName) || [];
  }

  getRotationStatus(secretName: string): RotationJob | null {
    return this.rotationJobs.get(secretName) || null;
  }

  private async sendNotification(notification: RotationNotification): Promise<void> {
    this.webhookQueue.push(notification);
  }

  private startWebhookProcessor(): void {
    setInterval(async () => {
      if (this.webhookQueue.length === 0) return;

      const notifications = this.webhookQueue.splice(0, 10); // Process up to 10 at a time
      
      for (const notification of notifications) {
        try {
          const job = this.rotationJobs.get(notification.secretName);
          const webhook = job?.policy.notificationWebhook;
          
          if (webhook) {
            await fetch(webhook, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(notification),
            });
          }
        } catch (error) {
          console.error('Failed to send rotation notification:', error);
        }
      }
    }, 5000); // Process every 5 seconds
  }

  // Emergency rotation methods
  async emergencyRotateAll(): Promise<SecretRotationResult[]> {
    const jobs = Array.from(this.rotationJobs.values());
    const results: SecretRotationResult[] = [];

    for (const job of jobs) {
      try {
        const result = await secretsManager.rotateSecret(job.secretName, 'emergency-rotation');
        results.push(result);
        
        // Update job status
        job.lastResult = result;
        job.lastRun = new Date().toISOString();
        
        // Send notification
        await this.sendNotification({
          event: result.success ? 'rotation_completed' : 'rotation_failed',
          secretName: job.secretName,
          timestamp: new Date().toISOString(),
          result,
          metadata: { emergency: true },
        });
      } catch (error) {
        const errorResult: SecretRotationResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
        
        results.push(errorResult);
        job.lastResult = errorResult;
      }
    }

    return results;
  }

  async emergencyRotateByTag(tag: string, value: string): Promise<SecretRotationResult[]> {
    // This would require extending the secrets manager to support tags
    // For now, return empty array
    return [];
  }

  // Health check methods
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeJobs: number;
    failedJobs: number;
    lastRotations: Record<string, string>;
  }> {
    const jobs = Array.from(this.rotationJobs.values());
    const activeJobs = jobs.filter(job => job.status === 'active').length;
    const failedJobs = jobs.filter(job => job.status === 'failed').length;
    
    const lastRotations: Record<string, string> = {};
    for (const job of jobs) {
      if (job.lastRun) {
        lastRotations[job.secretName] = job.lastRun;
      }
    }

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedJobs === 0) {
      status = 'healthy';
    } else if (failedJobs < jobs.length / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      activeJobs,
      failedJobs,
      lastRotations,
    };
  }
}

// Export singleton instance
export const rotationManager = SecretRotationManager.getInstance();

// Helper functions
export async function addRotationPolicy(policy: RotationPolicy): Promise<void> {
  rotationManager.addRotationPolicy(policy);
}

export async function addRotationSchedule(schedule: RotationSchedule): Promise<void> {
  rotationManager.addRotationSchedule(schedule);
}

export async function manualRotation(secretName: string): Promise<SecretRotationResult> {
  return rotationManager.manualRotation(secretName);
}

export async function emergencyRotateAll(): Promise<SecretRotationResult[]> {
  return rotationManager.emergencyRotateAll();
}

export function getRotationStatus(secretName: string): RotationJob | null {
  return rotationManager.getRotationStatus(secretName);
}

export function getRotationHistory(secretName: string): SecretRotationResult[] {
  return rotationManager.getRotationHistory(secretName);
}

export async function rotationHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeJobs: number;
  failedJobs: number;
  lastRotations: Record<string, string>;
}> {
  return rotationManager.healthCheck();
}