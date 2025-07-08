import crypto from 'crypto';
import { authenticator, totp } from 'otplib';
import qrcode from 'qrcode';

import { env } from '../env-validation';
import { generateUUID } from '@/utils/uuid';

export interface MFADevice {
  id: string;
  userId: string;
  name: string;
  type: 'totp' | 'sms' | 'email' | 'backup_codes';
  secret?: string;
  phoneNumber?: string;
  email?: string;
  verified: boolean;
  lastUsed?: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: Date;
}

export interface MFAChallenge {
  id: string;
  userId: string;
  deviceId: string;
  type: 'totp' | 'sms' | 'email';
  code?: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

export class MFAService {
  private devices: Map<string, MFADevice> = new Map();
  private backupCodes: Map<string, BackupCode[]> = new Map();
  private challenges: Map<string, MFAChallenge> = new Map();
  private readonly appName: string;
  private readonly maxAttempts: number = 3;
  private readonly challengeExpiryMs: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.appName = env.NEXT_PUBLIC_APP_NAME || 'Learning Assistant';
    
    // Configure TOTP settings
    authenticator.options = {
      window: 2, // Allow 2 time windows (±30 seconds)
      step: 30, // 30-second time step
      digits: 6, // 6-digit codes
      algorithm: 'sha1',
    };
  }

  /**
   * Generate TOTP secret for new device
   */
  generateTOTPSecret(): string {
    return authenticator.generateSecret();
  }

  /**
   * Generate QR code for TOTP setup
   */
  async generateTOTPQRCode(
    userId: string,
    userEmail: string,
    secret: string,
    deviceName: string = 'Default'
  ): Promise<string> {
    const otpauth = authenticator.keyuri(
      userEmail,
      `${this.appName} (${deviceName})`,
      secret
    );
    
    return await qrcode.toDataURL(otpauth);
  }

  /**
   * Add new MFA device
   */
  async addDevice(device: Omit<MFADevice, 'id' | 'createdAt' | 'verified'>): Promise<MFADevice> {
    const deviceId = generateUUID();
    const newDevice: MFADevice = {
      ...device,
      id: deviceId,
      verified: false,
      createdAt: new Date(),
    };

    this.devices.set(deviceId, newDevice);
    return newDevice;
  }

  /**
   * Verify MFA device during setup
   */
  async verifyDeviceSetup(
    deviceId: string,
    code: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const device = this.devices.get(deviceId);
    
    if (!device || device.userId !== userId) {
      return { success: false, error: 'Device not found' };
    }

    if (device.verified) {
      return { success: false, error: 'Device already verified' };
    }

    let isValid = false;

    switch (device.type) {
      case 'totp':
        if (!device.secret) {
          return { success: false, error: 'Device secret not found' };
        }
        isValid = authenticator.check(code, device.secret);
        break;
      
      case 'sms':
      case 'email':
        // For SMS/Email, we would verify against a sent code
        // For now, assume it's handled by a separate service
        isValid = await this.verifyExternalCode(device, code);
        break;
      
      default:
        return { success: false, error: 'Unsupported device type' };
    }

    if (isValid) {
      device.verified = true;
      device.lastUsed = new Date();
      this.devices.set(deviceId, device);
      
      // Generate backup codes if this is the first verified device
      const userDevices = await this.getUserDevices(userId);
      const verifiedDevices = userDevices.filter(d => d.verified);
      
      if (verifiedDevices.length === 1) {
        await this.generateBackupCodes(userId);
      }
      
      return { success: true };
    }

    return { success: false, error: 'Invalid verification code' };
  }

