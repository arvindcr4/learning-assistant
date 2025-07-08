import { NextRequest, NextResponse } from 'next/server';

import { mfaService } from './mfa-service';
import { sessionFingerprintingService } from './session-fingerprinting';
import { AdvancedRateLimiter, defaultRateLimitConfigs } from './advanced-rate-limiter';
import { CSPv3Service, defaultCSPConfigs } from './csp-v3';
import { fieldEncryption, PIIUtils } from './field-encryption';
import { vulnerabilityScanner } from './vulnerability-scanner';
import { securityHeaders } from './security-headers';

export interface SecurityConfig {
  mfa: {
    enabled: boolean;
    requireForSensitiveActions: boolean;
    backupCodesEnabled: boolean;
  };
  sessionSecurity: {
    fingerprintingEnabled: boolean;
    anomalyDetectionEnabled: boolean;
    maxSessionsPerUser: number;
  };
  rateLimiting: {
    enabled: boolean;
    config: 'strict' | 'moderate' | 'lenient';
    customLimits?: Record<string, any>;
  };
  contentSecurity: {
    cspEnabled: boolean;
    cspConfig: 'strict' | 'moderate' | 'development';
    nonceEnabled: boolean;
  };
  dataProtection: {
    encryptionEnabled: boolean;
    piiDetectionEnabled: boolean;
    maskingEnabled: boolean;
  };
  vulnerabilityScanning: {
    enabled: boolean;
    scanFrequency: 'daily' | 'weekly' | 'monthly';
    autoUpdate: boolean;
  };
  compliance: {
    gdprCompliant: boolean;
    hipaaCompliant: boolean;
    soc2Compliant: boolean;
  };
}

export interface SecurityMetrics {
  overallScore: number;
  categoryScores: {
    authentication: number;
    authorization: number;
    dataProtection: number;
    networkSecurity: number;
    vulnerability: number;
    compliance: number;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: Array<{
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    action: string;
  }>;
  lastAssessment: Date;
}

export interface SecurityIncident {
  id: string;
  type: 'authentication' | 'authorization' | 'data_breach' | 'vulnerability' | 'anomaly' | 'compliance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  affectedUsers?: string[];
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  resolvedAt?: Date;
  response: {
    immediate: string[];
    followUp: string[];
  };
  metadata: Record<string, any>;
}

export class SecurityOrchestrator {
  private config: SecurityConfig;
  private rateLimiter: AdvancedRateLimiter;
  private cspService: CSPv3Service;
  private incidents: SecurityIncident[] = [];
  private metrics: SecurityMetrics | null = null;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = this.mergeWithDefaults(config);
    this.initializeServices();
  }

  /**
   * Initialize security services based on configuration
   */
  private initializeServices(): void {
    // Initialize rate limiter
    if (this.config.rateLimiting.enabled) {
      const rateLimitConfig = defaultRateLimitConfigs[this.config.rateLimiting.config];
      this.rateLimiter = new AdvancedRateLimiter({
        ...rateLimitConfig,
        ...this.config.rateLimiting.customLimits,
      });
    }

    // Initialize CSP service
    if (this.config.contentSecurity.cspEnabled) {
      const cspConfig = defaultCSPConfigs[this.config.contentSecurity.cspConfig];
      this.cspService = new CSPv3Service({
        ...cspConfig,
        nonce: {
          ...cspConfig.nonce,
          enabled: this.config.contentSecurity.nonceEnabled,
        },
      });
    }
  }

  /**
   * Main security check for incoming requests
   */
  async processRequest(
    request: NextRequest,
    options: {
      userId?: string;
      userRole?: string;
      requireMFA?: boolean;
      sensitiveOperation?: boolean;
    } = {}
  ): Promise<{
    allowed: boolean;
    response?: NextResponse;
    securityContext: {
      fingerprint?: any;
      riskScore: number;
      anomalies: any[];
      recommendations: string[];
    };
  }> {
    const { userId, userRole, requireMFA = false, sensitiveOperation = false } = options;

    let riskScore = 0;
    const anomalies: any[] = [];
    const recommendations: string[] = [];

    // 1. Rate limiting check
    if (this.config.rateLimiting.enabled && this.rateLimiter) {
      const rateLimitResult = await this.rateLimiter.checkLimit(request, userId, userRole);
      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          response: NextResponse.json(
            { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
            { status: 429 }
          ),
          securityContext: { riskScore: 100, anomalies, recommendations },
        };
      }
    }

