/**
 * SLA monitoring with availability and performance tracking
 * Monitors service level agreements and tracks compliance
 */
import { createLogger } from '../logger';
import { env } from '../env-validation';

const logger = createLogger('sla-monitoring');

// SLA metric types
export enum SLAMetricType {
  AVAILABILITY = 'AVAILABILITY',
  LATENCY = 'LATENCY',
  ERROR_RATE = 'ERROR_RATE',
  THROUGHPUT = 'THROUGHPUT',
  UPTIME = 'UPTIME'
}

// SLA time windows
export enum SLATimeWindow {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

// SLA status
export enum SLAStatus {
  COMPLIANT = 'COMPLIANT',
  AT_RISK = 'AT_RISK',
  BREACHED = 'BREACHED',
  RECOVERING = 'RECOVERING'
}

// SLA definition
export interface SLADefinition {
  id: string;
  name: string;
  description: string;
  service: string;
  metric: SLAMetricType;
  target: number;
  threshold: number; // Warning threshold (e.g., 95% of target)
  timeWindow: SLATimeWindow;
  measurement: {
    unit: string; // e.g., 'percentage', 'milliseconds', 'requests/second'
    aggregation: 'average' | 'sum' | 'max' | 'min' | 'p95' | 'p99';
  };
  alerting: {
    enabled: boolean;
    onBreach: boolean;
    onAtRisk: boolean;
    onRecovery: boolean;
    escalation: boolean;
  };
  businessImpact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedFeatures: string[];
    customerImpact: string;
    revenueImpact?: string;
  };
  enabled: boolean;
}

// SLA measurement
export interface SLAMeasurement {
  id: string;
  slaId: string;
  timestamp: number;
  value: number;
  windowStart: number;
  windowEnd: number;
  status: SLAStatus;
  metadata?: any;
}

// SLA compliance report
export interface SLAComplianceReport {
  slaId: string;
  timeWindow: SLATimeWindow;
  period: {
    start: number;
    end: number;
  };
  target: number;
  actual: number;
  compliance: number; // percentage
  status: SLAStatus;
  breaches: number;
  totalMeasurements: number;
  measurements: SLAMeasurement[];
  trends: {
    previous: number;
    change: number;
    improving: boolean;
  };
  incidents: SLAIncident[];
}

// SLA incident
export interface SLAIncident {
  id: string;
  slaId: string;
  type: 'breach' | 'at_risk' | 'degradation';
  startTime: number;
  endTime?: number;
  duration?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  resolution?: string;
  status: 'open' | 'investigating' | 'resolved';
}

// SLA monitoring configuration
interface SLAMonitoringConfig {
  enabled: boolean;
  measurementInterval: number;
  retentionDays: number;
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    slackChannel?: string;
    emailRecipients?: string[];
  };
  reporting: {
    enabled: boolean;
    frequency: number; // milliseconds
    recipients?: string[];
  };
  compliance: {
    warningThreshold: number; // percentage below target to warn
    criticalThreshold: number; // percentage below target for critical
  };
}

const config: SLAMonitoringConfig = {
  enabled: process.env.ENABLE_SLA_MONITORING !== 'false',
  measurementInterval: parseInt(process.env.SLA_MEASUREMENT_INTERVAL || '60000'), // 1 minute
  retentionDays: parseInt(process.env.SLA_RETENTION_DAYS || '90'),
  alerting: {
    enabled: process.env.SLA_ALERTING_ENABLED === 'true',
    webhookUrl: process.env.SLA_ALERT_WEBHOOK_URL,
    slackChannel: process.env.SLA_ALERT_SLACK_CHANNEL,
    emailRecipients: process.env.SLA_ALERT_EMAIL_RECIPIENTS?.split(',') || [],
  },
  reporting: {
    enabled: process.env.SLA_REPORTING_ENABLED === 'true',
    frequency: parseInt(process.env.SLA_REPORTING_FREQUENCY || '86400000'), // 24 hours
    recipients: process.env.SLA_REPORT_RECIPIENTS?.split(',') || [],
  },
  compliance: {
    warningThreshold: parseFloat(process.env.SLA_WARNING_THRESHOLD || '5.0'), // 5% below target
    criticalThreshold: parseFloat(process.env.SLA_CRITICAL_THRESHOLD || '10.0'), // 10% below target
  },
};

