import { totpService } from './totp';
import { randomBytes } from 'crypto';

export interface MFADevice {
  id: string;
  userId: string;
  type: 'totp' | 'backup_codes' | 'sms' | 'email';
  name: string;
  secret?: string;
  backupCodes?: string[];
  phoneNumber?: string;
  email?: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

export interface MFAChallenge {
  id: string;
  userId: string;
  deviceId: string;
  type: 'totp' | 'backup_code' | 'sms' | 'email';
  code?: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  isVerified: boolean;
  createdAt: Date;
}

export interface MFASetupResult {
  deviceId: string;
  secret?: string;
  qrCodeUrl?: string;
  backupCodes?: string[];
}

export class MFAManager {
  private devices: Map<string, MFADevice> = new Map();
  private challenges: Map<string, MFAChallenge> = new Map();
  private usedBackupCodes: Set<string> = new Set();
  
  private readonly maxAttempts = 3;
  private readonly challengeExpiry = 5 * 60 * 1000; // 5 minutes

  /**
   * Setup TOTP MFA for a user
   */
  async setupTOTP(userId: string, deviceName: string = 'Authenticator App'): Promise<MFASetupResult> {
    const deviceId = randomBytes(16).toString('hex');
    const secret = totpService.generateSecret();
    
    // Get user email (in real implementation, fetch from database)
    const userEmail = `user-${userId}@example.com`; // Placeholder
    const qrCodeUrl = totpService.generateQRCodeURL(secret, userEmail);
    
    const device: MFADevice = {
      id: deviceId,
      userId,
      type: 'totp',
      name: deviceName,
      secret,
      isActive: false, // Will be activated after verification
      createdAt: new Date(),
      usageCount: 0,
    };
    
    this.devices.set(deviceId, device);
    
    return {
      deviceId,
      secret,
      qrCodeUrl,
    };
  }

  /**
   * Setup backup codes MFA
   */
  async setupBackupCodes(userId: string): Promise<MFASetupResult> {
    const deviceId = randomBytes(16).toString('hex');
    const backupCodes = totpService.generateBackupCodes(10);
    
    const device: MFADevice = {
      id: deviceId,
      userId,
      type: 'backup_codes',
      name: 'Backup Codes',
      backupCodes,
      isActive: true,
      createdAt: new Date(),
      usageCount: 0,
    };
    
    this.devices.set(deviceId, device);
    
    return {
      deviceId,
      backupCodes,
    };
  }

  /**
   * Verify TOTP setup
   */
  async verifyTOTPSetup(deviceId: string, token: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    
    if (!device || device.type !== 'totp' || !device.secret) {
      return false;
    }
    
    const isValid = totpService.verifyTOTP(device.secret, token);
    
    if (isValid) {
      device.isActive = true;
      device.lastUsed = new Date();
      device.usageCount++;
      this.devices.set(deviceId, device);
    }
    
    return isValid;
  }

  /**
   * Create MFA challenge for authentication
   */
  async createChallenge(userId: string, deviceId?: string): Promise<MFAChallenge | null> {
    const userDevices = this.getUserDevices(userId).filter(d => d.isActive);
    
    if (userDevices.length === 0) {
      return null;
    }
    
    const device = deviceId 
      ? userDevices.find(d => d.id === deviceId)
      : userDevices.find(d => d.type === 'totp') || userDevices[0];
    
    if (!device) {
      return null;
    }
    
    const challengeId = randomBytes(16).toString('hex');
    const challenge: MFAChallenge = {
      id: challengeId,
      userId,
      deviceId: device.id,
      type: device.type === 'backup_codes' ? 'backup_code' : device.type,
      expiresAt: new Date(Date.now() + this.challengeExpiry),
      attempts: 0,
      maxAttempts: this.maxAttempts,
      isVerified: false,
      createdAt: new Date(),
    };
    
    // For SMS/Email, generate and send code
    if (device.type === 'sms' || device.type === 'email') {
      challenge.code = this.generateSMSCode();
      // In real implementation, send SMS/Email here
    }
    
    this.challenges.set(challengeId, challenge);
    
    // Clean up expired challenges
    this.cleanupExpiredChallenges();
    
    return challenge;
  }

  /**
   * Verify MFA challenge
   */
  async verifyChallenge(challengeId: string, token: string): Promise<{
    isValid: boolean;
    challenge: MFAChallenge | null;
    remainingAttempts: number;
  }> {
    const challenge = this.challenges.get(challengeId);
    
    if (!challenge) {
      return { isValid: false, challenge: null, remainingAttempts: 0 };
    }
    
    // Check if challenge is expired
    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return { isValid: false, challenge, remainingAttempts: 0 };
    }
    
    // Check if too many attempts
    if (challenge.attempts >= challenge.maxAttempts) {
      return { isValid: false, challenge, remainingAttempts: 0 };
    }
    