    // 2. Session fingerprinting and anomaly detection
    let fingerprint: any;
    if (this.config.sessionSecurity.fingerprintingEnabled && userId) {
      fingerprint = sessionFingerprintingService.generateFingerprint(request);
      const analysis = await sessionFingerprintingService.associateFingerprintWithUser(
        fingerprint,
        userId
      );
      
      riskScore += analysis.riskScore * 50; // Scale to 0-50
      anomalies.push(...analysis.anomalies);
      recommendations.push(...analysis.recommendations);

      // Block high-risk requests
      if (analysis.riskScore > 0.8) {
        this.logSecurityIncident({
          type: 'anomaly',
          severity: 'high',
          title: 'High-risk session detected',
          description: `Session from ${fingerprint.ipAddress} flagged as high-risk`,
          affectedUsers: [userId],
          ipAddress: fingerprint.ipAddress,
          metadata: { riskScore: analysis.riskScore, anomalies: analysis.anomalies },
        });

        return {
          allowed: false,
          response: NextResponse.json(
            { error: 'Access denied due to security policy' },
            { status: 403 }
          ),
          securityContext: { fingerprint, riskScore, anomalies, recommendations },
        };
      }
    }

    // 3. MFA check for sensitive operations
    if (this.config.mfa.enabled && (requireMFA || sensitiveOperation) && userId) {
      const mfaStatus = await mfaService.getMFAStatus(userId);
      if (mfaStatus.enabled) {
        // In a real implementation, you'd check if MFA was recently verified
        // For now, we'll assume MFA verification is handled elsewhere
      } else if (sensitiveOperation) {
        recommendations.push('Enable MFA for enhanced security');
        riskScore += 20;
      }
    }

