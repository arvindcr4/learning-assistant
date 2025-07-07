import { securityMonitoringService, SecurityEvent, SecurityAlert } from './security-monitoring';
import { encryptionService } from './encryption';

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

export class IncidentResponseService {
  private incidents: Map<string, SecurityIncident> = new Map();
  private playbooks: Map<string, IncidentPlaybook> = new Map();
  private templates: Map<string, any> = new Map();
  
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
    this.startBackgroundProcessing();
  }

  /**
   * Create a new security incident
   */
  createIncident(incident: Omit<SecurityIncident, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'timeline' | 'actions' | 'communicationLog'>): string {
    const incidentId = encryptionService.generateSecureUUID();
    
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

    // Log security event
    securityMonitoringService.logEvent({
      type: 'unauthorized_access',
      severity: incident.severity,
      source: 'incident_response',
      ipAddress: 'system',
      details: {
        incidentId,
        category: incident.category,
        title: incident.title,
      },
      threat: 'security_incident',
      action: 'flagged',
    });

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
      id: encryptionService.generateSecureUUID(),
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
      id: encryptionService.generateSecureUUID(),
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
      id: encryptionService.generateSecureUUID(),
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

    if (incident.affectedUsersCount > 100) {
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
}

// Export singleton instance
export const incidentResponseService = new IncidentResponseService();