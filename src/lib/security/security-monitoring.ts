import { dataAnonymizationService } from './encryption';

/**
 * Comprehensive security monitoring and alerting system
 */
export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  details: Record<string, any>;
  threat: string;
  action: 'blocked' | 'allowed' | 'flagged';
  riskScore: number;
}

export type SecurityEventType = 
  | 'auth_failure'
  | 'auth_success' 
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'csrf_violation'
  | 'cors_violation'
  | 'malicious_file_upload'
  | 'brute_force_attack'
  | 'account_lockout'
  | 'privilege_escalation'
  | 'data_breach_attempt'
  | 'unauthorized_access'
  | 'scanning_attempt'
  | 'bot_detection'
  | 'payload_too_large'
  | 'invalid_token'
  | 'session_hijacking'
  | 'password_attack'
  | 'mfa_bypass_attempt';

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: 'threshold_breach' | 'anomaly_detected' | 'critical_event' | 'pattern_match';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  events: SecurityEvent[];
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  actions: string[];
}

export interface ThreatIntelligence {
  ipAddress: string;
  type: 'malicious' | 'suspicious' | 'bot' | 'tor' | 'vpn';
  confidence: number; // 0-100
  lastSeen: Date;
  sources: string[];
  tags: string[];
}

export interface AnomalyDetection {
  userId: string;
  anomalyType: 'location' | 'time' | 'behavior' | 'volume';
  score: number; // 0-100, higher is more anomalous
  baseline: any;
  current: any;
  timestamp: Date;
}

export class SecurityMonitoringService {
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private threatIntel: Map<string, ThreatIntelligence> = new Map();
  private userBaselines: Map<string, any> = new Map();
  private alertRules: AlertRule[] = [];
  
  private readonly maxEvents = 10000; // Keep last 10k events in memory
  private readonly maxAlerts = 1000;  // Keep last 1k alerts in memory

