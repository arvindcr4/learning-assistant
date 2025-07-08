import { securityMonitor, SecurityEvent, SecurityAlert, SecurityEventType, SecurityEventSeverity } from './security-monitor';
import { realTimeThreatDetection } from './threat-detection';
import { intrusionDetectionSystem } from './intrusion-detection';

/**
 * Comprehensive incident response and management system
 */
export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  category: 'data_breach' | 'malware' | 'unauthorized_access' | 'ddos' | 'phishing' | 'insider_threat' | 'other';
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest, 5 = lowest
  createdAt: Date;
  updatedAt: Date;
  discoveredAt: Date;
  containedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  assignedTo?: string;
  reporter: string;
  affectedSystems: string[];
  affectedUsers: string[];
  evidenceUrls: string[];
  timeline: IncidentTimelineEntry[];
  actions: IncidentAction[];
  rootCause?: string;
  lessonsLearned?: string;
  postIncidentReport?: string;
  relatedEvents: string[]; // Security event IDs
  relatedAlerts: string[]; // Security alert IDs
  communicationLog: CommunicationEntry[];
  tags: string[];
  confidentiality: 'public' | 'internal' | 'confidential' | 'restricted';
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  type: 'discovery' | 'escalation' | 'containment' | 'investigation' | 'resolution' | 'communication' | 'other';
  description: string;
  user: string;
  automated: boolean;
}

export interface IncidentAction {
  id: string;
  type: 'immediate' | 'short_term' | 'long_term' | 'preventive';
  description: string;
  assignedTo?: string;
  dueDate?: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface CommunicationEntry {
  id: string;
  timestamp: Date;
  type: 'internal' | 'external' | 'customer' | 'regulatory' | 'media';
  channel: 'email' | 'phone' | 'slack' | 'teams' | 'sms' | 'press_release' | 'website';
  recipient: string;
  subject?: string;
  message: string;
  sentBy: string;
}

export interface PlaybookStep {
  id: string;
  title: string;
  description: string;
  assignedRole: string;
  estimatedDuration: number; // minutes
  dependencies: string[]; // step IDs
  automated: boolean;
  script?: string;
  checklist: string[];
}

export interface IncidentPlaybook {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  severity: SecurityIncident['severity'];
  category: SecurityIncident['category'];
  steps: PlaybookStep[];
  escalationCriteria: string[];
  communicationPlan: string[];
  roles: string[];
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: AutomationTrigger[];
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority: number;
  cooldownPeriod: number; // minutes
  lastExecuted?: Date;
  executionCount: number;
  successRate: number;
}

export interface AutomationTrigger {
  type: 'incident_created' | 'incident_updated' | 'threshold_exceeded' | 'time_based' | 'external_event';
  criteria: Record<string, any>;
  weight: number;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'matches_pattern';
  value: any;
  required: boolean;
}

export interface AutomationAction {
  type: 'escalate' | 'assign' | 'notify' | 'execute_script' | 'create_ticket' | 'block_entity' | 'isolate_system';
  parameters: Record<string, any>;
  timeout: number; // seconds
  retryCount: number;
  rollbackAction?: AutomationAction;
}

export interface EscalationMatrix {
  id: string;
  name: string;
  rules: EscalationRule[];
  defaultEscalationPath: string[];
  emergencyContacts: string[];
  businessHoursOnly: boolean;
  regions: string[];
}

export interface EscalationRule {
  id: string;
  condition: string;
  severity: SecurityIncident['severity'];
  timeThreshold: number; // minutes
  escalateTo: string[];
  notificationChannels: string[];
  requiresApproval: boolean;
  autoApprove: boolean;
}

export interface IncidentMetrics {
  mttr: number; // Mean Time To Resolve
  mtta: number; // Mean Time To Acknowledge
  mttc: number; // Mean Time To Contain
  totalIncidents: number;
  incidentsByCategory: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  escalationRate: number;
  automationRate: number;
  customerImpact: number;
  costOfIncidents: number;
}

export class IncidentResponseService {
  private incidents: Map<string, SecurityIncident> = new Map();
  private playbooks: Map<string, IncidentPlaybook> = new Map();
  private templates: Map<string, any> = new Map();
  private automationRules: Map<string, AutomationRule> = new Map();
  private escalationMatrix: Map<string, EscalationMatrix> = new Map();
  private activeAutomations: Map<string, any> = new Map();
  
