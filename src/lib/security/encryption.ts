import { randomBytes, createCipher, createDecipher, createHash, scryptSync, pbkdf2Sync } from 'crypto';
import { env } from '@/lib/env-validation';

/**
 * Comprehensive encryption service for data protection
 */
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyDerivationAlgorithm = 'pbkdf2';
  private readonly iterations = 100000;
  private readonly saltLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly masterKey: Buffer;

  constructor() {
    // Derive master key from environment secret
    const secret = env.BETTER_AUTH_SECRET || env.JWT_SECRET || 'fallback-secret-key-change-me';
    this.masterKey = this.deriveKey(secret, 'master-key-salt');
  }

  /**
   * Encrypt sensitive data with AES-256-GCM
   */
  encrypt(data: string, context: string = 'default'): {
    encrypted: string;
    iv: string;
    tag: string;
    salt: string;
  } {
    try {
      // Generate random IV and salt
      const iv = randomBytes(this.ivLength);
      const salt = randomBytes(this.saltLength);
      
      // Derive context-specific key
      const key = this.deriveContextKey(context, salt);
      
      // Create cipher
      const cipher = require('crypto').createCipherGCM(this.algorithm, key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex'),
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  decrypt(encryptedData: {
    encrypted: string;
    iv: string;
    tag: string;
    salt: string;
  }, context: string = 'default'): string {
    try {
      // Convert hex strings to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const salt = Buffer.from(encryptedData.salt, 'hex');
      
      // Derive context-specific key
      const key = this.deriveContextKey(context, salt);
      
      // Create decipher
      const decipher = require('crypto').createDecipherGCM(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
    return createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Hash with salt for password storage
   */
  hashWithSalt(data: string, salt?: string): {
    hash: string;
    salt: string;
  } {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : randomBytes(this.saltLength);
    const hash = pbkdf2Sync(data, saltBuffer, this.iterations, 64, 'sha512');
    
    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex'),
    };
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const computed = this.hashWithSalt(data, salt);
      return this.constantTimeCompare(computed.hash, hash);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate cryptographically secure UUID
   */
  generateSecureUUID(): string {
    const bytes = randomBytes(16);
    
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    const hex = bytes.toString('hex');
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32),
    ].join('-');
  }

  /**
   * Encrypt object to JSON
   */
  encryptObject(obj: any, context: string = 'default'): string {
    const json = JSON.stringify(obj);
    const encrypted = this.encrypt(json, context);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt JSON to object
   */
  decryptObject<T = any>(encryptedJson: string, context: string = 'default'): T {
    const encryptedData = JSON.parse(encryptedJson);
    const decrypted = this.decrypt(encryptedData, context);
    return JSON.parse(decrypted);
  }

  /**
   * Encrypt file content
   */
  encryptFile(content: Buffer, context: string = 'file'): {
    encrypted: Buffer;
    iv: string;
    tag: string;
    salt: string;
  } {
    try {
      // Generate random IV and salt
      const iv = randomBytes(this.ivLength);
      const salt = randomBytes(this.saltLength);
      
      // Derive context-specific key
      const key = this.deriveContextKey(context, salt);
      
      // Create cipher
      const cipher = require('crypto').createCipherGCM(this.algorithm, key, iv);
      
      // Encrypt content
      const encrypted = Buffer.concat([
        cipher.update(content),
        cipher.final(),
      ]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex'),
      };
    } catch (error) {
      console.error('File encryption error:', error);
      throw new Error('File encryption failed');
    }
  }

  /**
   * Decrypt file content
   */
  decryptFile(encryptedData: {
    encrypted: Buffer;
    iv: string;
    tag: string;
    salt: string;
  }, context: string = 'file'): Buffer {
    try {
      // Convert hex strings to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      const salt = Buffer.from(encryptedData.salt, 'hex');
      
      // Derive context-specific key
      const key = this.deriveContextKey(context, salt);
      
      // Create decipher
      const decipher = require('crypto').createDecipherGCM(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt content
      const decrypted = Buffer.concat([
        decipher.update(encryptedData.encrypted),
        decipher.final(),
      ]);
      
      return decrypted;
    } catch (error) {
      console.error('File decryption error:', error);
      throw new Error('File decryption failed');
    }
  }

  /**
   * Create HMAC for data integrity
   */
  createHMAC(data: string, secret?: string): string {
    const key = secret ? Buffer.from(secret) : this.masterKey;
    return require('crypto').createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  verifyHMAC(data: string, hmac: string, secret?: string): boolean {
    const computed = this.createHMAC(data, secret);
    return this.constantTimeCompare(computed, hmac);
  }

  /**
   * Derive key from master key and context
   */
  private deriveContextKey(context: string, salt: Buffer): Buffer {
    const contextBuffer = Buffer.from(context, 'utf8');
    const keyMaterial = Buffer.concat([this.masterKey, contextBuffer]);
    return pbkdf2Sync(keyMaterial, salt, this.iterations, 32, 'sha256');
  }

  /**
   * Derive key from password/secret
   */
  private deriveKey(secret: string, salt: string): Buffer {
    return scryptSync(secret, salt, 32);
  }

  /**
   * Constant time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}

/**
 * Data anonymization service
 */
export class DataAnonymizationService {
  private readonly encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Anonymize email address
   */
  anonymizeEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***.***';
    
    const anonymizedLocal = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : '*'.repeat(local.length);
    
    const domainParts = domain.split('.');
    const anonymizedDomain = domainParts.map(part => 
      part.length > 2 ? part[0] + '*'.repeat(part.length - 2) + part[part.length - 1] : part
    ).join('.');
    
    return `${anonymizedLocal}@${anonymizedDomain}`;
  }

  /**
   * Anonymize phone number
   */
  anonymizePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return '*'.repeat(cleaned.length);
    
    return cleaned.substring(0, 3) + '*'.repeat(cleaned.length - 6) + cleaned.substring(cleaned.length - 3);
  }

  /**
   * Anonymize IP address
   */
  anonymizeIP(ip: string): string {
    if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      return parts.slice(0, 4).join(':') + ':****:****:****:****';
    } else {
      // IPv4
      const parts = ip.split('.');
      return parts.slice(0, 2).join('.') + '.***.***.***';
    }
  }

  /**
   * Anonymize user data for logs/analytics
   */
  anonymizeUserData(userData: {
    id?: string;
    email?: string;
    phone?: string;
    ip?: string;
    name?: string;
    [key: string]: any;
  }): any {
    const anonymized = { ...userData };
    
    if (anonymized.email) {
      anonymized.email = this.anonymizeEmail(anonymized.email);
    }
    
    if (anonymized.phone) {
      anonymized.phone = this.anonymizePhone(anonymized.phone);
    }
    
    if (anonymized.ip) {
      anonymized.ip = this.anonymizeIP(anonymized.ip);
    }
    
    if (anonymized.name) {
      const names = anonymized.name.split(' ');
      anonymized.name = names.map((name: string) => 
        name.length > 1 ? name[0] + '*'.repeat(name.length - 1) : name
      ).join(' ');
    }
    
    // Hash the ID for analytics while maintaining uniqueness
    if (anonymized.id) {
      anonymized.id = this.encryptionService.hash(anonymized.id).substring(0, 16);
    }
    
    return anonymized;
  }

  /**
   * Generate synthetic data for testing
   */
  generateSyntheticData(type: 'email' | 'phone' | 'name' | 'address'): string {
    switch (type) {
      case 'email':
        const domains = ['example.com', 'test.org', 'sample.net'];
        const username = this.encryptionService.generateToken(8);
        const domain = domains[Math.floor(Math.random() * domains.length)];
        return `${username}@${domain}`;
      
      case 'phone':
        return '+1' + Math.floor(Math.random() * 9000000000 + 1000000000).toString();
      
      case 'name':
        const firstNames = ['John', 'Jane', 'Alex', 'Sam', 'Taylor', 'Jordan'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'];
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        return `${firstName} ${lastName}`;
      
      case 'address':
        const streets = ['Main St', 'Oak Ave', 'Park Rd', 'First St', 'Elm St'];
        const street = streets[Math.floor(Math.random() * streets.length)];
        const number = Math.floor(Math.random() * 9999 + 1);
        return `${number} ${street}, Anytown, ST 12345`;
      
      default:
        return 'synthetic-data';
    }
  }
}

// Export singleton instances
export const encryptionService = new EncryptionService();
export const dataAnonymizationService = new DataAnonymizationService();