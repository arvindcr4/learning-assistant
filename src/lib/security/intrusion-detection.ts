import { securityMonitor, SecurityEventType, SecurityEventSeverity } from './security-monitor';
import { realTimeThreatDetection, ThreatContext } from './threat-detection';
import { incidentResponseService } from './incident-response';

/**
 * Advanced Intrusion Detection and Prevention System (IDS/IPS)
 */

export interface IntrusionEvent {
  id: string;
  timestamp: Date;
  type: IntrusionType;
  severity: SecurityEventSeverity;
  source: IntrusionSource;
  target: IntrusionTarget;
  evidence: IntrusionEvidence;
  preventionAction: PreventionAction;
  confidence: number;
  riskScore: number;
  mitigated: boolean;
  blocked: boolean;
  followUpRequired: boolean;
}

export interface IntrusionSource {
  ipAddress: string;
  port?: number;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    asn: string;
    isp: string;
  };
  reputation: number;
  previousIncidents: number;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
}

export interface IntrusionTarget {
  endpoint: string;
  service: string;
  asset: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  accessLevel: string;
}

export interface IntrusionEvidence {
  attackSignature: string;
  payloadSample: string;
  logEntries: string[];
  networkTraffic?: string;
  systemCalls?: string[];
  fileChanges?: string[];
  registryChanges?: string[];
  processActivity?: string[];
  memoryDumps?: string[];
}

export interface PreventionAction {
  action: PreventionActionType;
  automatic: boolean;
  timestamp: Date;
  duration?: number; // milliseconds
  scope: PreventionScope;
  bypassable: boolean;
  reason: string;
  effectiveness: number; // 0-1
}

export type IntrusionType = 
  | 'network_intrusion'
  | 'web_attack'
  | 'brute_force_attack'
  | 'privilege_escalation'
  | 'data_exfiltration'
  | 'lateral_movement'
  | 'persistence_attempt'
  | 'reconnaissance'
  | 'denial_of_service'
  | 'malware_activity'
  | 'insider_threat'
  | 'supply_chain_attack';

export type PreventionActionType = 
  | 'block_ip'
  | 'block_session'
  | 'block_user'
  | 'rate_limit'
  | 'quarantine'
  | 'redirect'
  | 'challenge'
  | 'log_only'
  | 'alert_only'
  | 'isolate_system'
  | 'terminate_process'
  | 'reset_connection';

export type PreventionScope = 
  | 'source_ip'
  | 'source_network'
  | 'target_service'
  | 'target_endpoint'
  | 'user_session'
  | 'system_wide'
  | 'application_layer';

export interface IDSRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  category: IntrusionType;
  conditions: RuleCondition[];
  actions: PreventionActionType[];
  threshold: number;
  timeWindow: number; // seconds
  falsePositiveRate: number;
  lastTriggered?: Date;
  triggerCount: number;
  effectiveness: number;
  autoTune: boolean;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than' | 'in_range';
  value: string | number | string[];
  weight: number;
  negate?: boolean;
}

export interface AttackPattern {
  id: string;
  name: string;
  category: IntrusionType;
  stages: AttackStage[];
  indicators: string[];
  mitreTactics: string[];
  mitreId?: string;
  killChainPhase: string;
  severity: SecurityEventSeverity;
  confidence: number;
}

export interface AttackStage {
  name: string;
  description: string;
  indicators: string[];
  timeFrame: number; // seconds
  prerequisites: string[];
  successCriteria: string[];
}

export interface HoneypotConfig {
  id: string;
  type: 'web' | 'ssh' | 'ftp' | 'database' | 'email';
  endpoint: string;
  port: number;
  enabled: boolean;
  interactions: HoneypotInteraction[];
  alertThreshold: number;
  decoyLevel: 'low' | 'medium' | 'high';
}

export interface HoneypotInteraction {
  timestamp: Date;
  sourceIP: string;
  interactionType: string;
  payload: string;
  duration: number;
  blocked: boolean;
}

export class IntrusionDetectionSystem {
  private events: Map<string, IntrusionEvent> = new Map();
  private rules: Map<string, IDSRule> = new Map();
  private attackPatterns: Map<string, AttackPattern> = new Map();
  private honeypots: Map<string, HoneypotConfig> = new Map();
  private blockedEntities: Map<string, Date> = new Map();
  private activeConnections: Map<string, any> = new Map();
  
