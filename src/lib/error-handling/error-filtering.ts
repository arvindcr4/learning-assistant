import { env } from '../env-validation';

// Error filtering configuration
export interface ErrorFilterConfig {
  ignoreErrors: string[];
  denyUrls: string[];
  allowUrls: string[];
  ignoreBots: boolean;
  ignoreLocalhost: boolean;
  maxErrorsPerMinute: number;
  maxSimilarErrors: number;
  sensitiveDataPatterns: RegExp[];
}

// Default error filtering configuration
export const defaultErrorFilterConfig: ErrorFilterConfig = {
  ignoreErrors: [
    // Network errors
    'Network request failed',
    'NetworkError',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED',
    'Load failed',
    'Loading chunk',
    'Loading CSS chunk',
    'ChunkLoadError',
    
    // Browser/Extension errors
    'Script error',
    'Script error.',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    
    // Ad blockers
    'blocked by client',
    'blocked by adblocker',
    
    // Browser extensions
    'extension',
    'extensions/',
    'chrome-extension',
    'moz-extension',
    'safari-extension',
    
    // Development errors
    'HMR',
    'Hot reload',
    'Fast refresh',
    
    // React DevTools
    'react-devtools',
    '__REACT_DEVTOOLS_GLOBAL_HOOK__',
    
    // Console API usage
    'console.clear',
    'console is not defined',
    
    // Specific browser quirks
    'SecurityError: DOM Exception 18',
    'Permission denied to access property',
    'The operation is insecure',
    
    // Mobile browser issues
    'Possible side-effect in debug-evaluate',
    'atomicSelection',
    
    // Service Worker errors
    'ServiceWorker script evaluation failed',
    'ServiceWorker registration failed',
    
    // Firebase/External service errors that are transient
    'Firebase: No Firebase App',
    'auth/network-request-failed',
    
    // CSS/Style errors
    'css is not defined',
    'getComputedStyle',
    
    // AbortController/Signal errors
    'AbortError',
    'The operation was aborted',
  ],
  
  denyUrls: [
    // Browser extensions
    /^chrome-extension:/,
    /^moz-extension:/,
    /^safari-extension:/,
    /^webkit-masked-url:/,
    
    // Development tools
    /localhost:\d+\/_next\/static\/chunks\/webpack\.js/,
    /\/_next\/static\/chunks\/.*\.hot-update\.js/,
    
    // Third-party scripts that shouldn't report errors
    /google-analytics\.com/,
    /googletagmanager\.com/,
    /facebook\.net/,
    /connect\.facebook\.net/,
    /platform\.twitter\.com/,
    
    // Ad networks
    /doubleclick\.net/,
    /googlesyndication\.com/,
    /amazon-adsystem\.com/,
    
    // CDNs with frequent issues
    /unpkg\.com/,
    /jsdelivr\.net/,
    
    // Bots and crawlers
    /bot|crawler|spider|scraper/i,
  ],
  
  allowUrls: [
    // Your domain
    /^https?:\/\/([^\.]+\.)?your-domain\.com/,
    
    // Development
    /^https?:\/\/localhost/,
    /^https?:\/\/127\.0\.0\.1/,
    /^https?:\/\/0\.0\.0\.0/,
    
    // Staging/Preview environments
    /\.vercel\.app$/,
    /\.netlify\.app$/,
    /\.railway\.app$/,
    /\.fly\.dev$/,
    
    // CDN assets
    /^https:\/\/cdn\./,
    /^https:\/\/assets\./,
  ],
  
  ignoreBots: true,
  ignoreLocalhost: false,
  maxErrorsPerMinute: 50,
  maxSimilarErrors: 5,
  
  sensitiveDataPatterns: [
    // API keys and tokens
    /api[_-]?key[s]?[\s]*[:=][\s]*['"]?[a-zA-Z0-9-_]{10,}['"]?/gi,
    /bearer[\s]+[a-zA-Z0-9\-_\.]+/gi,
    /token[\s]*[:=][\s]*['"]?[a-zA-Z0-9-_]{10,}['"]?/gi,
    
    // Passwords
    /password[\s]*[:=][\s]*['"]?[^\s'"]{6,}['"]?/gi,
    /passwd[\s]*[:=][\s]*['"]?[^\s'"]{6,}['"]?/gi,
    
    // Email addresses
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    
    // Credit card numbers
    /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    
    // Social Security Numbers
    /\b\d{3}-\d{2}-\d{4}\b/g,
    
    // Phone numbers
    /\b\d{3}-\d{3}-\d{4}\b/g,
    /\(\d{3}\)\s?\d{3}-\d{4}/g,
    
    // URLs with sensitive data
    /https?:\/\/[^\s]*(?:password|token|key|secret)[^\s]*/gi,
  ],
};

// Error rate limiting
class ErrorRateLimiter {
  private errorCounts = new Map<string, number>();
  private similarErrors = new Map<string, number>();
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 60000; // 1 minute

  shouldAllowError(errorMessage: string, config: ErrorFilterConfig): boolean {
    this.cleanup();
    
    // Check rate limiting
    const now = Math.floor(Date.now() / 60000); // Current minute
    const key = `${now}:${errorMessage}`;
    const count = this.errorCounts.get(key) || 0;
    
    if (count >= config.maxErrorsPerMinute) {
      return false;
    }
    
    this.errorCounts.set(key, count + 1);
    
    // Check similar errors
    const similarKey = this.getSimilarErrorKey(errorMessage);
    const similarCount = this.similarErrors.get(similarKey) || 0;
    
    if (similarCount >= config.maxSimilarErrors) {
      return false;
    }
    
    this.similarErrors.set(similarKey, similarCount + 1);
    
    return true;
  }
  
  private getSimilarErrorKey(errorMessage: string): string {
    // Normalize error message to group similar errors
    return errorMessage
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\s+/g, ' ') // Normalize whitespace
      .toLowerCase()
      .slice(0, 100); // Limit length
  }
  
  private cleanup() {
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.errorCounts.clear();
      this.similarErrors.clear();
      this.lastCleanup = now;
    }
  }
}