  /**
   * Create MFA challenge
   */
  async createChallenge(userId: string, deviceId?: string): Promise<MFAChallenge> {
    const userDevices = await this.getUserDevices(userId);
    const verifiedDevices = userDevices.filter(d => d.verified);
    
    if (verifiedDevices.length === 0) {
      throw new Error('No verified MFA devices found');
    }

    // Use specified device or select the most recently used one
    const selectedDevice = deviceId 
      ? verifiedDevices.find(d => d.id === deviceId)
      : verifiedDevices.sort((a, b) => 
          (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0)
        )[0];

    if (!selectedDevice) {
      throw new Error('MFA device not found or not verified');
    }

    const challengeId = generateUUID();
    const challenge: MFAChallenge = {
      id: challengeId,
      userId,
      deviceId: selectedDevice.id,
      type: selectedDevice.type as 'totp' | 'sms' | 'email',
      expiresAt: new Date(Date.now() + this.challengeExpiryMs),
      verified: false,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt: new Date(),
    };

    // For SMS/Email, generate and send code
    if (selectedDevice.type === 'sms' || selectedDevice.type === 'email') {
      challenge.code = this.generateRandomCode();
      await this.sendExternalCode(selectedDevice, challenge.code);
    }

    this.challenges.set(challengeId, challenge);
    return challenge;
  }

  /**
   * Verify MFA challenge
   */
  async verifyChallenge(
    challengeId: string,
    code: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
    const challenge = this.challenges.get(challengeId);
    
    if (!challenge || challenge.userId !== userId) {
      return { success: false, error: 'Challenge not found' };
    }

    if (challenge.verified) {
      return { success: false, error: 'Challenge already verified' };
    }

    if (challenge.expiresAt < new Date()) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Challenge expired' };
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Too many attempts' };
    }

    const device = this.devices.get(challenge.deviceId);
    if (!device) {
      return { success: false, error: 'Device not found' };
    }

    challenge.attempts++;
    let isValid = false;

    switch (challenge.type) {
      case 'totp':
        if (!device.secret) {
          return { success: false, error: 'Device secret not found' };
        }
        isValid = authenticator.check(code, device.secret);
        break;
      
      case 'sms':
      case 'email':
        isValid = challenge.code === code;
        break;
    }

    if (isValid) {
      challenge.verified = true;
      device.lastUsed = new Date();
      this.devices.set(device.id, device);
      this.challenges.delete(challengeId);
      return { success: true };
    }

    this.challenges.set(challengeId, challenge);
    const remainingAttempts = challenge.maxAttempts - challenge.attempts;
    
