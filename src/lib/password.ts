import bcrypt from 'bcryptjs';

export class PasswordService {
  private readonly saltRounds: number;
  private readonly minLength: number;
  private readonly maxLength: number;

  constructor() {
    this.saltRounds = 12; // High salt rounds for security
    this.minLength = 8;
    this.maxLength = 128;
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    try {
      this.validatePassword(password);
      const salt = await bcrypt.genSalt(this.saltRounds);
      return await bcrypt.hash(password, salt);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!password || !hash) {
        return false;
      }
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Validate password strength and requirements
   */
  validatePassword(password: string): void {
    const errors: string[] = [];

    // Length validation
    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }

    if (password.length > this.maxLength) {
      errors.push(`Password must be no more than ${this.maxLength} characters long`);
    }

    // Character requirements
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password patterns
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password');
    }

    // Sequential characters
    if (this.hasSequentialCharacters(password)) {
      errors.push('Password should not contain sequential characters (e.g., 123, abc)');
    }

    // Repeated characters
    if (this.hasRepeatedCharacters(password)) {
      errors.push('Password should not contain excessive repeated characters');
    }

    if (errors.length > 0) {
      throw new Error(errors.join('. '));
    }
  }

  /**
   * Check if password is in common password list
   */
  private isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password', 'password123', '123456', '12345678', 'qwerty',
      'abc123', 'admin', 'welcome', 'login', 'passw0rd',
      'password1', 'letmein', 'monkey', 'dragon', 'football',
      'iloveyou', 'admin123', 'welcome123', 'sunshine', 'master',
      'shadow', 'ashley', 'mustang', 'starwars', 'jesus',
      'michael', 'superman', 'hello', 'charlie', 'aa123456',
      'donald', 'freedom', 'ninja', 'pass', 'baseball',
      'welcome1', 'access', 'whatever', 'princess', 'qwerty123',
      'zaq12wsx', 'trust', 'hockey', 'hunter', 'harley',
      'ranger', 'jordan', 'george', 'secret', 'maggie',
      'buster', 'daniel', 'thomas', 'matrix', 'hannah',
      'banana', 'fuckme', 'ginger', 'summer', 'michelle',
      'jessica', 'jordan23', 'tigger', 'joshua', 'butter',
      'purple', 'monster', 'yankee', 'rainbow', 'andrew',
      'lovers', 'robert', 'samantha', 'golden', 'richard',
      'benjamin', 'samsung', 'mother', 'dakota', 'arsenal',
      'chelsea', 'liverpool', 'manchester', 'juventus', 'madrid',
      'barcelona', 'valencia', 'liverpool1', 'arsenal1', 'chelsea1'
    ];

    return commonPasswords.some(common => 
      password.toLowerCase().includes(common.toLowerCase())
    );
  }

  /**
   * Check for sequential characters
   */
  private hasSequentialCharacters(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm'
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const seq = sequence.substring(i, i + 3);
        const revSeq = seq.split('').reverse().join('');
        
        if (password.toLowerCase().includes(seq) || password.toLowerCase().includes(revSeq)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check for excessive repeated characters
   */
  private hasRepeatedCharacters(password: string): boolean {
    let repeatedCount = 1;
    let maxRepeated = 1;

    for (let i = 1; i < password.length; i++) {
      if (password[i] === password[i - 1]) {
        repeatedCount++;
      } else {
        maxRepeated = Math.max(maxRepeated, repeatedCount);
        repeatedCount = 1;
      }
    }

    maxRepeated = Math.max(maxRepeated, repeatedCount);
    return maxRepeated >= 3; // Allow max 2 repeated characters
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest with random characters
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to avoid predictable patterns
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check if password needs to be rehashed (for security updates)
   */
  async needsRehash(hash: string): Promise<boolean> {
    try {
      const rounds = await bcrypt.getRounds(hash);
      return rounds < this.saltRounds;
    } catch (error) {
      // If we can't determine rounds, assume it needs rehashing
      return true;
    }
  }

  /**
   * Calculate password strength score (0-100)
   */
  calculatePasswordStrength(password: string): {
    score: number;
    feedback: string[];
    level: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong';
  } {
    let score = 0;
    const feedback: string[] = [];

    // Length scoring
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 10;
    if (password.length >= 16) score += 10;
    if (password.length < 8) feedback.push('Use at least 8 characters');

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 10;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 10;
    else feedback.push('Include uppercase letters');

    if (/\d/.test(password)) score += 10;
    else feedback.push('Include numbers');

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 15;
    else feedback.push('Include special characters');

    // Complexity scoring
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) score += 15;
    else feedback.push('Avoid too many repeated characters');

    // Avoid common patterns
    if (!this.isCommonPassword(password)) score += 10;
    else feedback.push('Avoid common passwords');

    if (!this.hasSequentialCharacters(password)) score += 10;
    else feedback.push('Avoid sequential characters');

    // Determine level
    let level: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong';
    if (score < 30) level = 'weak';
    else if (score < 50) level = 'fair';
    else if (score < 70) level = 'good';
    else if (score < 90) level = 'strong';
    else level = 'very_strong';

    return { score, feedback, level };
  }
}

// Export singleton instance
export const passwordService = new PasswordService();

// Export utility functions
export const {
  hashPassword,
  verifyPassword,
  validatePassword,
  generateSecurePassword,
  needsRehash,
  calculatePasswordStrength,
} = passwordService;