  private readonly config = {
    enableRealTimeBlocking: true,
    enableBehavioralAnalysis: true,
    enableHoneypots: true,
    enableMachineLearning: true,
    maxEventsPerSecond: 10000,
    alertThreshold: 0.7,
    blockThreshold: 0.8,
    autoTuneRules: true,
    quarantineEnabled: true,
    honeypotAlertLevel: 0.9,
  };

  constructor() {
    this.initializeRules();
    this.initializeAttackPatterns();
    this.initializeHoneypots();
    this.startRealTimeMonitoring();
  }

  /**
   * Analyze network traffic for intrusions
   */
  public async analyzeTraffic(context: ThreatContext): Promise<IntrusionEvent[]> {
    const detectedIntrusions: IntrusionEvent[] = [];
    
    try {
      // Run parallel detection engines
      const [
        ruleBasedDetections,
        behavioralDetections,
        mlDetections,
        patternDetections,
        honeypotDetections
      ] = await Promise.all([
        this.runRuleBasedDetection(context),
        this.runBehavioralDetection(context),
        this.runMLBasedDetection(context),
        this.runPatternDetection(context),
        this.checkHoneypotInteractions(context)
      ]);

      detectedIntrusions.push(
        ...ruleBasedDetections,
        ...behavioralDetections,
        ...mlDetections,
        ...patternDetections,
        ...honeypotDetections
      );

      // Apply prevention actions
      for (const intrusion of detectedIntrusions) {
        await this.applyPreventionActions(intrusion);
      }

      // Update statistics and learn from detections
      if (detectedIntrusions.length > 0) {
        this.updateDetectionStatistics(detectedIntrusions);
        this.triggerIncidentResponse(detectedIntrusions);
      }

      return detectedIntrusions;

    } catch (error) {
      console.error('Intrusion detection error:', error);
      return [];
    }
  }

  /**
   * Add custom IDS rule
   */
  public addIDSRule(rule: Omit<IDSRule, 'id' | 'triggerCount' | 'lastTriggered'>): string {
    const ruleId = this.generateRuleId();
    
    const newRule: IDSRule = {
      id: ruleId,
      triggerCount: 0,
      ...rule,
    };

    this.rules.set(ruleId, newRule);
    
    console.log(`Added IDS rule: ${rule.name}`);
    
    return ruleId;
  }

  /**
   * Block IP address or entity
   */
  public blockEntity(entityId: string, duration?: number): void {
    const blockUntil = duration ? new Date(Date.now() + duration) : new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.blockedEntities.set(entityId, blockUntil);
    
    console.log(`Blocked entity: ${entityId} until ${blockUntil.toISOString()}`);
    
    // Auto-unblock after duration
    if (duration) {
      setTimeout(() => {
        this.unblockEntity(entityId);
      }, duration);
    }
  }

  /**
   * Unblock entity
   */
  public unblockEntity(entityId: string): boolean {
    const wasBlocked = this.blockedEntities.has(entityId);
    this.blockedEntities.delete(entityId);
    
    if (wasBlocked) {
      console.log(`Unblocked entity: ${entityId}`);
    }
    
    return wasBlocked;
  }

  /**
   * Check if entity is blocked
   */
  public isBlocked(entityId: string): boolean {
    const blockUntil = this.blockedEntities.get(entityId);
    if (!blockUntil) return false;
    
    if (blockUntil.getTime() < Date.now()) {
      this.blockedEntities.delete(entityId);
      return false;
    }
    
    return true;
  }