    if (remainingAttempts <= 0) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Too many attempts' };
    }

    return { 
      success: false, 
      error: 'Invalid code', 
      remainingAttempts 
    };
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(
    userId: string,
    code: string
  ): Promise<{ success: boolean; error?: string; remainingCodes?: number }> {
    const userBackupCodes = this.backupCodes.get(userId);
    
    if (!userBackupCodes) {
      return { success: false, error: 'No backup codes found' };
    }

    const matchingCode = userBackupCodes.find(bc => bc.code === code && !bc.used);
    
    if (!matchingCode) {
      return { success: false, error: 'Invalid backup code' };
    }

    // Mark code as used
    matchingCode.used = true;
    matchingCode.usedAt = new Date();
    this.backupCodes.set(userId, userBackupCodes);

    const remainingCodes = userBackupCodes.filter(bc => !bc.used).length;
    
    return { 
      success: true, 
      remainingCodes 
    };
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes(userId: string, count: number = 10): Promise<string[]> {
    const codes: BackupCode[] = [];
    
    for (let i = 0; i < count; i++) {
      codes.push({
        code: this.generateBackupCode(),
        used: false,
      });
    }

    this.backupCodes.set(userId, codes);
    return codes.map(c => c.code);
  }

  /**
   * Get user's MFA devices
   */
  async getUserDevices(userId: string): Promise<MFADevice[]> {
    const userDevices: MFADevice[] = [];
    
    for (const device of this.devices.values()) {
      if (device.userId === userId) {
        userDevices.push(device);
      }
    }

    return userDevices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
    
    // If this was the last device, remove backup codes
    const remainingDevices = await this.getUserDevices(userId);
    const verifiedDevices = remainingDevices.filter(d => d.verified);
    
    if (verifiedDevices.length === 0) {
      this.backupCodes.delete(userId);
    }

    return true;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: string): Promise<boolean> {
    const devices = await this.getUserDevices(userId);
    return devices.some(device => device.verified);
  }

  /**
   * Get MFA status for user
   */
  async getMFAStatus(userId: string): Promise<{
    enabled: boolean;
    deviceCount: number;
    verifiedDeviceCount: number;
    backupCodesRemaining: number;
    lastUsed?: Date;
  }> {
    const devices = await this.getUserDevices(userId);
    const verifiedDevices = devices.filter(d => d.verified);
    const backupCodes = this.backupCodes.get(userId) || [];
    const remainingBackupCodes = backupCodes.filter(bc => !bc.used).length;
    
    const lastUsed = verifiedDevices
      .filter(d => d.lastUsed)
      .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))[0]?.lastUsed;

    return {
      enabled: verifiedDevices.length > 0,
      deviceCount: devices.length,
      verifiedDeviceCount: verifiedDevices.length,
      backupCodesRemaining: remainingBackupCodes,
      lastUsed,
    };
  }

  /**
   * Clean up expired challenges
   */
  async cleanupExpiredChallenges(): Promise<number> {
    const now = new Date();
    let cleaned = 0;
    
    for (const [challengeId, challenge] of this.challenges.entries()) {
      if (challenge.expiresAt < now) {
        this.challenges.delete(challengeId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Generate random 6-digit code for SMS/Email
   */
  private generateRandomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate backup code
   */
  private generateBackupCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
      if (i === 3) result += '-'; // Add dash in middle
    }
    
    return result;
  }

  /**
   * Send external code (SMS/Email) - placeholder
   */
  private async sendExternalCode(device: MFADevice, code: string): Promise<boolean> {
    // In a real implementation, this would integrate with SMS/Email services
    console.log(`Sending MFA code ${code} to ${device.type} device:`, 
      device.phoneNumber || device.email);
    return true;
  }

  /**
   * Verify external code (SMS/Email) - placeholder
   */
  private async verifyExternalCode(device: MFADevice, code: string): Promise<boolean> {
    // In a real implementation, this would verify against a sent code
    // For testing purposes, accept any 6-digit code
    return /^\d{6}$/.test(code);
  }

  /**
   * Generate MFA recovery information
   */
  async generateRecoveryInfo(userId: string): Promise<{
    backupCodes: string[];
    recoveryKey: string;
    qrCodes: { deviceName: string; qrCode: string }[];
  }> {
    const devices = await this.getUserDevices(userId);
    const totpDevices = devices.filter(d => d.type === 'totp' && d.verified);
    
    const backupCodes = await this.generateBackupCodes(userId);
    const recoveryKey = crypto.randomBytes(32).toString('hex');
    
    const qrCodes = await Promise.all(
      totpDevices.map(async device => ({
        deviceName: device.name,
        qrCode: await this.generateTOTPQRCode(
          userId,
          'recovery@app.com',
          device.secret!,
          device.name
        ),
      }))
    );

    return {
      backupCodes,
      recoveryKey,
      qrCodes,
    };
  }

  /**
   * Get MFA audit log
   */
  async getMFAAuditLog(userId: string, limit: number = 50): Promise<Array<{
    timestamp: Date;
    action: string;
    deviceName?: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
  }>> {
    // In a real implementation, this would query an audit log
    // For now, return a placeholder
    return [];
  }
}

// Export singleton instance
export const mfaService = new MFAService();

// Auto-cleanup expired challenges every minute
if (typeof setInterval !== 'undefined') {
  setInterval(async () => {
    try {
      const cleaned = await mfaService.cleanupExpiredChallenges();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} expired MFA challenges`);
      }
    } catch (error) {
      console.error('Error cleaning up MFA challenges:', error);
    }
  }, 60 * 1000);
}