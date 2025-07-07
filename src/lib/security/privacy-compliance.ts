import { encryptionService, dataAnonymizationService } from './encryption';

/**
 * Privacy compliance service for GDPR, CCPA, and other regulations
 */
export interface PrivacyConfig {
  enableGDPR: boolean;
  enableCCPA: boolean;
  dataRetentionDays: number;
  anonymizeAfterDays: number;
  allowedDataProcessing: string[];
  requireExplicitConsent: boolean;
  enableDataPortability: boolean;
}

export interface ConsentRecord {
  userId: string;
  type: 'necessary' | 'analytics' | 'marketing' | 'personalization';
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  version: string;
  expiresAt?: Date;
}

export interface DataProcessingRecord {
  id: string;
  userId: string;
  dataType: string;
  purpose: string;
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'vital_interests' | 'public_task' | 'legitimate_interests';
  timestamp: Date;
  processedBy: string;
  retentionPeriod: number;
  anonymized: boolean;
}

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv' | 'xml';
  downloadUrl?: string;
  expiresAt?: Date;
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'verification' | 'processing' | 'completed' | 'rejected';
  reason?: string;
  verificationCode?: string;
  completedAt?: Date;
}

export class PrivacyComplianceService {
  private config: PrivacyConfig;
  private consentRecords: Map<string, ConsentRecord[]> = new Map();
  private processingRecords: Map<string, DataProcessingRecord[]> = new Map();
  private exportRequests: Map<string, DataExportRequest> = new Map();
  private deletionRequests: Map<string, DataDeletionRequest> = new Map();

  constructor(config: Partial<PrivacyConfig> = {}) {
    this.config = {
      enableGDPR: true,
      enableCCPA: true,
      dataRetentionDays: 365 * 2, // 2 years
      anonymizeAfterDays: 365 * 7, // 7 years
      allowedDataProcessing: ['necessary', 'analytics', 'personalization'],
      requireExplicitConsent: true,
      enableDataPortability: true,
      ...config,
    };
  }

  /**
   * Record user consent
   */
  recordConsent(consent: Omit<ConsentRecord, 'timestamp' | 'version'>): string {
    const record: ConsentRecord = {
      ...consent,
      timestamp: new Date(),
      version: '1.0',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    };

    const userConsents = this.consentRecords.get(consent.userId) || [];
    userConsents.push(record);
    this.consentRecords.set(consent.userId, userConsents);

    this.logDataProcessing({
      userId: consent.userId,
      dataType: 'consent',
      purpose: 'consent_management',
      legalBasis: 'consent',
      processedBy: 'privacy_service',
      retentionPeriod: 365,
    });

    return encryptionService.generateSecureUUID();
  }

  /**
   * Check if user has given consent for specific data processing
   */
  hasConsent(userId: string, type: ConsentRecord['type']): boolean {
    const userConsents = this.consentRecords.get(userId) || [];
    const latestConsent = userConsents
      .filter(c => c.type === type)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!latestConsent) {
      return false;
    }

    // Check if consent is still valid
    if (latestConsent.expiresAt && latestConsent.expiresAt < new Date()) {
      return false;
    }