  private readonly escalationRules = {
    autoEscalateAfterMinutes: {
      critical: 15,
      high: 60,
      medium: 240,
      low: 1440,
    },
    notificationChannels: {
      critical: ['sms', 'phone', 'email', 'slack'],
      high: ['email', 'slack'],
      medium: ['email'],
      low: ['email'],
    },
  };

  constructor() {
    this.setupDefaultPlaybooks();
    this.setupNotificationTemplates();
    this.setupAutomationRules();
    this.setupEscalationMatrix();
    this.startBackgroundProcessing();
    this.initializeIntegrations();
  }

  /**
   * Create a new security incident
   */
  createIncident(incident: Omit<SecurityIncident, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'timeline' | 'actions' | 'communicationLog'>): string {
    const incidentId = this.generateIncidentId();
    
    const newIncident: SecurityIncident = {
      id: incidentId,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      timeline: [],
      actions: [],
      communicationLog: [],
      ...incident,
    };

    // Add initial timeline entry
    this.addTimelineEntry(incidentId, {
      type: 'discovery',
      description: `Incident created: ${incident.title}`,
      user: incident.reporter,
      automated: false,
    });

    // Determine priority based on severity and category
    newIncident.priority = this.calculatePriority(incident.severity, incident.category);

    // Auto-assign based on severity and category
    newIncident.assignedTo = this.getAutoAssignee(incident.severity, incident.category);

    this.incidents.set(incidentId, newIncident);

    // Execute incident response playbook
    this.executePlaybook(incidentId);

    // Send initial notifications
    this.sendIncidentNotification(newIncident, 'created');

    // Execute automation rules
    this.executeAutomationRules('incident_created', newIncident);

    // Log security event
    securityMonitor.logEvent(
      SecurityEventType.SECURITY_CONFIGURATION_CHANGE,
      this.mapSeverityToEventSeverity(incident.severity),
      {
        source: 'incident_response',
        ipAddress: 'system',
        endpoint: 'incident_management',
        method: 'CREATE',
        incidentId,
        category: incident.category,
        title: incident.title,
      }
    );

    return incidentId;
  }

  /**
   * Update incident status
   */
  updateIncidentStatus(incidentId: string, newStatus: SecurityIncident['status'], user: string, notes?: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const oldStatus = incident.status;
    incident.status = newStatus;
    incident.updatedAt = new Date();

    // Update status-specific timestamps
    switch (newStatus) {
      case 'contained':
        incident.containedAt = new Date();
        break;
      case 'resolved':
        incident.resolvedAt = new Date();
        break;
      case 'closed':
        incident.closedAt = new Date();
        break;
    }

    // Add timeline entry
    this.addTimelineEntry(incidentId, {
      type: newStatus === 'contained' ? 'containment' : 
           newStatus === 'resolved' ? 'resolution' : 'other',
      description: `Status changed from ${oldStatus} to ${newStatus}${notes ? `: ${notes}` : ''}`,
      user,
      automated: false,
    });

    this.incidents.set(incidentId, incident);

    // Send status update notification
    this.sendIncidentNotification(incident, 'status_update');

    return true;
  }

  /**
   * Add timeline entry to incident
   */
  addTimelineEntry(incidentId: string, entry: Omit<IncidentTimelineEntry, 'id' | 'timestamp'>): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const timelineEntry: IncidentTimelineEntry = {
      id: this.generateTimelineId(),
      timestamp: new Date(),
      ...entry,
    };

    incident.timeline.push(timelineEntry);
    incident.updatedAt = new Date();
    this.incidents.set(incidentId, incident);

    return true;
  }

  /**
   * Add action item to incident
   */
  addIncidentAction(incidentId: string, action: Omit<IncidentAction, 'id' | 'status'>): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const incidentAction: IncidentAction = {
      id: this.generateActionId(),
      status: 'pending',
      ...action,
    };

    incident.actions.push(incidentAction);
    incident.updatedAt = new Date();
    this.incidents.set(incidentId, incident);

    // Send action assignment notification
    if (action.assignedTo) {
      this.sendActionAssignmentNotification(incident, incidentAction);
    }