// Predefined SLAs for the learning assistant
export const defaultSLAs: SLADefinition[] = [
  {
    id: 'service-availability',
    name: 'Service Availability',
    description: 'Overall service availability percentage',
    service: 'learning-assistant',
    metric: SLAMetricType.AVAILABILITY,
    target: 99.9, // 99.9% availability
    threshold: 99.5, // Warning at 99.5%
    timeWindow: SLATimeWindow.MONTHLY,
    measurement: {
      unit: 'percentage',
      aggregation: 'average',
    },
    alerting: {
      enabled: true,
      onBreach: true,
      onAtRisk: true,
      onRecovery: true,
      escalation: true,
    },
    businessImpact: {
      severity: 'critical',
      affectedFeatures: ['all'],
      customerImpact: 'Service completely unavailable',
      revenueImpact: 'Complete revenue loss during downtime',
    },
    enabled: true,
  },
  {
    id: 'api-response-time',
    name: 'API Response Time',
    description: 'Average API response time under 500ms',
    service: 'api',
    metric: SLAMetricType.LATENCY,
    target: 500, // 500ms
    threshold: 400, // Warning at 400ms
    timeWindow: SLATimeWindow.HOURLY,
    measurement: {
      unit: 'milliseconds',
      aggregation: 'p95',
    },
    alerting: {
      enabled: true,
      onBreach: true,
      onAtRisk: false,
      onRecovery: false,
      escalation: false,
    },
    businessImpact: {
      severity: 'high',
      affectedFeatures: ['api', 'user_interactions'],
      customerImpact: 'Slower user experience',
      revenueImpact: 'Potential customer churn due to poor performance',
    },
    enabled: true,
  },
  {
    id: 'error-rate',
    name: 'Error Rate',
    description: 'API error rate below 1%',
    service: 'api',
    metric: SLAMetricType.ERROR_RATE,
    target: 1.0, // 1% error rate
    threshold: 0.5, // Warning at 0.5%
    timeWindow: SLATimeWindow.HOURLY,
    measurement: {
      unit: 'percentage',
      aggregation: 'average',
    },
    alerting: {
      enabled: true,
      onBreach: true,
      onAtRisk: true,
      onRecovery: true,
      escalation: true,
    },
    businessImpact: {
      severity: 'high',
      affectedFeatures: ['api', 'user_interactions', 'data_processing'],
      customerImpact: 'Increased failure rate for user actions',
      revenueImpact: 'Customer dissatisfaction and potential churn',
    },
    enabled: true,
  },
  {
    id: 'learning-session-completion',
    name: 'Learning Session Completion Rate',
    description: 'Percentage of learning sessions completed successfully',
    service: 'learning-engine',
    metric: SLAMetricType.THROUGHPUT,
    target: 95.0, // 95% completion rate
    threshold: 90.0, // Warning at 90%
    timeWindow: SLATimeWindow.DAILY,
    measurement: {
      unit: 'percentage',
      aggregation: 'average',
    },
    alerting: {
      enabled: true,
      onBreach: true,
      onAtRisk: true,
      onRecovery: false,
      escalation: false,
    },
    businessImpact: {
      severity: 'medium',
      affectedFeatures: ['learning_sessions', 'user_progress'],
      customerImpact: 'Users unable to complete learning sessions',
      revenueImpact: 'Reduced learning effectiveness and user engagement',
    },
    enabled: true,
  },
  {
    id: 'database-availability',
    name: 'Database Availability',
    description: 'Database uptime and connectivity',
    service: 'database',
    metric: SLAMetricType.AVAILABILITY,
    target: 99.95, // 99.95% availability
    threshold: 99.9, // Warning at 99.9%
    timeWindow: SLATimeWindow.MONTHLY,
    measurement: {
      unit: 'percentage',
      aggregation: 'average',
    },
    alerting: {
      enabled: true,
      onBreach: true,
      onAtRisk: true,
      onRecovery: true,
      escalation: true,
    },
    businessImpact: {
      severity: 'critical',
      affectedFeatures: ['all'],
      customerImpact: 'Complete service failure',
      revenueImpact: 'Complete revenue loss during outage',
    },
    enabled: true,
  },
  {
    id: 'user-authentication-success',
    name: 'User Authentication Success Rate',
    description: 'Percentage of successful user authentications',
    service: 'authentication',
    metric: SLAMetricType.THROUGHPUT,
    target: 99.5, // 99.5% success rate
    threshold: 99.0, // Warning at 99%
    timeWindow: SLATimeWindow.HOURLY,
    measurement: {
      unit: 'percentage',
      aggregation: 'average',
    },
    alerting: {
      enabled: true,
      onBreach: true,
      onAtRisk: true,
      onRecovery: true,
      escalation: true,
    },
    businessImpact: {
      severity: 'critical',
      affectedFeatures: ['user_login', 'user_registration', 'session_management'],
      customerImpact: 'Users cannot access the service',
      revenueImpact: 'Complete user lockout, revenue impact',
    },
    enabled: true,
  },
];