    return latestConsent.granted;
  }

  /**
   * Withdraw consent
   */
  withdrawConsent(userId: string, type: ConsentRecord['type'], ipAddress: string, userAgent: string): void {
    this.recordConsent({
      userId,
      type,
      granted: false,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Get user's consent history
   */
  getConsentHistory(userId: string): ConsentRecord[] {
    return this.consentRecords.get(userId) || [];
  }

  /**
   * Log data processing activity
   */
  logDataProcessing(processing: Omit<DataProcessingRecord, 'id' | 'timestamp' | 'anonymized'>): string {
    const record: DataProcessingRecord = {
      id: encryptionService.generateSecureUUID(),
      timestamp: new Date(),
      anonymized: false,
      ...processing,
    };

    const userProcessing = this.processingRecords.get(processing.userId) || [];
    userProcessing.push(record);
    this.processingRecords.set(processing.userId, userProcessing);

    return record.id;
  }

  /**
   * Get data processing records for user
   */
  getDataProcessingRecords(userId: string): DataProcessingRecord[] {
    return this.processingRecords.get(userId) || [];
  }

  /**
   * Request data export (GDPR Article 20 - Right to data portability)
   */
  async requestDataExport(userId: string, format: 'json' | 'csv' | 'xml' = 'json'): Promise<string> {
    if (!this.config.enableDataPortability) {
      throw new Error('Data portability is not enabled');
    }

    const requestId = encryptionService.generateSecureUUID();
    const request: DataExportRequest = {
      id: requestId,
      userId,
      requestedAt: new Date(),
      status: 'pending',
      format,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    this.exportRequests.set(requestId, request);

    this.logDataProcessing({
      userId,
      dataType: 'export_request',
      purpose: 'data_portability',
      legalBasis: 'consent',
      processedBy: 'privacy_service',
      retentionPeriod: 30,
    });

    // In a real implementation, this would trigger an async job
    setTimeout(() => this.processDataExport(requestId), 1000);

    return requestId;
  }

  /**
   * Process data export request
   */
  private async processDataExport(requestId: string): Promise<void> {
    const request = this.exportRequests.get(requestId);
    if (!request) return;

    try {
      request.status = 'processing';
      this.exportRequests.set(requestId, request);

      // Collect user data from various sources
      const userData = await this.collectUserData(request.userId);
      
      // Format data according to requested format
      const exportData = this.formatExportData(userData, request.format);
      
      // Encrypt and store the export file
      const encrypted = encryptionService.encrypt(JSON.stringify(exportData), 'data_export');
      const exportId = encryptionService.generateSecureUUID();
      
      // In a real implementation, you would save this to secure storage
      // and provide a download URL
      request.downloadUrl = `/api/privacy/export/${exportId}`;
      request.status = 'completed';
      
      this.exportRequests.set(requestId, request);

      // Notify user (implementation specific)
      console.log(`Data export completed for user ${request.userId}: ${request.downloadUrl}`);
    } catch (error) {
      console.error('Data export processing error:', error);
      request.status = 'failed';
      this.exportRequests.set(requestId, request);
    }
  }

  /**
   * Request data deletion (GDPR Article 17 - Right to erasure)
   */
  async requestDataDeletion(userId: string, reason?: string): Promise<string> {
    const requestId = encryptionService.generateSecureUUID();
    const verificationCode = encryptionService.generateToken(16);
    
    const request: DataDeletionRequest = {
      id: requestId,
      userId,
      requestedAt: new Date(),
      status: 'verification',
      reason,
      verificationCode,
    };

    this.deletionRequests.set(requestId, request);

    this.logDataProcessing({
      userId,
      dataType: 'deletion_request',
      purpose: 'right_to_erasure',
      legalBasis: 'consent',
      processedBy: 'privacy_service',
      retentionPeriod: 90,
    });

    // In a real implementation, send verification email
    console.log(`Deletion verification code for ${userId}: ${verificationCode}`);

    return requestId;
  }

  /**
   * Verify and process data deletion
   */
  async verifyDataDeletion(requestId: string, verificationCode: string): Promise<boolean> {
    const request = this.deletionRequests.get(requestId);
    if (!request || request.verificationCode !== verificationCode) {
      return false;
    }

    request.status = 'processing';
    this.deletionRequests.set(requestId, request);

    try {
      // Perform actual data deletion
      await this.performDataDeletion(request.userId);
      
      request.status = 'completed';
      request.completedAt = new Date();
      this.deletionRequests.set(requestId, request);

      return true;
    } catch (error) {
      console.error('Data deletion error:', error);
      request.status = 'rejected';
      this.deletionRequests.set(requestId, request);
      return false;
    }
  }

  /**
   * Anonymize old data according to retention policy
   */
  async anonymizeExpiredData(): Promise<number> {
    let anonymizedCount = 0;
    const cutoffDate = new Date(Date.now() - this.config.anonymizeAfterDays * 24 * 60 * 60 * 1000);

    for (const [userId, records] of this.processingRecords.entries()) {
      for (const record of records) {
        if (record.timestamp < cutoffDate && !record.anonymized) {
          // Anonymize the record
          record.anonymized = true;
          
          // In a real implementation, you would anonymize the actual data
          console.log(`Anonymized data for record ${record.id}`);
          anonymizedCount++;
        }
      }
    }

    return anonymizedCount;
  }

  /**
   * Delete expired data according to retention policy
   */
  async deleteExpiredData(): Promise<number> {
    let deletedCount = 0;
    const cutoffDate = new Date(Date.now() - this.config.dataRetentionDays * 24 * 60 * 60 * 1000);

    // Clean up expired export requests
    for (const [requestId, request] of this.exportRequests.entries()) {
      if (request.expiresAt && request.expiresAt < new Date()) {
        this.exportRequests.delete(requestId);
        deletedCount++;
      }
    }

    // Clean up expired processing records
    for (const [userId, records] of this.processingRecords.entries()) {
      const validRecords = records.filter(record => 
        record.timestamp >= cutoffDate || record.retentionPeriod === -1
      );
      
      if (validRecords.length !== records.length) {
        this.processingRecords.set(userId, validRecords);
        deletedCount += records.length - validRecords.length;
      }
    }

    return deletedCount;
  }

  /**
   * Generate privacy compliance report
   */
  generateComplianceReport(): {
    totalUsers: number;
    totalConsentRecords: number;
    totalProcessingRecords: number;
    pendingExportRequests: number;
    pendingDeletionRequests: number;
    anonymizedRecords: number;
    consentBreakdown: Record<string, number>;
  } {
    let totalConsentRecords = 0;
    let totalProcessingRecords = 0;
    let anonymizedRecords = 0;
    const consentBreakdown: Record<string, number> = {};

    for (const consents of this.consentRecords.values()) {
      totalConsentRecords += consents.length;
      
      for (const consent of consents) {
        if (consent.granted) {
          consentBreakdown[consent.type] = (consentBreakdown[consent.type] || 0) + 1;
        }
      }
    }

    for (const records of this.processingRecords.values()) {
      totalProcessingRecords += records.length;
      anonymizedRecords += records.filter(r => r.anonymized).length;
    }

    const pendingExportRequests = Array.from(this.exportRequests.values())
      .filter(r => r.status === 'pending' || r.status === 'processing').length;

    const pendingDeletionRequests = Array.from(this.deletionRequests.values())
      .filter(r => r.status === 'pending' || r.status === 'verification' || r.status === 'processing').length;

    return {
      totalUsers: this.consentRecords.size,
      totalConsentRecords,
      totalProcessingRecords,
      pendingExportRequests,
      pendingDeletionRequests,
      anonymizedRecords,
      consentBreakdown,
    };
  }

  /**
   * Check if data processing is compliant
   */
  isProcessingCompliant(userId: string, dataType: string, purpose: string): {
    compliant: boolean;
    reason?: string;
    requiredConsent?: string[];
  } {
    if (!this.config.requireExplicitConsent) {
      return { compliant: true };
    }

    // Map data types to required consent types
    const consentMapping: Record<string, ConsentRecord['type'][]> = {
      'analytics': ['analytics'],
      'marketing': ['marketing'],
      'personalization': ['personalization'],
      'user_profile': ['necessary'],
      'preferences': ['necessary'],
    };

    const requiredConsents = consentMapping[dataType] || ['necessary'];
    const missingConsents: string[] = [];

    for (const consentType of requiredConsents) {
      if (!this.hasConsent(userId, consentType)) {
        missingConsents.push(consentType);
      }
    }

    if (missingConsents.length > 0) {
      return {
        compliant: false,
        reason: `Missing consent for: ${missingConsents.join(', ')}`,
        requiredConsent: missingConsents,
      };
    }

    return { compliant: true };
  }

  /**
   * Collect user data for export
   */
  private async collectUserData(userId: string): Promise<any> {
    // In a real implementation, this would collect data from various sources
    return {
      userId,
      consents: this.getConsentHistory(userId),
      processingRecords: this.getDataProcessingRecords(userId),
      exportedAt: new Date().toISOString(),
      // Add other user data sources here
    };
  }

  /**
   * Format export data according to requested format
   */
  private formatExportData(data: any, format: 'json' | 'csv' | 'xml'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'csv':
        // Simple CSV conversion (in production, use proper CSV library)
        return this.convertToCSV(data);
      
      case 'xml':
        // Simple XML conversion (in production, use proper XML library)
        return this.convertToXML(data);
      
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: any): string {
    // Simple implementation - in production, use a proper CSV library
    let csv = 'Type,Data,Timestamp\n';
    
    if (data.consents) {
      for (const consent of data.consents) {
        csv += `Consent,${JSON.stringify(consent).replace(/"/g, '""')},${consent.timestamp}\n`;
      }
    }
    
    return csv;
  }

  /**
   * Convert data to XML format
   */
  private convertToXML(data: any): string {
    // Simple implementation - in production, use a proper XML library
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<userdata>\n';
    xml += `  <userId>${data.userId}</userId>\n`;
    xml += `  <exportedAt>${data.exportedAt}</exportedAt>\n`;
    xml += '</userdata>\n';
    
    return xml;
  }

  /**
   * Perform actual data deletion
   */
  private async performDataDeletion(userId: string): Promise<void> {
    // Remove consent records
    this.consentRecords.delete(userId);
    
    // Remove processing records
    this.processingRecords.delete(userId);
    
    // In a real implementation, you would:
    // 1. Delete from database
    // 2. Delete from file storage
    // 3. Delete from external services
    // 4. Notify other systems
    
    console.log(`Data deletion completed for user ${userId}`);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): PrivacyConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const privacyComplianceService = new PrivacyComplianceService();