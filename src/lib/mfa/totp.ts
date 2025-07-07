import { randomBytes, createHmac } from 'crypto';
import { env } from '@/lib/env-validation';

/**
 * Time-based One-Time Password (TOTP) implementation
 * RFC 6238 compliant TOTP implementation for MFA
 */
export class TOTPService {
  private readonly algorithm = 'sha1';
  private readonly digits = 6;
  private readonly period = 30; // seconds
  private readonly window = 2; // Allow 2 periods before/after current
  private readonly appName = 'Learning Assistant';

  /**
   * Generate a random base32 secret for TOTP
   */
  generateSecret(): string {
    const buffer = randomBytes(20);
    return this.base32Encode(buffer);
  }

  /**
   * Generate TOTP code for a given secret and timestamp
   */
  generateTOTP(secret: string, timestamp?: number): string {
    const time = Math.floor((timestamp || Date.now()) / 1000);
    const timeSlice = Math.floor(time / this.period);
    const secretBuffer = this.base32Decode(secret);
    
    // Convert time slice to 8-byte buffer
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(Math.floor(timeSlice / 0x100000000), 0);
    timeBuffer.writeUInt32BE(timeSlice & 0xFFFFFFFF, 4);
    
    // HMAC-SHA1
    const hmac = createHmac(this.algorithm, secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0F;
    const truncatedHash = hash.slice(offset, offset + 4);
    
    // Convert to 32-bit integer
    const code = (
      ((truncatedHash[0] & 0x7F) << 24) |
      ((truncatedHash[1] & 0xFF) << 16) |
      ((truncatedHash[2] & 0xFF) << 8) |
      (truncatedHash[3] & 0xFF)
    );
    
    // Generate final code
    const finalCode = code % Math.pow(10, this.digits);
    return finalCode.toString().padStart(this.digits, '0');
  }

  /**
   * Verify TOTP code
   */
  verifyTOTP(secret: string, token: string, timestamp?: number): boolean {
    const time = Math.floor((timestamp || Date.now()) / 1000);
    const timeSlice = Math.floor(time / this.period);
    
    // Check current time slice and window
    for (let i = -this.window; i <= this.window; i++) {
      const testTime = (timeSlice + i) * this.period * 1000;
      const expectedToken = this.generateTOTP(secret, testTime);
      
      if (this.constantTimeCompare(token, expectedToken)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate QR code URL for Google Authenticator
   */
  generateQRCodeURL(secret: string, userEmail: string): string {
    const issuer = encodeURIComponent(this.appName);
    const label = encodeURIComponent(`${this.appName} (${userEmail})`);
    const secretParam = encodeURIComponent(secret);
    
    return `otpauth://totp/${label}?secret=${secretParam}&issuer=${issuer}&algorithm=SHA1&digits=${this.digits}&period=${this.period}`;
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Validate backup code format
   */
  validateBackupCode(code: string): boolean {
    return /^[A-F0-9]{8}$/.test(code.toUpperCase());
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

  /**
   * Base32 encoding
   */
  private base32Encode(buffer: Buffer): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      
      while (bits >= 5) {
        result += chars[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    
    if (bits > 0) {
      result += chars[(value << (5 - bits)) & 31];
    }
    
    return result;
  }

  /**
   * Base32 decoding
   */
  private base32Decode(encoded: string): Buffer {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    encoded = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
    
    let value = 0;
    let bits = 0;
    const result: number[] = [];
    
    for (let i = 0; i < encoded.length; i++) {
      const index = chars.indexOf(encoded[i]);
      if (index === -1) {
        throw new Error('Invalid base32 character');
      }
      
      value = (value << 5) | index;
      bits += 5;
      
      if (bits >= 8) {
        result.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    
    return Buffer.from(result);
  }
}

// Export singleton instance
export const totpService = new TOTPService();