    challenge.attempts++;
    
    const device = this.devices.get(challenge.deviceId);
    if (!device) {
      return { isValid: false, challenge, remainingAttempts: challenge.maxAttempts - challenge.attempts };
    }
    
    let isValid = false;
    
    switch (challenge.type) {
      case 'totp':
        if (device.secret) {
          isValid = totpService.verifyTOTP(device.secret, token);
        }
        break;
        
      case 'backup_code':
        isValid = this.verifyBackupCode(device, token);
        break;
        
      case 'sms':
      case 'email':
        isValid = challenge.code === token;
        break;
    }
    
    if (isValid) {
      challenge.isVerified = true;
      device.lastUsed = new Date();
      device.usageCount++;
      this.devices.set(device.id, device);
      this.challenges.delete(challengeId);
    } else {
      this.challenges.set(challengeId, challenge);
    }
    
    return {
      isValid,
      challenge,
      remainingAttempts: challenge.maxAttempts - challenge.attempts,
    };
  }

  /**
   * Get user's MFA devices
   */
  getUserDevices(userId: string): MFADevice[] {
    return Array.from(this.devices.values())
      .filter(device => device.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Check if user has MFA enabled
   */
  hasUserMFAEnabled(userId: string): boolean {
    return this.getUserDevices(userId).some(device => device.isActive);
  }

  /**
   * Remove MFA device
   */
  async removeDevice(deviceId: string, userId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    
    if (!device || device.userId !== userId) {
      return false;
    }
    
    this.devices.delete(deviceId);
    
    // Remove any pending challenges for this device
    for (const [challengeId, challenge] of this.challenges.entries()) {
      if (challenge.deviceId === deviceId) {
        this.challenges.delete(challengeId);
      }
    }
    
    return true;
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(deviceId: string, userId: string): Promise<string[] | null> {
    const device = this.devices.get(deviceId);
    
    if (!device || device.userId !== userId || device.type !== 'backup_codes') {
      return null;
    }
    
    const newCodes = totpService.generateBackupCodes(10);
    device.backupCodes = newCodes;
    device.usageCount = 0;
    this.devices.set(deviceId, device);
    
    // Clear used backup codes for this user
    for (const code of this.usedBackupCodes) {
      if (code.startsWith(`${userId}:`)) {
        this.usedBackupCodes.delete(code);
      }
    }
    
    return newCodes;
  }

  /**
   * Get MFA status for user
   */
  getMFAStatus(userId: string): {
    isEnabled: boolean;
    deviceCount: number;
    devices: Array<{
      id: string;
      type: string;
      name: string;
      isActive: boolean;
      lastUsed?: Date;
    }>;
  } {
    const devices = this.getUserDevices(userId);
    
    return {
      isEnabled: devices.some(d => d.isActive),
      deviceCount: devices.filter(d => d.isActive).length,
      devices: devices.map(d => ({
        id: d.id,
        type: d.type,
        name: d.name,
        isActive: d.isActive,
        lastUsed: d.lastUsed,
      })),
    };
  }

  /**
   * Verify backup code
   */
  private verifyBackupCode(device: MFADevice, code: string): boolean {
    if (!device.backupCodes || !totpService.validateBackupCode(code)) {
      return false;
    }
    
    const normalizedCode = code.toUpperCase();
    const codeKey = `${device.userId}:${normalizedCode}`;
    
    // Check if code was already used
    if (this.usedBackupCodes.has(codeKey)) {
      return false;
    }
    
    // Check if code exists in device backup codes
    if (!device.backupCodes.includes(normalizedCode)) {
      return false;
    }
    
    // Mark code as used
    this.usedBackupCodes.add(codeKey);
    
    return true;
  }

  /**
   * Generate SMS/Email verification code
   */
  private generateSMSCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Clean up expired challenges
   */
  private cleanupExpiredChallenges(): void {
    const now = new Date();
    
    for (const [challengeId, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(challengeId);
      }
    }
  }

  /**
   * Get challenge status
   */
  getChallengeStatus(challengeId: string): MFAChallenge | null {
    return this.challenges.get(challengeId) || null;
  }

  /**
   * Force disable MFA for user (admin function)
   */
  async forceDisableMFA(userId: string): Promise<number> {
    const devices = this.getUserDevices(userId);
    let disabled = 0;
    
    for (const device of devices) {
      device.isActive = false;
      this.devices.set(device.id, device);
      disabled++;
    }
    
    // Remove pending challenges
    for (const [challengeId, challenge] of this.challenges.entries()) {
      if (challenge.userId === userId) {
        this.challenges.delete(challengeId);
      }
    }
    
    return disabled;
  }
}

// Export singleton instance
export const mfaManager = new MFAManager();