// SLA data storage
const slaMeasurements = new Map<string, SLAMeasurement[]>();
const slaIncidents = new Map<string, SLAIncident[]>();
const slaSchedules = new Map<string, NodeJS.Timeout>();

// Helper function to get time window boundaries
const getTimeWindowBoundaries = (timeWindow: SLATimeWindow, timestamp = Date.now()): { start: number; end: number } => {
  const date = new Date(timestamp);
  
  switch (timeWindow) {
    case SLATimeWindow.HOURLY:
      return {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime(),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime(),
      };
    case SLATimeWindow.DAILY:
      return {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime(),
      };
    case SLATimeWindow.WEEKLY:
      const dayOfWeek = date.getDay();
      return {
        start: new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek).getTime(),
        end: new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek + 7).getTime(),
      };
    case SLATimeWindow.MONTHLY:
      return {
        start: new Date(date.getFullYear(), date.getMonth(), 1).getTime(),
        end: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(),
      };
    case SLATimeWindow.QUARTERLY:
      const quarter = Math.floor(date.getMonth() / 3);
      return {
        start: new Date(date.getFullYear(), quarter * 3, 1).getTime(),
        end: new Date(date.getFullYear(), quarter * 3 + 3, 1).getTime(),
      };
    case SLATimeWindow.YEARLY:
      return {
        start: new Date(date.getFullYear(), 0, 1).getTime(),
        end: new Date(date.getFullYear() + 1, 0, 1).getTime(),
      };
    default:
      throw new Error(`Unknown time window: ${timeWindow}`);
  }
};

// Calculate SLA metric based on type
const calculateSLAMetric = async (sla: SLADefinition): Promise<number> => {
  try {
    switch (sla.metric) {
      case SLAMetricType.AVAILABILITY:
        return await calculateAvailabilityMetric(sla);
      case SLAMetricType.LATENCY:
        return await calculateLatencyMetric(sla);
      case SLAMetricType.ERROR_RATE:
        return await calculateErrorRateMetric(sla);
      case SLAMetricType.THROUGHPUT:
        return await calculateThroughputMetric(sla);
      case SLAMetricType.UPTIME:
        return await calculateUptimeMetric(sla);
      default:
        throw new Error(`Unknown SLA metric type: ${sla.metric}`);
    }
  } catch (error) {
    logger.error(`Failed to calculate SLA metric for ${sla.id}`, error);
    return 0;
  }
};