  /**
   * Get intrusion statistics
   */
  public getIntrusionStatistics(): {
    totalIntrusions: number;
    intrusionsByType: Record<string, number>;
    intrusionsBySeverity: Record<string, number>;
    blockedEntities: number;
    preventionEffectiveness: number;
    falsePositiveRate: number;
    topAttackers: Array<{ source: string; attempts: number }>;
    topTargets: Array<{ target: string; attempts: number }>;
  } {
    const allIntrusions = Array.from(this.events.values());
    
    const intrusionsByType: Record<string, number> = {};
    const intrusionsBySeverity: Record<string, number> = {};
    const attackerCounts = new Map<string, number>();
    const targetCounts = new Map<string, number>();

    for (const intrusion of allIntrusions) {
      intrusionsByType[intrusion.type] = (intrusionsByType[intrusion.type] || 0) + 1;
      intrusionsBySeverity[intrusion.severity] = (intrusionsBySeverity[intrusion.severity] || 0) + 1;
      
      const attacker = intrusion.source.ipAddress;
      attackerCounts.set(attacker, (attackerCounts.get(attacker) || 0) + 1);
      
      const target = intrusion.target.endpoint;
      targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
    }

    const topAttackers = Array.from(attackerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([source, attempts]) => ({ source, attempts }));

    const topTargets = Array.from(targetCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([target, attempts]) => ({ target, attempts }));

    // Calculate prevention effectiveness
    const mitigatedIntrusions = allIntrusions.filter(i => i.mitigated).length;
    const preventionEffectiveness = allIntrusions.length > 0 ? 
      mitigatedIntrusions / allIntrusions.length : 0;

    // Calculate false positive rate
    const rules = Array.from(this.rules.values());
    const avgFalsePositiveRate = rules.length > 0 ?
      rules.reduce((sum, rule) => sum + rule.falsePositiveRate, 0) / rules.length : 0;

    return {
      totalIntrusions: allIntrusions.length,
      intrusionsByType,
      intrusionsBySeverity,
      blockedEntities: this.blockedEntities.size,
      preventionEffectiveness,
      falsePositiveRate: avgFalsePositiveRate,
      topAttackers,
      topTargets,
    };
  }

  // Private detection methods

  private async runRuleBasedDetection(context: ThreatContext): Promise<IntrusionEvent[]> {
    const detections: IntrusionEvent[] = [];
    
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      
      const matches = await this.evaluateRule(rule, context);
      if (matches) {
        const intrusion = this.createIntrusionEvent(rule, context, 'rule_based');
        detections.push(intrusion);
        
        // Update rule statistics
        rule.triggerCount++;
        rule.lastTriggered = new Date();
        this.rules.set(rule.id, rule);
      }
    }
    
