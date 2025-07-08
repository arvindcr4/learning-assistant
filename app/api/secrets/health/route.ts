import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { secretsManager, rotationManager } from '@/lib/secrets';
import runtimeSecrets from '@/lib/runtime-secrets';

// Request schema for health check
const HealthCheckSchema = z.object({
  includeDetails: z.boolean().optional().default(false),
  checkConnectivity: z.boolean().optional().default(true),
});

// Response interface
interface SecretsHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    secretsManager: {
      status: 'healthy' | 'unhealthy';
      provider: string;
      connectivity: boolean;
    };
    rotationManager: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      activeJobs: number;
      failedJobs: number;
    };
    runtimeInjection: {
      status: 'enabled' | 'disabled';
      secretCount: number;
      lastRefresh?: string;
    };
  };
  metrics?: {
    totalSecrets: number;
    successfulRotations: number;
    failedRotations: number;
    lastRotationTimestamp?: string;
    auditLogEntries: number;
  };
  issues?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const includeDetails = url.searchParams.get('details') === 'true';
    const checkConnectivity = url.searchParams.get('connectivity') !== 'false';

    const issues: string[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check secrets manager
    let secretsManagerStatus: 'healthy' | 'unhealthy' = 'healthy';
    let connectivity = false;
    let provider = 'unknown';

    try {
      if (checkConnectivity) {
        // Test basic connectivity by trying to list secrets
        const testSecret = await secretsManager.getSecret('health-check-test');
        connectivity = true;
      }
      provider = process.env.SECRETS_PROVIDER || 'unknown';
    } catch (error) {
      secretsManagerStatus = 'unhealthy';
      issues.push('Secrets manager connectivity failed');
      overallStatus = 'unhealthy';
    }

    // Check rotation manager
    const rotationHealth = await rotationManager.healthCheck();
    let rotationStatus: 'healthy' | 'degraded' | 'unhealthy' = rotationHealth.status;
    
    if (rotationStatus === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    } else if (rotationStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    }

    if (rotationHealth.failedJobs > 0) {
      issues.push(`${rotationHealth.failedJobs} rotation jobs have failed`);
    }

    // Check runtime injection
    const runtimeStatus = runtimeSecrets.getStatus();
    const runtimeInjectionStatus = runtimeStatus.injectionEnabled ? 'enabled' : 'disabled';

    if (!runtimeStatus.injectionEnabled && process.env.NODE_ENV === 'production') {
      issues.push('Runtime secrets injection is disabled in production');
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    // Prepare response
    const response: SecretsHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        secretsManager: {
          status: secretsManagerStatus,
          provider,
          connectivity,
        },
        rotationManager: {
          status: rotationStatus,
          activeJobs: rotationHealth.activeJobs,
          failedJobs: rotationHealth.failedJobs,
        },
        runtimeInjection: {
          status: runtimeInjectionStatus,
          secretCount: runtimeStatus.secretCount,
        },
      },
    };

    // Add detailed metrics if requested
    if (includeDetails) {
      try {
        const auditLogs = secretsManager.getAuditLogs();
        const recentRotations = auditLogs.filter((log: any) => 
          log.action === 'rotate' && 
          new Date(log.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        response.metrics = {
          totalSecrets: Object.keys(rotationHealth.lastRotations).length,
          successfulRotations: recentRotations.filter(log => !log.metadata?.error).length,
          failedRotations: recentRotations.filter(log => log.metadata?.error).length,
          lastRotationTimestamp: Object.values(rotationHealth.lastRotations)
            .sort()
            .reverse()[0],
          auditLogEntries: auditLogs.length,
        };
      } catch (error) {
        issues.push('Failed to collect detailed metrics');
      }
    }

    // Add issues if any
    if (issues.length > 0) {
      response.issues = issues;
    }

    // Set appropriate HTTP status
    let httpStatus = 200;
    if (overallStatus === 'degraded') {
      httpStatus = 200; // Still operational but with warnings
    } else if (overallStatus === 'unhealthy') {
      httpStatus = 503; // Service unavailable
    }

    return NextResponse.json({
      success: overallStatus !== 'unhealthy',
      data: response,
    }, { status: httpStatus });

  } catch (error) {
    console.error('Secrets health check failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { includeDetails, checkConnectivity } = HealthCheckSchema.parse(body);

    // Trigger manual refresh of secrets
    if (runtimeSecrets.isEnabled()) {
      await runtimeSecrets.refreshSecrets();
    }

    // Perform detailed health check
    const url = new URL(request.url);
    url.searchParams.set('details', includeDetails.toString());
    url.searchParams.set('connectivity', checkConnectivity.toString());

    // Re-run the GET health check with updated state
    const getRequest = new NextRequest(url.toString(), {
      method: 'GET',
      headers: request.headers,
    });

    return GET(getRequest);

  } catch (error) {
    console.error('POST secrets health check failed:', error);

    return NextResponse.json({
      success: false,
      error: 'Health check request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 400 });
  }
}