    return {
      allowed: true,
      securityContext: { fingerprint, riskScore, anomalies, recommendations },
    };
  }

  /**
   * Apply security headers to response
   */
  applySecurityHeaders(
    response: NextResponse,
    request: NextRequest,
    options: {
      generateNonce?: boolean;
      strictMode?: boolean;
    } = {}
  ): NextResponse {
    // Apply CSP headers
    if (this.config.contentSecurity.cspEnabled && this.cspService) {
      const { response: securedResponse } = this.cspService.applyHeaders(response, request, options);
      response = securedResponse;
    }

    // Apply additional security headers
    return securityHeaders.applyHeaders(response, request);
  }

  /**
   * Encrypt sensitive data
   */
  encryptSensitiveData<T extends Record<string, any>>(
    data: T,
    piiFields: Record<keyof T, any>
  ): T {
    if (!this.config.dataProtection.encryptionEnabled) {
      return data;
    }

    return fieldEncryption.encryptFields(data, piiFields);
  }

  /**
   * Decrypt sensitive data
   */
  decryptSensitiveData<T extends Record<string, any>>(
    data: T,
    fieldNames: (keyof T)[]
  ): T {
    if (!this.config.dataProtection.encryptionEnabled) {
      return data;
    }

    return fieldEncryption.decryptFields(data, fieldNames);
  }

  /**
   * Mask PII in text for logging/display
   */
  maskPII(text: string): string {
    if (!this.config.dataProtection.maskingEnabled) {
      return text;
    }

    return PIIUtils.maskPII(text);
  }

  /**
   * Perform comprehensive security assessment
   */
  async performSecurityAssessment(): Promise<SecurityMetrics> {
    console.log('Performing comprehensive security assessment...');

    const scores = {
      authentication: await this.assessAuthentication(),
      authorization: await this.assessAuthorization(),
      dataProtection: await this.assessDataProtection(),
      networkSecurity: await this.assessNetworkSecurity(),
      vulnerability: await this.assessVulnerabilities(),
      compliance: await this.assessCompliance(),
    };

    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
    const riskLevel = this.calculateRiskLevel(overallScore);
    const recommendations = this.generateSecurityRecommendations(scores);

    this.metrics = {
      overallScore: Math.round(overallScore),
      categoryScores: scores,
      riskLevel,
      recommendations,
      lastAssessment: new Date(),
    };

    console.log(`Security assessment completed. Overall score: ${this.metrics.overallScore}/100`);
    return this.metrics;
  }

  /**
   * Run vulnerability scan
   */
  async runVulnerabilityScan(): Promise<any> {
    if (!this.config.vulnerabilityScanning.enabled) {
      throw new Error('Vulnerability scanning is disabled');
    }

    console.log('Running vulnerability scan...');
    const report = await vulnerabilityScanner.scanProject();

    // Log critical vulnerabilities as incidents
    report.vulnerabilities.forEach(({ dependency, vulnerabilities }) => {
      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
      if (criticalVulns.length > 0) {
        this.logSecurityIncident({
          type: 'vulnerability',
          severity: 'critical',
          title: `Critical vulnerabilities in ${dependency.name}`,
          description: `${criticalVulns.length} critical vulnerabilities found in ${dependency.name}@${dependency.version}`,
          metadata: { dependency, vulnerabilities: criticalVulns },
        });
      }
    });

    return report;
  }

  /**
   * Log security incident
   */
  logSecurityIncident(incident: Omit<SecurityIncident, 'id' | 'timestamp' | 'resolved' | 'response'>): void {
    const fullIncident: SecurityIncident = {
      id: this.generateIncidentId(),
      timestamp: new Date(),
      resolved: false,
      response: this.generateIncidentResponse(incident.type, incident.severity),
      ...incident,
    };

    this.incidents.push(fullIncident);

    // Keep only recent incidents
    if (this.incidents.length > 1000) {
      this.incidents = this.incidents.slice(-1000);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Security Incident:', fullIncident);
    }

    // Execute immediate response actions
    this.executeIncidentResponse(fullIncident);
  }

  /**
   * Get security incidents
   */
  getSecurityIncidents(filters: {
    type?: SecurityIncident['type'];
    severity?: SecurityIncident['severity'];
    resolved?: boolean;
    limit?: number;
  } = {}): SecurityIncident[] {
    let filtered = [...this.incidents];

    if (filters.type) {
      filtered = filtered.filter(incident => incident.type === filters.type);
    }

    if (filters.severity) {
      filtered = filtered.filter(incident => incident.severity === filters.severity);
    }

    if (filters.resolved !== undefined) {
      filtered = filtered.filter(incident => incident.resolved === filters.resolved);
    }

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, filters.limit || 100);
  }

  /**
   * Get current security metrics
   */
  getSecurityMetrics(): SecurityMetrics | null {
    return this.metrics;
  }

  /**
   * Update security configuration
   */
  updateConfiguration(updates: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...updates };
    this.initializeServices();
  }

  /**
   * Export security report
   */
  exportSecurityReport(format: 'json' | 'pdf' | 'html' = 'json'): string {
    const report = {
      timestamp: new Date().toISOString(),
      configuration: this.config,
      metrics: this.metrics,
      recentIncidents: this.getSecurityIncidents({ limit: 50 }),
      recommendations: this.generateComprehensiveRecommendations(),
    };

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);
      case 'html':
        return this.generateHTMLReport(report);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Private helper methods
   */
  private mergeWithDefaults(config: Partial<SecurityConfig>): SecurityConfig {
    const defaults: SecurityConfig = {
      mfa: {
        enabled: true,
        requireForSensitiveActions: true,
        backupCodesEnabled: true,
      },
      sessionSecurity: {
        fingerprintingEnabled: true,
        anomalyDetectionEnabled: true,
        maxSessionsPerUser: 5,
      },
      rateLimiting: {
        enabled: true,
        config: 'moderate',
      },
      contentSecurity: {
        cspEnabled: true,
        cspConfig: 'moderate',
        nonceEnabled: true,
      },
      dataProtection: {
        encryptionEnabled: true,
        piiDetectionEnabled: true,
        maskingEnabled: true,
      },
      vulnerabilityScanning: {
        enabled: true,
        scanFrequency: 'weekly',
        autoUpdate: true,
      },
      compliance: {
        gdprCompliant: true,
        hipaaCompliant: false,
        soc2Compliant: true,
      },
    };

    return { ...defaults, ...config };
  }

  private async assessAuthentication(): Promise<number> {
    let score = 60; // Base score

    if (this.config.mfa.enabled) score += 20;
    if (this.config.mfa.backupCodesEnabled) score += 10;
    if (this.config.sessionSecurity.fingerprintingEnabled) score += 10;

    return Math.min(100, score);
  }

  private async assessAuthorization(): Promise<number> {
    let score = 70; // Base score

    if (this.config.sessionSecurity.anomalyDetectionEnabled) score += 15;
    if (this.config.rateLimiting.enabled) score += 15;

    return Math.min(100, score);
  }

  private async assessDataProtection(): Promise<number> {
    let score = 50; // Base score

    if (this.config.dataProtection.encryptionEnabled) score += 30;
    if (this.config.dataProtection.piiDetectionEnabled) score += 10;
    if (this.config.dataProtection.maskingEnabled) score += 10;

    return Math.min(100, score);
  }

  private async assessNetworkSecurity(): Promise<number> {
    let score = 60; // Base score

    if (this.config.contentSecurity.cspEnabled) score += 20;
    if (this.config.contentSecurity.nonceEnabled) score += 10;
    if (this.config.rateLimiting.enabled) score += 10;

    return Math.min(100, score);
  }

  private async assessVulnerabilities(): Promise<number> {
    if (!this.config.vulnerabilityScanning.enabled) return 30;

    try {
      const report = await vulnerabilityScanner.scanProject();
      return report.summary.securityScore;
    } catch (error) {
      console.error('Failed to assess vulnerabilities:', error);
      return 50;
    }
  }

  private async assessCompliance(): Promise<number> {
    let score = 60; // Base score

    if (this.config.compliance.gdprCompliant) score += 15;
    if (this.config.compliance.soc2Compliant) score += 15;
    if (this.config.compliance.hipaaCompliant) score += 10;

    return Math.min(100, score);
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 90) return 'low';
    if (score >= 70) return 'medium';
    if (score >= 50) return 'high';
    return 'critical';
  }

  private generateSecurityRecommendations(scores: Record<string, number>): Array<{
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    action: string;
  }> {
    const recommendations: any[] = [];

    Object.entries(scores).forEach(([category, score]) => {
      if (score < 50) {
        recommendations.push({
          category,
          priority: 'critical',
          description: `${category} security is critically low (${score}/100)`,
          action: `Immediate improvement needed in ${category} controls`,
        });
      } else if (score < 70) {
        recommendations.push({
          category,
          priority: 'high',
          description: `${category} security needs improvement (${score}/100)`,
          action: `Enhance ${category} security measures`,
        });
      } else if (score < 90) {
        recommendations.push({
          category,
          priority: 'medium',
          description: `${category} security is good but can be optimized (${score}/100)`,
          action: `Consider additional ${category} enhancements`,
        });
      }
    });

    return recommendations;
  }

  private generateComprehensiveRecommendations(): string[] {
    const recommendations = [];

    if (!this.config.mfa.enabled) {
      recommendations.push('Enable multi-factor authentication for enhanced security');
    }

    if (!this.config.dataProtection.encryptionEnabled) {
      recommendations.push('Enable field-level encryption for sensitive data');
    }

    if (!this.config.vulnerabilityScanning.enabled) {
      recommendations.push('Enable regular vulnerability scanning');
    }

    if (!this.config.contentSecurity.cspEnabled) {
      recommendations.push('Implement Content Security Policy (CSP)');
    }

    return recommendations;
  }

  private generateIncidentResponse(
    type: SecurityIncident['type'],
    severity: SecurityIncident['severity']
  ): SecurityIncident['response'] {
    const responses = {
      authentication: {
        immediate: ['Lock affected account', 'Reset authentication tokens'],
        followUp: ['Review authentication logs', 'Update security policies'],
      },
      vulnerability: {
        immediate: ['Update affected dependencies', 'Apply security patches'],
        followUp: ['Conduct security audit', 'Review dependency management'],
      },
      anomaly: {
        immediate: ['Block suspicious IP', 'Notify security team'],
        followUp: ['Investigate activity patterns', 'Update detection rules'],
      },
    };

    return responses[type] || {
      immediate: ['Notify security team', 'Document incident'],
      followUp: ['Investigate root cause', 'Update security measures'],
    };
  }

  private executeIncidentResponse(incident: SecurityIncident): void {
    // Execute immediate response actions
    incident.response.immediate.forEach(action => {
      console.log(`Executing immediate response: ${action}`);
      // In a real implementation, you'd execute actual response actions
    });

    // Schedule follow-up actions
    setTimeout(() => {
      incident.response.followUp.forEach(action => {
        console.log(`Executing follow-up response: ${action}`);
        // In a real implementation, you'd execute follow-up actions
      });
    }, 5000); // 5 second delay for demo purposes
  }

  private generateIncidentId(): string {
    return `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateHTMLReport(report: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Security Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .score { font-size: 2em; font-weight: bold; }
            .critical { color: #d32f2f; }
            .high { color: #f57c00; }
            .medium { color: #fbc02d; }
            .low { color: #388e3c; }
          </style>
        </head>
        <body>
          <h1>Comprehensive Security Report</h1>
          <p>Generated: ${report.timestamp}</p>
          ${report.metrics ? `
            <div class="score">Overall Security Score: ${report.metrics.overallScore}/100</div>
            <p class="${report.metrics.riskLevel}">Risk Level: ${report.metrics.riskLevel.toUpperCase()}</p>
          ` : ''}
          <h2>Recent Security Incidents</h2>
          <p>${report.recentIncidents.length} incidents in the last period</p>
          <h2>Recommendations</h2>
          <ul>
            ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
          </ul>
        </body>
      </html>
    `;
  }
}

// Export singleton instance
export const securityOrchestrator = new SecurityOrchestrator();