/**
 * SLA Tracking and Uptime Monitoring System
 * Comprehensive SLA monitoring with uptime tracking, incident management, and reporting
 */
import { createLogger } from './logger';
import { multiProviderAPM } from './apm-providers';
import { alertingEngine } from './alerting-engine';

const logger = createLogger('sla-tracker');

// SLA status types
export enum SLAStatus {
  COMPLIANT = 'compliant',
  AT_RISK = 'at_risk',
  BREACHED = 'breached',
  UNKNOWN = 'unknown',
}

// Incident severity levels
export enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Incident status
export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  MONITORING = 'monitoring',
  RESOLVED = 'resolved',
}

// Service level agreement definition
export interface SLA {
  id: string;
  name: string;
  description: string;
  service: string;
  enabled: boolean;
  targets: SLATarget[];
  timeWindow: SLATimeWindow;
  measurement: SLAMeasurement;
  notifications: SLANotification[];
  metadata?: Record<string, any>;
}

// SLA target definition
export interface SLATarget {
  id: string;
  name: string;
  metric: string;
  operator: 'gte' | 'lte' | 'eq';
  target: number;
  unit: string;
  warningThreshold?: number; // percentage of target for warnings
  criticalThreshold?: number; // percentage of target for critical alerts
}

// SLA time window configuration
export interface SLATimeWindow {
  type: 'rolling' | 'calendar';
  period: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  duration: number; // e.g., 30 for 30-day rolling window
  timezone: string;
  businessHours?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
    days: number[]; // 0-6, Sunday = 0
    holidays?: Date[];
  };
}

// SLA measurement configuration
export interface SLAMeasurement {
  source: 'synthetic' | 'real_user' | 'health_check' | 'custom';
  interval: number; // seconds
  timeout: number; // seconds
  endpoints?: string[];
  regions?: string[];
  excludeMaintenanceWindows: boolean;
  aggregation: 'availability' | 'response_time' | 'error_rate' | 'throughput';
}

// SLA notification configuration
export interface SLANotification {
  type: 'warning' | 'breach' | 'recovery';
  channels: string[];
  recipients: string[];
  escalation?: boolean;
}

// SLA status record
export interface SLARecord {
  id: string;
  slaId: string;
  timestamp: Date;
  status: SLAStatus;
  compliance: number; // percentage
  targets: Record<string, {
    actual: number;
    target: number;
    compliant: boolean;
    deviation: number;
  }>;
  incidents: string[]; // incident IDs affecting this SLA
  metadata?: Record<string, any>;
}

// Uptime check configuration
export interface UptimeCheck {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
  headers?: Record<string, string>;
  body?: string;
  timeout: number; // seconds
  interval: number; // seconds
  regions: string[];
  expectedStatus: number[];
  expectedContent?: string;
  followRedirects: boolean;
  verifySSL: boolean;
  enabled: boolean;
}

// Uptime result
export interface UptimeResult {
  id: string;
  checkId: string;
  timestamp: Date;
  region: string;
  success: boolean;
  responseTime: number; // milliseconds
  statusCode?: number;
  error?: string;
  contentMatch?: boolean;
  sslValid?: boolean;
  metadata?: Record<string, any>;
}

// Incident definition
export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedServices: string[];
  affectedSLAs: string[];
  startTime: Date;
  endTime?: Date;
  duration?: number; // milliseconds
  impact: string;
  rootCause?: string;
  resolution?: string;
  timeline: IncidentUpdate[];
  creator: string;
  assignee?: string;
  metadata?: Record<string, any>;
}

// Incident update/timeline entry
export interface IncidentUpdate {
  id: string;
  timestamp: Date;
  author: string;
  type: 'status_change' | 'investigation' | 'update' | 'resolution';
  message: string;
  newStatus?: IncidentStatus;
}

