/**
 * Request monitoring middleware
 * Tracks all HTTP requests with performance metrics and error handling
 */
import { NextRequest, NextResponse } from 'next/server';
import { requestMonitoring } from '../lib/monitoring';
import { alertManager } from '../lib/alerts';
import { createLogger } from '../lib/logger';
import { securityMonitoring } from '../lib/monitoring/security-monitoring';

const logger = createLogger('monitoring-middleware');

// Request tracking
const requestTracker = new Map<string, {
  startTime: number;
  trace: any;
  metadata: Record<string, any>;
}>();

// Rate limiting for monitoring
const rateLimiter = new Map<string, number[]>();

// Error tracking
const errorTracker = new Map<string, number>();

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  slow: 2000, // 2 seconds
  verySlow: 5000, // 5 seconds
  critical: 10000, // 10 seconds
};

// Monitoring configuration
const config = {
  enabled: process.env.ENABLE_REQUEST_MONITORING !== 'false',
  sampleRate: parseFloat(process.env.REQUEST_MONITORING_SAMPLE_RATE || '1.0'),
  maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100'),
  trackUserAgent: process.env.TRACK_USER_AGENT === 'true',
  trackGeoLocation: process.env.TRACK_GEO_LOCATION === 'true',
  alertOnSlowRequests: process.env.ALERT_ON_SLOW_REQUESTS === 'true',
  alertOnErrorSpikes: process.env.ALERT_ON_ERROR_SPIKES === 'true',
};

// Extract client information
const extractClientInfo = (req: NextRequest) => {
  const ip = req.ip || 
    req.headers.get('x-forwarded-for')?.split(',')[0] || 
    req.headers.get('x-real-ip') || 
    'unknown';

  const userAgent = req.headers.get('user-agent') || 'unknown';
  const referer = req.headers.get('referer') || 'direct';
  const origin = req.headers.get('origin') || 'unknown';

  return {
    ip,
    userAgent: config.trackUserAgent ? userAgent : 'hidden',
    referer,
    origin,
  };
};

// Check rate limits
const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const windowStart = now - (60 * 1000); // 1 minute window

  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, []);
  }

  const requests = rateLimiter.get(ip)!;
  const recentRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= config.maxRequestsPerMinute) {
    return false;
  }

  recentRequests.push(now);
  rateLimiter.set(ip, recentRequests);
  
  return true;
};

// Track error patterns
const trackErrorPattern = (ip: string, statusCode: number) => {
  if (statusCode >= 400) {
    const errorKey = `${ip}-errors`;
    const currentCount = errorTracker.get(errorKey) || 0;
    errorTracker.set(errorKey, currentCount + 1);

    // Check for error spikes
    if (currentCount > 10 && config.alertOnErrorSpikes) {
      alertManager.createAlert({
        title: 'Error Spike Detected',
        message: `High error rate detected from IP ${ip}: ${currentCount} errors`,
        severity: 'warning',
        category: 'security',
        source: 'monitoring-middleware',
        metadata: {
          ip,
          errorCount: currentCount,
          statusCode,
        },
      });
    }
  }
};

// Monitor request performance
const monitorRequestPerformance = async (
  req: NextRequest,
  response: NextResponse,
  duration: number,
  metadata: Record<string, any>
) => {
  const { ip, userAgent } = extractClientInfo(req);

  // Check for slow requests
  if (duration > PERFORMANCE_THRESHOLDS.slow && config.alertOnSlowRequests) {
    const severity = duration > PERFORMANCE_THRESHOLDS.critical ? 'critical' : 
                    duration > PERFORMANCE_THRESHOLDS.verySlow ? 'error' : 'warning';

    await alertManager.createAlert({
      title: 'Slow Request Detected',
      message: `Request took ${duration}ms to complete`,
      severity,
      category: 'performance',
      source: 'monitoring-middleware',
      metadata: {
        url: req.url,
        method: req.method,
        duration,
        ip,
        userAgent,
        statusCode: response.status,
        ...metadata,
      },
    });
  }

  // Track error patterns
  trackErrorPattern(ip, response.status);

  // Log request details
  logger.info('Request completed', {
    method: req.method,
    url: req.url,
    statusCode: response.status,
    duration,
    ip,
    userAgent: config.trackUserAgent ? userAgent : 'hidden',
    ...metadata,
  });
};

