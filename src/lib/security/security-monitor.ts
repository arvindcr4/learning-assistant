import { NextRequest, NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';

// Security event types
export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'auth_success',
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHORIZATION_DENIED = 'authz_denied',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  ADMIN_ACTION = 'admin_action',
  SECURITY_POLICY_VIOLATION = 'security_policy_violation',
  MALICIOUS_REQUEST = 'malicious_request',
  DDOS_ATTEMPT = 'ddos_attempt',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  SESSION_HIJACK_ATTEMPT = 'session_hijack_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
  DIRECTORY_TRAVERSAL_ATTEMPT = 'directory_traversal_attempt',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  COMPLIANCE_VIOLATION = 'compliance_violation',
  SECURITY_CONFIGURATION_CHANGE = 'security_config_change',
  ERROR_RATE_SPIKE = 'error_rate_spike',
  ANOMALOUS_BEHAVIOR = 'anomalous_behavior',
}

// Security event severity levels
export enum SecurityEventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Security event interface
export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  source: string;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  riskScore: number;
  threatSignatures: string[];
  metadata: Record<string, any>;
  correlationId?: string;
  mitigated: boolean;
  mitigationActions: string[];
}

// Security alert interface
export interface SecurityAlert {
  id: string;
  timestamp: Date;
  title: string;
  description: string;
  severity: SecurityEventSeverity;
  category: string;
  eventIds: string[];
  affectedResources: string[];
  recommendation: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  escalated: boolean;
  escalatedTo?: string;
  escalatedAt?: Date;
}

// Performance metrics
export interface PerformanceMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  throughput: number;
  concurrentUsers: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Threat intelligence
export interface ThreatIntelligence {
  maliciousIPs: Set<string>;
  suspiciousUserAgents: Set<string>;
  knownAttackPatterns: RegExp[];
  blockedDomains: Set<string>;
  compromisedAccounts: Set<string>;
  lastUpdated: Date;
}

// Behavioral analysis interfaces
export interface UserBehaviorProfile {
  userId: string;
  createdAt: Date;
  lastUpdated: Date;
  loginPatterns: {
    typicalHours: number[];
    typicalDays: number[];
    averageSessionDuration: number;
    frequentLocations: string[];
    deviceFingerprints: string[];
  };
  activityPatterns: {
    averageRequestsPerMinute: number;
    commonEndpoints: string[];
    typicalUserAgents: string[];
    navigationPatterns: string[];
  };
  anomalyScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trainedSamples: number;
}

export interface MLThreatModel {
  modelType: 'anomaly_detection' | 'classification' | 'clustering';
  algorithm: 'isolation_forest' | 'one_class_svm' | 'autoencoder' | 'random_forest';
  features: string[];
  threshold: number;
  accuracy: number;
  lastTrained: Date;
  trainingData: any[];
  modelData: any;
}

export interface RiskScore {
  userId: string;
  ipAddress: string;
  sessionId: string;
  timestamp: Date;
  components: {
    behavioral: number;
    geographical: number;
    temporal: number;
    technical: number;
    historical: number;
  };
  totalScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  confidence: number;
}