// SLA report data
export interface SLAReport {
  period: {
    start: Date;
    end: Date;
    type: string;
  };
  summary: {
    totalSLAs: number;
    compliantSLAs: number;
    atRiskSLAs: number;
    breachedSLAs: number;
    overallCompliance: number;
  };
  slas: Array<{
    sla: SLA;
    compliance: number;
    status: SLAStatus;
    targets: Record<string, {
      target: number;
      actual: number;
      compliance: number;
      status: SLAStatus;
    }>;
    incidents: Incident[];
    trend: Array<{
      timestamp: Date;
      compliance: number;
    }>;
  }>;
  incidents: {
    total: number;
    bySeverity: Record<IncidentSeverity, number>;
    totalDowntime: number; // milliseconds
    mttr: number; // mean time to resolution in milliseconds
    mtbf: number; // mean time between failures in milliseconds
  };
  recommendations: string[];
}

class SLATracker {
  private slas: Map<string, SLA> = new Map();
  private uptimeChecks: Map<string, UptimeCheck> = new Map();
  private slaRecords: Map<string, SLARecord[]> = new Map();
  private uptimeResults: Map<string, UptimeResult[]> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultSLAs();
    this.initializeDefaultChecks();
    this.startEvaluationLoop();
  }

  private initializeDefaultSLAs() {
    // Service availability SLA
    this.addSLA({
      id: 'service_availability',
      name: 'Service Availability',
      description: 'Learning Assistant service must be available 99.9% of the time',
      service: 'learning-assistant',
      enabled: true,
      targets: [
        {
          id: 'uptime_target',
          name: 'Uptime',
          metric: 'availability',
          operator: 'gte',
          target: 99.9,
          unit: 'percent',
          warningThreshold: 95,
          criticalThreshold: 90,
        },
      ],
      timeWindow: {
        type: 'rolling',
        period: 'month',
        duration: 1,
        timezone: 'UTC',
        businessHours: {
          enabled: false,
          start: '09:00',
          end: '17:00',
          days: [1, 2, 3, 4, 5],
        },
      },
      measurement: {
        source: 'synthetic',
        interval: 60,
        timeout: 30,
        endpoints: ['/api/health', '/api/metrics'],
        regions: ['us-east-1', 'eu-west-1'],
        excludeMaintenanceWindows: true,
        aggregation: 'availability',
      },
      notifications: [
        {
          type: 'warning',
          channels: ['slack'],
          recipients: ['#sla-alerts'],
        },
        {
          type: 'breach',
          channels: ['slack', 'email', 'pagerduty'],
          recipients: ['#critical-alerts', 'sre@company.com'],
          escalation: true,
        },
      ],
    });

    // Response time SLA
    this.addSLA({
      id: 'response_time',
      name: 'Response Time',
      description: 'API response time should be under 2 seconds for 95% of requests',
      service: 'learning-assistant',
      enabled: true,
      targets: [
        {
          id: 'p95_response_time',
          name: 'P95 Response Time',
          metric: 'response_time_p95',
          operator: 'lte',
          target: 2000,
          unit: 'milliseconds',
          warningThreshold: 80,
          criticalThreshold: 50,
        },
      ],
      timeWindow: {
        type: 'rolling',
        period: 'day',
        duration: 7,
        timezone: 'UTC',
      },
      measurement: {
        source: 'real_user',
        interval: 300,
        timeout: 10,
        excludeMaintenanceWindows: true,
        aggregation: 'response_time',
      },
      notifications: [
        {
          type: 'warning',
          channels: ['slack'],
          recipients: ['#performance-alerts'],
        },
        {
          type: 'breach',
          channels: ['slack', 'email'],
          recipients: ['#performance-alerts', 'performance-team@company.com'],
        },
      ],
    });

    // Error rate SLA
    this.addSLA({
      id: 'error_rate',
      name: 'Error Rate',
      description: 'Error rate should be below 1% of all requests',
      service: 'learning-assistant',
      enabled: true,
      targets: [
        {
          id: 'error_rate_target',
          name: 'Error Rate',
          metric: 'error_rate',
          operator: 'lte',
          target: 1,
          unit: 'percent',
          warningThreshold: 150,
          criticalThreshold: 200,
        },
      ],
      timeWindow: {
        type: 'rolling',
        period: 'hour',
        duration: 24,
        timezone: 'UTC',
      },
      measurement: {
        source: 'real_user',
        interval: 300,
        timeout: 10,
        excludeMaintenanceWindows: true,
        aggregation: 'error_rate',
      },
      notifications: [
        {
          type: 'warning',
          channels: ['slack'],
          recipients: ['#error-alerts'],
        },
        {
          type: 'breach',
          channels: ['slack', 'email'],
          recipients: ['#error-alerts', 'dev-team@company.com'],
        },
      ],
    });

    logger.info(`Initialized ${this.slas.size} default SLAs`);
  }

  private initializeDefaultChecks() {
    // Health check endpoint
    this.addUptimeCheck({
      id: 'health_check',
      name: 'Health Check Endpoint',
      url: '/api/health',
      method: 'GET',
      timeout: 30,
      interval: 60,
      regions: ['local'],
      expectedStatus: [200],
      followRedirects: false,
      verifySSL: true,
      enabled: true,
    });

    // Main application endpoint
    this.addUptimeCheck({
      id: 'main_app',
      name: 'Main Application',
      url: '/',
      method: 'GET',
      timeout: 30,
      interval: 300,
      regions: ['local'],
      expectedStatus: [200],
      followRedirects: true,
      verifySSL: true,
      enabled: true,
    });

    // API endpoints
    this.addUptimeCheck({
      id: 'api_metrics',
      name: 'Metrics API',
      url: '/api/metrics',
      method: 'GET',
      timeout: 30,
      interval: 300,
      regions: ['local'],
      expectedStatus: [200],
      followRedirects: false,
      verifySSL: true,
      enabled: true,
    });

    logger.info(`Initialized ${this.uptimeChecks.size} default uptime checks`);
  }

  private startEvaluationLoop() {
    // Evaluate SLAs every 5 minutes
    this.evaluationInterval = setInterval(async () => {
      await this.evaluateAllSLAs();
    }, 300000);

    logger.info('SLA evaluation loop started');
  }

  // Public API methods
  public addSLA(sla: SLA) {
    this.slas.set(sla.id, sla);
    logger.info(`Added SLA: ${sla.id}`);
  }

  public removeSLA(slaId: string) {
    this.slas.delete(slaId);
    this.slaRecords.delete(slaId);
    logger.info(`Removed SLA: ${slaId}`);
  }

  public addUptimeCheck(check: UptimeCheck) {
    this.uptimeChecks.set(check.id, check);
    
    if (check.enabled) {
      this.startUptimeCheck(check);
    }
    
    logger.info(`Added uptime check: ${check.id}`);
  }

  public removeUptimeCheck(checkId: string) {
    this.uptimeChecks.delete(checkId);
    this.uptimeResults.delete(checkId);
    this.stopUptimeCheck(checkId);
    logger.info(`Removed uptime check: ${checkId}`);
  }

  private startUptimeCheck(check: UptimeCheck) {
    // Stop existing interval if any
    this.stopUptimeCheck(check.id);

    const interval = setInterval(async () => {
      await this.executeUptimeCheck(check);
    }, check.interval * 1000);

    this.checkIntervals.set(check.id, interval);
    
    // Execute immediately
    this.executeUptimeCheck(check);
  }

  private stopUptimeCheck(checkId: string) {
    const interval = this.checkIntervals.get(checkId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(checkId);
    }
  }

  private async executeUptimeCheck(check: UptimeCheck) {
    for (const region of check.regions) {
      try {
        const startTime = Date.now();
        
        // Build full URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        const fullUrl = check.url.startsWith('http') ? check.url : `${baseUrl}${check.url}`;
        
        const response = await fetch(fullUrl, {
          method: check.method,
          headers: check.headers,
          body: check.body,
          signal: AbortSignal.timeout(check.timeout * 1000),
          redirect: check.followRedirects ? 'follow' : 'manual',
        });

        const responseTime = Date.now() - startTime;
        const success = check.expectedStatus.includes(response.status);
        
        let contentMatch = true;
        if (check.expectedContent) {
          const content = await response.text();
          contentMatch = content.includes(check.expectedContent);
        }

        const result: UptimeResult = {
          id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          checkId: check.id,
          timestamp: new Date(),
          region,
          success: success && contentMatch,
          responseTime,
          statusCode: response.status,
          contentMatch,
          sslValid: true, // Would check SSL certificate in production
        };

        this.recordUptimeResult(result);

        // Record metrics
        multiProviderAPM.recordMetric(
          'uptime_check_response_time',
          responseTime,
          'histogram',
          {
            check_id: check.id,
            region,
            success: success.toString(),
          }
        );

        multiProviderAPM.recordMetric(
          'uptime_check_success',
          success ? 1 : 0,
          'gauge',
          {
            check_id: check.id,
            region,
          }
        );

      } catch (error) {
        const result: UptimeResult = {
          id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          checkId: check.id,
          timestamp: new Date(),
          region,
          success: false,
          responseTime: check.timeout * 1000,
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        this.recordUptimeResult(result);

        logger.error(`Uptime check ${check.id} failed in ${region}:`, error);
      }
    }
  }

  private recordUptimeResult(result: UptimeResult) {
    const results = this.uptimeResults.get(result.checkId) || [];
    results.push(result);
    
    // Keep last 1000 results per check
    if (results.length > 1000) {
      results.shift();
    }
    
    this.uptimeResults.set(result.checkId, results);
  }

  private async evaluateAllSLAs() {
    for (const sla of this.slas.values()) {
      if (!sla.enabled) continue;

      try {
        await this.evaluateSLA(sla);
      } catch (error) {
        logger.error(`Error evaluating SLA ${sla.id}:`, error);
      }
    }
  }

  private async evaluateSLA(sla: SLA) {
    const now = new Date();
    const timeWindow = this.calculateTimeWindow(sla.timeWindow, now);
    
    const record: SLARecord = {
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      slaId: sla.id,
      timestamp: now,
      status: SLAStatus.UNKNOWN,
      compliance: 0,
      targets: {},
      incidents: [],
    };

    let overallCompliance = 100;
    let hasBreaches = false;
    let hasWarnings = false;

    for (const target of sla.targets) {
      const actual = await this.getMeasurement(sla.measurement, target.metric, timeWindow);
      const compliant = this.evaluateTarget(target, actual);
      const deviation = this.calculateDeviation(target, actual);

      record.targets[target.id] = {
        actual,
        target: target.target,
        compliant,
        deviation,
      };

      if (!compliant) {
        hasBreaches = true;
        overallCompliance = Math.min(overallCompliance, (actual / target.target) * 100);
      }

      // Check warning thresholds
      if (target.warningThreshold) {
        const warningLevel = target.target * (target.warningThreshold / 100);
        if (target.operator === 'gte' && actual < warningLevel) {
          hasWarnings = true;
        } else if (target.operator === 'lte' && actual > warningLevel) {
          hasWarnings = true;
        }
      }
    }

    // Determine overall status
    if (hasBreaches) {
      record.status = SLAStatus.BREACHED;
    } else if (hasWarnings) {
      record.status = SLAStatus.AT_RISK;
    } else {
      record.status = SLAStatus.COMPLIANT;
    }

    record.compliance = overallCompliance;

    // Store record
    const records = this.slaRecords.get(sla.id) || [];
    records.push(record);
    
    // Keep last 1000 records per SLA
    if (records.length > 1000) {
      records.shift();
    }
    
    this.slaRecords.set(sla.id, records);

    // Send notifications if needed
    await this.checkNotifications(sla, record);

    // Record metrics
    multiProviderAPM.recordMetric(
      'sla_compliance',
      record.compliance,
      'gauge',
      {
        sla_id: sla.id,
        sla_name: sla.name,
        status: record.status,
      }
    );

    logger.debug(`SLA ${sla.id} evaluated`, {
      status: record.status,
      compliance: record.compliance,
    });
  }

  private calculateTimeWindow(config: SLATimeWindow, now: Date): { start: Date; end: Date } {
    const end = new Date(now);
    const start = new Date(now);

    switch (config.period) {
      case 'hour':
        start.setHours(start.getHours() - config.duration);
        break;
      case 'day':
        start.setDate(start.getDate() - config.duration);
        break;
      case 'week':
        start.setDate(start.getDate() - (config.duration * 7));
        break;
      case 'month':
        start.setMonth(start.getMonth() - config.duration);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - (config.duration * 3));
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - config.duration);
        break;
    }

    return { start, end };
  }

  private async getMeasurement(config: SLAMeasurement, metric: string, timeWindow: { start: Date; end: Date }): Promise<number> {
    switch (config.source) {
      case 'synthetic':
        return this.getSyntheticMeasurement(metric, timeWindow);
      case 'real_user':
        return this.getRealUserMeasurement(metric, timeWindow);
      case 'health_check':
        return this.getHealthCheckMeasurement(metric, timeWindow);
      default:
        return 0;
    }
  }

  private getSyntheticMeasurement(metric: string, timeWindow: { start: Date; end: Date }): number {
    // Calculate from uptime check results
    const allResults: UptimeResult[] = [];
    
    for (const results of this.uptimeResults.values()) {
      const filteredResults = results.filter(r => 
        r.timestamp >= timeWindow.start && r.timestamp <= timeWindow.end
      );
      allResults.push(...filteredResults);
    }

    if (allResults.length === 0) return 100; // Default to 100% if no data

    switch (metric) {
      case 'availability':
        const successfulChecks = allResults.filter(r => r.success).length;
        return (successfulChecks / allResults.length) * 100;
      
      case 'response_time_p95':
        const responseTimes = allResults
          .filter(r => r.success)
          .map(r => r.responseTime)
          .sort((a, b) => a - b);
        
        if (responseTimes.length === 0) return 0;
        
        const p95Index = Math.floor(responseTimes.length * 0.95);
        return responseTimes[p95Index] || 0;
      
      default:
        return 0;
    }
  }

  private getRealUserMeasurement(metric: string, timeWindow: { start: Date; end: Date }): number {
    // In production, this would query real user monitoring data
    // For now, return mock values
    switch (metric) {
      case 'response_time_p95':
        return Math.random() * 1000 + 500; // 500-1500ms
      case 'error_rate':
        return Math.random() * 2; // 0-2%
      default:
        return Math.random() * 100;
    }
  }

  private getHealthCheckMeasurement(metric: string, timeWindow: { start: Date; end: Date }): number {
    // Mock health check measurement
    return Math.random() * 100;
  }

  private evaluateTarget(target: SLATarget, actual: number): boolean {
    switch (target.operator) {
      case 'gte':
        return actual >= target.target;
      case 'lte':
        return actual <= target.target;
      case 'eq':
        return Math.abs(actual - target.target) < 0.01; // Allow small floating point differences
      default:
        return false;
    }
  }

  private calculateDeviation(target: SLATarget, actual: number): number {
    const deviation = ((actual - target.target) / target.target) * 100;
    return Math.round(deviation * 100) / 100; // Round to 2 decimal places
  }

  private async checkNotifications(sla: SLA, record: SLARecord) {
    // Check if we should send notifications based on status change
    const previousRecords = this.slaRecords.get(sla.id) || [];
    const previousRecord = previousRecords[previousRecords.length - 2]; // Second to last

    if (!previousRecord || previousRecord.status !== record.status) {
      for (const notification of sla.notifications) {
        if (
          (notification.type === 'warning' && record.status === SLAStatus.AT_RISK) ||
          (notification.type === 'breach' && record.status === SLAStatus.BREACHED) ||
          (notification.type === 'recovery' && record.status === SLAStatus.COMPLIANT && previousRecord?.status !== SLAStatus.COMPLIANT)
        ) {
          await this.sendSLANotification(sla, record, notification);
        }
      }
    }
  }

  private async sendSLANotification(sla: SLA, record: SLARecord, notification: SLANotification) {
    // Create alert for SLA breach/warning
    const severity = record.status === SLAStatus.BREACHED ? 'critical' : 
                    record.status === SLAStatus.AT_RISK ? 'high' : 'medium';

    // This would integrate with the alerting engine
    logger.warn(`SLA notification: ${sla.name}`, {
      slaId: sla.id,
      status: record.status,
      compliance: record.compliance,
      type: notification.type,
    });
  }

  // Incident management
  public createIncident(incident: Omit<Incident, 'id' | 'timeline'>): string {
    const id = `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullIncident: Incident = {
      ...incident,
      id,
      timeline: [
        {
          id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          author: incident.creator,
          type: 'status_change',
          message: 'Incident created',
          newStatus: incident.status,
        },
      ],
    };

    this.incidents.set(id, fullIncident);
    
    logger.warn('Incident created', {
      incidentId: id,
      title: incident.title,
      severity: incident.severity,
    });

    return id;
  }

  public updateIncident(incidentId: string, update: Omit<IncidentUpdate, 'id' | 'timestamp'>) {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    const fullUpdate: IncidentUpdate = {
      ...update,
      id: `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    incident.timeline.push(fullUpdate);

    if (fullUpdate.newStatus) {
      incident.status = fullUpdate.newStatus;
      
      if (fullUpdate.newStatus === IncidentStatus.RESOLVED) {
        incident.endTime = new Date();
        incident.duration = incident.endTime.getTime() - incident.startTime.getTime();
      }
    }

    logger.info('Incident updated', {
      incidentId,
      updateType: update.type,
      newStatus: update.newStatus,
    });
  }

  // Reporting
  public async generateSLAReport(timeRange: { start: Date; end: Date }): Promise<SLAReport> {
    const slas = Array.from(this.slas.values());
    const incidents = Array.from(this.incidents.values()).filter(
      i => i.startTime >= timeRange.start && i.startTime <= timeRange.end
    );

    const slaReports = [];
    let totalCompliant = 0;
    let totalAtRisk = 0;
    let totalBreached = 0;

    for (const sla of slas) {
      const records = this.slaRecords.get(sla.id) || [];
      const periodRecords = records.filter(
        r => r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );

      if (periodRecords.length === 0) continue;

      const latestRecord = periodRecords[periodRecords.length - 1];
      const avgCompliance = periodRecords.reduce((sum, r) => sum + r.compliance, 0) / periodRecords.length;

      const slaIncidents = incidents.filter(i => i.affectedSLAs.includes(sla.id));

      slaReports.push({
        sla,
        compliance: avgCompliance,
        status: latestRecord.status,
        targets: latestRecord.targets,
        incidents: slaIncidents,
        trend: periodRecords.map(r => ({
          timestamp: r.timestamp,
          compliance: r.compliance,
        })),
      });

      // Count by status
      switch (latestRecord.status) {
        case SLAStatus.COMPLIANT:
          totalCompliant++;
          break;
        case SLAStatus.AT_RISK:
          totalAtRisk++;
          break;
        case SLAStatus.BREACHED:
          totalBreached++;
          break;
      }
    }

    // Calculate incident metrics
    const totalDowntime = incidents.reduce((sum, i) => sum + (i.duration || 0), 0);
    const resolvedIncidents = incidents.filter(i => i.status === IncidentStatus.RESOLVED);
    const mttr = resolvedIncidents.length > 0 
      ? resolvedIncidents.reduce((sum, i) => sum + (i.duration || 0), 0) / resolvedIncidents.length
      : 0;

    const mtbf = resolvedIncidents.length > 1
      ? (timeRange.end.getTime() - timeRange.start.getTime()) / (resolvedIncidents.length - 1)
      : 0;

    const incidentsBySeverity = incidents.reduce((acc, i) => {
      acc[i.severity] = (acc[i.severity] || 0) + 1;
      return acc;
    }, {} as Record<IncidentSeverity, number>);

    return {
      period: {
        start: timeRange.start,
        end: timeRange.end,
        type: 'custom',
      },
      summary: {
        totalSLAs: slas.length,
        compliantSLAs: totalCompliant,
        atRiskSLAs: totalAtRisk,
        breachedSLAs: totalBreached,
        overallCompliance: slaReports.length > 0
          ? slaReports.reduce((sum, r) => sum + r.compliance, 0) / slaReports.length
          : 100,
      },
      slas: slaReports,
      incidents: {
        total: incidents.length,
        bySeverity: incidentsBySeverity,
        totalDowntime,
        mttr,
        mtbf,
      },
      recommendations: this.generateRecommendations(slaReports, incidents),
    };
  }

  private generateRecommendations(slaReports: any[], incidents: Incident[]): string[] {
    const recommendations: string[] = [];

    // Check for consistently low compliance
    const lowComplianceSLAs = slaReports.filter(r => r.compliance < 95);
    if (lowComplianceSLAs.length > 0) {
      recommendations.push(`${lowComplianceSLAs.length} SLA(s) have compliance below 95%. Consider reviewing capacity and performance optimization.`);
    }

    // Check for high incident frequency
    if (incidents.length > 10) {
      recommendations.push(`High incident frequency detected (${incidents.length} incidents). Consider implementing preventive measures and improving monitoring.`);
    }

    // Check for long resolution times
    const highMTTR = incidents.filter(i => (i.duration || 0) > 4 * 60 * 60 * 1000); // > 4 hours
    if (highMTTR.length > 0) {
      recommendations.push(`${highMTTR.length} incident(s) had long resolution times. Consider improving incident response procedures and automation.`);
    }

    return recommendations;
  }

  // Status and metrics
  public getSLAStatus(): Record<string, SLAStatus> {
    const status: Record<string, SLAStatus> = {};
    
    for (const [slaId, records] of this.slaRecords) {
      const latestRecord = records[records.length - 1];
      status[slaId] = latestRecord?.status || SLAStatus.UNKNOWN;
    }

    return status;
  }

  public getUptimeStatus(): Record<string, { availability: number; averageResponseTime: number }> {
    const status: Record<string, { availability: number; averageResponseTime: number }> = {};
    
    for (const [checkId, results] of this.uptimeResults) {
      const recent = results.slice(-100); // Last 100 results
      
      if (recent.length === 0) {
        status[checkId] = { availability: 100, averageResponseTime: 0 };
        continue;
      }

      const successful = recent.filter(r => r.success).length;
      const availability = (successful / recent.length) * 100;
      const avgResponseTime = recent
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.responseTime, 0) / Math.max(successful, 1);

      status[checkId] = {
        availability: Math.round(availability * 100) / 100,
        averageResponseTime: Math.round(avgResponseTime),
      };
    }

    return status;
  }

  public getMetrics(): Record<string, any> {
    const slaStatus = this.getSLAStatus();
    const uptimeStatus = this.getUptimeStatus();
    
    return {
      slas: {
        total: this.slas.size,
        enabled: Array.from(this.slas.values()).filter(s => s.enabled).length,
        compliant: Object.values(slaStatus).filter(s => s === SLAStatus.COMPLIANT).length,
        atRisk: Object.values(slaStatus).filter(s => s === SLAStatus.AT_RISK).length,
        breached: Object.values(slaStatus).filter(s => s === SLAStatus.BREACHED).length,
      },
      uptimeChecks: {
        total: this.uptimeChecks.size,
        enabled: Array.from(this.uptimeChecks.values()).filter(c => c.enabled).length,
        running: this.checkIntervals.size,
      },
      incidents: {
        total: this.incidents.size,
        open: Array.from(this.incidents.values()).filter(i => i.status !== IncidentStatus.RESOLVED).length,
        resolved: Array.from(this.incidents.values()).filter(i => i.status === IncidentStatus.RESOLVED).length,
      },
      status: {
        sla: slaStatus,
        uptime: uptimeStatus,
      },
    };
  }

  public shutdown() {
    // Stop all uptime check intervals
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }

    // Stop SLA evaluation loop
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }

    logger.info('SLA tracker shutdown');
  }
}

// Create singleton instance
export const slaTracker = new SLATracker();

// Export default
export default slaTracker;