    return true;
  }

  /**
   * Update action status
   */
  updateActionStatus(incidentId: string, actionId: string, status: IncidentAction['status'], user: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const action = incident.actions.find(a => a.id === actionId);
    if (!action) return false;

    action.status = status;
    if (status === 'completed') {
      action.completedAt = new Date();
    }

    incident.updatedAt = new Date();
    this.incidents.set(incidentId, incident);

    // Add timeline entry
    this.addTimelineEntry(incidentId, {
      type: 'other',
      description: `Action "${action.description}" marked as ${status}`,
      user,
      automated: false,
    });

    return true;
  }

  /**
   * Add communication log entry
   */
  addCommunicationEntry(incidentId: string, communication: Omit<CommunicationEntry, 'id' | 'timestamp'>): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const commEntry: CommunicationEntry = {
      id: this.generateCommunicationId(),
      timestamp: new Date(),
      ...communication,
    };

    incident.communicationLog.push(commEntry);
    incident.updatedAt = new Date();
    this.incidents.set(incidentId, incident);

    return true;
  }

  /**
   * Execute incident response playbook
   */
  executePlaybook(incidentId: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    // Find matching playbook
    const playbook = this.findMatchingPlaybook(incident);
    if (!playbook) {
      console.warn(`No matching playbook found for incident ${incidentId}`);
      return;
    }

    console.log(`Executing playbook "${playbook.name}" for incident ${incidentId}`);

    // Create actions from playbook steps
    for (const step of playbook.steps) {
      this.addIncidentAction(incidentId, {
        type: 'immediate',
        description: step.title,
        assignedTo: this.getAssigneeForRole(step.assignedRole),
        priority: incident.severity === 'critical' ? 'critical' : 'high',
      });

      // Execute automated steps
      if (step.automated && step.script) {
        this.executeAutomatedStep(incidentId, step);
      }
    }

    this.addTimelineEntry(incidentId, {
      type: 'other',
      description: `Executed playbook: ${playbook.name}`,
      user: 'system',
      automated: true,
    });
  }

  /**
   * Generate incident report
   */
  generateIncidentReport(incidentId: string): {
    summary: any;
    timeline: IncidentTimelineEntry[];
    actions: IncidentAction[];
    communications: CommunicationEntry[];
    metrics: any;
    recommendations: string[];
  } | null {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    // Calculate metrics
    const createdAt = incident.createdAt;
    const containedAt = incident.containedAt;
    const resolvedAt = incident.resolvedAt;
    const closedAt = incident.closedAt;

    const timeToContainment = containedAt ? 
      Math.round((containedAt.getTime() - createdAt.getTime()) / (1000 * 60)) : null;
    
    const timeToResolution = resolvedAt ? 
      Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60)) : null;

    const metrics = {
      timeToContainment,
      timeToResolution,
      totalActions: incident.actions.length,
      completedActions: incident.actions.filter(a => a.status === 'completed').length,
      communicationsSent: incident.communicationLog.length,
      affectedSystemsCount: incident.affectedSystems.length,
      affectedUsersCount: incident.affectedUsers.length,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(incident, metrics);

    return {
      summary: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        category: incident.category,
        status: incident.status,
        createdAt: incident.createdAt,
        resolvedAt: incident.resolvedAt,
        rootCause: incident.rootCause,
        lessonsLearned: incident.lessonsLearned,
      },
      timeline: incident.timeline,
      actions: incident.actions,
      communications: incident.communicationLog,
      metrics,
      recommendations,
    };
  }

  /**
   * Get incidents with filtering
   */
  getIncidents(filters: {
    status?: SecurityIncident['status'];
    severity?: SecurityIncident['severity'];
    category?: SecurityIncident['category'];
    assignedTo?: string;
    dateRange?: { start: Date; end: Date };
    limit?: number;
  } = {}): SecurityIncident[] {
    let incidents = Array.from(this.incidents.values());

    // Apply filters
    if (filters.status) {
      incidents = incidents.filter(i => i.status === filters.status);
    }
    if (filters.severity) {
      incidents = incidents.filter(i => i.severity === filters.severity);
    }
    if (filters.category) {
      incidents = incidents.filter(i => i.category === filters.category);
    }
    if (filters.assignedTo) {
      incidents = incidents.filter(i => i.assignedTo === filters.assignedTo);
    }
    if (filters.dateRange) {
      incidents = incidents.filter(i => 
        i.createdAt >= filters.dateRange!.start && 
        i.createdAt <= filters.dateRange!.end
      );
    }

    // Sort by created date (newest first)
    incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters.limit) {
      incidents = incidents.slice(0, filters.limit);
    }

    return incidents;
  }

  /**
   * Get incident metrics and statistics
   */
  getIncidentMetrics(): {
    total: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    averageTimeToContainment: number;
    averageTimeToResolution: number;
    trendsLast30Days: any[];
  } {
    const allIncidents = Array.from(this.incidents.values());
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentIncidents = allIncidents.filter(i => i.createdAt >= last30Days);

    // Count by status
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const incident of allIncidents) {
      byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;
      bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
      byCategory[incident.category] = (byCategory[incident.category] || 0) + 1;
    }

    // Calculate average times
    const containmentTimes = allIncidents
      .filter(i => i.containedAt)
      .map(i => (i.containedAt!.getTime() - i.createdAt.getTime()) / (1000 * 60));
    
    const resolutionTimes = allIncidents
      .filter(i => i.resolvedAt)
      .map(i => (i.resolvedAt!.getTime() - i.createdAt.getTime()) / (1000 * 60));

    const averageTimeToContainment = containmentTimes.length > 0 ?
      containmentTimes.reduce((a, b) => a + b, 0) / containmentTimes.length : 0;

    const averageTimeToResolution = resolutionTimes.length > 0 ?
      resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;

    // Generate trends
    const trends = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const dayIncidents = allIncidents.filter(incident => 
        incident.createdAt >= dayStart && incident.createdAt <= dayEnd
      );

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        total: dayIncidents.length,
        critical: dayIncidents.filter(i => i.severity === 'critical').length,
        high: dayIncidents.filter(i => i.severity === 'high').length,
      });
    }

    return {
      total: allIncidents.length,
      byStatus,
      bySeverity,
      byCategory,
      averageTimeToContainment,
      averageTimeToResolution,
      trendsLast30Days: trends,
    };
  }

  // Private helper methods

  private setupDefaultPlaybooks(): void {
    // Data breach playbook
    this.playbooks.set('data_breach', {
      id: 'data_breach',
      name: 'Data Breach Response',
      description: 'Response procedures for data breach incidents',
      triggers: ['data_breach_attempt', 'unauthorized_access'],
      severity: 'critical',
      category: 'data_breach',
      steps: [
        {
          id: 'assess_scope',
          title: 'Assess breach scope and impact',
          description: 'Determine what data was accessed and how many users are affected',
          assignedRole: 'security_lead',
          estimatedDuration: 30,
          dependencies: [],
          automated: false,
          checklist: [
            'Identify affected systems',
            'Determine data types accessed',
            'Count affected users',
            'Assess business impact',
          ],
        },
        {
          id: 'contain_breach',
          title: 'Contain the breach',
          description: 'Stop ongoing data access and secure affected systems',
          assignedRole: 'security_engineer',
          estimatedDuration: 60,
          dependencies: ['assess_scope'],
          automated: true,
          script: 'containment_script.sh',
          checklist: [
            'Block malicious IP addresses',
            'Revoke compromised credentials',
            'Isolate affected systems',
            'Enable additional monitoring',
          ],
        },
        {
          id: 'notify_stakeholders',
          title: 'Notify internal stakeholders',
          description: 'Inform management and relevant teams',
          assignedRole: 'incident_commander',
          estimatedDuration: 15,
          dependencies: ['assess_scope'],
          automated: false,
          checklist: [
            'Notify CISO',
            'Inform legal team',
            'Update executive team',
            'Brief customer support',
          ],
        },
      ],
      escalationCriteria: [
        'More than 1000 users affected',
        'Sensitive data (PII, financial) accessed',
        'Breach not contained within 2 hours',
      ],
      communicationPlan: [
        'Internal notification within 1 hour',
        'Customer notification within 24 hours',
        'Regulatory notification within 72 hours',
      ],
      roles: ['security_lead', 'security_engineer', 'incident_commander', 'legal_counsel'],
    });

    // DDoS attack playbook
    this.playbooks.set('ddos_attack', {
      id: 'ddos_attack',
      name: 'DDoS Attack Response',
      description: 'Response procedures for DDoS attacks',
      triggers: ['rate_limit_exceeded', 'suspicious_activity'],
      severity: 'high',
      category: 'ddos',
      steps: [
        {
          id: 'enable_ddos_protection',
          title: 'Enable DDoS protection',
          description: 'Activate DDoS mitigation services',
          assignedRole: 'network_engineer',
          estimatedDuration: 15,
          dependencies: [],
          automated: true,
          script: 'ddos_protection.sh',
          checklist: [
            'Enable WAF protection',
            'Activate rate limiting',
            'Configure traffic filtering',
          ],
        },
      ],
      escalationCriteria: [
        'Attack exceeds 1 Gbps',
        'Service availability below 95%',
        'Attack duration exceeds 1 hour',
      ],
      communicationPlan: [
        'Internal notification immediately',
        'Customer notification if service impacted',
      ],
      roles: ['network_engineer', 'devops_lead'],
    });
  }

  private setupNotificationTemplates(): void {
    this.templates.set('incident_created', {
      subject: 'Security Incident Created: {{title}}',
      body: `
A new security incident has been created:

Incident ID: {{id}}
Title: {{title}}
Severity: {{severity}}
Category: {{category}}
Reporter: {{reporter}}
Description: {{description}}

Please review and take appropriate action.
`,
    });

    this.templates.set('incident_escalated', {
      subject: 'URGENT: Security Incident Escalated - {{title}}',
      body: `
A security incident has been escalated:

Incident ID: {{id}}
Title: {{title}}
Severity: {{severity}}
Time Since Creation: {{timeElapsed}}

Immediate attention required.
`,
    });
  }

  private calculatePriority(severity: SecurityIncident['severity'], category: SecurityIncident['category']): SecurityIncident['priority'] {
    if (severity === 'critical') return 1;
    if (severity === 'high') return category === 'data_breach' ? 1 : 2;
    if (severity === 'medium') return 3;
    if (severity === 'low') return 4;
    return 5;
  }

  private getAutoAssignee(severity: SecurityIncident['severity'], category: SecurityIncident['category']): string {
    // In a real implementation, this would lookup actual team members
    if (severity === 'critical') return 'security_team_lead';
    if (category === 'data_breach') return 'privacy_officer';
    return 'security_analyst';
  }

  private findMatchingPlaybook(incident: SecurityIncident): IncidentPlaybook | null {
    for (const playbook of this.playbooks.values()) {
      if (playbook.category === incident.category && 
          playbook.severity === incident.severity) {
        return playbook;
      }
    }
    return null;
  }

  private getAssigneeForRole(role: string): string {
    // In a real implementation, this would lookup actual team members by role
    const roleAssignees: Record<string, string> = {
      'security_lead': 'security_team_lead',
      'security_engineer': 'security_engineer_1',
      'incident_commander': 'security_team_lead',
      'network_engineer': 'network_team_lead',
      'devops_lead': 'devops_team_lead',
    };
    return roleAssignees[role] || 'security_analyst';
  }

  private executeAutomatedStep(incidentId: string, step: PlaybookStep): void {
    console.log(`Executing automated step: ${step.title} for incident ${incidentId}`);
    
    this.addTimelineEntry(incidentId, {
      type: 'other',
      description: `Automated step executed: ${step.title}`,
      user: 'system',
      automated: true,
    });

    // In a real implementation, this would execute the actual script
    // For now, we just log it
  }

  private sendIncidentNotification(incident: SecurityIncident, type: 'created' | 'status_update' | 'escalated'): void {
    const channels = this.escalationRules.notificationChannels[incident.severity];
    
    console.log(`Sending ${type} notification for incident ${incident.id} via: ${channels.join(', ')}`);
    
    // In a real implementation, this would send actual notifications
    this.addCommunicationEntry(incident.id, {
      type: 'internal',
      channel: 'email',
      recipient: 'security_team',
      subject: `Security Incident ${type}: ${incident.title}`,
      message: `Incident ${incident.id} - ${incident.title}`,
      sentBy: 'system',
    });
  }

  private sendActionAssignmentNotification(incident: SecurityIncident, action: IncidentAction): void {
    if (!action.assignedTo) return;

    console.log(`Sending action assignment notification for incident ${incident.id} to ${action.assignedTo}`);
    
    this.addCommunicationEntry(incident.id, {
      type: 'internal',
      channel: 'email',
      recipient: action.assignedTo,
      subject: `Action Assigned: ${action.description}`,
      message: `You have been assigned an action for incident ${incident.id}: ${action.description}`,
      sentBy: 'system',
    });
  }

  private generateRecommendations(incident: SecurityIncident, metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.timeToContainment > 60) {
      recommendations.push('Consider implementing automated containment procedures to reduce response time');
    }

    if (incident.category === 'data_breach' && !incident.rootCause) {
      recommendations.push('Conduct thorough forensic analysis to determine root cause');
    }

    if (incident.affectedUsers.length > 100) {
      recommendations.push('Implement additional user notification procedures for large-scale incidents');
    }

    if (metrics.completedActions / metrics.totalActions < 0.8) {
      recommendations.push('Ensure all action items are completed before closing incident');
    }

    return recommendations;
  }

  private startBackgroundProcessing(): void {
    // Check for escalation every 5 minutes
    setInterval(() => {
      this.checkEscalationCriteria();
    }, 5 * 60 * 1000);

    // Send status updates every hour
    setInterval(() => {
      this.sendPeriodicUpdates();
    }, 60 * 60 * 1000);
  }

  private checkEscalationCriteria(): void {
    const now = new Date();
    
    for (const incident of this.incidents.values()) {
      if (incident.status === 'closed' || incident.status === 'resolved') continue;

      const minutesSinceCreation = (now.getTime() - incident.createdAt.getTime()) / (1000 * 60);
      const escalationThreshold = this.escalationRules.autoEscalateAfterMinutes[incident.severity];

      if (minutesSinceCreation > escalationThreshold) {
        this.escalateIncident(incident.id);
      }
    }
  }

  private escalateIncident(incidentId: string): void {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    // Escalate severity if not already critical
    if (incident.severity !== 'critical') {
      const oldSeverity = incident.severity;
      incident.severity = incident.severity === 'high' ? 'critical' : 'high';
      incident.priority = this.calculatePriority(incident.severity, incident.category);
      incident.updatedAt = new Date();

      this.addTimelineEntry(incidentId, {
        type: 'escalation',
        description: `Incident escalated from ${oldSeverity} to ${incident.severity} due to time elapsed`,
        user: 'system',
        automated: true,
      });

      this.sendIncidentNotification(incident, 'escalated');
      this.incidents.set(incidentId, incident);
    }
  }

  private sendPeriodicUpdates(): void {
    const openIncidents = this.getIncidents({ status: 'open' });
    const investigatingIncidents = this.getIncidents({ status: 'investigating' });

    if (openIncidents.length > 0 || investigatingIncidents.length > 0) {
      console.log(`Periodic update: ${openIncidents.length} open, ${investigatingIncidents.length} investigating incidents`);
      // In a real implementation, send summary to stakeholders
    }
  }

  /**
   * Enhanced automation and escalation methods
   */

  /**
   * Execute automation rules based on trigger
   */
  private async executeAutomationRules(triggerType: string, incident: SecurityIncident): Promise<void> {
    const applicableRules = Array.from(this.automationRules.values())
      .filter(rule => 
        rule.enabled && 
        rule.triggers.some(trigger => trigger.type === triggerType) &&
        this.isRuleCooldownExpired(rule)
      )
      .sort((a, b) => b.priority - a.priority);

    for (const rule of applicableRules) {
      try {
        const shouldExecute = await this.evaluateAutomationConditions(rule, incident);
        
        if (shouldExecute) {
          await this.executeAutomationActions(rule, incident);
          
          // Update rule execution statistics
          rule.lastExecuted = new Date();
          rule.executionCount++;
          this.automationRules.set(rule.id, rule);
          
          console.log(`Executed automation rule: ${rule.name} for incident ${incident.id}`);
        }
      } catch (error) {
        console.error(`Failed to execute automation rule ${rule.name}:`, error);
        
        // Update success rate
        rule.successRate = Math.max(rule.successRate - 0.1, 0);
        this.automationRules.set(rule.id, rule);
      }
    }
  }

  /**
   * Add automation rule
   */
  public addAutomationRule(rule: Omit<AutomationRule, 'id' | 'executionCount' | 'successRate'>): string {
    const ruleId = this.generateAutomationRuleId();
    
    const newRule: AutomationRule = {
      id: ruleId,
      executionCount: 0,
      successRate: 1.0,
      ...rule,
    };

    this.automationRules.set(ruleId, newRule);
    
    console.log(`Added automation rule: ${rule.name}`);
    
    return ruleId;
  }

  /**
   * Advanced escalation with matrix-based rules
   */
  public async escalateIncidentAdvanced(incidentId: string, reason: string): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const matrix = this.findApplicableEscalationMatrix(incident);
    if (!matrix) {
      console.warn(`No escalation matrix found for incident ${incidentId}`);
      return false;
    }

    const applicableRules = matrix.rules.filter(rule => 
      this.isEscalationRuleApplicable(rule, incident)
    );

    if (applicableRules.length === 0) {
      console.warn(`No applicable escalation rules for incident ${incidentId}`);
      return false;
    }

    // Sort by time threshold (most urgent first)
    applicableRules.sort((a, b) => a.timeThreshold - b.timeThreshold);
    
    for (const rule of applicableRules) {
      await this.executeEscalationRule(rule, incident, reason);
    }

    return true;
  }

  /**
   * Get enhanced incident metrics
   */
  public getAdvancedIncidentMetrics(): IncidentMetrics {
    const allIncidents = Array.from(this.incidents.values());
    const resolvedIncidents = allIncidents.filter(i => i.resolvedAt);
    
    // Calculate MTTR (Mean Time To Resolve)
    const resolutionTimes = resolvedIncidents.map(i => 
      i.resolvedAt!.getTime() - i.createdAt.getTime()
    );
    const mttr = resolutionTimes.length > 0 ? 
      resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length / 60000 : 0; // minutes

    // Calculate MTTA (Mean Time To Acknowledge)
    const acknowledgeTimes = allIncidents
      .filter(i => i.assignedTo)
      .map(i => {
        const assignmentTime = i.timeline.find(t => t.type === 'escalation')?.timestamp || i.createdAt;
        return assignmentTime.getTime() - i.createdAt.getTime();
      });
    const mtta = acknowledgeTimes.length > 0 ?
      acknowledgeTimes.reduce((a, b) => a + b, 0) / acknowledgeTimes.length / 60000 : 0; // minutes

    // Calculate MTTC (Mean Time To Contain)
    const containmentTimes = allIncidents
      .filter(i => i.containedAt)
      .map(i => i.containedAt!.getTime() - i.createdAt.getTime());
    const mttc = containmentTimes.length > 0 ?
      containmentTimes.reduce((a, b) => a + b, 0) / containmentTimes.length / 60000 : 0; // minutes

    // Count by category and severity
    const incidentsByCategory: Record<string, number> = {};
    const incidentsBySeverity: Record<string, number> = {};
    
    for (const incident of allIncidents) {
      incidentsByCategory[incident.category] = (incidentsByCategory[incident.category] || 0) + 1;
      incidentsBySeverity[incident.severity] = (incidentsBySeverity[incident.severity] || 0) + 1;
    }

    // Calculate escalation rate
    const escalatedIncidents = allIncidents.filter(i => 
      i.timeline.some(t => t.type === 'escalation')
    );
    const escalationRate = allIncidents.length > 0 ? 
      escalatedIncidents.length / allIncidents.length : 0;

    // Calculate automation rate
    const automatedActions = allIncidents.reduce((total, incident) => 
      total + incident.timeline.filter(t => t.automated).length, 0
    );
    const totalActions = allIncidents.reduce((total, incident) => 
      total + incident.timeline.length, 0
    );
    const automationRate = totalActions > 0 ? automatedActions / totalActions : 0;

    return {
      mttr,
      mtta,
      mttc,
      totalIncidents: allIncidents.length,
      incidentsByCategory,
      incidentsBySeverity,
      escalationRate,
      automationRate,
      customerImpact: this.calculateCustomerImpact(allIncidents),
      costOfIncidents: this.calculateIncidentCosts(allIncidents),
    };
  }

  // Private automation helper methods

  private setupAutomationRules(): void {
    // Critical incident auto-escalation
    this.addAutomationRule({
      name: 'Critical Incident Auto-Escalation',
      description: 'Automatically escalate critical incidents to senior staff',
      enabled: true,
      triggers: [
        {
          type: 'incident_created',
          criteria: { severity: 'critical' },
          weight: 1.0,
        },
      ],
      conditions: [
        {
          field: 'severity',
          operator: 'equals',
          value: 'critical',
          required: true,
        },
      ],
      actions: [
        {
          type: 'escalate',
          parameters: { escalationLevel: 'senior_management' },
          timeout: 300,
          retryCount: 3,
        },
        {
          type: 'notify',
          parameters: { 
            channels: ['sms', 'phone', 'email'],
            urgency: 'critical',
          },
          timeout: 60,
          retryCount: 2,
        },
      ],
      priority: 10,
      cooldownPeriod: 5,
    });

    console.log(`Initialized ${this.automationRules.size} automation rules`);
  }

  private setupEscalationMatrix(): void {
    this.escalationMatrix.set('default', {
      id: 'default',
      name: 'Default Escalation Matrix',
      rules: [
        {
          id: 'critical_immediate',
          condition: 'severity >= critical',
          severity: 'critical',
          timeThreshold: 0,
          escalateTo: ['security_lead', 'ciso', 'ceo'],
          notificationChannels: ['sms', 'phone', 'email'],
          requiresApproval: false,
          autoApprove: true,
        },
        {
          id: 'high_15min',
          condition: 'severity >= high',
          severity: 'high',
          timeThreshold: 15,
          escalateTo: ['security_lead', 'manager'],
          notificationChannels: ['email', 'slack'],
          requiresApproval: false,
          autoApprove: true,
        },
      ],
      defaultEscalationPath: ['analyst', 'senior_analyst', 'team_lead', 'manager', 'director'],
      emergencyContacts: ['security_hotline', 'emergency_response'],
      businessHoursOnly: false,
      regions: ['global'],
    });
  }

  private initializeIntegrations(): void {
    console.log('Initializing external integrations...');
  }

  private isRuleCooldownExpired(rule: AutomationRule): boolean {
    if (!rule.lastExecuted) return true;
    
    const cooldownMs = rule.cooldownPeriod * 60 * 1000;
    return Date.now() - rule.lastExecuted.getTime() > cooldownMs;
  }

  private async evaluateAutomationConditions(rule: AutomationRule, incident: SecurityIncident): Promise<boolean> {
    for (const condition of rule.conditions) {
      const fieldValue = this.getIncidentFieldValue(condition.field, incident);
      const conditionMet = this.evaluateCondition(condition, fieldValue);
      
      if (condition.required && !conditionMet) {
        return false;
      }
    }
    
    return true;
  }

  private async executeAutomationActions(rule: AutomationRule, incident: SecurityIncident): Promise<void> {
    for (const action of rule.actions) {
      try {
        await this.executeAutomationAction(action, incident);
      } catch (error) {
        console.error(`Failed to execute automation action ${action.type}:`, error);
      }
    }
  }

  private async executeAutomationAction(action: AutomationAction, incident: SecurityIncident): Promise<void> {
    switch (action.type) {
      case 'escalate':
        await this.escalateIncidentAdvanced(incident.id, 'Automated escalation');
        break;
        
      case 'assign':
        incident.assignedTo = action.parameters.assignee;
        this.incidents.set(incident.id, incident);
        break;
        
      case 'notify':
        await this.sendAutomatedNotification(action.parameters, incident);
        break;
    }
  }

  private findApplicableEscalationMatrix(incident: SecurityIncident): EscalationMatrix | null {
    return this.escalationMatrix.get('default') || null;
  }

  private isEscalationRuleApplicable(rule: EscalationRule, incident: SecurityIncident): boolean {
    if (rule.severity !== incident.severity) return false;
    
    const minutesSinceCreation = (Date.now() - incident.createdAt.getTime()) / (1000 * 60);
    if (minutesSinceCreation < rule.timeThreshold) return false;
    
    return true;
  }

  private async executeEscalationRule(rule: EscalationRule, incident: SecurityIncident, reason: string): Promise<void> {
    if (rule.escalateTo.length > 0) {
      incident.assignedTo = rule.escalateTo[0];
    }
    
    this.addTimelineEntry(incident.id, {
      type: 'escalation',
      description: `Escalated via rule ${rule.id}: ${reason}`,
      user: 'system',
      automated: true,
    });
    
    console.log(`Executed escalation rule ${rule.id} for incident ${incident.id}`);
  }

  private getIncidentFieldValue(field: string, incident: SecurityIncident): any {
    const fieldMap: Record<string, any> = {
      'severity': incident.severity,
      'category': incident.category,
      'status': incident.status,
      'priority': incident.priority,
      'assignedTo': incident.assignedTo,
      'tags': incident.tags,
    };
    
    return fieldMap[field];
  }

  private evaluateCondition(condition: AutomationCondition, fieldValue: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
      default:
        return false;
    }
  }

  private calculateCustomerImpact(incidents: SecurityIncident[]): number {
    const impactfulIncidents = incidents.filter(i => 
      i.category === 'data_breach' || 
      i.category === 'ddos' ||
      i.severity === 'critical'
    );
    
    return impactfulIncidents.length;
  }

  private calculateIncidentCosts(incidents: SecurityIncident[]): number {
    const costMap = {
      'critical': 100000,
      'high': 50000,
      'medium': 10000,
      'low': 1000,
    };
    
    return incidents.reduce((total, incident) => {
      return total + costMap[incident.severity];
    }, 0);
  }

  private async sendAutomatedNotification(parameters: any, incident: SecurityIncident): Promise<void> {
    console.log(`Sending automated notification for incident ${incident.id}`);
  }

  private mapSeverityToEventSeverity(severity: SecurityIncident['severity']): SecurityEventSeverity {
    const mapping = {
      'critical': SecurityEventSeverity.CRITICAL,
      'high': SecurityEventSeverity.HIGH,
      'medium': SecurityEventSeverity.MEDIUM,
      'low': SecurityEventSeverity.LOW,
    };
    
    return mapping[severity];
  }

  // Helper ID generation methods
  private generateIncidentId(): string {
    return `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTimelineId(): string {
    return `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCommunicationId(): string {
    return `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAutomationRuleId(): string {
    return `auto_rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const incidentResponseService = new IncidentResponseService();