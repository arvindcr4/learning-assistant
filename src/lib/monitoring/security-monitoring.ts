// Enhanced security monitoring and threat detection
import logger from '../logger';
import { metricsUtils } from '../metrics';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  source: {
    ip: string;
    userAgent?: string;
    country?: string;
    userId?: string;
  };
  target: {
    resource: string;
    action: string;
    method?: string;
  };
  details: any;
  risk_score: number;
  mitigated: boolean;
}

export type SecurityEventType = 
  | 'failed_login'
  | 'brute_force_attempt'
  | 'suspicious_activity'
  | 'unauthorized_access'
  | 'privilege_escalation'
  | 'data_exfiltration'
  | 'injection_attempt'
  | 'xss_attempt'
  | 'csrf_attempt'
  | 'rate_limit_exceeded'
  | 'anomalous_behavior'
  | 'malware_detected'
  | 'insider_threat';

export interface ThreatIntelligence {
  ip: string;
  reputation: 'good' | 'suspicious' | 'malicious';
  sources: string[];
  last_seen: string;
  threat_types: string[];
}

export interface SecurityMetrics {
  total_events: number;
  events_by_severity: Record<string, number>;
  events_by_type: Record<string, number>;
  blocked_attempts: number;
  false_positives: number;
  mean_time_to_detect: number;
  mean_time_to_respond: number;
}

// Security configuration
const securityConfig = {
  enabled: process.env.ENABLE_SECURITY_MONITORING === 'true',
  maxFailedLogins: parseInt(process.env.MAX_FAILED_LOGINS || '5'),
  bruteForceWindow: parseInt(process.env.BRUTE_FORCE_WINDOW || '300'), // 5 minutes
  suspiciousThreshold: parseInt(process.env.SUSPICIOUS_THRESHOLD || '10'),
  riskScoreThreshold: parseInt(process.env.RISK_SCORE_THRESHOLD || '70'),
  autoBlock: process.env.AUTO_BLOCK_THREATS === 'true',
  threatIntelEnabled: process.env.THREAT_INTEL_ENABLED === 'true',
};

// Security state tracking
const securityState = {
  events: [] as SecurityEvent[],
  blockedIPs: new Set<string>(),
  failedLogins: new Map<string, number>(),
  bruteForceAttempts: new Map<string, { count: number; lastAttempt: number }>(),
  suspiciousActivities: new Map<string, number>(),
  threatIntel: new Map<string, ThreatIntelligence>(),
  metrics: {
    total_events: 0,
    events_by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
    events_by_type: {},
    blocked_attempts: 0,
    false_positives: 0,
    mean_time_to_detect: 0,
    mean_time_to_respond: 0,
  } as SecurityMetrics,
};

// Risk scoring algorithms
const riskScoring = {
  calculateBaseRisk: (eventType: SecurityEventType): number => {
    const riskMap: Record<SecurityEventType, number> = {
      failed_login: 20,
      brute_force_attempt: 80,
      suspicious_activity: 60,
      unauthorized_access: 90,
      privilege_escalation: 95,
      data_exfiltration: 100,
      injection_attempt: 85,
      xss_attempt: 70,
      csrf_attempt: 65,
      rate_limit_exceeded: 40,
      anomalous_behavior: 50,
      malware_detected: 100,
      insider_threat: 95,
    };
    
    return riskMap[eventType] || 30;
  },

  calculateIPRisk: (ip: string): number => {
    let risk = 0;
    
    // Check if IP is in threat intelligence
    const threatInfo = securityState.threatIntel.get(ip);
    if (threatInfo) {
      risk += threatInfo.reputation === 'malicious' ? 50 : 
              threatInfo.reputation === 'suspicious' ? 30 : 0;
    }
    
    // Check failed login attempts
    const failedAttempts = securityState.failedLogins.get(ip) || 0;
    risk += Math.min(failedAttempts * 5, 30);
    
    // Check brute force attempts
    const bruteForce = securityState.bruteForceAttempts.get(ip);
    if (bruteForce) {
      risk += Math.min(bruteForce.count * 10, 40);
    }
    
    return Math.min(risk, 100);
  },

  calculateUserRisk: (userId: string): number => {
    let risk = 0;
    
    // Check recent security events for this user
    const userEvents = securityState.events.filter(e => 
      e.source.userId === userId && 
      Date.now() - new Date(e.timestamp).getTime() < 86400000 // Last 24 hours
    );
    
    risk += Math.min(userEvents.length * 5, 30);
    
    // Check for privilege escalation attempts
    const privilegeEvents = userEvents.filter(e => e.type === 'privilege_escalation');
    risk += privilegeEvents.length * 20;
    
    return Math.min(risk, 100);
  },

  calculateOverallRisk: (event: Partial<SecurityEvent>): number => {
    const baseRisk = riskScoring.calculateBaseRisk(event.type!);
    const ipRisk = event.source?.ip ? riskScoring.calculateIPRisk(event.source.ip) : 0;
    const userRisk = event.source?.userId ? riskScoring.calculateUserRisk(event.source.userId) : 0;
    
    // Weighted average
    return Math.round((baseRisk * 0.5 + ipRisk * 0.3 + userRisk * 0.2));
  },
};