const rateLimiter = new ErrorRateLimiter();

// Main error filtering function
export function shouldCaptureError(
  error: Error,
  context?: {
    url?: string;
    userAgent?: string;
    userId?: string;
  },
  customConfig?: Partial<ErrorFilterConfig>
): boolean {
  const config = { ...defaultErrorFilterConfig, ...customConfig };
  
  // Get error details
  const errorMessage = error.message || error.toString();
  const errorStack = error.stack || '';
  const url = context?.url || (typeof window !== 'undefined' ? window.location.href : '');
  const userAgent = context?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  
  // Check rate limiting first
  if (!rateLimiter.shouldAllowError(errorMessage, config)) {
    return false;
  }
  
  // 1. Check ignored error messages
  for (const ignorePattern of config.ignoreErrors) {
    if (typeof ignorePattern === 'string') {
      if (errorMessage.includes(ignorePattern) || errorStack.includes(ignorePattern)) {
        return false;
      }
    } else if (ignorePattern instanceof RegExp) {
      if (ignorePattern.test(errorMessage) || ignorePattern.test(errorStack)) {
        return false;
      }
    }
  }
  
  // 2. Check URL filtering
  if (url) {
    // Check deny list
    for (const denyPattern of config.denyUrls) {
      if (denyPattern.test(url)) {
        return false;
      }
    }
    
    // Check allow list (if not empty)
    if (config.allowUrls.length > 0) {
      const isAllowed = config.allowUrls.some(pattern => pattern.test(url));
      if (!isAllowed) {
        return false;
      }
    }
    
    // Check localhost filtering
    if (config.ignoreLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(url)) {
      return false;
    }
  }
  
  // 3. Check bot filtering
  if (config.ignoreBots && userAgent) {
    const botPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|perl/i,
      /lighthouse|pagespeed|gtmetrix/i,
      /facebook|twitter|linkedin|pinterest|whatsapp/i,
      /googlebot|bingbot|slurp|duckduckbot/i,
    ];
    
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      return false;
    }
  }
  
  // 4. Check for sensitive data in error message
  const sanitizedMessage = sanitizeErrorMessage(errorMessage, config.sensitiveDataPatterns);
  if (sanitizedMessage !== errorMessage) {
    // Create new error with sanitized message
    const sanitizedError = new Error(sanitizedMessage);
    sanitizedError.stack = sanitizeErrorMessage(errorStack, config.sensitiveDataPatterns);
    Object.assign(error, sanitizedError);
  }
  
  return true;
}

