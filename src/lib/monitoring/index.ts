// Comprehensive monitoring and observability service
import { apm } from '../apm';
import { metricsUtils } from '../metrics';
import logger from '../logger';
import * as Sentry from '@sentry/nextjs';

export interface MonitoringConfig {
  enabled: boolean;
  sampleRate: number;
  errorThreshold: number;
  performanceThreshold: number;
  userAnalytics: boolean;
  costTracking: boolean;
  securityMonitoring: boolean;
}

// Default configuration
const defaultConfig: MonitoringConfig = {
  enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_MONITORING === 'true',
  sampleRate: parseFloat(process.env.MONITORING_SAMPLE_RATE || '0.1'),
  errorThreshold: parseInt(process.env.ERROR_THRESHOLD || '10'),
  performanceThreshold: parseInt(process.env.PERFORMANCE_THRESHOLD || '2000'),
  userAnalytics: process.env.ENABLE_USER_ANALYTICS === 'true',
  costTracking: process.env.ENABLE_COST_TRACKING === 'true',
  securityMonitoring: process.env.ENABLE_SECURITY_MONITORING === 'true',
};

let config = { ...defaultConfig };

// State management
const monitoringState = {
  errorCount: 0,
  performanceIssues: 0,
  securityEvents: 0,
  costAlerts: 0,
  lastHealthCheck: Date.now(),
};