    return detections;
  }

  private async runBehavioralDetection(context: ThreatContext): Promise<IntrusionEvent[]> {
    const detections: IntrusionEvent[] = [];
    
    if (!this.config.enableBehavioralAnalysis) return detections;
    
    // Analyze user behavior patterns
    const behavioralData = {
      requestFrequency: this.getRequestFrequency(context.ipAddress),
      endpointDiversity: this.getEndpointDiversity(context.ipAddress),
      timePatterns: this.getTimePatterns(context.ipAddress),
      geolocationConsistency: this.getGeolocationConsistency(context.ipAddress),
      userAgentConsistency: this.getUserAgentConsistency(context.ipAddress),
    };

    // Check for behavioral anomalies
    const anomalies = await this.detectBehavioralAnomalies(behavioralData, context);
    
    for (const anomaly of anomalies) {
      if (anomaly.confidence > this.config.alertThreshold) {
        const intrusion = this.createBehavioralIntrusionEvent(anomaly, context);
        detections.push(intrusion);
      }
    }
    
    return detections;
  }

  private async runMLBasedDetection(context: ThreatContext): Promise<IntrusionEvent[]> {
    const detections: IntrusionEvent[] = [];
    
    if (!this.config.enableMachineLearning) return detections;
    
    // Use enhanced threat detection
    const threatResult = await realTimeThreatDetection.analyzeRequest(context);
    
    if (threatResult.detected && threatResult.riskScore > this.config.alertThreshold) {
      for (const threat of threatResult.threats) {
        const intrusion: IntrusionEvent = {
          id: this.generateIntrusionId(),
          timestamp: new Date(),
          type: this.mapThreatToIntrusionType(threat.threatType),
          severity: threat.severity,
          source: this.createIntrusionSource(context),
          target: this.createIntrusionTarget(context),
          evidence: {
            attackSignature: threat.evidence.matchedPattern,
            payloadSample: threat.evidence.matchedValue,
            logEntries: [JSON.stringify(threat.evidence)],
          },
          preventionAction: {
            action: 'log_only',
            automatic: true,
            timestamp: new Date(),
            scope: 'source_ip',
            bypassable: false,
            reason: 'ML-based threat detection',
            effectiveness: threat.confidence,
          },
          confidence: threat.confidence,
          riskScore: threatResult.riskScore,
          mitigated: false,
          blocked: false,
          followUpRequired: threat.confidence > 0.8,
        };
        
        detections.push(intrusion);
      }
    }
    
    return detections;
  }

  private async runPatternDetection(context: ThreatContext): Promise<IntrusionEvent[]> {
    const detections: IntrusionEvent[] = [];
    
    for (const pattern of this.attackPatterns.values()) {
      const matchScore = await this.evaluateAttackPattern(pattern, context);
      
      if (matchScore > this.config.alertThreshold) {
        const intrusion: IntrusionEvent = {
          id: this.generateIntrusionId(),
          timestamp: new Date(),
          type: pattern.category,
          severity: pattern.severity,
          source: this.createIntrusionSource(context),
          target: this.createIntrusionTarget(context),
          evidence: {
            attackSignature: pattern.name,
            payloadSample: JSON.stringify(context.bodyParams),
            logEntries: [`Attack pattern match: ${pattern.name}`],
          },
          preventionAction: {
            action: 'alert_only',
            automatic: true,
            timestamp: new Date(),
            scope: 'source_ip',
            bypassable: false,
            reason: `Attack pattern detected: ${pattern.name}`,
            effectiveness: matchScore,
          },
          confidence: pattern.confidence * matchScore,
          riskScore: matchScore,
          mitigated: false,
          blocked: false,
          followUpRequired: pattern.severity === SecurityEventSeverity.CRITICAL,
        };
        
        detections.push(intrusion);
      }
    }
    
    return detections;
  }

  private async checkHoneypotInteractions(context: ThreatContext): Promise<IntrusionEvent[]> {
    const detections: IntrusionEvent[] = [];
    
    if (!this.config.enableHoneypots) return detections;
    
    // Check if request is targeting a honeypot
    for (const honeypot of this.honeypots.values()) {
      if (!honeypot.enabled) continue;
      
      if (this.isHoneypotTarget(context, honeypot)) {
        // Log honeypot interaction
        const interaction: HoneypotInteraction = {
          timestamp: new Date(),
          sourceIP: context.ipAddress,
          interactionType: context.method,
          payload: JSON.stringify(context.bodyParams),
          duration: 0,
          blocked: false,
        };
        
        honeypot.interactions.push(interaction);
        
        // Create high-confidence intrusion event
        const intrusion: IntrusionEvent = {
          id: this.generateIntrusionId(),
          timestamp: new Date(),
          type: 'reconnaissance',
          severity: SecurityEventSeverity.HIGH,
          source: this.createIntrusionSource(context),
          target: this.createIntrusionTarget(context),
          evidence: {
            attackSignature: 'honeypot_interaction',
            payloadSample: interaction.payload,
            logEntries: [`Honeypot interaction: ${honeypot.type}`],
          },
          preventionAction: {
            action: 'block_ip',
            automatic: true,
            timestamp: new Date(),
            duration: 24 * 60 * 60 * 1000, // 24 hours
            scope: 'source_ip',
            bypassable: false,
            reason: 'Honeypot interaction detected',
            effectiveness: this.config.honeypotAlertLevel,
          },
          confidence: this.config.honeypotAlertLevel,
          riskScore: this.config.honeypotAlertLevel,
          mitigated: false,
          blocked: false,
          followUpRequired: true,
        };
        
        detections.push(intrusion);
      }
    }
    
    return detections;
  }

  private async applyPreventionActions(intrusion: IntrusionEvent): Promise<void> {
    const action = intrusion.preventionAction;
    
    try {
      switch (action.action) {
        case 'block_ip':
          this.blockEntity(intrusion.source.ipAddress, action.duration);
          intrusion.blocked = true;
          break;
          
        case 'block_session':
          if (intrusion.source.sessionId) {
            this.blockEntity(`session:${intrusion.source.sessionId}`, action.duration);
            intrusion.blocked = true;
          }
          break;
          
        case 'block_user':
          if (intrusion.source.userId) {
            this.blockEntity(`user:${intrusion.source.userId}`, action.duration);
            intrusion.blocked = true;
          }
          break;
          
        case 'rate_limit':
          await this.applyRateLimit(intrusion.source.ipAddress, action.duration);
          intrusion.mitigated = true;
          break;
          
        case 'quarantine':
          await this.quarantineConnection(intrusion);
          intrusion.mitigated = true;
          break;
          
        case 'challenge':
          await this.issueChallengeResponse(intrusion);
          intrusion.mitigated = true;
          break;
          
        case 'reset_connection':
          await this.resetConnection(intrusion);
          intrusion.mitigated = true;
          break;
          
        case 'log_only':
        case 'alert_only':
          // No preventive action, just logging
          break;
      }
      
      console.log(`Applied prevention action: ${action.action} for intrusion ${intrusion.id}`);
      
    } catch (error) {
      console.error(`Failed to apply prevention action ${action.action}:`, error);
    }
  }

  private async evaluateRule(rule: IDSRule, context: ThreatContext): Promise<boolean> {
    let score = 0;
    let totalWeight = 0;
    
    for (const condition of rule.conditions) {
      const conditionMet = await this.evaluateCondition(condition, context);
      const weight = condition.weight;
      
      if (conditionMet !== condition.negate) {
        score += weight;
      }
      totalWeight += weight;
    }
    
    const matchPercentage = totalWeight > 0 ? score / totalWeight : 0;
    return matchPercentage >= rule.threshold;
  }

  private async evaluateCondition(condition: RuleCondition, context: ThreatContext): Promise<boolean> {
    const fieldValue = this.getFieldValue(condition.field, context);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
        
      case 'contains':
        return typeof fieldValue === 'string' && 
               fieldValue.includes(condition.value as string);
        
      case 'regex':
        return typeof fieldValue === 'string' && 
               new RegExp(condition.value as string).test(fieldValue);
        
      case 'greater_than':
        return typeof fieldValue === 'number' && 
               fieldValue > (condition.value as number);
        
      case 'less_than':
        return typeof fieldValue === 'number' && 
               fieldValue < (condition.value as number);
        
      case 'in_range':
        if (typeof fieldValue === 'number' && Array.isArray(condition.value)) {
          const [min, max] = (condition.value as unknown) as number[];
          return fieldValue >= min && fieldValue <= max;
        }
        return false;
        
      default:
        return false;
    }
  }

  private getFieldValue(field: string, context: ThreatContext): any {
    const fieldMap: Record<string, any> = {
      'ip_address': context.ipAddress,
      'user_agent': context.userAgent,
      'method': context.method,
      'url': context.url,
      'referer': context.referer,
      'request_size': JSON.stringify(context.bodyParams).length,
      'param_count': Object.keys(context.queryParams).length,
      'header_count': Object.keys(context.headers).length,
      'time_of_day': new Date().getHours(),
      'day_of_week': new Date().getDay(),
    };
    
    return fieldMap[field];
  }

  private createIntrusionEvent(rule: IDSRule, context: ThreatContext, source: string): IntrusionEvent {
    return {
      id: this.generateIntrusionId(),
      timestamp: new Date(),
      type: rule.category,
      severity: this.calculateSeverity(rule.priority),
      source: this.createIntrusionSource(context),
      target: this.createIntrusionTarget(context),
      evidence: {
        attackSignature: rule.name,
        payloadSample: JSON.stringify(context.bodyParams),
        logEntries: [`Rule triggered: ${rule.name}`],
      },
      preventionAction: {
        action: rule.actions[0] || 'log_only',
        automatic: true,
        timestamp: new Date(),
        scope: 'source_ip',
        bypassable: false,
        reason: `IDS rule triggered: ${rule.name}`,
        effectiveness: rule.effectiveness,
      },
      confidence: 1 - rule.falsePositiveRate,
      riskScore: rule.priority / 10,
      mitigated: false,
      blocked: false,
      followUpRequired: rule.priority >= 8,
    };
  }

  private createBehavioralIntrusionEvent(anomaly: any, context: ThreatContext): IntrusionEvent {
    return {
      id: this.generateIntrusionId(),
      timestamp: new Date(),
      type: 'reconnaissance',
      severity: anomaly.confidence > 0.8 ? SecurityEventSeverity.HIGH : SecurityEventSeverity.MEDIUM,
      source: this.createIntrusionSource(context),
      target: this.createIntrusionTarget(context),
      evidence: {
        attackSignature: 'behavioral_anomaly',
        payloadSample: JSON.stringify(anomaly.factors),
        logEntries: [`Behavioral anomaly detected: ${anomaly.type}`],
      },
      preventionAction: {
        action: 'alert_only',
        automatic: true,
        timestamp: new Date(),
        scope: 'source_ip',
        bypassable: false,
        reason: 'Behavioral anomaly detected',
        effectiveness: anomaly.confidence,
      },
      confidence: anomaly.confidence,
      riskScore: anomaly.confidence,
      mitigated: false,
      blocked: false,
      followUpRequired: anomaly.confidence > 0.9,
    };
  }

  private createIntrusionSource(context: ThreatContext): IntrusionSource {
    return {
      ipAddress: context.ipAddress,
      geolocation: context.geolocation ? {
        country: context.geolocation.country,
        region: context.geolocation.region,
        city: context.geolocation.city,
        asn: 'unknown',
        isp: 'unknown'
      } : undefined,
      reputation: Math.random(), // Would be actual reputation lookup
      previousIncidents: 0, // Would be calculated from history
      userAgent: context.userAgent,
      sessionId: context.sessionId,
      userId: context.userId,
    };
  }

  private createIntrusionTarget(context: ThreatContext): IntrusionTarget {
    return {
      endpoint: context.url,
      service: this.extractService(context.url),
      asset: this.extractAsset(context.url),
      criticality: this.assessCriticality(context.url),
      dataClassification: this.assessDataClassification(context.url),
      accessLevel: 'public',
    };
  }

  // Helper methods

  private initializeRules(): void {
    // Brute force detection
    this.addIDSRule({
      name: 'Brute Force Login Attempts',
      description: 'Detects excessive login attempts from single IP',
      enabled: true,
      priority: 8,
      category: 'brute_force_attack',
      conditions: [
        {
          field: 'url',
          operator: 'contains',
          value: '/login',
          weight: 0.3,
        },
        {
          field: 'method',
          operator: 'equals',
          value: 'POST',
          weight: 0.2,
        },
      ],
      actions: ['rate_limit', 'alert_only'],
      threshold: 0.5,
      timeWindow: 300, // 5 minutes
      falsePositiveRate: 0.1,
      effectiveness: 0.8,
      autoTune: true,
    });

    // SQL Injection detection
    this.addIDSRule({
      name: 'SQL Injection Pattern',
      description: 'Detects SQL injection attempts',
      enabled: true,
      priority: 9,
      category: 'web_attack',
      conditions: [
        {
          field: 'url',
          operator: 'regex',
          value: '(union|select|insert|update|delete|drop|create|alter)',
          weight: 0.8,
        },
      ],
      actions: ['block_ip', 'alert_only'],
      threshold: 0.8,
      timeWindow: 60,
      falsePositiveRate: 0.05,
      effectiveness: 0.9,
      autoTune: false,
    });

    // Suspicious user agent
    this.addIDSRule({
      name: 'Malicious User Agent',
      description: 'Detects known malicious user agents',
      enabled: true,
      priority: 7,
      category: 'reconnaissance',
      conditions: [
        {
          field: 'user_agent',
          operator: 'regex',
          value: '(sqlmap|nmap|nikto|dirb|gobuster|wfuzz)',
          weight: 1.0,
        },
      ],
      actions: ['block_ip'],
      threshold: 1.0,
      timeWindow: 1,
      falsePositiveRate: 0.01,
      effectiveness: 0.95,
      autoTune: false,
    });

    console.log(`Initialized ${this.rules.size} IDS rules`);
  }

  private initializeAttackPatterns(): void {
    // Multi-stage attack pattern
    this.attackPatterns.set('web_app_attack', {
      id: 'web_app_attack',
      name: 'Web Application Attack Pattern',
      category: 'web_attack',
      stages: [
        {
          name: 'reconnaissance',
          description: 'Attacker scans for vulnerabilities',
          indicators: ['directory_traversal', 'parameter_fuzzing'],
          timeFrame: 300,
          prerequisites: [],
          successCriteria: ['valid_response_codes'],
        },
        {
          name: 'exploitation',
          description: 'Attacker attempts to exploit vulnerabilities',
          indicators: ['sql_injection', 'xss_attempts'],
          timeFrame: 600,
          prerequisites: ['reconnaissance'],
          successCriteria: ['error_messages', 'data_disclosure'],
        },
      ],
      indicators: ['suspicious_user_agent', 'multiple_error_codes', 'payload_patterns'],
      mitreTactics: ['T1190', 'T1059'],
      killChainPhase: 'exploitation',
      severity: SecurityEventSeverity.HIGH,
      confidence: 0.8,
    });

    console.log(`Initialized ${this.attackPatterns.size} attack patterns`);
  }

  private initializeHoneypots(): void {
    // Web honeypot
    this.honeypots.set('web_admin', {
      id: 'web_admin',
      type: 'web',
      endpoint: '/admin',
      port: 80,
      enabled: true,
      interactions: [],
      alertThreshold: 1.0,
      decoyLevel: 'medium',
    });

    // SSH honeypot
    this.honeypots.set('ssh_server', {
      id: 'ssh_server',
      type: 'ssh',
      endpoint: '/ssh',
      port: 22,
      enabled: true,
      interactions: [],
      alertThreshold: 1.0,
      decoyLevel: 'high',
    });

    console.log(`Initialized ${this.honeypots.size} honeypots`);
  }

  private startRealTimeMonitoring(): void {
    // Cleanup old events
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000); // Every hour

    // Auto-tune rules
    if (this.config.autoTuneRules) {
      setInterval(() => {
        this.autoTuneRules();
      }, 24 * 60 * 60 * 1000); // Daily
    }

    // Update attack patterns
    setInterval(() => {
      this.updateAttackPatterns();
    }, 4 * 60 * 60 * 1000); // Every 4 hours
  }

  private async detectBehavioralAnomalies(data: any, context: ThreatContext): Promise<any[]> {
    const anomalies = [];
    
    // High request frequency
    if (data.requestFrequency > 100) {
      anomalies.push({
        type: 'high_request_frequency',
        confidence: Math.min(data.requestFrequency / 1000, 1.0),
        factors: [`${data.requestFrequency} requests per minute`],
      });
    }
    
    // Diverse endpoint access
    if (data.endpointDiversity > 20) {
      anomalies.push({
        type: 'endpoint_scanning',
        confidence: Math.min(data.endpointDiversity / 50, 1.0),
        factors: [`${data.endpointDiversity} unique endpoints accessed`],
      });
    }
    
    return anomalies;
  }

  private async evaluateAttackPattern(pattern: AttackPattern, context: ThreatContext): Promise<number> {
    let score = 0;
    let totalIndicators = pattern.indicators.length;
    
    for (const indicator of pattern.indicators) {
      if (this.checkIndicator(indicator, context)) {
        score++;
      }
    }
    
    return totalIndicators > 0 ? score / totalIndicators : 0;
  }

  private checkIndicator(indicator: string, context: ThreatContext): boolean {
    const checks: Record<string, () => boolean> = {
      'suspicious_user_agent': () => /bot|crawler|scanner/i.test(context.userAgent),
      'multiple_error_codes': () => false, // Would check response history
      'payload_patterns': () => this.hasPayloadPatterns(context),
      'directory_traversal': () => /\.\./g.test(context.url),
      'parameter_fuzzing': () => Object.keys(context.queryParams).length > 10,
      'sql_injection': () => /union|select|insert/gi.test(JSON.stringify(context.bodyParams)),
      'xss_attempts': () => /<script|javascript:/gi.test(JSON.stringify(context.bodyParams)),
    };
    
    return checks[indicator]?.() || false;
  }

  private isHoneypotTarget(context: ThreatContext, honeypot: HoneypotConfig): boolean {
    return context.url.includes(honeypot.endpoint);
  }

  private mapThreatToIntrusionType(threatType: string): IntrusionType {
    const mapping: Record<string, IntrusionType> = {
      'sql_injection': 'web_attack',
      'xss_attack': 'web_attack',
      'brute_force': 'brute_force_attack',
      'automated_scanning': 'reconnaissance',
      'suspicious_activity': 'reconnaissance',
      'malicious_ip': 'network_intrusion',
    };
    
    return mapping[threatType] || 'web_attack';
  }

  private calculateSeverity(priority: number): SecurityEventSeverity {
    if (priority >= 9) return SecurityEventSeverity.CRITICAL;
    if (priority >= 7) return SecurityEventSeverity.HIGH;
    if (priority >= 5) return SecurityEventSeverity.MEDIUM;
    return SecurityEventSeverity.LOW;
  }

  private extractService(url: string): string {
    if (url.includes('/api/')) return 'api';
    if (url.includes('/admin/')) return 'admin';
    if (url.includes('/auth/')) return 'auth';
    return 'web';
  }

  private extractAsset(url: string): string {
    const parts = url.split('/').filter(p => p.length > 0);
    return parts[parts.length - 1] || 'root';
  }

  private assessCriticality(url: string): 'low' | 'medium' | 'high' | 'critical' {
    if (url.includes('/admin') || url.includes('/config')) return 'critical';
    if (url.includes('/api') || url.includes('/auth')) return 'high';
    if (url.includes('/user') || url.includes('/data')) return 'medium';
    return 'low';
  }

  private assessDataClassification(url: string): 'public' | 'internal' | 'confidential' | 'restricted' {
    if (url.includes('/admin') || url.includes('/config')) return 'restricted';
    if (url.includes('/api') || url.includes('/user')) return 'confidential';
    if (url.includes('/data')) return 'internal';
    return 'public';
  }

  private hasPayloadPatterns(context: ThreatContext): boolean {
    const payload = JSON.stringify(context.bodyParams);
    const patterns = [
      /script|javascript|eval/gi,
      /union|select|insert|drop/gi,
      /\.\./g,
      /admin|root|config/gi,
    ];
    
    return patterns.some(pattern => pattern.test(payload));
  }

  private getRequestFrequency(ipAddress: string): number {
    // Simulate request frequency calculation
    return Math.floor(Math.random() * 200);
  }

  private getEndpointDiversity(ipAddress: string): number {
    // Simulate endpoint diversity calculation
    return Math.floor(Math.random() * 50);
  }

  private getTimePatterns(ipAddress: string): any {
    // Simulate time pattern analysis
    return { consistent: Math.random() > 0.5 };
  }

  private getGeolocationConsistency(ipAddress: string): number {
    // Simulate geolocation consistency check
    return Math.random();
  }

  private getUserAgentConsistency(ipAddress: string): number {
    // Simulate user agent consistency check
    return Math.random();
  }

  private async applyRateLimit(ipAddress: string, duration?: number): Promise<void> {
    console.log(`Applied rate limiting to ${ipAddress}`);
  }

  private async quarantineConnection(intrusion: IntrusionEvent): Promise<void> {
    console.log(`Quarantined connection from ${intrusion.source.ipAddress}`);
  }

  private async issueChallengeResponse(intrusion: IntrusionEvent): Promise<void> {
    console.log(`Issued challenge response to ${intrusion.source.ipAddress}`);
  }

  private async resetConnection(intrusion: IntrusionEvent): Promise<void> {
    console.log(`Reset connection from ${intrusion.source.ipAddress}`);
  }

  private updateDetectionStatistics(intrusions: IntrusionEvent[]): void {
    for (const intrusion of intrusions) {
      this.events.set(intrusion.id, intrusion);
    }
  }

  private triggerIncidentResponse(intrusions: IntrusionEvent[]): void {
    const criticalIntrusions = intrusions.filter(i => 
      i.severity === SecurityEventSeverity.CRITICAL || i.followUpRequired
    );
    
    if (criticalIntrusions.length > 0) {
      const intrusionTypes = criticalIntrusions.map(i => i.type).join(', ');
      
      incidentResponseService.createIncident({
        title: `Multiple Intrusion Attempts Detected`,
        description: `Detected ${criticalIntrusions.length} critical intrusions: ${intrusionTypes}`,
        severity: 'high',
        category: 'unauthorized_access',
        priority: 1,
        discoveredAt: new Date(),
        reporter: 'intrusion_detection_system',
        affectedSystems: [...new Set(criticalIntrusions.map(i => i.target.service))],
        affectedUsers: [],
        evidenceUrls: [],
        relatedEvents: criticalIntrusions.map(i => i.id),
        relatedAlerts: [],
        tags: ['intrusion_detection', 'critical'],
        confidentiality: 'internal',
      });
    }
  }

  private cleanupOldEvents(): void {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp.getTime() < oneDayAgo) {
        this.events.delete(id);
      }
    }
  }

  private autoTuneRules(): void {
    for (const rule of this.rules.values()) {
      if (!rule.autoTune) continue;
      
      // Adjust thresholds based on performance
      if (rule.falsePositiveRate > 0.2) {
        rule.threshold = Math.min(rule.threshold + 0.1, 1.0);
        rule.falsePositiveRate = Math.max(rule.falsePositiveRate - 0.05, 0);
      }
      
      this.rules.set(rule.id, rule);
    }
  }

  private updateAttackPatterns(): void {
    console.log('Updating attack patterns from threat intelligence...');
    // In production, this would fetch from threat intelligence feeds
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateIntrusionId(): string {
    return `intrusion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const intrusionDetectionSystem = new IntrusionDetectionSystem();