// Sanitize error messages to remove sensitive data
export function sanitizeErrorMessage(message: string, patterns: RegExp[]): string {
  let sanitized = message;
  
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Replace with placeholder but keep structure
      if (match.includes('@')) return '[EMAIL_REDACTED]';
      if (match.includes('token') || match.includes('key')) return '[TOKEN_REDACTED]';
      if (match.includes('password')) return '[PASSWORD_REDACTED]';
      return '[SENSITIVE_DATA_REDACTED]';
    });
  }
  
  return sanitized;
}

// Configure error filtering from environment variables
export function getErrorFilterConfigFromEnv(): Partial<ErrorFilterConfig> {
  const config: Partial<ErrorFilterConfig> = {};
  
  if (env.SENTRY_IGNORE_ERRORS) {
    config.ignoreErrors = env.SENTRY_IGNORE_ERRORS.split(',').map(s => s.trim());
  }
  
  if (env.SENTRY_DENY_URLS) {
    config.denyUrls = env.SENTRY_DENY_URLS.split(',').map(s => new RegExp(s.trim()));
  }
  
  if (env.SENTRY_ALLOW_URLS) {
    config.allowUrls = env.SENTRY_ALLOW_URLS.split(',').map(s => new RegExp(s.trim()));
  }
  
  // Environment-specific settings
  if (env.NODE_ENV === 'development') {
    config.ignoreLocalhost = false;
    config.maxErrorsPerMinute = 100; // More lenient in development
  } else if (env.NODE_ENV === 'production') {
    config.ignoreBots = true;
    config.ignoreLocalhost = true;
    config.maxErrorsPerMinute = 20; // Stricter in production
  }
  
  return config;
}

// Specialized filters for different error types
export function shouldCaptureApiError(
  error: Error,
  statusCode?: number,
  endpoint?: string
): boolean {
  // Don't capture certain HTTP errors
  if (statusCode) {
    // Don't capture client errors (4xx) except authentication issues
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 401 && statusCode !== 403) {
      return false;
    }
    
    // Don't capture rate limiting errors
    if (statusCode === 429) {
      return false;
    }
  }
  
  // Don't capture health check errors
  if (endpoint && endpoint.includes('/health')) {
    return false;
  }
  
  return shouldCaptureError(error);
}

export function shouldCaptureAuthError(
  error: Error,
  action: string
): boolean {
  const ignoredAuthErrors = [
    'Invalid credentials',
    'User not found',
    'Email already exists',
    'Weak password',
    'Token expired',
  ];
  
  // Don't capture expected auth errors
  if (ignoredAuthErrors.some(ignored => error.message.includes(ignored))) {
    return false;
  }
  
  return shouldCaptureError(error);
}

export function shouldCaptureLearningError(
  error: Error,
  sessionId?: string
): boolean {
  // Always capture learning session errors for debugging
  return shouldCaptureError(error);
}

export default {
  shouldCaptureError,
  shouldCaptureApiError,
  shouldCaptureAuthError,
  shouldCaptureLearningError,
  sanitizeErrorMessage,
  getErrorFilterConfigFromEnv,
  defaultErrorFilterConfig,
};