import crypto from 'crypto';
import { NextRequest } from 'next/server';

export interface SessionFingerprint {
  id: string;
  userId: string;
  hash: string;
  components: {
    userAgent: string;
    acceptLanguage: string;
    acceptEncoding: string;
    timezone: string;
    screenResolution?: string;
    colorDepth?: string;
    platform?: string;
    cookieEnabled?: boolean;
    doNotTrack?: string;
    plugins?: string[];
    fonts?: string[];
    canvas?: string;
    webgl?: string;
  };
  ipAddress: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };
  createdAt: Date;
  lastSeen: Date;
  trustScore: number;
  isCompromised: boolean;
  anomalies: SecurityAnomaly[];
}

export interface SecurityAnomaly {
  id: string;
  type: 'location_change' | 'device_change' | 'behavior_change' | 'time_anomaly' | 'ip_reputation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  confidence: number;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface BehaviorPattern {
  userId: string;
  loginTimes: number[];
  sessionDurations: number[];
  clickPatterns: Array<{ x: number; y: number; timestamp: number }>;
  keystrokePatterns: Array<{ interval: number; pressure?: number }>;
  mouseMovePatterns: Array<{ x: number; y: number; timestamp: number }>;
  pageVisitPatterns: Array<{ page: string; duration: number; timestamp: number }>;
  lastUpdated: Date;
}

export class SessionFingerprintingService {
  private fingerprints: Map<string, SessionFingerprint> = new Map();
  private behaviorPatterns: Map<string, BehaviorPattern> = new Map();
  private ipReputationCache: Map<string, { score: number; lastChecked: Date }> = new Map();
  private readonly trustThreshold = 0.7;
  private readonly anomalyThreshold = 0.8;

  /**
   * Generate fingerprint from request
   */
  generateFingerprint(request: NextRequest, clientData?: any): SessionFingerprint {
    const components = {
      userAgent: request.headers.get('user-agent') || '',
      acceptLanguage: request.headers.get('accept-language') || '',
      acceptEncoding: request.headers.get('accept-encoding') || '',
      timezone: clientData?.timezone || '',
      screenResolution: clientData?.screenResolution,
      colorDepth: clientData?.colorDepth,
      platform: clientData?.platform,
      cookieEnabled: clientData?.cookieEnabled,
      doNotTrack: request.headers.get('dnt') || clientData?.doNotTrack,
      plugins: clientData?.plugins || [],
      fonts: clientData?.fonts || [],
      canvas: clientData?.canvas,
      webgl: clientData?.webgl,
    };

    const fingerprintString = JSON.stringify(components);
    const hash = crypto.createHash('sha256').update(fingerprintString).digest('hex');
    
    const ipAddress = this.extractIpAddress(request);
    
    const fingerprint: SessionFingerprint = {
      id: hash,
      userId: '', // Will be set when associating with user
      hash,
      components,
      ipAddress,
      createdAt: new Date(),
      lastSeen: new Date(),
      trustScore: 0.5, // Initial neutral score
      isCompromised: false,
      anomalies: [],
    };

    return fingerprint;
  }

  /**
   * Associate fingerprint with user and analyze
   */
  async associateFingerprintWithUser(
    fingerprint: SessionFingerprint,
    userId: string
  ): Promise<{
    fingerprint: SessionFingerprint;
    anomalies: SecurityAnomaly[];
    riskScore: number;
    recommendations: string[];
  }> {
    fingerprint.userId = userId;
    
    // Get existing fingerprints for user
    const existingFingerprints = this.getUserFingerprints(userId);
    
    // Analyze for anomalies
    const anomalies = await this.detectAnomalies(fingerprint, existingFingerprints);
    fingerprint.anomalies = anomalies;
    
    // Calculate trust score
    fingerprint.trustScore = this.calculateTrustScore(fingerprint, existingFingerprints);
    
    // Store fingerprint
    this.fingerprints.set(fingerprint.id, fingerprint);
    
    // Generate risk assessment
    const riskScore = this.calculateRiskScore(fingerprint, anomalies);
    const recommendations = this.generateSecurityRecommendations(fingerprint, anomalies);
    
    return {
      fingerprint,
      anomalies,
      riskScore,
      recommendations,
    };
  }