// Security monitoring configuration
export interface SecurityMonitorConfig {
  enableRealTimeMonitoring: boolean;
  enableAnomalyDetection: boolean;
  enableThreatIntelligence: boolean;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    requestVolume: number;
    failedAuthAttempts: number;
    suspiciousScore: number;
  };
  retentionPeriod: number;
  alertingEnabled: boolean;
  notificationChannels: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class SecurityMonitoringService {
  private events: LRUCache<string, SecurityEvent>;
  private alerts: LRUCache<string, SecurityAlert>;
  private metrics: LRUCache<string, PerformanceMetrics>;
  private threatIntel: ThreatIntelligence;
  private config: SecurityMonitorConfig;
  private anomalyBaselines: Map<string, number[]>;
  private correlationMap: Map<string, string[]>;
  private activeSessions: Map<string, any>;
  private behavioralProfiles: Map<string, UserBehaviorProfile>;
  private mlModels: Map<string, MLThreatModel>;
  private riskScores: Map<string, RiskScore>;

  constructor(config: Partial<SecurityMonitorConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      enableAnomalyDetection: true,
      enableThreatIntelligence: true,
      alertThresholds: {
        errorRate: 0.05, // 5%
        responseTime: 5000, // 5 seconds
        requestVolume: 1000, // requests per minute
        failedAuthAttempts: 10, // per 5 minutes
        suspiciousScore: 70,
      },
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      alertingEnabled: true,
      notificationChannels: ['console', 'webhook'],
      logLevel: 'info',
      ...config,
    };

    // Initialize caches
    this.events = new LRUCache<string, SecurityEvent>({
      max: 100000,
      ttl: this.config.retentionPeriod,
      updateAgeOnGet: true,
    });

    this.alerts = new LRUCache<string, SecurityAlert>({
      max: 10000,
      ttl: this.config.retentionPeriod,
      updateAgeOnGet: true,
    });

    this.metrics = new LRUCache<string, PerformanceMetrics>({
      max: 10000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      updateAgeOnGet: true,
    });

    // Initialize threat intelligence
    this.threatIntel = {
      maliciousIPs: new Set(),
      suspiciousUserAgents: new Set(),
      knownAttackPatterns: this.getDefaultAttackPatterns(),
      blockedDomains: new Set(),
      compromisedAccounts: new Set(),
      lastUpdated: new Date(),
    };

    this.anomalyBaselines = new Map();
    this.correlationMap = new Map();
    this.activeSessions = new Map();
    this.behavioralProfiles = new Map();
    this.mlModels = new Map();
    this.riskScores = new Map();

    // Initialize ML models
    this.initializeMachineLearningModels();

    // Start background tasks
    this.startBackgroundTasks();
  }

  /**
   * Create monitoring middleware
   */
  public createMonitoringMiddleware() {
    return (request: NextRequest, response?: NextResponse) => {
      const startTime = Date.now();
      const requestId = this.generateRequestId();

      // Pre-request monitoring
      this.monitorRequest(request, requestId, startTime);

      // Return response interceptor
      return (response: NextResponse): NextResponse => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        // Post-response monitoring
        this.monitorResponse(request, response, requestId, responseTime);

        return response;
      };
    };
  }

  /**
   * Monitor incoming request
   */
  private monitorRequest(request: NextRequest, requestId: string, startTime: number): void {
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const endpoint = request.nextUrl.pathname;
    const method = request.method;

    // Real-time threat detection
    if (this.config.enableRealTimeMonitoring) {
      this.performRealTimeThreatDetection(request, requestId);
    }

    // Check against threat intelligence
    if (this.config.enableThreatIntelligence) {
      this.checkThreatIntelligence(request, requestId);
    }

    // Log request details
    this.logEvent(SecurityEventType.DATA_ACCESS, SecurityEventSeverity.LOW, {
      requestId,
      source: `${method} ${endpoint}`,
      ipAddress,
      userAgent,
      endpoint,
      method,
      startTime,
      contentLength: parseInt(request.headers.get('content-length') || '0'),
    });
  }

  /**
   * Monitor response
   */
  private monitorResponse(
    request: NextRequest,
    response: NextResponse,
    requestId: string,
    responseTime: number
  ): void {
    const statusCode = response.status;
    const responseSize = parseInt(response.headers.get('content-length') || '0');

    // Update performance metrics
    this.updatePerformanceMetrics(request, responseTime, statusCode);

    // Detect anomalies
    if (this.config.enableAnomalyDetection) {
      this.detectAnomalies(request, responseTime, statusCode);
    }

    // Check for error patterns
    if (statusCode >= 400) {
      this.handleErrorResponse(request, response, requestId, responseTime);
    }

    // Log response details
    this.logEvent(SecurityEventType.DATA_ACCESS, SecurityEventSeverity.LOW, {
      requestId,
      source: `${request.method} ${request.nextUrl.pathname}`,
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || 'unknown',
      endpoint: request.nextUrl.pathname,
      method: request.method,
      statusCode,
      responseTime,
      responseSize,
    });
  }

  /**
   * Real-time threat detection
   */
  private performRealTimeThreatDetection(request: NextRequest, requestId: string): void {
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const url = request.nextUrl.toString();

    let threatSignatures: string[] = [];
    let riskScore = 0;

    // Check for malicious patterns
    for (const pattern of this.threatIntel.knownAttackPatterns) {
      if (pattern.test(url) || pattern.test(userAgent)) {
        threatSignatures.push(pattern.source);
        riskScore += 30;
      }
    }

    // Check for known malicious IPs
    if (this.threatIntel.maliciousIPs.has(ipAddress)) {
      threatSignatures.push('known_malicious_ip');
      riskScore += 50;
    }

    // Check for suspicious user agents
    if (this.threatIntel.suspiciousUserAgents.has(userAgent)) {
      threatSignatures.push('suspicious_user_agent');
      riskScore += 25;
    }

    // Check for rapid requests from same IP
    const recentRequests = this.getRecentRequestsByIP(ipAddress);
    if (recentRequests.length > 100) {
      threatSignatures.push('rapid_requests');
      riskScore += 40;
    }

    // Generate alert if risk score is high
    if (riskScore > this.config.alertThresholds.suspiciousScore) {
      this.createAlert({
        title: 'High-Risk Request Detected',
        description: `Request with risk score ${riskScore} detected from ${ipAddress}`,
        severity: riskScore > 80 ? SecurityEventSeverity.CRITICAL : SecurityEventSeverity.HIGH,
        category: 'threat_detection',
        eventIds: [requestId],
        affectedResources: [request.nextUrl.pathname],
        recommendation: 'Investigate request source and consider blocking if malicious',
      });
    }
  }

  /**
   * Check threat intelligence
   */
  private checkThreatIntelligence(request: NextRequest, requestId: string): void {
    const ipAddress = this.getClientIP(request);
    const referer = request.headers.get('referer') || '';

    // Check referer against blocked domains
    if (referer) {
      try {
        const refererDomain = new URL(referer).hostname;
        if (this.threatIntel.blockedDomains.has(refererDomain)) {
          this.logEvent(SecurityEventType.SECURITY_POLICY_VIOLATION, SecurityEventSeverity.HIGH, {
            requestId,
            source: 'threat_intelligence',
            ipAddress,
            endpoint: request.nextUrl.pathname,
            method: request.method,
            reason: 'blocked_referer_domain',
            blockedDomain: refererDomain,
          });
        }
      } catch (error) {
        // Invalid referer URL
      }
    }

    // Update threat intelligence with new data
    this.updateThreatIntelligence(request);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(
    request: NextRequest,
    responseTime: number,
    statusCode: number
  ): void {
    const endpoint = request.nextUrl.pathname;
    const now = Date.now();
    const minuteKey = `${endpoint}:${Math.floor(now / 60000)}`;

    let metrics = this.metrics.get(minuteKey) || {
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestsPerSecond: 0,
      errorRate: 0,
      throughput: 0,
      concurrentUsers: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };

    // Update response time metrics
    const responseTimes = this.getRecentResponseTimes(endpoint);
    responseTimes.push(responseTime);

    metrics.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    metrics.p95ResponseTime = this.calculatePercentile(responseTimes, 95);
    metrics.p99ResponseTime = this.calculatePercentile(responseTimes, 99);

    // Update error rate
    const recentRequests = this.getRecentRequestsByEndpoint(endpoint);
    const errorCount = recentRequests.filter(req => req.statusCode >= 400).length;
    metrics.errorRate = recentRequests.length > 0 ? errorCount / recentRequests.length : 0;

    // Update requests per second
    const requestsInLastMinute = recentRequests.filter(
      req => now - req.timestamp.getTime() < 60000
    ).length;
    metrics.requestsPerSecond = requestsInLastMinute / 60;

    this.metrics.set(minuteKey, metrics);

    // Check alert thresholds
    this.checkPerformanceAlerts(endpoint, metrics);
  }

  /**
   * Detect anomalies
   */
  private detectAnomalies(request: NextRequest, responseTime: number, statusCode: number): void {
    const endpoint = request.nextUrl.pathname;
    const ipAddress = this.getClientIP(request);

    // Get baseline metrics
    const baseline = this.anomalyBaselines.get(endpoint) || [];
    baseline.push(responseTime);

    // Keep only recent baselines (last 1000 requests)
    if (baseline.length > 1000) {
      baseline.splice(0, baseline.length - 1000);
    }

    this.anomalyBaselines.set(endpoint, baseline);

    // Calculate statistical anomalies
    if (baseline.length >= 100) {
      const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length;
      const variance = baseline.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / baseline.length;
      const stdDev = Math.sqrt(variance);

      // Detect response time anomalies (> 3 standard deviations)
      if (Math.abs(responseTime - mean) > 3 * stdDev) {
        this.logEvent(SecurityEventType.ANOMALOUS_BEHAVIOR, SecurityEventSeverity.MEDIUM, {
          source: 'anomaly_detection',
          ipAddress,
          endpoint,
          method: request.method,
          responseTime,
          baseline: mean,
          standardDeviation: stdDev,
          anomalyType: 'response_time',
        });
      }
    }

    // Detect request pattern anomalies
    this.detectRequestPatternAnomalies(ipAddress, endpoint);
  }

  /**
   * Detect request pattern anomalies
   */
  private detectRequestPatternAnomalies(ipAddress: string, endpoint: string): void {
    const recentRequests = this.getRecentRequestsByIP(ipAddress);
    const timeWindows = [60000, 300000, 900000]; // 1min, 5min, 15min

    for (const window of timeWindows) {
      const windowRequests = recentRequests.filter(
        req => Date.now() - req.timestamp.getTime() < window
      );

      // Check for burst patterns
      if (windowRequests.length > 50 && window === 60000) {
        this.logEvent(SecurityEventType.ANOMALOUS_BEHAVIOR, SecurityEventSeverity.HIGH, {
          source: 'pattern_anomaly',
          ipAddress,
          endpoint,
          anomalyType: 'request_burst',
          requestCount: windowRequests.length,
          timeWindow: window,
        });
      }

      // Check for distributed attacks
      const uniqueEndpoints = new Set(windowRequests.map(req => req.endpoint));
      if (uniqueEndpoints.size > 20 && window === 300000) {
        this.logEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, SecurityEventSeverity.HIGH, {
          source: 'pattern_anomaly',
          ipAddress,
          anomalyType: 'endpoint_scanning',
          uniqueEndpoints: uniqueEndpoints.size,
          timeWindow: window,
        });
      }
    }
  }

  /**
   * Handle error responses
   */
  private handleErrorResponse(
    request: NextRequest,
    response: NextResponse,
    requestId: string,
    responseTime: number
  ): void {
    const statusCode = response.status;
    const ipAddress = this.getClientIP(request);
    const endpoint = request.nextUrl.pathname;

    let eventType: SecurityEventType;
    let severity: SecurityEventSeverity;

    // Categorize error types
    switch (true) {
      case statusCode === 401:
        eventType = SecurityEventType.AUTHENTICATION_FAILURE;
        severity = SecurityEventSeverity.MEDIUM;
        break;
      case statusCode === 403:
        eventType = SecurityEventType.AUTHORIZATION_DENIED;
        severity = SecurityEventSeverity.MEDIUM;
        break;
      case statusCode === 429:
        eventType = SecurityEventType.RATE_LIMIT_EXCEEDED;
        severity = SecurityEventSeverity.HIGH;
        break;
      case statusCode >= 500:
        eventType = SecurityEventType.ERROR_RATE_SPIKE;
        severity = SecurityEventSeverity.HIGH;
        break;
      default:
        eventType = SecurityEventType.SECURITY_POLICY_VIOLATION;
        severity = SecurityEventSeverity.LOW;
    }

    this.logEvent(eventType, severity, {
      requestId,
      source: `error_handler`,
      ipAddress,
      endpoint,
      method: request.method,
      statusCode,
      responseTime,
    });

    // Check for error rate spikes
    this.checkErrorRateSpikes(endpoint, statusCode);
  }

  /**
   * Check error rate spikes
   */
  private checkErrorRateSpikes(endpoint: string, statusCode: number): void {
    const recentRequests = this.getRecentRequestsByEndpoint(endpoint);
    const errorRequests = recentRequests.filter(req => req.statusCode >= 400);

    const errorRate = recentRequests.length > 0 ? errorRequests.length / recentRequests.length : 0;

    if (errorRate > this.config.alertThresholds.errorRate && recentRequests.length > 10) {
      this.createAlert({
        title: 'Error Rate Spike Detected',
        description: `Error rate of ${(errorRate * 100).toFixed(1)}% detected for ${endpoint}`,
        severity: errorRate > 0.2 ? SecurityEventSeverity.CRITICAL : SecurityEventSeverity.HIGH,
        category: 'performance',
        eventIds: errorRequests.map(req => req.id || ''),
        affectedResources: [endpoint],
        recommendation: 'Investigate service health and potential attacks',
      });
    }
  }

  /**
   * Check performance alerts
   */
  private checkPerformanceAlerts(endpoint: string, metrics: PerformanceMetrics): void {
    // Response time alerts
    if (metrics.avgResponseTime > this.config.alertThresholds.responseTime) {
      this.createAlert({
        title: 'High Response Time Detected',
        description: `Average response time of ${metrics.avgResponseTime}ms for ${endpoint}`,
        severity: SecurityEventSeverity.MEDIUM,
        category: 'performance',
        eventIds: [],
        affectedResources: [endpoint],
        recommendation: 'Investigate service performance and optimize if needed',
      });
    }

    // Request volume alerts
    if (metrics.requestsPerSecond > this.config.alertThresholds.requestVolume / 60) {
      this.createAlert({
        title: 'High Request Volume Detected',
        description: `Request rate of ${metrics.requestsPerSecond.toFixed(1)} req/s for ${endpoint}`,
        severity: SecurityEventSeverity.MEDIUM,
        category: 'traffic',
        eventIds: [],
        affectedResources: [endpoint],
        recommendation: 'Monitor for potential DDoS attack and scale resources if needed',
      });
    }
  }

  /**
   * Log security event
   */
  public logEvent(
    type: SecurityEventType,
    severity: SecurityEventSeverity,
    metadata: Record<string, any>
  ): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type,
      severity,
      source: metadata.source || 'security_monitor',
      userId: metadata.userId,
      sessionId: metadata.sessionId,
      ipAddress: metadata.ipAddress || 'unknown',
      userAgent: metadata.userAgent || 'unknown',
      endpoint: metadata.endpoint || '',
      method: metadata.method || '',
      statusCode: metadata.statusCode || 200,
      responseTime: metadata.responseTime || 0,
      requestSize: metadata.requestSize || 0,
      responseSize: metadata.responseSize || 0,
      riskScore: metadata.riskScore || 0,
      threatSignatures: metadata.threatSignatures || [],
      metadata,
      correlationId: metadata.correlationId,
      mitigated: false,
      mitigationActions: [],
    };

    this.events.set(event.id, event);

    // Console logging based on severity
    const logLevel = this.getLogLevel(severity);
    if (this.shouldLog(logLevel)) {
      console[logLevel]('Security Event:', {
        id: event.id,
        type: event.type,
        severity: event.severity,
        source: event.source,
        ipAddress: event.ipAddress,
        endpoint: event.endpoint,
      });
    }

    // Trigger correlation analysis
    this.correlateEvents(event);
  }

  /**
   * Create security alert
   */
  private createAlert(alertData: Partial<SecurityAlert>): void {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      title: alertData.title || 'Security Alert',
      description: alertData.description || '',
      severity: alertData.severity || SecurityEventSeverity.MEDIUM,
      category: alertData.category || 'security',
      eventIds: alertData.eventIds || [],
      affectedResources: alertData.affectedResources || [],
      recommendation: alertData.recommendation || '',
      acknowledged: false,
      resolved: false,
      escalated: false,
    };

    this.alerts.set(alert.id, alert);

    // Send notifications
    if (this.config.alertingEnabled) {
      this.sendNotification(alert);
    }

    console.warn('Security Alert Created:', {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      category: alert.category,
    });
  }

  /**
   * Correlate events to identify attack patterns
   */
  private correlateEvents(event: SecurityEvent): void {
    const correlationKey = `${event.ipAddress}:${event.type}`;
    const relatedEvents = this.correlationMap.get(correlationKey) || [];
    
    relatedEvents.push(event.id);
    
    // Keep only recent events (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentEvents = relatedEvents.filter(eventId => {
      const relatedEvent = this.events.get(eventId);
      return relatedEvent && relatedEvent.timestamp.getTime() > oneHourAgo;
    });

    this.correlationMap.set(correlationKey, recentEvents);

    // Check for attack patterns
    if (recentEvents.length >= 5) {
      this.createAlert({
        title: 'Correlated Attack Pattern Detected',
        description: `${recentEvents.length} related ${event.type} events from ${event.ipAddress}`,
        severity: SecurityEventSeverity.HIGH,
        category: 'attack_pattern',
        eventIds: recentEvents,
        affectedResources: [event.endpoint],
        recommendation: 'Consider blocking source IP and investigating attack pattern',
      });
    }
  }

  /**
   * Send notification
   */
  private sendNotification(alert: SecurityAlert): void {
    for (const channel of this.config.notificationChannels) {
      switch (channel) {
        case 'console':
          console.error(`SECURITY ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`);
          break;
        case 'webhook':
          // In production, send to webhook endpoint
          this.sendWebhookNotification(alert);
          break;
        // Add more notification channels as needed
      }
    }
  }

  /**
   * Send webhook notification (placeholder)
   */
  private async sendWebhookNotification(alert: SecurityAlert): Promise<void> {
    // Implementation would send to external webhook
    console.log('Webhook notification sent for alert:', alert.id);
  }

  /**
   * Update threat intelligence
   */
  private updateThreatIntelligence(request: NextRequest): void {
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = this.getClientIP(request);

    // Update suspicious user agents
    if (this.isSuspiciousUserAgent(userAgent)) {
      this.threatIntel.suspiciousUserAgents.add(userAgent);
    }

    // Update with external threat feeds (placeholder)
    // In production, this would fetch from threat intelligence APIs
    this.threatIntel.lastUpdated = new Date();
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Cleanup old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    // Update threat intelligence every 4 hours
    setInterval(() => {
      this.updateThreatIntelligenceFromSources();
    }, 4 * 60 * 60 * 1000);

    // Generate periodic reports every 24 hours
    setInterval(() => {
      this.generatePeriodicReport();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Utility methods
   */
  private getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           request.headers.get('cf-connecting-ip') ||
           'unknown';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLogLevel(severity: SecurityEventSeverity): 'debug' | 'info' | 'warn' | 'error' {
    switch (severity) {
      case SecurityEventSeverity.LOW:
        return 'debug';
      case SecurityEventSeverity.MEDIUM:
        return 'info';
      case SecurityEventSeverity.HIGH:
        return 'warn';
      case SecurityEventSeverity.CRITICAL:
        return 'error';
      default:
        return 'info';
    }
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const eventLevelIndex = levels.indexOf(level);
    return eventLevelIndex >= configLevelIndex;
  }

  private getDefaultAttackPatterns(): RegExp[] {
    return [
      // XSS patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      
      // SQL injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
      
      // Path traversal patterns
      /\.\./gi,
      /\%2e\%2e/gi,
      
      // Command injection patterns
      /(\||;|&|`|\$\()/gi,
      
      // Common attack tools
      /sqlmap|nmap|nikto|dirb|gobuster|wfuzz/gi,
    ];
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|php/i,
      /postman|insomnia|fiddler/i,
      /sqlmap|nmap|nikto|dirb|gobuster|wfuzz/i,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent)) ||
           userAgent.length < 10 ||
           userAgent === '';
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private getRecentRequestsByIP(ipAddress: string): SecurityEvent[] {
    const events = Array.from(this.events.values());
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    return events.filter(event => 
      event.ipAddress === ipAddress && 
      event.timestamp.getTime() > oneHourAgo
    );
  }

  private getRecentRequestsByEndpoint(endpoint: string): SecurityEvent[] {
    const events = Array.from(this.events.values());
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    return events.filter(event => 
      event.endpoint === endpoint && 
      event.timestamp.getTime() > oneHourAgo
    );
  }

  private getRecentResponseTimes(endpoint: string): number[] {
    const events = this.getRecentRequestsByEndpoint(endpoint);
    return events.map(event => event.responseTime).filter(time => time > 0);
  }

  private cleanupOldData(): void {
    // LRU caches will automatically cleanup based on TTL
    // Additional cleanup logic can be added here
    console.log('Security monitoring data cleanup completed');
  }

  private updateThreatIntelligenceFromSources(): void {
    // Placeholder for external threat intelligence updates
    console.log('Threat intelligence updated from external sources');
  }

  private generatePeriodicReport(): void {
    const stats = this.getSecurityStatistics();
    console.log('Daily Security Report:', stats);
  }

  /**
   * Public API methods
   */
  
  public getEvents(filters: {
    type?: SecurityEventType;
    severity?: SecurityEventSeverity;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    userId?: string;
    limit?: number;
  } = {}): SecurityEvent[] {
    let events = Array.from(this.events.values());

    if (filters.type) {
      events = events.filter(event => event.type === filters.type);
    }

    if (filters.severity) {
      events = events.filter(event => event.severity === filters.severity);
    }

    if (filters.startDate) {
      events = events.filter(event => event.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      events = events.filter(event => event.timestamp <= filters.endDate!);
    }

    if (filters.ipAddress) {
      events = events.filter(event => event.ipAddress === filters.ipAddress);
    }

    if (filters.userId) {
      events = events.filter(event => event.userId === filters.userId);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  public getAlerts(filters: {
    severity?: SecurityEventSeverity;
    category?: string;
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
  } = {}): SecurityAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    if (filters.category) {
      alerts = alerts.filter(alert => alert.category === filters.category);
    }

    if (filters.acknowledged !== undefined) {
      alerts = alerts.filter(alert => alert.acknowledged === filters.acknowledged);
    }

    if (filters.resolved !== undefined) {
      alerts = alerts.filter(alert => alert.resolved === filters.resolved);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      alerts = alerts.slice(0, filters.limit);
    }

    return alerts;
  }

  public getSecurityStatistics(): {
    totalEvents: number;
    eventsBySeverity: Record<SecurityEventSeverity, number>;
    eventsByType: Record<SecurityEventType, number>;
    topAttackers: Array<{ ip: string; eventCount: number }>;
    alertsGenerated: number;
    unacknowledgedAlerts: number;
    unresolvedAlerts: number;
    avgResponseTime: number;
    errorRate: number;
  } {
    const events = Array.from(this.events.values());
    const alerts = Array.from(this.alerts.values());

    const eventsBySeverity = events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<SecurityEventSeverity, number>);

    const eventsByType = events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<SecurityEventType, number>);

    const ipCounts = events.reduce((acc, event) => {
      acc[event.ipAddress] = (acc[event.ipAddress] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topAttackers = Object.entries(ipCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, eventCount]) => ({ ip, eventCount }));

    const responseTimes = events.map(event => event.responseTime).filter(time => time > 0);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;

    const errorEvents = events.filter(event => event.statusCode >= 400);
    const errorRate = events.length > 0 ? errorEvents.length / events.length : 0;

    return {
      totalEvents: events.length,
      eventsBySeverity,
      eventsByType,
      topAttackers,
      alertsGenerated: alerts.length,
      unacknowledgedAlerts: alerts.filter(alert => !alert.acknowledged).length,
      unresolvedAlerts: alerts.filter(alert => !alert.resolved).length,
      avgResponseTime,
      errorRate,
    };
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      this.alerts.set(alertId, alert);
      return true;
    }
    return false;
  }

  public resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();
      this.alerts.set(alertId, alert);
      return true;
    }
    return false;
  }

  /**
   * Initialize Machine Learning models for threat detection
   */
  private initializeMachineLearningModels(): void {
    // Anomaly detection model for behavioral analysis
    this.mlModels.set('behavioral_anomaly', {
      modelType: 'anomaly_detection',
      algorithm: 'isolation_forest',
      features: [
        'requestsPerMinute',
        'sessionDuration',
        'uniqueEndpoints',
        'errorRate',
        'responseTime',
        'deviceFingerprint',
        'locationConsistency',
        'timeOfDay',
        'dayOfWeek',
      ],
      threshold: 0.7,
      accuracy: 0.0,
      lastTrained: new Date(),
      trainingData: [],
      modelData: null,
    });

    // Classification model for threat categorization
    this.mlModels.set('threat_classification', {
      modelType: 'classification',
      algorithm: 'random_forest',
      features: [
        'userAgent',
        'ipReputation',
        'requestPattern',
        'payloadAnalysis',
        'headerAnalysis',
        'behaviorScore',
      ],
      threshold: 0.8,
      accuracy: 0.0,
      lastTrained: new Date(),
      trainingData: [],
      modelData: null,
    });

    // Clustering model for attack pattern recognition
    this.mlModels.set('attack_clustering', {
      modelType: 'clustering',
      algorithm: 'one_class_svm',
      features: [
        'requestFrequency',
        'endpointDiversity',
        'payloadSimilarity',
        'temporalPattern',
        'sourceConsistency',
      ],
      threshold: 0.6,
      accuracy: 0.0,
      lastTrained: new Date(),
      trainingData: [],
      modelData: null,
    });
  }

  /**
   * Update user behavioral profile with ML analysis
   */
  public updateBehavioralProfile(userId: string, sessionData: any): void {
    let profile = this.behavioralProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        createdAt: new Date(),
        lastUpdated: new Date(),
        loginPatterns: {
          typicalHours: [],
          typicalDays: [],
          averageSessionDuration: 0,
          frequentLocations: [],
          deviceFingerprints: [],
        },
        activityPatterns: {
          averageRequestsPerMinute: 0,
          commonEndpoints: [],
          typicalUserAgents: [],
          navigationPatterns: [],
        },
        anomalyScore: 0,
        riskLevel: 'low',
        trainedSamples: 0,
      };
    }

    // Update patterns with new data
    this.updateLoginPatterns(profile, sessionData);
    this.updateActivityPatterns(profile, sessionData);
    
    // Calculate anomaly score using ML
    profile.anomalyScore = this.calculateBehavioralAnomalyScore(profile, sessionData);
    
    // Update risk level
    profile.riskLevel = this.determineRiskLevel(profile.anomalyScore);
    
    profile.lastUpdated = new Date();
    profile.trainedSamples++;
    
    this.behavioralProfiles.set(userId, profile);
    
    // Train ML models if we have enough data
    if (profile.trainedSamples % 100 === 0) {
      this.retrainBehavioralModels(userId);
    }
  }

  /**
   * Calculate comprehensive risk score using ML
   */
  public calculateAdvancedRiskScore(
    userId: string,
    ipAddress: string,
    sessionId: string,
    requestData: any
  ): RiskScore {
    const timestamp = new Date();
    const profile = this.behavioralProfiles.get(userId);
    
    const components = {
      behavioral: this.calculateBehavioralRisk(profile, requestData),
      geographical: this.calculateGeographicalRisk(ipAddress, profile),
      temporal: this.calculateTemporalRisk(timestamp, profile),
      technical: this.calculateTechnicalRisk(requestData),
      historical: this.calculateHistoricalRisk(userId, ipAddress),
    };

    const totalScore = this.calculateWeightedRiskScore(components);
    const riskLevel = this.determineRiskLevel(totalScore);
    const factors = this.identifyRiskFactors(components);
    const confidence = this.calculateConfidence(profile, requestData);

    const riskScore: RiskScore = {
      userId,
      ipAddress,
      sessionId,
      timestamp,
      components,
      totalScore,
      riskLevel,
      factors,
      confidence,
    };

    this.riskScores.set(`${userId}:${sessionId}`, riskScore);
    
    return riskScore;
  }

  /**
   * Advanced anomaly detection using ML
   */
  public detectAdvancedAnomalies(requestData: any): {
    isAnomaly: boolean;
    anomalyType: string;
    confidence: number;
    factors: string[];
  } {
    const features = this.extractFeatures(requestData);
    const model = this.mlModels.get('behavioral_anomaly');
    
    if (!model || !model.modelData) {
      return {
        isAnomaly: false,
        anomalyType: 'unknown',
        confidence: 0,
        factors: [],
      };
    }

    // Simulate ML anomaly detection
    const anomalyScore = this.predictAnomaly(features, model);
    const isAnomaly = anomalyScore > model.threshold;
    
    const anomalyType = this.classifyAnomalyType(features, anomalyScore);
    const confidence = Math.min(anomalyScore, 1.0);
    const factors = this.identifyAnomalyFactors(features, anomalyScore);

    return {
      isAnomaly,
      anomalyType,
      confidence,
      factors,
    };
  }

  /**
   * Predict threat classification using ML
   */
  public predictThreatClassification(requestData: any): {
    threatType: string;
    confidence: number;
    severity: SecurityEventSeverity;
    recommendedAction: string;
  } {
    const features = this.extractThreatFeatures(requestData);
    const model = this.mlModels.get('threat_classification');
    
    if (!model || !model.modelData) {
      return {
        threatType: 'unknown',
        confidence: 0,
        severity: SecurityEventSeverity.LOW,
        recommendedAction: 'monitor',
      };
    }

    const prediction = this.predictThreatType(features, model);
    const confidence = this.calculatePredictionConfidence(prediction, model);
    const severity = this.mapThreatToSeverity(prediction.threatType);
    const recommendedAction = this.recommendAction(prediction.threatType, confidence);

    return {
      threatType: prediction.threatType,
      confidence,
      severity,
      recommendedAction,
    };
  }

  // Private ML helper methods

  private updateLoginPatterns(profile: UserBehaviorProfile, sessionData: any): void {
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    
    // Update typical hours
    if (!profile.loginPatterns.typicalHours.includes(currentHour)) {
      profile.loginPatterns.typicalHours.push(currentHour);
    }
    
    // Update typical days
    if (!profile.loginPatterns.typicalDays.includes(currentDay)) {
      profile.loginPatterns.typicalDays.push(currentDay);
    }
    
    // Update session duration
    if (sessionData.duration) {
      const currentAvg = profile.loginPatterns.averageSessionDuration;
      const samples = profile.trainedSamples;
      profile.loginPatterns.averageSessionDuration = 
        (currentAvg * samples + sessionData.duration) / (samples + 1);
    }
    
    // Update locations and device fingerprints
    if (sessionData.location && !profile.loginPatterns.frequentLocations.includes(sessionData.location)) {
      profile.loginPatterns.frequentLocations.push(sessionData.location);
    }
    
    if (sessionData.deviceFingerprint && !profile.loginPatterns.deviceFingerprints.includes(sessionData.deviceFingerprint)) {
      profile.loginPatterns.deviceFingerprints.push(sessionData.deviceFingerprint);
    }
  }

  private updateActivityPatterns(profile: UserBehaviorProfile, sessionData: any): void {
    // Update requests per minute
    if (sessionData.requestsPerMinute) {
      const currentAvg = profile.activityPatterns.averageRequestsPerMinute;
      const samples = profile.trainedSamples;
      profile.activityPatterns.averageRequestsPerMinute = 
        (currentAvg * samples + sessionData.requestsPerMinute) / (samples + 1);
    }
    
    // Update common endpoints
    if (sessionData.endpoints) {
      for (const endpoint of sessionData.endpoints) {
        if (!profile.activityPatterns.commonEndpoints.includes(endpoint)) {
          profile.activityPatterns.commonEndpoints.push(endpoint);
        }
      }
    }
    
    // Update user agents
    if (sessionData.userAgent && !profile.activityPatterns.typicalUserAgents.includes(sessionData.userAgent)) {
      profile.activityPatterns.typicalUserAgents.push(sessionData.userAgent);
    }
  }

  private calculateBehavioralAnomalyScore(profile: UserBehaviorProfile, sessionData: any): number {
    let score = 0;
    let factors = 0;
    
    // Time-based anomaly
    const currentHour = new Date().getHours();
    if (!profile.loginPatterns.typicalHours.includes(currentHour)) {
      score += 0.3;
    }
    factors++;
    
    // Location-based anomaly
    if (sessionData.location && !profile.loginPatterns.frequentLocations.includes(sessionData.location)) {
      score += 0.4;
    }
    factors++;
    
    // Device-based anomaly
    if (sessionData.deviceFingerprint && !profile.loginPatterns.deviceFingerprints.includes(sessionData.deviceFingerprint)) {
      score += 0.5;
    }
    factors++;
    
    // Activity pattern anomaly
    if (sessionData.requestsPerMinute) {
      const deviation = Math.abs(sessionData.requestsPerMinute - profile.activityPatterns.averageRequestsPerMinute);
      const normalizedDeviation = Math.min(deviation / profile.activityPatterns.averageRequestsPerMinute, 1);
      score += normalizedDeviation * 0.3;
    }
    factors++;
    
    return Math.min(score / factors, 1.0);
  }

  private calculateBehavioralRisk(profile: UserBehaviorProfile | undefined, requestData: any): number {
    if (!profile) return 0.5; // Medium risk for unknown users
    
    return profile.anomalyScore * 0.8 + (requestData.suspiciousActivity ? 0.2 : 0);
  }

  private calculateGeographicalRisk(ipAddress: string, profile: UserBehaviorProfile | undefined): number {
    // Simulate geolocation risk calculation
    const knownMaliciousRegions = ['CN', 'RU', 'KP']; // Example
    const currentRegion = this.getRegionFromIP(ipAddress);
    
    if (knownMaliciousRegions.includes(currentRegion)) {
      return 0.8;
    }
    
    if (profile && profile.loginPatterns.frequentLocations.length > 0) {
      // Check if current location is consistent with profile
      const locationConsistent = profile.loginPatterns.frequentLocations.some(loc => 
        this.isLocationConsistent(loc, currentRegion)
      );
      return locationConsistent ? 0.1 : 0.6;
    }
    
    return 0.3; // Medium risk for unknown locations
  }

  private calculateTemporalRisk(timestamp: Date, profile: UserBehaviorProfile | undefined): number {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    
    // High risk during unusual hours (2-6 AM)
    if (hour >= 2 && hour <= 6) {
      return 0.7;
    }
    
    if (profile) {
      const hourConsistent = profile.loginPatterns.typicalHours.includes(hour);
      const dayConsistent = profile.loginPatterns.typicalDays.includes(day);
      
      if (!hourConsistent && !dayConsistent) {
        return 0.8;
      } else if (!hourConsistent || !dayConsistent) {
        return 0.4;
      }
    }
    
    return 0.1; // Low risk during normal hours
  }

  private calculateTechnicalRisk(requestData: any): number {
    let risk = 0;
    
    // Check for suspicious headers
    if (requestData.headers) {
      const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
      const hasSuspiciousHeaders = suspiciousHeaders.some(header => 
        requestData.headers[header] && requestData.headers[header].includes(',')
      );
      if (hasSuspiciousHeaders) risk += 0.3;
    }
    
    // Check for suspicious user agent
    if (requestData.userAgent) {
      const suspiciousPatterns = [/bot|crawler|spider/i, /curl|wget|python/i];
      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(requestData.userAgent)
      );
      if (isSuspicious) risk += 0.4;
    }
    
    // Check for suspicious payload
    if (requestData.payload) {
      const maliciousPatterns = [/script|javascript|eval|exec/i, /union|select|insert|drop/i];
      const isMalicious = maliciousPatterns.some(pattern => 
        pattern.test(requestData.payload)
      );
      if (isMalicious) risk += 0.5;
    }
    
    return Math.min(risk, 1.0);
  }

  private calculateHistoricalRisk(userId: string, ipAddress: string): number {
    // Check historical events for this user/IP
    const userEvents = this.getEvents({ userId, limit: 100 });
    const ipEvents = this.getEvents({ ipAddress, limit: 100 });
    
    const userRiskEvents = userEvents.filter(event => 
      event.severity === SecurityEventSeverity.HIGH || 
      event.severity === SecurityEventSeverity.CRITICAL
    );
    
    const ipRiskEvents = ipEvents.filter(event => 
      event.severity === SecurityEventSeverity.HIGH || 
      event.severity === SecurityEventSeverity.CRITICAL
    );
    
    const userRiskScore = Math.min(userRiskEvents.length * 0.1, 0.8);
    const ipRiskScore = Math.min(ipRiskEvents.length * 0.15, 0.9);
    
    return Math.max(userRiskScore, ipRiskScore);
  }

  private calculateWeightedRiskScore(components: RiskScore['components']): number {
    const weights = {
      behavioral: 0.3,
      geographical: 0.2,
      temporal: 0.15,
      technical: 0.25,
      historical: 0.1,
    };
    
    return Object.entries(components).reduce((total, [key, value]) => {
      return total + value * weights[key as keyof typeof weights];
    }, 0);
  }

  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  private identifyRiskFactors(components: RiskScore['components']): string[] {
    const factors: string[] = [];
    
    if (components.behavioral > 0.6) factors.push('Unusual user behavior detected');
    if (components.geographical > 0.6) factors.push('Suspicious geographical location');
    if (components.temporal > 0.6) factors.push('Unusual timing of activity');
    if (components.technical > 0.6) factors.push('Suspicious technical indicators');
    if (components.historical > 0.6) factors.push('Previous security incidents');
    
    return factors;
  }

  private calculateConfidence(profile: UserBehaviorProfile | undefined, requestData: any): number {
    if (!profile) return 0.5;
    
    // Confidence increases with more training data
    const sampleConfidence = Math.min(profile.trainedSamples / 1000, 0.8);
    
    // Confidence decreases with missing data
    const dataCompleteness = this.calculateDataCompleteness(requestData);
    
    return (sampleConfidence + dataCompleteness) / 2;
  }

  private retrainBehavioralModels(userId: string): void {
    const profile = this.behavioralProfiles.get(userId);
    if (!profile) return;
    
    console.log(`Retraining behavioral models for user ${userId}`);
    
    // In a real implementation, this would retrain actual ML models
    // For now, we simulate model improvement
    const model = this.mlModels.get('behavioral_anomaly');
    if (model) {
      model.lastTrained = new Date();
      model.accuracy = Math.min(model.accuracy + 0.01, 0.95);
      this.mlModels.set('behavioral_anomaly', model);
    }
  }

  private extractFeatures(requestData: any): Record<string, number> {
    return {
      requestsPerMinute: requestData.requestsPerMinute || 0,
      sessionDuration: requestData.sessionDuration || 0,
      uniqueEndpoints: requestData.uniqueEndpoints || 0,
      errorRate: requestData.errorRate || 0,
      responseTime: requestData.responseTime || 0,
      deviceFingerprint: this.hashFeature(requestData.deviceFingerprint || ''),
      locationConsistency: requestData.locationConsistency || 0,
      timeOfDay: new Date().getHours() / 24,
      dayOfWeek: new Date().getDay() / 7,
    };
  }

  private extractThreatFeatures(requestData: any): Record<string, any> {
    return {
      userAgent: requestData.userAgent || '',
      ipReputation: requestData.ipReputation || 0,
      requestPattern: requestData.requestPattern || '',
      payloadAnalysis: requestData.payloadAnalysis || {},
      headerAnalysis: requestData.headerAnalysis || {},
      behaviorScore: requestData.behaviorScore || 0,
    };
  }

  private predictAnomaly(features: Record<string, number>, model: MLThreatModel): number {
    // Simulate ML prediction
    const featureValues = Object.values(features);
    const mean = featureValues.reduce((a, b) => a + b, 0) / featureValues.length;
    const variance = featureValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / featureValues.length;
    
    // Simple anomaly score based on variance
    return Math.min(Math.sqrt(variance), 1.0);
  }

  private predictThreatType(features: Record<string, any>, model: MLThreatModel): { threatType: string; confidence: number } {
    // Simulate threat classification
    const userAgent = features.userAgent || '';
    const payload = features.payloadAnalysis || {};
    
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      return { threatType: 'automated_scanning', confidence: 0.8 };
    }
    
    if (payload.sqlInjection) {
      return { threatType: 'sql_injection', confidence: 0.9 };
    }
    
    if (payload.xss) {
      return { threatType: 'xss_attack', confidence: 0.9 };
    }
    
    return { threatType: 'unknown', confidence: 0.3 };
  }

  private classifyAnomalyType(features: Record<string, number>, anomalyScore: number): string {
    const highFeatures = Object.entries(features)
      .filter(([_, value]) => value > 0.7)
      .map(([key, _]) => key);
    
    if (highFeatures.includes('requestsPerMinute')) return 'rate_anomaly';
    if (highFeatures.includes('errorRate')) return 'error_anomaly';
    if (highFeatures.includes('responseTime')) return 'performance_anomaly';
    if (highFeatures.includes('uniqueEndpoints')) return 'scanning_anomaly';
    
    return 'behavioral_anomaly';
  }

  private identifyAnomalyFactors(features: Record<string, number>, anomalyScore: number): string[] {
    const factors: string[] = [];
    
    Object.entries(features).forEach(([key, value]) => {
      if (value > 0.7) {
        factors.push(`High ${key}: ${value.toFixed(2)}`);
      }
    });
    
    return factors;
  }

  private calculatePredictionConfidence(prediction: any, model: MLThreatModel): number {
    // Simulate confidence calculation based on model accuracy
    return model.accuracy * 0.9 + Math.random() * 0.1;
  }

  private mapThreatToSeverity(threatType: string): SecurityEventSeverity {
    const severityMap: Record<string, SecurityEventSeverity> = {
      'sql_injection': SecurityEventSeverity.CRITICAL,
      'xss_attack': SecurityEventSeverity.HIGH,
      'csrf_attack': SecurityEventSeverity.HIGH,
      'brute_force': SecurityEventSeverity.MEDIUM,
      'automated_scanning': SecurityEventSeverity.MEDIUM,
      'suspicious_activity': SecurityEventSeverity.LOW,
      'unknown': SecurityEventSeverity.LOW,
    };
    
    return severityMap[threatType] || SecurityEventSeverity.LOW;
  }

  private recommendAction(threatType: string, confidence: number): string {
    if (confidence > 0.8) {
      if (threatType === 'sql_injection' || threatType === 'xss_attack') {
        return 'block_immediately';
      }
      return 'alert_and_monitor';
    }
    
    if (confidence > 0.6) {
      return 'increase_monitoring';
    }
    
    return 'continue_monitoring';
  }

  private getRegionFromIP(ipAddress: string): string {
    // Simulate GeoIP lookup
    const regions = ['US', 'UK', 'DE', 'FR', 'CN', 'RU', 'JP', 'KR'];
    return regions[Math.floor(Math.random() * regions.length)];
  }

  private isLocationConsistent(profileLocation: string, currentRegion: string): boolean {
    // Simple location consistency check
    return profileLocation.includes(currentRegion);
  }

  private calculateDataCompleteness(requestData: any): number {
    const requiredFields = ['userAgent', 'ipAddress', 'sessionId', 'timestamp'];
    const presentFields = requiredFields.filter(field => requestData[field]);
    
    return presentFields.length / requiredFields.length;
  }

  private hashFeature(feature: string): number {
    // Simple hash function for categorical features
    let hash = 0;
    for (let i = 0; i < feature.length; i++) {
      const char = feature.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / Math.pow(2, 31); // Normalize to 0-1
  }
}

// Export default instance
export const securityMonitor = new SecurityMonitoringService();