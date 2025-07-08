import crypto from 'crypto';
import { env } from '../env-validation';

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyDerivation: 'pbkdf2' | 'scrypt' | 'argon2';
  encoding: 'base64' | 'hex';
  compression: boolean;
  fieldSeparator: string;
}

export interface EncryptedField {
  value: string;
  algorithm: string;
  keyId: string;
  iv: string;
  tag?: string;
  salt?: string;
  metadata?: Record<string, any>;
}

export interface PIIClassification {
  email: 'high';
  phone: 'high';
  ssn: 'critical';
  creditCard: 'critical';
  name: 'medium';
  address: 'medium';
  dateOfBirth: 'high';
  biometric: 'critical';
  medical: 'critical';
  financial: 'high';
  location: 'medium';
  custom: 'low' | 'medium' | 'high' | 'critical';
}

export type PIILevel = 'low' | 'medium' | 'high' | 'critical';

export interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
  purpose: string;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  version: number;
}

export class FieldEncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private config: EncryptionConfig;
  private masterKey: Buffer;
  private currentKeyId: string;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyDerivation: 'pbkdf2',
      encoding: 'base64',
      compression: true,
      fieldSeparator: '|',
      ...config,
    };

    this.masterKey = this.deriveMasterKey();
    this.currentKeyId = this.generateKeyId();
    this.initializeKeys();
  }

  /**
   * Encrypt a field value
   */
  encrypt(
    value: string,
    piiLevel: PIILevel = 'medium',
    metadata?: Record<string, any>
  ): EncryptedField {
    if (!value || value.trim() === '') {
      throw new Error('Cannot encrypt empty value');
    }

    const key = this.getActiveKey();
    let processedValue = value;

    // Apply compression if enabled
    if (this.config.compression) {
      processedValue = this.compressValue(value);
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.config.algorithm, key.key);
    cipher.setAAD(Buffer.from(key.id)); // Additional authenticated data

    let encrypted = cipher.update(processedValue, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const result: EncryptedField = {
      value: encrypted.toString(this.config.encoding),
      algorithm: this.config.algorithm,
      keyId: key.id,
      iv: iv.toString(this.config.encoding),
      metadata: {
        piiLevel,
        encryptedAt: new Date().toISOString(),
        version: key.version,
        compressed: this.config.compression,
        ...metadata,
      },
    };

    // Add authentication tag for GCM mode
    if (this.config.algorithm === 'aes-256-gcm') {
      result.tag = cipher.getAuthTag().toString(this.config.encoding);
    }

    return result;
  }

  /**
   * Decrypt a field value
   */
  decrypt(encryptedField: EncryptedField): string {
    const key = this.getKey(encryptedField.keyId);
    if (!key) {
      throw new Error(`Encryption key not found: ${encryptedField.keyId}`);
    }

    if (!key.isActive) {
      console.warn(`Using inactive encryption key: ${encryptedField.keyId}`);
    }

    const iv = Buffer.from(encryptedField.iv, this.config.encoding);
    const encryptedData = Buffer.from(encryptedField.value, this.config.encoding);
    
    const decipher = crypto.createDecipher(encryptedField.algorithm, key.key);
    decipher.setAAD(Buffer.from(encryptedField.keyId));

    // Set authentication tag for GCM mode
    if (encryptedField.algorithm === 'aes-256-gcm' && encryptedField.tag) {
      const tag = Buffer.from(encryptedField.tag, this.config.encoding);
      decipher.setAuthTag(tag);
    }

    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    // Apply decompression if needed
    if (encryptedField.metadata?.compressed) {
      decrypted = this.decompressValue(decrypted);
    }

    return decrypted;
  }

  /**
   * Encrypt multiple fields in an object
   */
  encryptFields<T extends Record<string, any>>(
    data: T,
    fieldConfig: Record<keyof T, PIILevel | { level: PIILevel; metadata?: Record<string, any> }>
  ): T {
    const result = { ...data };

    Object.entries(fieldConfig).forEach(([fieldName, config]) => {
      const value = data[fieldName];
      if (value !== null && value !== undefined && value !== '') {
        const level = typeof config === 'string' ? config : config.level;
        const metadata = typeof config === 'object' ? config.metadata : undefined;
        
        try {
          result[fieldName] = this.encrypt(String(value), level, metadata);
        } catch (error) {
          console.error(`Failed to encrypt field ${fieldName}:`, error);
          // Optionally, you might want to throw or handle this differently
        }
      }
    });

    return result;
  }

  /**
   * Decrypt multiple fields in an object
   */
  decryptFields<T extends Record<string, any>>(
    data: T,
    fieldNames: (keyof T)[]
  ): T {
    const result = { ...data };

    fieldNames.forEach(fieldName => {
      const encryptedField = data[fieldName];
      if (encryptedField && typeof encryptedField === 'object' && encryptedField.value) {
        try {
          result[fieldName] = this.decrypt(encryptedField);
        } catch (error) {
          console.error(`Failed to decrypt field ${fieldName}:`, error);
          // Keep the encrypted value if decryption fails
        }
      }
    });

    return result;
  }

  /**
   * Re-encrypt field with new key (for key rotation)
   */
  reencrypt(encryptedField: EncryptedField): EncryptedField {
    const decryptedValue = this.decrypt(encryptedField);
    const piiLevel = encryptedField.metadata?.piiLevel || 'medium';
    const metadata = { ...encryptedField.metadata, reencryptedAt: new Date().toISOString() };
    
    return this.encrypt(decryptedValue, piiLevel, metadata);
  }

  /**
   * Search encrypted fields (limited functionality)
   */
  createSearchHash(value: string, salt?: string): string {
    const searchSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.createHmac('sha256', this.masterKey)
      .update(value.toLowerCase().trim() + searchSalt)
      .digest('hex');
    
    return `${hash}:${searchSalt}`;
  }

  /**
   * Verify search hash
   */
  verifySearchHash(value: string, hash: string): boolean {
    const [expectedHash, salt] = hash.split(':');
    if (!expectedHash || !salt) return false;
    
    const computedHash = crypto.createHmac('sha256', this.masterKey)
      .update(value.toLowerCase().trim() + salt)
      .digest('hex');
    
    return computedHash === expectedHash;
  }

  /**
   * Generate key for encryption
   */
  generateKey(purpose: string = 'field-encryption'): EncryptionKey {
    const keyId = this.generateKeyId();
    const key = crypto.randomBytes(32); // 256-bit key
    
    const encryptionKey: EncryptionKey = {
      id: keyId,
      key,
      algorithm: this.config.algorithm,
      purpose,
      createdAt: new Date(),
      isActive: true,
      version: 1,
    };

    this.keys.set(keyId, encryptionKey);
    return encryptionKey;
  }

  /**
   * Rotate encryption keys
   */
  rotateKeys(): { newKeyId: string; oldKeyId: string } {
    const oldKeyId = this.currentKeyId;
    const oldKey = this.keys.get(oldKeyId);
    
    if (oldKey) {
      oldKey.isActive = false;
      oldKey.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }

    const newKey = this.generateKey();
    this.currentKeyId = newKey.id;

    return { newKeyId: newKey.id, oldKeyId };
  }

  /**
   * Get encryption key by ID
   */
  getKey(keyId: string): EncryptionKey | undefined {
    return this.keys.get(keyId);
  }

  /**
   * Get active encryption key
   */
  getActiveKey(): EncryptionKey {
    const key = this.keys.get(this.currentKeyId);
    if (!key || !key.isActive) {
      throw new Error('No active encryption key available');
    }
    return key;
  }

  /**
   * List all keys
   */
  listKeys(): EncryptionKey[] {
    return Array.from(this.keys.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Export key for backup (encrypted)
   */
  exportKey(keyId: string, password: string): string {
    const key = this.getKey(keyId);
    if (!key) {
      throw new Error(`Key not found: ${keyId}`);
    }

    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM('aes-256-gcm', derivedKey);
    cipher.setAAD(salt);

    const keyData = JSON.stringify({
      id: key.id,
      key: key.key.toString('base64'),
      algorithm: key.algorithm,
      purpose: key.purpose,
      createdAt: key.createdAt.toISOString(),
      version: key.version,
    });

    let encrypted = cipher.update(keyData, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    const exportData = {
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted.toString('base64'),
    };

    return Buffer.from(JSON.stringify(exportData)).toString('base64');
  }

  /**
   * Import key from backup
   */
  importKey(exportedKey: string, password: string): EncryptionKey {
    const exportData = JSON.parse(Buffer.from(exportedKey, 'base64').toString('utf8'));
    
    const salt = Buffer.from(exportData.salt, 'base64');
    const iv = Buffer.from(exportData.iv, 'base64');
    const tag = Buffer.from(exportData.tag, 'base64');
    const encryptedData = Buffer.from(exportData.data, 'base64');

    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    
    const decipher = crypto.createDecipherGCM('aes-256-gcm', derivedKey);
    decipher.setAAD(salt);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    const keyData = JSON.parse(decrypted);
    
    const importedKey: EncryptionKey = {
      id: keyData.id,
      key: Buffer.from(keyData.key, 'base64'),
      algorithm: keyData.algorithm,
      purpose: keyData.purpose,
      createdAt: new Date(keyData.createdAt),
      isActive: false, // Imported keys are inactive by default
      version: keyData.version,
    };

    this.keys.set(importedKey.id, importedKey);
    return importedKey;
  }

  /**
   * Validate encrypted field
   */
  validateEncryptedField(encryptedField: any): encryptedField is EncryptedField {
    return (
      typeof encryptedField === 'object' &&
      typeof encryptedField.value === 'string' &&
      typeof encryptedField.algorithm === 'string' &&
      typeof encryptedField.keyId === 'string' &&
      typeof encryptedField.iv === 'string'
    );
  }

  /**
   * Get encryption statistics
   */
  getStatistics(): {
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    algorithms: Record<string, number>;
    oldestKey: Date | null;
    newestKey: Date | null;
  } {
    const keys = this.listKeys();
    const algorithms: Record<string, number> = {};
    
    let activeKeys = 0;
    let expiredKeys = 0;
    
    keys.forEach(key => {
      algorithms[key.algorithm] = (algorithms[key.algorithm] || 0) + 1;
      
      if (key.isActive) {
        activeKeys++;
      }
      
      if (key.expiresAt && key.expiresAt < new Date()) {
        expiredKeys++;
      }
    });

    return {
      totalKeys: keys.length,
      activeKeys,
      expiredKeys,
      algorithms,
      oldestKey: keys.length > 0 ? keys[keys.length - 1].createdAt : null,
      newestKey: keys.length > 0 ? keys[0].createdAt : null,
    };
  }

  /**
   * Private helper methods
   */
  private deriveMasterKey(): Buffer {
    const secret = env.ENCRYPTION_SECRET || env.BETTER_AUTH_SECRET;
    const salt = env.ENCRYPTION_SALT || 'learning-assistant-salt';
    
    return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
  }

  private generateKeyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private initializeKeys(): void {
    // Generate initial key if none exist
    if (this.keys.size === 0) {
      this.generateKey();
    }
  }

  private compressValue(value: string): string {
    // Simple compression using zlib (in a real implementation, you might use a more efficient algorithm)
    const compressed = crypto.createGzip();
    const chunks: Buffer[] = [];
    
    compressed.on('data', chunk => chunks.push(chunk));
    compressed.write(value);
    compressed.end();
    
    return Buffer.concat(chunks).toString('base64');
  }

  private decompressValue(compressedValue: string): string {
    const compressed = Buffer.from(compressedValue, 'base64');
    const decompressed = crypto.createGunzip();
    const chunks: Buffer[] = [];
    
    decompressed.on('data', chunk => chunks.push(chunk));
    decompressed.write(compressed);
    decompressed.end();
    
    return Buffer.concat(chunks).toString('utf8');
  }
}

/**
 * Utility functions for common PII operations
 */
export class PIIUtils {
  private static fieldEncryption = new FieldEncryptionService();

  /**
   * Auto-detect PII in text
   */
  static detectPII(text: string): Array<{
    type: keyof PIIClassification;
    value: string;
    confidence: number;
    start: number;
    end: number;
  }> {
    const patterns = [
      {
        type: 'email' as const,
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        confidence: 0.95,
      },
      {
        type: 'phone' as const,
        regex: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
        confidence: 0.85,
      },
      {
        type: 'ssn' as const,
        regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        confidence: 0.90,
      },
      {
        type: 'creditCard' as const,
        regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        confidence: 0.80,
      },
    ];

    const detections: Array<{
      type: keyof PIIClassification;
      value: string;
      confidence: number;
      start: number;
      end: number;
    }> = [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(text)) !== null) {
        detections.push({
          type: pattern.type,
          value: match[0],
          confidence: pattern.confidence,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    });

    return detections.sort((a, b) => a.start - b.start);
  }

  /**
   * Mask PII in text for display
   */
  static maskPII(text: string, maskChar: string = '*'): string {
    const detections = this.detectPII(text);
    let maskedText = text;
    
    // Process from end to start to maintain string indices
    detections.reverse().forEach(detection => {
      const { value, start, end } = detection;
      let maskedValue: string;
      
      switch (detection.type) {
        case 'email':
          const [localPart, domain] = value.split('@');
          maskedValue = `${localPart.charAt(0)}${maskChar.repeat(localPart.length - 2)}${localPart.charAt(localPart.length - 1)}@${domain}`;
          break;
        case 'phone':
          maskedValue = value.replace(/\d(?=\d{4})/g, maskChar);
          break;
        case 'ssn':
          maskedValue = value.replace(/\d(?=\d{4})/g, maskChar);
          break;
        case 'creditCard':
          maskedValue = value.replace(/\d(?=\d{4})/g, maskChar);
          break;
        default:
          maskedValue = maskChar.repeat(value.length);
      }
      
      maskedText = maskedText.substring(0, start) + maskedValue + maskedText.substring(end);
    });
    
    return maskedText;
  }

  /**
   * Encrypt PII in text
   */
  static encryptPIIInText(text: string): {
    encryptedText: string;
    encryptedFields: Array<{
      id: string;
      type: keyof PIIClassification;
      encryptedField: EncryptedField;
    }>;
  } {
    const detections = this.detectPII(text);
    let encryptedText = text;
    const encryptedFields: Array<{
      id: string;
      type: keyof PIIClassification;
      encryptedField: EncryptedField;
    }> = [];
    
    // Process from end to start to maintain string indices
    detections.reverse().forEach((detection, index) => {
      const { type, value, start, end } = detection;
      const fieldId = `pii_${type}_${index}`;
      
      const piiLevel: PIILevel = type === 'ssn' || type === 'creditCard' ? 'critical' : 'high';
      const encryptedField = this.fieldEncryption.encrypt(value, piiLevel, { type });
      
      encryptedFields.push({
        id: fieldId,
        type,
        encryptedField,
      });
      
      encryptedText = encryptedText.substring(0, start) + `{{${fieldId}}}` + encryptedText.substring(end);
    });
    
    return { encryptedText, encryptedFields: encryptedFields.reverse() };
  }
}

// Export singleton instance
export const fieldEncryption = new FieldEncryptionService();

// Export PII classification levels
export const PII_LEVELS: PIIClassification = {
  email: 'high',
  phone: 'high',
  ssn: 'critical',
  creditCard: 'critical',
  name: 'medium',
  address: 'medium',
  dateOfBirth: 'high',
  biometric: 'critical',
  medical: 'critical',
  financial: 'high',
  location: 'medium',
  custom: 'medium',
};