// Calculate availability metric
const calculateAvailabilityMetric = async (sla: SLADefinition): Promise<number> => {
  // Get health check results for the service
  const { healthCheckManager } = await import('../health-checks');
  const healthChecks = await healthCheckManager.runAll();
  
  if (sla.service === 'learning-assistant') {
    // Overall service availability based on critical components
    const criticalChecks = healthChecks.filter(check => 
      ['database', 'application', 'learning_system'].includes(check.name)
    );
    const healthyChecks = criticalChecks.filter(check => check.status === 'healthy');
    return criticalChecks.length > 0 ? (healthyChecks.length / criticalChecks.length) * 100 : 0;
  }
  
  if (sla.service === 'database') {
    const dbCheck = healthChecks.find(check => check.name === 'database');
    return dbCheck?.status === 'healthy' ? 100 : 0;
  }
  
  // Default: service is available if any related checks are healthy
  const serviceChecks = healthChecks.filter(check => check.name.includes(sla.service));
  const healthyServiceChecks = serviceChecks.filter(check => check.status === 'healthy');
  return serviceChecks.length > 0 ? (healthyServiceChecks.length / serviceChecks.length) * 100 : 100;
};

// Calculate latency metric
const calculateLatencyMetric = async (sla: SLADefinition): Promise<number> => {
  // Get APM metrics
  const { apm } = await import('../apm');
  const metrics = apm.getMetrics();
  
  if (sla.service === 'api') {
    return metrics.averageResponseTime || 0;
  }
  
  // Default to overall response time
  return metrics.averageResponseTime || 0;
};

// Calculate error rate metric
const calculateErrorRateMetric = async (sla: SLADefinition): Promise<number> => {
  // Get APM metrics
  const { apm } = await import('../apm');
  const metrics = apm.getMetrics();
  
  const totalRequests = metrics.requests || 1;
  const errorRequests = metrics.errors || 0;
  
  return (errorRequests / totalRequests) * 100;
};

// Calculate throughput metric
const calculateThroughputMetric = async (sla: SLADefinition): Promise<number> => {
  if (sla.service === 'learning-engine') {
    // Mock calculation for learning session completion rate
    // In a real implementation, this would query your learning analytics
    return 95.0; // Assume 95% completion rate
  }
  
  if (sla.service === 'authentication') {
    // Mock calculation for authentication success rate
    // In a real implementation, this would query your auth service metrics
    return 99.2; // Assume 99.2% success rate
  }
  
  // Get APM metrics for general throughput
  const { apm } = await import('../apm');
  const metrics = apm.getMetrics();
  
  return metrics.requests || 0;
};

// Calculate uptime metric
const calculateUptimeMetric = async (sla: SLADefinition): Promise<number> => {
  // Similar to availability but based on continuous uptime
  return await calculateAvailabilityMetric(sla);
};

// Determine SLA status
const determineSLAStatus = (sla: SLADefinition, currentValue: number, previousMeasurements: SLAMeasurement[]): SLAStatus => {
  // For error rate, lower is better
  const isInverted = sla.metric === SLAMetricType.ERROR_RATE;
  
  const target = sla.target;
  const threshold = sla.threshold;
  
  let status: SLAStatus;
  
  if (isInverted) {
    // For error rates, higher values are worse
    if (currentValue > target) {
      status = SLAStatus.BREACHED;
    } else if (currentValue > threshold) {
      status = SLAStatus.AT_RISK;
    } else {
      status = SLAStatus.COMPLIANT;
    }
  } else {
    // For other metrics, lower values are worse
    if (currentValue < target) {
      status = SLAStatus.BREACHED;
    } else if (currentValue < threshold) {
      status = SLAStatus.AT_RISK;
    } else {
      status = SLAStatus.COMPLIANT;
    }
  }
  
  // Check if recovering from a breach
  if (previousMeasurements.length > 0) {
    const lastMeasurement = previousMeasurements[previousMeasurements.length - 1];
    if (lastMeasurement.status === SLAStatus.BREACHED && status !== SLAStatus.BREACHED) {
      status = SLAStatus.RECOVERING;
    }
  }
  
  return status;
};