  constructor() {
    this.setupDefaultAlertRules();
    this.startBackgroundProcessing();
  }

  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'riskScore'>): string {
    const securityEvent: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      riskScore: this.calculateRiskScore(event),
      ...event,
    };

    // Anonymize sensitive data
    if (securityEvent.details) {
      securityEvent.details = this.anonymizeSensitiveData(securityEvent.details);
    }

    this.events.push(securityEvent);

    // Trim events if we exceed max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Check for alert conditions
    this.checkAlertRules(securityEvent);

    // Update threat intelligence
    this.updateThreatIntelligence(securityEvent);

    // Log to console (in production, send to logging service)
    this.outputEvent(securityEvent);

    return securityEvent.id;
  }

  /**
   * Log authentication event
   */
  logAuthEvent(details: {
    userId?: string;
    ipAddress: string;
    userAgent?: string;
    success: boolean;
    method: 'password' | 'mfa' | 'oauth' | 'token';
    reason?: string;
  }): string {
    return this.logEvent({
      type: details.success ? 'auth_success' : 'auth_failure',
      severity: details.success ? 'low' : 'medium',
      source: 'auth_service',
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      details: {
        method: details.method,
        reason: details.reason,
      },
      threat: details.success ? 'none' : 'authentication_failure',
      action: details.success ? 'allowed' : 'blocked',
    });
  }

  /**
   * Log API request event
   */
  logAPIEvent(details: {
    userId?: string;
    ipAddress: string;
    userAgent?: string;
    endpoint: string;
    method: string;
    statusCode: number;
    threat?: string;
    blocked?: boolean;
    rateLimited?: boolean;
  }): string {
    let severity: SecurityEvent['severity'] = 'low';
    let type: SecurityEventType = 'suspicious_activity';

    if (details.rateLimited) {
      severity = 'medium';
      type = 'rate_limit_exceeded';
    } else if (details.threat) {
      severity = details.blocked ? 'high' : 'medium';
      if (details.threat.includes('sql')) type = 'sql_injection_attempt';
      else if (details.threat.includes('xss')) type = 'xss_attempt';
      else if (details.threat.includes('csrf')) type = 'csrf_violation';
      else if (details.threat.includes('cors')) type = 'cors_violation';
    }

    return this.logEvent({
      type,
      severity,
      source: 'api_gateway',
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: details.userAgent,
      endpoint: details.endpoint,
      method: details.method,
      statusCode: details.statusCode,
      details: {
        threat: details.threat,
        rateLimited: details.rateLimited,
      },
      threat: details.threat || 'none',
      action: details.blocked ? 'blocked' : 'allowed',
    });
  }

  /**
   * Create security alert
   */
  createAlert(alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>): string {
    const securityAlert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      ...alert,
    };

    this.alerts.push(securityAlert);

    // Trim alerts if we exceed max
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    // Send alert notification (implementation specific)
    this.sendAlertNotification(securityAlert);

    // Auto-escalate critical alerts
    if (securityAlert.severity === 'critical') {
      this.escalateAlert(securityAlert.id);
    }

    return securityAlert.id;
  }

  /**
   * Detect anomalies in user behavior
   */
  detectAnomalies(userId: string, currentActivity: any): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    const baseline = this.userBaselines.get(userId);

    if (!baseline) {
      // No baseline yet, create one
      this.userBaselines.set(userId, this.createBaseline(currentActivity));
      return anomalies;
    }

    // Check for location anomalies
    if (currentActivity.location && baseline.location) {
      const locationAnomaly = this.detectLocationAnomaly(baseline.location, currentActivity.location);
      if (locationAnomaly > 70) {
        anomalies.push({
          userId,
          anomalyType: 'location',
          score: locationAnomaly,
          baseline: baseline.location,
          current: currentActivity.location,
          timestamp: new Date(),
        });
      }
    }

    // Check for time-based anomalies
    if (currentActivity.timestamp && baseline.timePattern) {
      const timeAnomaly = this.detectTimeAnomaly(baseline.timePattern, currentActivity.timestamp);
      if (timeAnomaly > 80) {
        anomalies.push({
          userId,
          anomalyType: 'time',
          score: timeAnomaly,
          baseline: baseline.timePattern,
          current: currentActivity.timestamp,
          timestamp: new Date(),
        });
      }
    }

    // Check for behavior anomalies
    if (currentActivity.actions && baseline.behaviorPattern) {
      const behaviorAnomaly = this.detectBehaviorAnomaly(baseline.behaviorPattern, currentActivity.actions);
      if (behaviorAnomaly > 75) {
        anomalies.push({
          userId,
          anomalyType: 'behavior',
          score: behaviorAnomaly,
          baseline: baseline.behaviorPattern,
          current: currentActivity.actions,
          timestamp: new Date(),
        });
      }
    }

    // Update baseline with new data
    this.updateBaseline(userId, currentActivity);

    return anomalies;
  }

  /**
   * Get security events with filtering
   */
  getEvents(filters: {
    type?: SecurityEventType;
    severity?: SecurityEvent['severity'];
    userId?: string;
    ipAddress?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
  } = {}): SecurityEvent[] {
    let filteredEvents = [...this.events];

    if (filters.type) {
      filteredEvents = filteredEvents.filter(e => e.type === filters.type);
    }
    if (filters.severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === filters.severity);
    }
    if (filters.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === filters.userId);
    }
    if (filters.ipAddress) {
      filteredEvents = filteredEvents.filter(e => e.ipAddress === filters.ipAddress);
    }
    if (filters.timeRange) {
      filteredEvents = filteredEvents.filter(e => 
        e.timestamp >= filters.timeRange!.start && e.timestamp <= filters.timeRange!.end
      );
    }

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      filteredEvents = filteredEvents.slice(0, filters.limit);
    }

    return filteredEvents;
  }

  /**
   * Get security alerts
   */
  getAlerts(filters: {
    severity?: SecurityAlert['severity'];
    acknowledged?: boolean;
    resolved?: boolean;
    limit?: number;
  } = {}): SecurityAlert[] {
    let filteredAlerts = [...this.alerts];

    if (filters.severity) {
      filteredAlerts = filteredAlerts.filter(a => a.severity === filters.severity);
    }
    if (filters.acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.acknowledged === filters.acknowledged);
    }
    if (filters.resolved !== undefined) {
      filteredAlerts = filteredAlerts.filter(a => a.resolved === filters.resolved);
    }

    // Sort by timestamp (newest first)
    filteredAlerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      filteredAlerts = filteredAlerts.slice(0, filters.limit);
    }

    return filteredAlerts;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    return true;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedBy = resolvedBy;
    alert.resolvedAt = new Date();

    return true;
  }

  /**
   * Get security dashboard metrics
   */
  getDashboardMetrics(): {
    eventCounts: Record<SecurityEventType, number>;
    severityCounts: Record<SecurityEvent['severity'], number>;
    alertCounts: Record<SecurityAlert['severity'], number>;
    topThreats: Array<{ threat: string; count: number }>;
    topSources: Array<{ ipAddress: string; count: number }>;
    riskScore: number;
    trends: any;
  } {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp > last24h);

    // Count events by type
    const eventCounts = {} as Record<SecurityEventType, number>;
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const threatCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

    for (const event of recentEvents) {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
      severityCounts[event.severity]++;
      
      threatCounts.set(event.threat, (threatCounts.get(event.threat) || 0) + 1);
      sourceCounts.set(event.ipAddress, (sourceCounts.get(event.ipAddress) || 0) + 1);
    }

    // Count alerts by severity
    const recentAlerts = this.alerts.filter(a => a.timestamp > last24h);
    const alertCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const alert of recentAlerts) {
      alertCounts[alert.severity]++;
    }

    // Top threats and sources
    const topThreats = Array.from(threatCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([threat, count]) => ({ threat, count }));

    const topSources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ipAddress, count]) => ({ ipAddress, count }));

    // Calculate overall risk score
    const riskScore = this.calculateOverallRiskScore(recentEvents);

    return {
      eventCounts,
      severityCounts,
      alertCounts,
      topThreats,
      topSources,
      riskScore,
      trends: this.calculateTrends(),
    };
  }

  // Private helper methods

  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'multiple_auth_failures',
        name: 'Multiple Authentication Failures',
        condition: 'count(type=auth_failure, timeframe=15m) > 5',
        severity: 'high',
        enabled: true,
      },
      {
        id: 'critical_event',
        name: 'Critical Security Event',
        condition: 'severity=critical',
        severity: 'critical',
        enabled: true,
      },
      {
        id: 'rate_limit_exceeded',
        name: 'Rate Limit Frequently Exceeded',
        condition: 'count(type=rate_limit_exceeded, timeframe=1h) > 10',
        severity: 'medium',
        enabled: true,
      },
      {
        id: 'sql_injection_attempts',
        name: 'SQL Injection Attempts',
        condition: 'count(type=sql_injection_attempt, timeframe=1h) > 3',
        severity: 'high',
        enabled: true,
      },
    ];
  }

  private checkAlertRules(event: SecurityEvent): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      if (this.evaluateAlertCondition(rule, event)) {
        this.createAlert({
          type: 'threshold_breach',
          title: rule.name,
          description: `Alert rule '${rule.name}' triggered`,
          severity: rule.severity,
          events: [event],
          metadata: { ruleId: rule.id },
          actions: this.getRecommendedActions(rule.id),
        });
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, event: SecurityEvent): boolean {
    // Simple rule evaluation - in production, use a proper rule engine
    if (rule.condition === 'severity=critical') {
      return event.severity === 'critical';
    }

    if (rule.condition.includes('count(')) {
      // Extract parameters from condition
      const match = rule.condition.match(/count\(type=(\w+), timeframe=(\d+)([mh])\) > (\d+)/);
      if (!match) return false;

      const [, type, duration, unit, threshold] = match;
      const eventType = type as SecurityEventType;
      const timeframeMs = parseInt(duration) * (unit === 'h' ? 60 * 60 * 1000 : 60 * 1000);
      const thresholdCount = parseInt(threshold);

      const cutoff = new Date(Date.now() - timeframeMs);
      const recentEvents = this.events.filter(e => 
        e.type === eventType && e.timestamp > cutoff
      );

      return recentEvents.length > thresholdCount;
    }

    return false;
  }

  private calculateRiskScore(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'riskScore'>): number {
    let score = 0;

    // Base score by severity
    switch (event.severity) {
      case 'low': score += 10; break;
      case 'medium': score += 30; break;
      case 'high': score += 60; break;
      case 'critical': score += 90; break;
    }

    // Adjust by event type
    const highRiskTypes: SecurityEventType[] = [
      'sql_injection_attempt',
      'xss_attempt',
      'privilege_escalation',
      'data_breach_attempt',
      'session_hijacking',
    ];

    if (highRiskTypes.includes(event.type)) {
      score += 20;
    }

    // Adjust by action
    if (event.action === 'blocked') {
      score += 10;
    }

    // Check threat intelligence
    const threatInfo = this.threatIntel.get(event.ipAddress);
    if (threatInfo) {
      score += threatInfo.confidence / 2;
    }

    return Math.min(score, 100);
  }

  private calculateOverallRiskScore(events: SecurityEvent[]): number {
    if (events.length === 0) return 0;

    const avgRisk = events.reduce((sum, e) => sum + e.riskScore, 0) / events.length;
    const highRiskEvents = events.filter(e => e.riskScore > 70).length;
    const eventVelocity = events.length / 24; // events per hour over 24h

    return Math.min(avgRisk + (highRiskEvents * 5) + (eventVelocity * 2), 100);
  }

  private updateThreatIntelligence(event: SecurityEvent): void {
    if (event.riskScore > 50) {
      const existing = this.threatIntel.get(event.ipAddress);
      
      if (existing) {
        existing.confidence = Math.min(existing.confidence + 10, 100);
        existing.lastSeen = event.timestamp;
      } else {
        this.threatIntel.set(event.ipAddress, {
          ipAddress: event.ipAddress,
          type: this.classifyThreatType(event),
          confidence: event.riskScore,
          lastSeen: event.timestamp,
          sources: ['internal'],
          tags: [event.threat],
        });
      }
    }
  }

  private classifyThreatType(event: SecurityEvent): ThreatIntelligence['type'] {
    if (event.type === 'bot_detection') return 'bot';
    if (event.threat.includes('malicious')) return 'malicious';
    return 'suspicious';
  }

  private anonymizeSensitiveData(data: Record<string, any>): Record<string, any> {
    const anonymized = { ...data };
    
    // Anonymize common sensitive fields
    if (anonymized.email) {
      anonymized.email = dataAnonymizationService.anonymizeEmail(anonymized.email);
    }
    if (anonymized.phone) {
      anonymized.phone = dataAnonymizationService.anonymizePhone(anonymized.phone);
    }
    
    return anonymized;
  }

  private outputEvent(event: SecurityEvent): void {
    const logLevel = event.severity === 'critical' ? 'error' : 
                    event.severity === 'high' ? 'warn' : 'info';
    
    console[logLevel]('Security Event:', {
      id: event.id,
      type: event.type,
      severity: event.severity,
      threat: event.threat,
      action: event.action,
      riskScore: event.riskScore,
      source: event.source,
      timestamp: event.timestamp.toISOString(),
    });
  }

  private sendAlertNotification(alert: SecurityAlert): void {
    // In production, send to notification service (email, Slack, PagerDuty, etc.)
    console.error('Security Alert:', {
      id: alert.id,
      title: alert.title,
      severity: alert.severity,
      timestamp: alert.timestamp.toISOString(),
    });
  }

  private escalateAlert(alertId: string): void {
    // In production, escalate to security team
    console.error(`Critical alert escalated: ${alertId}`);
  }

  private getRecommendedActions(ruleId: string): string[] {
    const actions: Record<string, string[]> = {
      'multiple_auth_failures': [
        'Block IP address temporarily',
        'Require additional authentication',
        'Notify user of suspicious activity',
      ],
      'critical_event': [
        'Immediate investigation required',
        'Consider blocking source IP',
        'Review system logs',
      ],
      'sql_injection_attempts': [
        'Block IP address',
        'Review WAF rules',
        'Audit database access logs',
      ],
    };

    return actions[ruleId] || ['Review and investigate'];
  }

  private startBackgroundProcessing(): void {
    // Clean up old events every hour
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000);

    // Update threat intelligence every 6 hours
    setInterval(() => {
      this.updateExternalThreatIntel();
    }, 6 * 60 * 60 * 1000);
  }

  private cleanupOldEvents(): void {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    this.events = this.events.filter(e => e.timestamp > cutoff);
  }

  private updateExternalThreatIntel(): void {
    // In production, fetch from threat intelligence feeds
    console.log('Updating threat intelligence...');
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createBaseline(activity: any): any {
    return {
      location: activity.location,
      timePattern: this.extractTimePattern(activity.timestamp),
      behaviorPattern: activity.actions,
    };
  }

  private updateBaseline(userId: string, activity: any): void {
    const baseline = this.userBaselines.get(userId);
    if (baseline) {
      // Simple exponential moving average
      baseline.location = this.mergeLocation(baseline.location, activity.location);
      baseline.timePattern = this.mergeTimePattern(baseline.timePattern, activity.timestamp);
      baseline.behaviorPattern = this.mergeBehavior(baseline.behaviorPattern, activity.actions);
    }
  }

  private detectLocationAnomaly(baseline: any, current: any): number {
    // Simple distance-based anomaly detection
    if (!baseline || !current) return 0;
    
    const distance = Math.sqrt(
      Math.pow(baseline.lat - current.lat, 2) + 
      Math.pow(baseline.lng - current.lng, 2)
    );
    
    return Math.min(distance * 100, 100);
  }

  private detectTimeAnomaly(baseline: any, current: Date): number {
    if (!baseline) return 0;
    
    const hour = current.getHours();
    const dayOfWeek = current.getDay();
    
    const expectedProbability = baseline[dayOfWeek]?.[hour] || 0;
    return (1 - expectedProbability) * 100;
  }

  private detectBehaviorAnomaly(baseline: any, current: any): number {
    // Simple behavior pattern matching
    if (!baseline || !current) return 0;
    
    let similarity = 0;
    const totalActions = current.length;
    
    for (const action of current) {
      if (baseline.includes(action)) {
        similarity++;
      }
    }
    
    return (1 - similarity / totalActions) * 100;
  }

  private extractTimePattern(timestamp: Date): any {
    // Extract time patterns for baseline
    const patterns: any = {};
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    
    if (!patterns[dayOfWeek]) patterns[dayOfWeek] = {};
    patterns[dayOfWeek][hour] = (patterns[dayOfWeek][hour] || 0) + 0.1;
    
    return patterns;
  }

  private mergeLocation(baseline: any, current: any): any {
    if (!current) return baseline;
    if (!baseline) return current;
    
    return {
      lat: baseline.lat * 0.9 + current.lat * 0.1,
      lng: baseline.lng * 0.9 + current.lng * 0.1,
    };
  }

  private mergeTimePattern(baseline: any, current: Date): any {
    const updated = { ...baseline };
    const hour = current.getHours();
    const dayOfWeek = current.getDay();
    
    if (!updated[dayOfWeek]) updated[dayOfWeek] = {};
    updated[dayOfWeek][hour] = Math.min(
      (updated[dayOfWeek][hour] || 0) + 0.05,
      1.0
    );
    
    return updated;
  }

  private mergeBehavior(baseline: any[], current: any[]): any[] {
    return [...new Set([...baseline, ...current])].slice(-100); // Keep last 100 unique actions
  }

  private calculateTrends(): any {
    // Calculate security trends over time
    const now = new Date();
    const periods = [];
    
    for (let i = 23; i >= 0; i--) {
      const start = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
      const end = new Date(now.getTime() - i * 60 * 60 * 1000);
      
      const periodEvents = this.events.filter(e => 
        e.timestamp >= start && e.timestamp < end
      );
      
      periods.push({
        hour: i,
        totalEvents: periodEvents.length,
        highRiskEvents: periodEvents.filter(e => e.riskScore > 70).length,
        criticalEvents: periodEvents.filter(e => e.severity === 'critical').length,
      });
    }
    
    return periods;
  }
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: SecurityAlert['severity'];
  enabled: boolean;
}

// Export singleton instance
export const securityMonitoringService = new SecurityMonitoringService();