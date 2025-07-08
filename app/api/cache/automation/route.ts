import { NextRequest, NextResponse } from 'next/server';
import { cacheAutomation } from '@/lib/cache/cache-automation';
import logger from '@/lib/logger';

// GET /api/cache/automation - Get automation status and metrics
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    const jobId = url.searchParams.get('jobId');

    logger.info('Cache automation API request', {
      action,
      jobId,
      category: 'cache',
      operation: 'automation_status'
    });

    if (action === 'health') {
      const health = cacheAutomation.getHealthSummary();
      return NextResponse.json(health);
    }

    if (action === 'metrics') {
      const metrics = cacheAutomation.getMetrics();
      return NextResponse.json(metrics);
    }

    if (action === 'jobs') {
      const activeJobs = cacheAutomation.getActiveJobs();
      return NextResponse.json(activeJobs);
    }

    if (action === 'job' && jobId) {
      const warmingJob = cacheAutomation.getWarmingJob(jobId);
      const invalidationJob = cacheAutomation.getInvalidationJob(jobId);
      const job = warmingJob || invalidationJob;
      
      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        job,
        type: warmingJob ? 'warming' : 'invalidation'
      });
    }

    // Default: return comprehensive automation status
    const [health, metrics, activeJobs] = await Promise.all([
      cacheAutomation.getHealthSummary(),
      cacheAutomation.getMetrics(),
      cacheAutomation.getActiveJobs()
    ]);

    const response = {
      status: health.status,
      timestamp: new Date().toISOString(),
      health,
      metrics,
      activeJobs,
      recommendations: health.recommendations.slice(0, 5),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Cache automation status check failed', {
      error: error instanceof Error ? error.message : String(error),
      category: 'cache',
      operation: 'automation_status'
    });

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to get automation status',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/cache/automation - Execute automation actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    logger.info('Cache automation action requested', {
      action,
      params,
      category: 'cache',
      operation: 'automation_action'
    });

    let result;

    switch (action) {
      case 'warm':
        result = await handleWarmAction(params);
        break;
      
      case 'invalidate':
        result = await handleInvalidateAction(params);
        break;
      
      case 'schedule_adaptive_warming':
        result = await handleScheduleAdaptiveWarming(params);
        break;
      
      case 'cleanup':
        result = await handleCleanupAction(params);
        break;
      
      case 'cancel_job':
        result = await handleCancelJob(params);
        break;
      
      case 'configure':
        result = await handleConfigureAction(params);
        break;
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    logger.info('Cache automation action completed', {
      action,
      result,
      category: 'cache',
      operation: 'automation_action'
    });

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache automation action failed', {
      error: error instanceof Error ? error.message : String(error),
      category: 'cache',
      operation: 'automation_action'
    });

    return NextResponse.json({
      success: false,
      error: 'Automation action failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// DELETE /api/cache/automation - Cancel jobs or cleanup
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('jobId');
    const action = url.searchParams.get('action');

    logger.info('Cache automation delete request', {
      jobId,
      action,
      category: 'cache',
      operation: 'automation_delete'
    });

    if (jobId) {
      const cancelled = cacheAutomation.cancelJob(jobId);
      
      if (!cancelled) {
        return NextResponse.json(
          { error: 'Job not found or cannot be cancelled' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Job ${jobId} cancelled`,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'cleanup') {
      const jobId = await cacheAutomation.scheduleCleanup();
      
      return NextResponse.json({
        success: true,
        message: 'Cleanup scheduled',
        jobId,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { error: 'Missing jobId or action parameter' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Cache automation delete failed', {
      error: error instanceof Error ? error.message : String(error),
      category: 'cache',
      operation: 'automation_delete'
    });

    return NextResponse.json({
      success: false,
      error: 'Delete operation failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Helper functions for handling different actions
async function handleWarmAction(params: any) {
  const {
    patterns = [],
    namespace = 'default',
    strategy = 'adaptive',
    priority = 'medium',
    name
  } = params;

  if (!patterns.length) {
    throw new Error('Patterns are required for cache warming');
  }

  const jobId = await cacheAutomation.scheduleWarmingJob(
    name || `manual-warming-${Date.now()}`,
    namespace,
    patterns,
    { warmingStrategy: strategy, priority }
  );

  return {
    type: 'warming',
    jobId,
    namespace,
    patterns,
    strategy
  };
}

async function handleInvalidateAction(params: any) {
  const {
    patterns = [],
    namespaces = ['default'],
    strategy = 'immediate',
    cascading = false,
    tags
  } = params;

  let keysInvalidated = 0;

  if (tags && tags.length > 0) {
    keysInvalidated = await cacheAutomation.invalidateByTags(tags, namespaces);
  } else if (patterns.length > 0) {
    keysInvalidated = await cacheAutomation.invalidateByPatterns(
      patterns,
      namespaces,
      { strategy, cascading }
    );
  } else {
    throw new Error('Either patterns or tags are required for cache invalidation');
  }

  return {
    type: 'invalidation',
    keysInvalidated,
    namespaces,
    patterns,
    tags,
    strategy,
    cascading
  };
}

async function handleScheduleAdaptiveWarming(params: any) {
  const jobIds = await cacheAutomation.scheduleAdaptiveWarming();
  
  return {
    type: 'adaptive_warming',
    jobIds,
    jobsScheduled: jobIds.length
  };
}

async function handleCleanupAction(params: any) {
  const jobId = await cacheAutomation.scheduleCleanup();
  
  return {
    type: 'cleanup',
    jobId
  };
}

async function handleCancelJob(params: any) {
  const { jobId } = params;
  
  if (!jobId) {
    throw new Error('Job ID is required for cancellation');
  }

  const cancelled = cacheAutomation.cancelJob(jobId);
  
  if (!cancelled) {
    throw new Error('Job not found or cannot be cancelled');
  }

  return {
    type: 'job_cancellation',
    jobId,
    cancelled: true
  };
}

async function handleConfigureAction(params: any) {
  const { warmingConfig, invalidationConfig } = params;

  if (warmingConfig) {
    cacheAutomation.updateWarmingConfig(warmingConfig);
  }

  if (invalidationConfig) {
    cacheAutomation.updateInvalidationConfig(invalidationConfig);
  }

  return {
    type: 'configuration_update',
    warmingConfigUpdated: !!warmingConfig,
    invalidationConfigUpdated: !!invalidationConfig
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}