  /**
   * Detect security anomalies
   */
  private async detectAnomalies(
    newFingerprint: SessionFingerprint,
    existingFingerprints: SessionFingerprint[]
  ): Promise<SecurityAnomaly[]> {
    const anomalies: SecurityAnomaly[] = [];
    
    if (existingFingerprints.length === 0) {
      return anomalies; // First time user, no comparison possible
    }

    // Location-based anomalies
    const locationAnomalies = await this.detectLocationAnomalies(newFingerprint, existingFingerprints);
    anomalies.push(...locationAnomalies);

    // Device-based anomalies
    const deviceAnomalies = this.detectDeviceAnomalies(newFingerprint, existingFingerprints);
    anomalies.push(...deviceAnomalies);

    // IP reputation anomalies
    const ipAnomalies = await this.detectIPAnomalies(newFingerprint);
    anomalies.push(...ipAnomalies);

    // Time-based anomalies
    const timeAnomalies = this.detectTimeAnomalies(newFingerprint, existingFingerprints);
    anomalies.push(...timeAnomalies);

    return anomalies;
  }

  /**
   * Detect location-based anomalies
   */
  private async detectLocationAnomalies(
    newFingerprint: SessionFingerprint,
    existingFingerprints: SessionFingerprint[]
  ): Promise<SecurityAnomaly[]> {
    const anomalies: SecurityAnomaly[] = [];
    
    // Get IP geolocation
    const newLocation = await this.getIPGeolocation(newFingerprint.ipAddress);
    newFingerprint.location = newLocation;
    
    // Check against recent fingerprints
    const recentFingerprints = existingFingerprints
      .filter(fp => fp.lastSeen > new Date(Date.now() - 24 * 60 * 60 * 1000))
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
    
    if (recentFingerprints.length > 0) {
      const lastFingerprint = recentFingerprints[0];
      
      // Check for impossible travel
      if (lastFingerprint.location && newLocation) {
        const distance = this.calculateDistance(lastFingerprint.location, newLocation);
        const timeDiff = (newFingerprint.createdAt.getTime() - lastFingerprint.lastSeen.getTime()) / 1000 / 3600; // hours
        const maxSpeed = 1000; // km/h (commercial flight speed)
        
        if (distance > maxSpeed * timeDiff && distance > 100) {
          anomalies.push({
            id: crypto.randomUUID(),
            type: 'location_change',
            severity: 'high',
            description: `Impossible travel detected: ${distance.toFixed(0)}km in ${timeDiff.toFixed(1)} hours`,
            detectedAt: new Date(),
            confidence: 0.9,
            metadata: {
              distance,
              timeDiff,
              fromLocation: lastFingerprint.location,
              toLocation: newLocation,
            },
            resolved: false,
          });
        }
      }
      
      // Check for unusual country/region changes
      const countryChanges = recentFingerprints.filter(fp => 
        fp.location?.country !== newLocation?.country
      ).length;
      
      if (countryChanges > 2) {
        anomalies.push({
          id: crypto.randomUUID(),
          type: 'location_change',
          severity: 'medium',
          description: `Multiple country changes detected in recent sessions`,
          detectedAt: new Date(),
          confidence: 0.7,
          metadata: {
            countryChanges,
            recentCountries: recentFingerprints.map(fp => fp.location?.country).filter(Boolean),
          },
          resolved: false,
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect device-based anomalies
   */
  private detectDeviceAnomalies(
    newFingerprint: SessionFingerprint,
    existingFingerprints: SessionFingerprint[]
  ): Promise<SecurityAnomaly[]> {
    const anomalies: SecurityAnomaly[] = [];
    
    const recentFingerprints = existingFingerprints
      .filter(fp => fp.lastSeen > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    if (recentFingerprints.length === 0) {
      return Promise.resolve(anomalies);
    }

    // Check for user agent changes
    const userAgents = new Set(recentFingerprints.map(fp => fp.components.userAgent));
    if (!userAgents.has(newFingerprint.components.userAgent)) {
      const similarity = this.calculateUserAgentSimilarity(
        newFingerprint.components.userAgent,
        Array.from(userAgents)
      );
      
      if (similarity < 0.5) {
        anomalies.push({
          id: crypto.randomUUID(),
          type: 'device_change',
          severity: 'medium',
          description: 'New device or browser detected',
          detectedAt: new Date(),
          confidence: 1 - similarity,
          metadata: {
            newUserAgent: newFingerprint.components.userAgent,
            knownUserAgents: Array.from(userAgents),
            similarity,
          },
          resolved: false,
        });
      }
    }

    // Check for screen resolution changes (if available)
    if (newFingerprint.components.screenResolution) {
      const knownResolutions = new Set(
        recentFingerprints
          .map(fp => fp.components.screenResolution)
          .filter(Boolean)
      );
      
      if (knownResolutions.size > 0 && !knownResolutions.has(newFingerprint.components.screenResolution)) {
        anomalies.push({
          id: crypto.randomUUID(),
          type: 'device_change',
          severity: 'low',
          description: 'New screen resolution detected',
          detectedAt: new Date(),
          confidence: 0.6,
          metadata: {
            newResolution: newFingerprint.components.screenResolution,
            knownResolutions: Array.from(knownResolutions),
          },
          resolved: false,
        });
      }
    }

    return Promise.resolve(anomalies);
  }

  /**
   * Detect IP reputation anomalies
   */
  private async detectIPAnomalies(fingerprint: SessionFingerprint): Promise<SecurityAnomaly[]> {
    const anomalies: SecurityAnomaly[] = [];
    
    const reputation = await this.checkIPReputation(fingerprint.ipAddress);
    
    if (reputation.score < 0.3) {
      anomalies.push({
        id: crypto.randomUUID(),
        type: 'ip_reputation',
        severity: reputation.score < 0.1 ? 'critical' : 'high',
        description: `Login from IP address with poor reputation (score: ${reputation.score})`,
        detectedAt: new Date(),
        confidence: 1 - reputation.score,
        metadata: {
          ipAddress: fingerprint.ipAddress,
          reputationScore: reputation.score,
          reasons: reputation.reasons || [],
        },
        resolved: false,
      });
    }

    return anomalies;
  }

  /**
   * Detect time-based anomalies
   */
  private detectTimeAnomalies(
    newFingerprint: SessionFingerprint,
    existingFingerprints: SessionFingerprint[]
  ): SecurityAnomaly[] {
    const anomalies: SecurityAnomaly[] = [];
    
    // Get behavior pattern
    const behavior = this.behaviorPatterns.get(newFingerprint.userId);
    if (!behavior || behavior.loginTimes.length < 5) {
      return anomalies; // Not enough data
    }

    const currentHour = newFingerprint.createdAt.getHours();
    const usualHours = behavior.loginTimes;
    
    // Calculate if current time is unusual
    const hourCounts = new Array(24).fill(0);
    usualHours.forEach(hour => hourCounts[hour]++);
    
    const totalLogins = usualHours.length;
    const currentHourFreq = hourCounts[currentHour] / totalLogins;
    
    if (currentHourFreq < 0.05 && totalLogins > 20) { // Less than 5% of logins at this hour
      anomalies.push({
        id: crypto.randomUUID(),
        type: 'time_anomaly',
        severity: 'medium',
        description: `Login at unusual time (${currentHour}:00)`,
        detectedAt: new Date(),
        confidence: 1 - currentHourFreq,
        metadata: {
          currentHour,
          usualHours: usualHours.slice(-30), // Last 30 login hours
          frequency: currentHourFreq,
        },
        resolved: false,
      });
    }

    return anomalies;
  }

  /**
   * Calculate trust score for fingerprint
   */
  private calculateTrustScore(
    fingerprint: SessionFingerprint,
    existingFingerprints: SessionFingerprint[]
  ): number {
    let score = 0.5; // Base score
    
    // Increase trust if fingerprint is similar to existing ones
    const similarities = existingFingerprints.map(fp => 
      this.calculateFingerprintSimilarity(fingerprint, fp)
    );
    
    if (similarities.length > 0) {
      const maxSimilarity = Math.max(...similarities);
      score += maxSimilarity * 0.3;
    }
    
    // Decrease trust based on anomalies
    const highSeverityAnomalies = fingerprint.anomalies.filter(a => 
      a.severity === 'high' || a.severity === 'critical'
    ).length;
    
    score -= highSeverityAnomalies * 0.2;
    
    // Increase trust based on age of similar fingerprints
    const recentSimilar = existingFingerprints.filter(fp => {
      const similarity = this.calculateFingerprintSimilarity(fingerprint, fp);
      const daysSinceLastSeen = (Date.now() - fp.lastSeen.getTime()) / (1000 * 60 * 60 * 24);
      return similarity > 0.7 && daysSinceLastSeen < 30;
    });
    
    score += Math.min(recentSimilar.length * 0.1, 0.3);
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(
    fingerprint: SessionFingerprint,
    anomalies: SecurityAnomaly[]
  ): number {
    let riskScore = 0;
    
    // Base risk from trust score
    riskScore += (1 - fingerprint.trustScore) * 0.4;
    
    // Risk from anomalies
    anomalies.forEach(anomaly => {
      const severityWeight = {
        low: 0.1,
        medium: 0.2,
        high: 0.3,
        critical: 0.4,
      };
      
      riskScore += severityWeight[anomaly.severity] * anomaly.confidence;
    });
    
    return Math.max(0, Math.min(1, riskScore));
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    fingerprint: SessionFingerprint,
    anomalies: SecurityAnomaly[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (fingerprint.trustScore < this.trustThreshold) {
      recommendations.push('Require additional authentication factors');
    }
    
    const hasLocationAnomaly = anomalies.some(a => a.type === 'location_change');
    if (hasLocationAnomaly) {
      recommendations.push('Verify login location with user');
      recommendations.push('Consider temporary account restrictions');
    }
    
    const hasDeviceAnomaly = anomalies.some(a => a.type === 'device_change');
    if (hasDeviceAnomaly) {
      recommendations.push('Send device verification notification');
      recommendations.push('Require email verification for new device');
    }
    
    const hasIPAnomaly = anomalies.some(a => a.type === 'ip_reputation');
    if (hasIPAnomaly) {
      recommendations.push('Block or restrict access from suspicious IP');
      recommendations.push('Require additional identity verification');
    }
    
    const hasTimeAnomaly = anomalies.some(a => a.type === 'time_anomaly');
    if (hasTimeAnomaly) {
      recommendations.push('Send login notification to user');
      recommendations.push('Monitor for unusual activity patterns');
    }
    
    return recommendations;
  }

  /**
   * Update behavior pattern
   */
  updateBehaviorPattern(userId: string, data: Partial<BehaviorPattern>): void {
    const existing = this.behaviorPatterns.get(userId) || {
      userId,
      loginTimes: [],
      sessionDurations: [],
      clickPatterns: [],
      keystrokePatterns: [],
      mouseMovePatterns: [],
      pageVisitPatterns: [],
      lastUpdated: new Date(),
    };

    // Update fields
    Object.assign(existing, data, { lastUpdated: new Date() });
    
    // Keep only recent data to avoid memory bloat
    existing.loginTimes = existing.loginTimes.slice(-100);
    existing.clickPatterns = existing.clickPatterns.slice(-1000);
    existing.keystrokePatterns = existing.keystrokePatterns.slice(-1000);
    existing.mouseMovePatterns = existing.mouseMovePatterns.slice(-1000);
    existing.pageVisitPatterns = existing.pageVisitPatterns.slice(-500);
    
    this.behaviorPatterns.set(userId, existing);
  }

  /**
   * Get user fingerprints
   */
  getUserFingerprints(userId: string): SessionFingerprint[] {
    const userFingerprints: SessionFingerprint[] = [];
    
    for (const fingerprint of this.fingerprints.values()) {
      if (fingerprint.userId === userId) {
        userFingerprints.push(fingerprint);
      }
    }

    return userFingerprints.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }

  /**
   * Helper methods
   */
  private extractIpAddress(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           request.headers.get('cf-connecting-ip') ||
           'unknown';
  }

  private calculateFingerprintSimilarity(fp1: SessionFingerprint, fp2: SessionFingerprint): number {
    const weights = {
      userAgent: 0.3,
      acceptLanguage: 0.2,
      acceptEncoding: 0.1,
      timezone: 0.2,
      screenResolution: 0.1,
      platform: 0.1,
    };

    let similarity = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      const val1 = (fp1.components as any)[key];
      const val2 = (fp2.components as any)[key];
      
      if (val1 && val2) {
        totalWeight += weight;
        if (val1 === val2) {
          similarity += weight;
        } else if (typeof val1 === 'string' && typeof val2 === 'string') {
          // Calculate string similarity for partial matches
          const strSim = this.calculateStringSimilarity(val1, val2);
          similarity += weight * strSim;
        }
      }
    });

    return totalWeight > 0 ? similarity / totalWeight : 0;
  }

  private calculateUserAgentSimilarity(newUA: string, knownUAs: string[]): number {
    if (knownUAs.length === 0) return 0;
    
    const similarities = knownUAs.map(ua => this.calculateStringSimilarity(newUA, ua));
    return Math.max(...similarities);
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async getIPGeolocation(ipAddress: string): Promise<any> {
    // In a real implementation, this would call a geolocation service
    // For now, return a placeholder
    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      timezone: 'UTC',
    };
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // Simple placeholder - in reality would use proper geolocation calculation
    return Math.random() * 1000;
  }

  private async checkIPReputation(ipAddress: string): Promise<{ score: number; reasons?: string[] }> {
    // Check cache first
    const cached = this.ipReputationCache.get(ipAddress);
    if (cached && (Date.now() - cached.lastChecked.getTime()) < 60 * 60 * 1000) {
      return { score: cached.score };
    }

    // In a real implementation, this would check against threat intelligence feeds
    // For now, return a placeholder score
    const score = Math.random();
    this.ipReputationCache.set(ipAddress, { score, lastChecked: new Date() });
    
    return { score };
  }
}

// Export singleton instance
export const sessionFingerprintingService = new SessionFingerprintingService();