// Measure SLA compliance
export const measureSLA = async (sla: SLADefinition): Promise<SLAMeasurement> => {
  const startTime = Date.now();
  const timeWindow = getTimeWindowBoundaries(sla.timeWindow, startTime);
  
  const value = await calculateSLAMetric(sla);
  const previousMeasurements = slaMeasurements.get(sla.id) || [];
  const status = determineSLAStatus(sla, value, previousMeasurements);
  
  const measurement: SLAMeasurement = {
    id: `${sla.id}-${startTime}`,
    slaId: sla.id,
    timestamp: startTime,
    value,
    windowStart: timeWindow.start,
    windowEnd: timeWindow.end,
    status,
    metadata: {
      target: sla.target,
      threshold: sla.threshold,
      unit: sla.measurement.unit,
      aggregation: sla.measurement.aggregation,
    },
  };
  
  // Store measurement
  if (!slaMeasurements.has(sla.id)) {
    slaMeasurements.set(sla.id, []);
  }
  const measurements = slaMeasurements.get(sla.id)!;
  measurements.push(measurement);
  
  // Keep only recent measurements
  const retentionCutoff = Date.now() - (config.retentionDays * 24 * 60 * 60 * 1000);
  slaMeasurements.set(sla.id, measurements.filter(m => m.timestamp > retentionCutoff));
  
  logger.info(`SLA measurement completed: ${sla.name}`, {
    value,
    status,
    target: sla.target,
    unit: sla.measurement.unit,
  });
  
  return measurement;
};

// Create SLA incident
const createSLAIncident = async (sla: SLADefinition, measurement: SLAMeasurement, type: 'breach' | 'at_risk' | 'degradation') => {
  const incident: SLAIncident = {
    id: `${sla.id}-incident-${Date.now()}`,
    slaId: sla.id,
    type,
    startTime: measurement.timestamp,
    severity: sla.businessImpact.severity,
    impact: sla.businessImpact.customerImpact,
    status: 'open',
  };
  
  if (!slaIncidents.has(sla.id)) {
    slaIncidents.set(sla.id, []);
  }
  slaIncidents.get(sla.id)!.push(incident);
  
  logger.warn(`SLA incident created: ${sla.name}`, {
    type,
    severity: incident.severity,
    value: measurement.value,
    target: sla.target,
  });
  
  // Send alert
  if (sla.alerting.enabled) {
    await sendSLAAlert(sla, incident, measurement);
  }
  
  return incident;
};