// Security monitoring
const monitorSecurity = async (req: NextRequest, response: NextResponse) => {
  const { ip, userAgent } = extractClientInfo(req);

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\/|\.\.\\/, // Path traversal
    /<script|javascript:/i, // XSS attempts
    /union\s+select|select\s+.*\s+from/i, // SQL injection
    /eval\s*\(|exec\s*\(|system\s*\(/i, // Code injection
  ];

  const url = req.url;
  const hasSuspiciousPattern = suspiciousPatterns.some(pattern => pattern.test(url));

  if (hasSuspiciousPattern) {
    await securityMonitoring.trackSecurityEvent('suspicious_request', 'high', {
      ip,
      userAgent,
      url,
      method: req.method,
      suspiciousPattern: 'detected',
    });

    await alertManager.createAlert({
      title: 'Suspicious Request Pattern',
      message: `Potential security threat detected in request`,
      severity: 'error',
      category: 'security',
      source: 'monitoring-middleware',
      metadata: {
        ip,
        userAgent,
        url,
        method: req.method,
      },
    });
  }

  // Check for failed authentication attempts
  if (response.status === 401 || response.status === 403) {
    await securityMonitoring.trackFailedLogin(ip, userAgent);
  }

  // Check for rate limit violations
  if (response.status === 429) {
    await securityMonitoring.trackRateLimitExceeded(ip, url, 1);
  }
};

// Main monitoring middleware
export const monitoringMiddleware = async (req: NextRequest) => {
  if (!config.enabled) {
    return NextResponse.next();
  }

  const startTime = Date.now();
  const requestId = `req-${startTime}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Extract client info
  const clientInfo = extractClientInfo(req);
  
  // Check rate limits
  if (!checkRateLimit(clientInfo.ip)) {
    logger.warn('Rate limit exceeded', {
      ip: clientInfo.ip,
      url: req.url,
      method: req.method,
    });

    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': config.maxRequestsPerMinute.toString(),
        'X-RateLimit-Reset': (Date.now() + 60000).toString(),
      },
    });
  }

  // Start monitoring
  const monitoring = requestMonitoring(req);
  
  // Track request
  requestTracker.set(requestId, {
    startTime,
    trace: monitoring?.trace,
    metadata: {
      ...clientInfo,
      requestId,
      path: new URL(req.url).pathname,
    },
  });

  // Sample requests for detailed monitoring
  const shouldSample = Math.random() < config.sampleRate;
  
  if (shouldSample) {
    logger.debug('Request started', {
      requestId,
      method: req.method,
      url: req.url,
      ...clientInfo,
    });
  }

  // Process request
  const response = NextResponse.next();
  
  // Add monitoring headers
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Monitored', 'true');
  response.headers.set('X-Response-Time', (Date.now() - startTime).toString());

  // Track response
  const duration = Date.now() - startTime;
  const requestData = requestTracker.get(requestId);
  
  if (requestData) {
    // End monitoring
    if (monitoring) {
      monitoring.end(response);
    }

    // Monitor performance
    await monitorRequestPerformance(req, response, duration, requestData.metadata);
    
    // Monitor security
    await monitorSecurity(req, response);
    
    // Cleanup
    requestTracker.delete(requestId);
  }

  return response;
};

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  // Cleanup old request tracking
  for (const [requestId, data] of requestTracker.entries()) {
    if (now - data.startTime > maxAge) {
      requestTracker.delete(requestId);
    }
  }

  // Cleanup rate limiter
  for (const [ip, requests] of rateLimiter.entries()) {
    const recentRequests = requests.filter(timestamp => timestamp > now - 60000);
    if (recentRequests.length === 0) {
      rateLimiter.delete(ip);
    } else {
      rateLimiter.set(ip, recentRequests);
    }
  }

  // Cleanup error tracker
  for (const [key, count] of errorTracker.entries()) {
    if (count === 0) {
      errorTracker.delete(key);
    } else {
      // Decay error counts over time
      errorTracker.set(key, Math.max(0, count - 1));
    }
  }
}, 60000); // Run every minute

// Export monitoring utilities
export const monitoringUtils = {
  getRequestStats: () => ({
    activeRequests: requestTracker.size,
    rateLimitedIPs: rateLimiter.size,
    errorTracking: errorTracker.size,
  }),
  
  getIPStats: (ip: string) => ({
    recentRequests: rateLimiter.get(ip)?.length || 0,
    errorCount: errorTracker.get(`${ip}-errors`) || 0,
  }),
  
  clearTracking: () => {
    requestTracker.clear();
    rateLimiter.clear();
    errorTracker.clear();
  },
  
  getConfig: () => config,
  
  updateConfig: (updates: Partial<typeof config>) => {
    Object.assign(config, updates);
    logger.info('Monitoring middleware configuration updated', updates);
  },
};

export default monitoringMiddleware;