// Threat detection algorithms
const threatDetection = {
  detectBruteForce: (ip: string): boolean => {
    const attempts = securityState.bruteForceAttempts.get(ip);
    if (!attempts) return false;
    
    const now = Date.now();
    const windowStart = now - securityConfig.bruteForceWindow * 1000;
    
    return attempts.count >= securityConfig.maxFailedLogins && 
           attempts.lastAttempt > windowStart;
  },

  detectAnomalousBehavior: (userId: string, action: string): boolean => {
    // Simple anomaly detection based on frequency
    const userEvents = securityState.events.filter(e => 
      e.source.userId === userId && 
      e.target.action === action &&
      Date.now() - new Date(e.timestamp).getTime() < 3600000 // Last hour
    );
    
    return userEvents.length > securityConfig.suspiciousThreshold;
  },

  detectInjectionAttempt: (payload: string): boolean => {
    const patterns = [
      /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL injection
      /<script[^>]*>.*?<\/script>/gi, // XSS
      /javascript:/gi, // JavaScript injection
      /data:text\/html/gi, // Data URI XSS
      /vbscript:/gi, // VBScript injection
    ];
    
    return patterns.some(pattern => pattern.test(payload));
  },

  detectSuspiciousUserAgent: (userAgent: string): boolean => {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /php/i,
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  },
};