// User analytics tracking
const userAnalytics = {
  trackPageView: (userId: string, page: string, metadata?: any) => {
    if (!config.userAnalytics || !config.enabled) return;
    
    logger.info('Page view tracked', {
      userId,
      page,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
    
    // Track with Sentry
    Sentry.addBreadcrumb({
      message: 'Page view',
      category: 'navigation',
      data: { page, userId, ...metadata },
    });
  },
  
  trackUserAction: (userId: string, action: string, metadata?: any) => {
    if (!config.userAnalytics || !config.enabled) return;
    
    logger.info('User action tracked', {
      userId,
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
    
    // Track with Sentry
    Sentry.addBreadcrumb({
      message: 'User action',
      category: 'user',
      data: { action, userId, ...metadata },
    });
  },
  
  trackLearningEvent: (userId: string, event: string, contentId: string, metadata?: any) => {
    if (!config.userAnalytics || !config.enabled) return;
    
    const eventData = {
      userId,
      event,
      contentId,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    
    logger.info('Learning event tracked', eventData);
    
    // Track with existing metrics
    metricsUtils.recordContentView(contentId, metadata?.contentType || 'unknown', 
      metadata?.learningStyle || 'unknown', metadata?.engagementTime || 0);
    
    // Track with Sentry
    Sentry.addBreadcrumb({
      message: 'Learning event',
      category: 'learning',
      data: eventData,
    });
  },
  
  trackLearningSession: (userId: string, sessionData: any) => {
    if (!config.userAnalytics || !config.enabled) return;
    
    const { duration, contentType, learningStyle, completionRate, score } = sessionData;
    
    logger.info('Learning session tracked', {
      userId,
      duration,
      contentType,
      learningStyle,
      completionRate,
      score,
      timestamp: new Date().toISOString(),
    });
    
    // Track with existing APM
    apm.trackLearningSession(userId, contentType, duration, learningStyle, completionRate);
    
    // Track with Sentry
    Sentry.setUser({ id: userId });
    Sentry.setContext('learning_session', sessionData);
  },
  
  trackAssessmentResult: (userId: string, assessmentData: any) => {
    if (!config.userAnalytics || !config.enabled) return;
    
    const { assessmentType, score, difficulty, duration, correct, total } = assessmentData;
    
    logger.info('Assessment result tracked', {
      userId,
      assessmentType,
      score,
      difficulty,
      duration,
      correct,
      total,
      timestamp: new Date().toISOString(),
    });
    
    // Track with existing APM
    apm.trackAssessment(assessmentType, userId, score, difficulty, duration);
    
    // Track with Sentry
    Sentry.setContext('assessment_result', assessmentData);
  },
};

// Cost monitoring
const costMonitoring = {
  trackApiUsage: (service: string, usage: number, cost: number) => {
    if (!config.costTracking || !config.enabled) return;
    
    logger.info('API usage tracked', {
      service,
      usage,
      cost,
      timestamp: new Date().toISOString(),
    });
    
    // Check for cost alerts
    if (cost > parseFloat(process.env.COST_ALERT_THRESHOLD || '100')) {
      costMonitoring.sendCostAlert(service, cost);
    }
  },
  
  trackInfrastructureCost: (provider: string, resource: string, cost: number) => {
    if (!config.costTracking || !config.enabled) return;
    
    logger.info('Infrastructure cost tracked', {
      provider,
      resource,
      cost,
      timestamp: new Date().toISOString(),
    });
    
    // Check for infrastructure cost alerts
    if (cost > parseFloat(process.env.INFRA_COST_ALERT_THRESHOLD || '50')) {
      costMonitoring.sendInfrastructureCostAlert(provider, resource, cost);
    }
  },
  
  sendCostAlert: (service: string, cost: number) => {
    monitoringState.costAlerts++;
    
    logger.warn('Cost alert triggered', {
      service,
      cost,
      threshold: process.env.COST_ALERT_THRESHOLD,
      timestamp: new Date().toISOString(),
    });
    
    // Send to Sentry
    Sentry.captureMessage(`High cost alert: ${service} - $${cost}`, 'warning');
  },
  
  sendInfrastructureCostAlert: (provider: string, resource: string, cost: number) => {
    monitoringState.costAlerts++;
    
    logger.warn('Infrastructure cost alert triggered', {
      provider,
      resource,
      cost,
      threshold: process.env.INFRA_COST_ALERT_THRESHOLD,
      timestamp: new Date().toISOString(),
    });
    
    // Send to Sentry
    Sentry.captureMessage(`High infrastructure cost alert: ${provider}/${resource} - $${cost}`, 'warning');
  },
};

// Security monitoring
const securityMonitoring = {
  trackSecurityEvent: (eventType: string, severity: 'low' | 'medium' | 'high' | 'critical', details: any) => {
    if (!config.securityMonitoring || !config.enabled) return;
    
    monitoringState.securityEvents++;
    
    const eventData = {
      eventType,
      severity,
      details,
      timestamp: new Date().toISOString(),
    };
    
    logger.warn('Security event tracked', eventData);
    
    // Track with metrics
    metricsUtils.recordError(eventType, severity, 'security');
    
    // Send to Sentry based on severity
    if (severity === 'critical' || severity === 'high') {
      Sentry.captureMessage(`Security event: ${eventType}`, severity as any);
      Sentry.setContext('security_event', eventData);
    }
  },
  
  trackFailedLogin: (ip: string, userAgent: string, attemptedEmail?: string) => {
    securityMonitoring.trackSecurityEvent('failed_login', 'medium', {
      ip,
      userAgent,
      attemptedEmail,
    });
  },
  
  trackSuspiciousActivity: (userId: string, activity: string, metadata?: any) => {
    securityMonitoring.trackSecurityEvent('suspicious_activity', 'high', {
      userId,
      activity,
      ...metadata,
    });
  },
  
  trackRateLimitExceeded: (ip: string, endpoint: string, attempts: number) => {
    securityMonitoring.trackSecurityEvent('rate_limit_exceeded', 'medium', {
      ip,
      endpoint,
      attempts,
    });
  },
  
  trackUnauthorizedAccess: (ip: string, resource: string, userAgent: string) => {
    securityMonitoring.trackSecurityEvent('unauthorized_access', 'high', {
      ip,
      resource,
      userAgent,
    });
  },
};

// Error tracking
const errorTracking = {
  trackError: (error: Error, context?: any) => {
    if (!config.enabled) return;
    
    monitoringState.errorCount++;
    
    logger.error('Error tracked', {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });
    
    // Track with existing metrics
    metricsUtils.recordError(error.name, 'error', context?.component || 'unknown');
    
    // Send to Sentry
    Sentry.captureException(error, {
      contexts: {
        error_context: context,
      },
    });
    
    // Check error threshold
    if (monitoringState.errorCount > config.errorThreshold) {
      errorTracking.sendErrorAlert();
    }
  },
  
  trackUnhandledRejection: (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled promise rejection', {
      reason,
      promise,
      timestamp: new Date().toISOString(),
    });
    
    // Send to Sentry
    Sentry.captureException(new Error(`Unhandled promise rejection: ${reason}`));
  },
  
  sendErrorAlert: () => {
    logger.error('Error threshold exceeded', {
      errorCount: monitoringState.errorCount,
      threshold: config.errorThreshold,
      timestamp: new Date().toISOString(),
    });
    
    // Send to Sentry
    Sentry.captureMessage(`Error threshold exceeded: ${monitoringState.errorCount} errors`, 'error');
  },
};

// Performance monitoring
const performanceMonitoring = {
  trackPerformanceIssue: (operation: string, duration: number, metadata?: any) => {
    if (!config.enabled) return;
    
    if (duration > config.performanceThreshold) {
      monitoringState.performanceIssues++;
      
      logger.warn('Performance issue detected', {
        operation,
        duration,
        threshold: config.performanceThreshold,
        metadata,
        timestamp: new Date().toISOString(),
      });
      
      // Send to Sentry
      Sentry.captureMessage(`Performance issue: ${operation} took ${duration}ms`, 'warning');
    }
  },
  
  trackWebVitals: (metrics: any) => {
    if (!config.enabled) return;
    
    logger.info('Web vitals tracked', metrics);
    
    // Track with Sentry
    Sentry.setContext('web_vitals', metrics);
  },
};

// Health check
const healthCheck = {
  performHealthCheck: async () => {
    const now = Date.now();
    monitoringState.lastHealthCheck = now;
    
    const healthData = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 0,
      memory: process.memoryUsage ? process.memoryUsage() : {},
      errorCount: monitoringState.errorCount,
      performanceIssues: monitoringState.performanceIssues,
      securityEvents: monitoringState.securityEvents,
      costAlerts: monitoringState.costAlerts,
    };
    
    logger.info('Health check performed', healthData);
    
    return healthData;
  },
  
  isHealthy: () => {
    const now = Date.now();
    const lastCheck = monitoringState.lastHealthCheck;
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    return (now - lastCheck) < maxAge && 
           monitoringState.errorCount < config.errorThreshold &&
           monitoringState.performanceIssues < 5;
  },
};

// Configuration management
const monitoring = {
  configure: (newConfig: Partial<MonitoringConfig>) => {
    config = { ...config, ...newConfig };
    logger.info('Monitoring configuration updated', newConfig);
  },
  
  getConfig: () => ({ ...config }),
  
  getState: () => ({ ...monitoringState }),
  
  reset: () => {
    monitoringState.errorCount = 0;
    monitoringState.performanceIssues = 0;
    monitoringState.securityEvents = 0;
    monitoringState.costAlerts = 0;
    logger.info('Monitoring state reset');
  },
};

// Export everything
export {
  userAnalytics,
  costMonitoring,
  securityMonitoring,
  errorTracking,
  performanceMonitoring,
  healthCheck,
  monitoring,
};

// Initialize monitoring
if (config.enabled) {
  logger.info('Monitoring service initialized', { config });
  
  // Set up unhandled rejection tracking
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', errorTracking.trackUnhandledRejection);
  }
  
  // Set up periodic health checks
  if (typeof setInterval !== 'undefined') {
    setInterval(healthCheck.performHealthCheck, 60000); // Every minute
  }
}

// Default export (alternative access)
const monitoringService = {
  userAnalytics,
  costMonitoring,
  securityMonitoring,
  errorTracking,
  performanceMonitoring,
  healthCheck,
  monitoring,
};

export default monitoringService;