// Send SLA alert
const sendSLAAlert = async (sla: SLADefinition, incident: SLAIncident, measurement: SLAMeasurement) => {
  if (!config.alerting.enabled) return;
  
  const alert = {
    type: 'sla_alert',
    sla: {
      id: sla.id,
      name: sla.name,
      service: sla.service,
      metric: sla.metric,
      target: sla.target,
    },
    incident: {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      impact: incident.impact,
    },
    measurement: {
      value: measurement.value,
      status: measurement.status,
      unit: sla.measurement.unit,
    },
    businessImpact: sla.businessImpact,
    timestamp: new Date().toISOString(),
  };
  
  // Send to webhook
  if (config.alerting.webhookUrl) {
    try {
      await fetch(config.alerting.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      logger.error('Failed to send SLA alert', error);
    }
  }
  
  logger.warn(`SLA alert sent: ${sla.name}`, alert);
};

// Schedule SLA monitoring
export const scheduleSLAMonitoring = (sla: SLADefinition) => {
  if (!config.enabled || !sla.enabled) return;
  
  // Clear existing schedule
  if (slaSchedules.has(sla.id)) {
    clearInterval(slaSchedules.get(sla.id)!);
  }
  
  // Schedule measurements
  const interval = setInterval(async () => {
    try {
      const measurement = await measureSLA(sla);
      
      // Handle status changes
      if (measurement.status === SLAStatus.BREACHED && sla.alerting.onBreach) {
        await createSLAIncident(sla, measurement, 'breach');
      } else if (measurement.status === SLAStatus.AT_RISK && sla.alerting.onAtRisk) {
        await createSLAIncident(sla, measurement, 'at_risk');
      }
      
    } catch (error) {
      logger.error(`Failed to measure SLA: ${sla.name}`, error);
    }
  }, config.measurementInterval);
  
  slaSchedules.set(sla.id, interval);
  
  logger.info(`Scheduled SLA monitoring: ${sla.name}`, {
    interval: config.measurementInterval,
    target: sla.target,
    timeWindow: sla.timeWindow,
  });
};

// Generate SLA compliance report
export const generateComplianceReport = (slaId: string, timeWindow?: SLATimeWindow): SLAComplianceReport | null => {
  const sla = defaultSLAs.find(s => s.id === slaId);
  if (!sla) return null;
  
  const measurements = slaMeasurements.get(slaId) || [];
  const window = timeWindow || sla.timeWindow;
  const boundaries = getTimeWindowBoundaries(window);
  
  const periodMeasurements = measurements.filter(m => 
    m.timestamp >= boundaries.start && m.timestamp < boundaries.end
  );
  
  if (periodMeasurements.length === 0) {
    return null;
  }
  
  // Calculate compliance
  const compliantMeasurements = periodMeasurements.filter(m => m.status === SLAStatus.COMPLIANT);
  const compliance = (compliantMeasurements.length / periodMeasurements.length) * 100;
  
  // Calculate actual value based on aggregation method
  let actualValue: number;
  switch (sla.measurement.aggregation) {
    case 'average':
      actualValue = periodMeasurements.reduce((sum, m) => sum + m.value, 0) / periodMeasurements.length;
      break;
    case 'max':
      actualValue = Math.max(...periodMeasurements.map(m => m.value));
      break;
    case 'min':
      actualValue = Math.min(...periodMeasurements.map(m => m.value));
      break;
    case 'p95':
      const sorted = periodMeasurements.map(m => m.value).sort((a, b) => a - b);
      actualValue = sorted[Math.floor(sorted.length * 0.95)];
      break;
    case 'p99':
      const sorted99 = periodMeasurements.map(m => m.value).sort((a, b) => a - b);
      actualValue = sorted99[Math.floor(sorted99.length * 0.99)];
      break;
    default:
      actualValue = periodMeasurements.reduce((sum, m) => sum + m.value, 0) / periodMeasurements.length;
  }
  
  // Determine overall status
  const breaches = periodMeasurements.filter(m => m.status === SLAStatus.BREACHED).length;
  let status: SLAStatus;
  if (breaches > 0) {
    status = SLAStatus.BREACHED;
  } else if (compliance < 95) {
    status = SLAStatus.AT_RISK;
  } else {
    status = SLAStatus.COMPLIANT;
  }
  
  // Calculate trends (compare with previous period)
  const previousBoundaries = getTimeWindowBoundaries(window, boundaries.start - 1);
  const previousMeasurements = measurements.filter(m => 
    m.timestamp >= previousBoundaries.start && m.timestamp < previousBoundaries.end
  );
  
  let previousValue = 0;
  if (previousMeasurements.length > 0) {
    previousValue = previousMeasurements.reduce((sum, m) => sum + m.value, 0) / previousMeasurements.length;
  }
  
  const change = actualValue - previousValue;
  const improving = sla.metric === SLAMetricType.ERROR_RATE ? change < 0 : change > 0;
  
  // Get incidents for this period
  const incidents = (slaIncidents.get(slaId) || []).filter(i => 
    i.startTime >= boundaries.start && i.startTime < boundaries.end
  );
  
  return {
    slaId,
    timeWindow: window,
    period: {
      start: boundaries.start,
      end: boundaries.end,
    },
    target: sla.target,
    actual: actualValue,
    compliance,
    status,
    breaches,
    totalMeasurements: periodMeasurements.length,
    measurements: periodMeasurements,
    trends: {
      previous: previousValue,
      change,
      improving,
    },
    incidents,
  };
};

// Get SLA monitoring summary
export const getSLAMonitoringSummary = () => {
  const summary = {
    enabled: config.enabled,
    totalSLAs: defaultSLAs.length,
    activeSLAs: defaultSLAs.filter(sla => sla.enabled).length,
    monitoredSLAs: slaSchedules.size,
    slaStatus: {
      compliant: 0,
      atRisk: 0,
      breached: 0,
      recovering: 0,
    },
    overallCompliance: 0,
    activeIncidents: 0,
    slas: {} as Record<string, any>,
    timestamp: new Date().toISOString(),
  };
  
  // Get latest measurements for each SLA
  defaultSLAs.forEach(sla => {
    const measurements = slaMeasurements.get(sla.id) || [];
    if (measurements.length > 0) {
      const latest = measurements[measurements.length - 1];
      
      // Count status
      switch (latest.status) {
        case SLAStatus.COMPLIANT:
          summary.slaStatus.compliant++;
          break;
        case SLAStatus.AT_RISK:
          summary.slaStatus.atRisk++;
          break;
        case SLAStatus.BREACHED:
          summary.slaStatus.breached++;
          break;
        case SLAStatus.RECOVERING:
          summary.slaStatus.recovering++;
          break;
      }
      
      summary.slas[sla.id] = {
        name: sla.name,
        service: sla.service,
        metric: sla.metric,
        target: sla.target,
        current: latest.value,
        status: latest.status,
        lastMeasured: latest.timestamp,
        unit: sla.measurement.unit,
      };
    }
  });
  
  // Calculate overall compliance
  const totalMonitored = summary.slaStatus.compliant + summary.slaStatus.atRisk + 
                        summary.slaStatus.breached + summary.slaStatus.recovering;
  if (totalMonitored > 0) {
    summary.overallCompliance = ((summary.slaStatus.compliant + summary.slaStatus.recovering) / totalMonitored) * 100;
  }
  
  // Count active incidents
  slaIncidents.forEach(incidents => {
    summary.activeIncidents += incidents.filter(i => i.status === 'open').length;
  });
  
  return summary;
};

// Start SLA monitoring
export const startSLAMonitoring = () => {
  if (!config.enabled) {
    logger.info('SLA monitoring is disabled');
    return;
  }
  
  logger.info('Starting SLA monitoring', {
    slas: defaultSLAs.length,
    enabled: defaultSLAs.filter(sla => sla.enabled).length,
  });
  
  // Schedule monitoring for all enabled SLAs
  defaultSLAs.forEach(sla => {
    if (sla.enabled) {
      scheduleSLAMonitoring(sla);
    }
  });
};

// Stop SLA monitoring
export const stopSLAMonitoring = () => {
  slaSchedules.forEach((interval, slaId) => {
    clearInterval(interval);
    logger.info(`Stopped SLA monitoring: ${slaId}`);
  });
  
  slaSchedules.clear();
  logger.info('SLA monitoring stopped');
};

// Export the SLA monitoring service
export const slaMonitoring = {
  config,
  defaultSLAs,
  startMonitoring: startSLAMonitoring,
  stopMonitoring: stopSLAMonitoring,
  measureSLA,
  generateComplianceReport,
  getSummary: getSLAMonitoringSummary,
  getMeasurements: (slaId: string) => slaMeasurements.get(slaId) || [],
  getIncidents: (slaId: string) => slaIncidents.get(slaId) || [],
  getAllMeasurements: () => Object.fromEntries(slaMeasurements),
  getAllIncidents: () => Object.fromEntries(slaIncidents),
  scheduleSLA: scheduleSLAMonitoring,
};

export default slaMonitoring;