// Main security monitoring service
export const securityMonitoring = {
  trackEvent: (eventData: Omit<SecurityEvent, 'id' | 'timestamp' | 'risk_score' | 'mitigated'>) => {
    if (!securityConfig.enabled) return;

    const event: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      risk_score: riskScoring.calculateOverallRisk(eventData),
      mitigated: false,
      ...eventData,
    };

    // Store event
    securityState.events.push(event);
    
    // Update metrics
    securityState.metrics.total_events++;
    securityState.metrics.events_by_severity[event.severity]++;
    securityState.metrics.events_by_type[event.type] = 
      (securityState.metrics.events_by_type[event.type] || 0) + 1;

    // Log event
    logger.warn('Security event detected', {
      id: event.id,
      type: event.type,
      severity: event.severity,
      risk_score: event.risk_score,
      source_ip: event.source.ip,
      target_resource: event.target.resource,
    });

    // Track with metrics
    metricsUtils.recordError(event.type, event.severity, 'security');

    // Check for automatic mitigation
    if (event.risk_score >= securityConfig.riskScoreThreshold) {
      securityMonitoring.mitigateEvent(event);
    }

    // Clean up old events (keep last 1000)
    if (securityState.events.length > 1000) {
      securityState.events = securityState.events.slice(-1000);
    }

    return event;
  },

  trackFailedLogin: (ip: string, userAgent: string, attemptedEmail?: string) => {
    // Update failed login count
    const currentCount = securityState.failedLogins.get(ip) || 0;
    securityState.failedLogins.set(ip, currentCount + 1);

    // Update brute force tracking
    const now = Date.now();
    const bruteForce = securityState.bruteForceAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    
    if (now - bruteForce.lastAttempt < securityConfig.bruteForceWindow * 1000) {
      bruteForce.count++;
    } else {
      bruteForce.count = 1;
    }
    bruteForce.lastAttempt = now;
    
    securityState.bruteForceAttempts.set(ip, bruteForce);

    // Determine event type
    const isBruteForce = threatDetection.detectBruteForce(ip);
    const eventType = isBruteForce ? 'brute_force_attempt' : 'failed_login';

    return securityMonitoring.trackEvent({
      type: eventType,
      severity: isBruteForce ? 'high' : 'medium',
      source: { ip, userAgent },
      target: { resource: 'auth', action: 'login' },
      details: { attempted_email: attemptedEmail, failed_count: currentCount + 1 },
    });
  },

  trackSuspiciousActivity: (userId: string, ip: string, activity: string, details?: any) => {
    const currentCount = securityState.suspiciousActivities.get(userId) || 0;
    securityState.suspiciousActivities.set(userId, currentCount + 1);

    const isAnomalous = threatDetection.detectAnomalousBehavior(userId, activity);

    return securityMonitoring.trackEvent({
      type: isAnomalous ? 'anomalous_behavior' : 'suspicious_activity',
      severity: isAnomalous ? 'high' : 'medium',
      source: { ip, userId },
      target: { resource: details?.resource || 'unknown', action: activity },
      details: { ...details, suspicious_count: currentCount + 1 },
    });
  },

  trackUnauthorizedAccess: (ip: string, resource: string, userAgent: string, userId?: string) => {
    return securityMonitoring.trackEvent({
      type: 'unauthorized_access',
      severity: 'high',
      source: { ip, userAgent, userId },
      target: { resource, action: 'access' },
      details: { attempted_access: resource },
    });
  },

  trackInjectionAttempt: (ip: string, payload: string, type: 'sql' | 'xss' | 'other', userAgent?: string) => {
    return securityMonitoring.trackEvent({
      type: 'injection_attempt',
      severity: 'high',
      source: { ip, userAgent },
      target: { resource: 'application', action: 'inject' },
      details: { injection_type: type, payload: payload.substring(0, 200) },
    });
  },

  trackRateLimitExceeded: (ip: string, endpoint: string, attempts: number, userAgent?: string) => {
    return securityMonitoring.trackEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      source: { ip, userAgent },
      target: { resource: endpoint, action: 'request' },
      details: { attempts, limit_exceeded: true },
    });
  },

  mitigateEvent: (event: SecurityEvent) => {
    if (!securityConfig.autoBlock) return;

    logger.warn('Mitigating security event', {
      event_id: event.id,
      type: event.type,
      risk_score: event.risk_score,
      source_ip: event.source.ip,
    });

    // Block IP if risk score is high enough
    if (event.risk_score >= 80 && event.source.ip) {
      securityMonitoring.blockIP(event.source.ip, 'High risk security event');
    }

    // Mark event as mitigated
    event.mitigated = true;
    securityState.metrics.blocked_attempts++;
  },

  blockIP: (ip: string, reason: string) => {
    securityState.blockedIPs.add(ip);
    
    logger.warn('IP blocked', { ip, reason });
    
    // In a real implementation, you would integrate with:
    // - Firewall rules
    // - Load balancer
    // - CDN/WAF
    // - Rate limiting middleware
  },

  unblockIP: (ip: string) => {
    securityState.blockedIPs.delete(ip);
    logger.info('IP unblocked', { ip });
  },

  isIPBlocked: (ip: string): boolean => {
    return securityState.blockedIPs.has(ip);
  },

  analyzeRequest: (req: any) => {
    const { method, url, headers, body } = req;
    const ip = headers['x-forwarded-for'] || headers['x-real-ip'] || req.connection?.remoteAddress;
    const userAgent = headers['user-agent'] || '';

    // Check if IP is blocked
    if (securityMonitoring.isIPBlocked(ip)) {
      throw new Error('IP is blocked due to security concerns');
    }

    // Check for suspicious user agent
    if (threatDetection.detectSuspiciousUserAgent(userAgent)) {
      securityMonitoring.trackEvent({
        type: 'suspicious_activity',
        severity: 'low',
        source: { ip, userAgent },
        target: { resource: url, action: method },
        details: { suspicious_user_agent: true },
      });
    }

    // Check for injection attempts in query params and body
    const fullUrl = url + (body ? JSON.stringify(body) : '');
    if (threatDetection.detectInjectionAttempt(fullUrl)) {
      const injectionType = fullUrl.includes('<script') ? 'xss' : 
                           fullUrl.includes('SELECT') || fullUrl.includes('UNION') ? 'sql' : 'other';
      
      securityMonitoring.trackInjectionAttempt(ip, fullUrl, injectionType, userAgent);
    }

    return { ip, userAgent, safe: true };
  },

  getMetrics: (): SecurityMetrics => {
    return { ...securityState.metrics };
  },

  getRecentEvents: (limit: number = 100): SecurityEvent[] => {
    return securityState.events.slice(-limit);
  },

  getHighRiskEvents: (riskThreshold: number = 70): SecurityEvent[] => {
    return securityState.events.filter(event => 
      event.risk_score >= riskThreshold &&
      Date.now() - new Date(event.timestamp).getTime() < 86400000 // Last 24 hours
    );
  },

  getThreatSummary: () => {
    const now = Date.now();
    const last24h = securityState.events.filter(event => 
      now - new Date(event.timestamp).getTime() < 86400000
    );

    return {
      total_events: last24h.length,
      high_risk_events: last24h.filter(e => e.risk_score >= 70).length,
      blocked_ips: securityState.blockedIPs.size,
      top_threat_types: Object.entries(
        last24h.reduce((acc, event) => {
          acc[event.type] = (acc[event.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1]).slice(0, 5),
      avg_risk_score: last24h.length > 0 
        ? last24h.reduce((sum, e) => sum + e.risk_score, 0) / last24h.length 
        : 0,
    };
  },

  reset: () => {
    securityState.events = [];
    securityState.blockedIPs.clear();
    securityState.failedLogins.clear();
    securityState.bruteForceAttempts.clear();
    securityState.suspiciousActivities.clear();
    securityState.metrics = {
      total_events: 0,
      events_by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
      events_by_type: {},
      blocked_attempts: 0,
      false_positives: 0,
      mean_time_to_detect: 0,
      mean_time_to_respond: 0,
    };
  },
};

// Periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const cutoff = 24 * 60 * 60 * 1000; // 24 hours
    
    // Clean up old failed login attempts
    for (const [ip, timestamp] of securityState.failedLogins.entries()) {
      if (now - timestamp > cutoff) {
        securityState.failedLogins.delete(ip);
      }
    }
    
    // Clean up old brute force attempts
    for (const [ip, attempt] of securityState.bruteForceAttempts.entries()) {
      if (now - attempt.lastAttempt > cutoff) {
        securityState.bruteForceAttempts.delete(ip);
      }
    }
  }, 60 * 60 * 1000); // Run every hour
}

export default securityMonitoring;