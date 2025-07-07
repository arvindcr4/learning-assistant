import { NextRequest, NextResponse } from 'next/server';
// import { securityLogger } from '@/lib/logger'; // Removed due to Edge Runtime compatibility

// Middleware function type definitions
type SecurityMiddleware = (req: NextRequest) => NextResponse | null;
type ResponseSecurityMiddleware = (response: NextResponse, req: NextRequest) => NextResponse;

// Security configuration
interface SecurityConfig {
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  cors: {
    origin: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  csp: {
    defaultSrc: string[];
    scriptSrc: string[];
    styleSrc: string[];
    imgSrc: string[];
    connectSrc: string[];
    fontSrc: string[];
    frameSrc: string[];
    frameAncestors: string[];
  };
  headers: {
    hsts: boolean;
    noSniff: boolean;
    frameOptions: string;
    xssProtection: boolean;
    referrerPolicy: string;
    permissionsPolicy: string[];
  };
}

const securityConfig: SecurityConfig = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    skipSuccessfulRequests: false,
  },
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'DNT',
      'User-Agent',
      'X-Requested-With',
      'If-Modified-Since',
      'Cache-Control',
      'Content-Type',
      'Range',
      'Authorization',
    ],
  },
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      'https://apis.google.com',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
    ],
    styleSrc: [
      "'self'",
      'https://fonts.googleapis.com',
    ],
    imgSrc: [
      "'self'",
      'data:',
      'https:',
      'blob:',
    ],
    connectSrc: [
      "'self'",
      'https://api.openai.com',
      'https://analytics.google.com',
      'https://www.google-analytics.com',
    ],
    fontSrc: [
      "'self'",
      'https://fonts.gstatic.com',
    ],
    frameSrc: ["'none'"],
    frameAncestors: ["'self'"],
  },
  headers: {
    hsts: true,
    noSniff: true,
    frameOptions: 'SAMEORIGIN',
    xssProtection: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
    ],
  },
};

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up old rate limit entries (only in Node.js runtime)
if (typeof setInterval !== 'undefined') {
  try {
    setInterval(() => {
      const now = Date.now();
      rateLimitStore.forEach((value, key) => {
        if (now > value.resetTime) {
          rateLimitStore.delete(key);
        }
      });
    }, 60000); // Clean up every minute
  } catch (error) {
    // Ignore in Edge Runtime
  }
}

// Rate limiting function
const checkRateLimit = (req: NextRequest): boolean => {
  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const key = `rate_limit:${clientIp}`;
  const now = Date.now();
  
  const current = rateLimitStore.get(key);
  
  if (!current || now > current.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + securityConfig.rateLimit.windowMs,
    });
    return true;
  }
  
  if (current.count >= securityConfig.rateLimit.max) {
    // Rate limit exceeded
    console.warn('Rate limit exceeded', {
      ip: clientIp,
      path: req.nextUrl.pathname,
      userAgent: req.headers.get('user-agent'),
    });
    return false;
  }
  
  // Increment count
  current.count++;
  return true;
};

// CORS check function
const checkCors = (req: NextRequest): boolean => {
  const origin = req.headers.get('origin');
  
  if (!origin) {
    // Same-origin requests don't have origin header
    return true;
  }
  
  // Check if origin is allowed
  const isAllowed = securityConfig.cors.origin.includes('*') || 
                   securityConfig.cors.origin.includes(origin);
  
  if (!isAllowed) {
    console.warn('CORS violation', {
      origin,
      path: req.nextUrl.pathname,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    });
  }
  
  return isAllowed;
};

// Security headers function
const addSecurityHeaders = (response: NextResponse): void => {
  // HSTS
  if (securityConfig.headers.hsts) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Content Security Policy
  const cspDirectives = [
    `default-src ${securityConfig.csp.defaultSrc.join(' ')}`,
    `script-src ${securityConfig.csp.scriptSrc.join(' ')}`,
    `style-src ${securityConfig.csp.styleSrc.join(' ')}`,
    `img-src ${securityConfig.csp.imgSrc.join(' ')}`,
    `connect-src ${securityConfig.csp.connectSrc.join(' ')}`,
    `font-src ${securityConfig.csp.fontSrc.join(' ')}`,
    `frame-src ${securityConfig.csp.frameSrc.join(' ')}`,
    `frame-ancestors ${securityConfig.csp.frameAncestors.join(' ')}`,
  ];
  
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
  
  // X-Frame-Options
  response.headers.set('X-Frame-Options', securityConfig.headers.frameOptions);
  
  // X-Content-Type-Options
  if (securityConfig.headers.noSniff) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }
  
  // X-XSS-Protection
  if (securityConfig.headers.xssProtection) {
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', securityConfig.headers.referrerPolicy);
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    securityConfig.headers.permissionsPolicy.join(', ')
  );
  
  // Remove server information
  response.headers.delete('Server');
  response.headers.delete('X-Powered-By');
};

// CORS headers function
const addCorsHeaders = (response: NextResponse, origin?: string): void => {
  if (origin && securityConfig.cors.origin.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else if (securityConfig.cors.origin.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  
  response.headers.set(
    'Access-Control-Allow-Methods',
    securityConfig.cors.methods.join(', ')
  );
  
  response.headers.set(
    'Access-Control-Allow-Headers',
    securityConfig.cors.allowedHeaders.join(', ')
  );
  
  if (securityConfig.cors.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
};

// Suspicious request detection
const detectSuspiciousActivity = (req: NextRequest): boolean => {
  const userAgent = req.headers.get('user-agent') || '';
  const path = req.nextUrl.pathname;
  const method = req.method;
  
  // Check for common attack patterns
  const suspiciousPatterns = [
    /\b(union|select|insert|update|delete|drop|create|alter)\b/i, // SQL injection
    /<script|javascript:|onload=|onerror=/i, // XSS
    /\.\.|\/\.\./g, // Path traversal
    /\/wp-admin|\/admin|phpmyadmin/i, // Admin path scanning
    /\.(php|asp|jsp|cgi)$/i, // Server-side script access
  ];
  
  // Check path
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(path) || pattern.test(req.nextUrl.search)) {
      console.warn('Suspicious request detected', {
        pattern: pattern.toString(),
        path,
        method,
        userAgent,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      });
      return true;
    }
  }
  
  // Check for bot user agents
  const botPatterns = [
    /bot|crawler|spider|scraper/i,
    /curl|wget|python|java|perl/i,
  ];
  
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent) && !req.nextUrl.pathname.startsWith('/api/health')) {
      console.info('Bot request detected', {
        userAgent,
        path,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      });
      // Don't block bots, just log them
    }
  }
  
  return false;
};

// Input validation and sanitization
export const validateInput = (input: string, type: 'email' | 'url' | 'text' | 'number'): boolean => {
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    case 'url':
      try {
        new URL(input);
        return true;
      } catch {
        return false;
      }
    case 'text':
      // Check for dangerous characters
      return !/[<>'"&]/.test(input);
    case 'number':
      return /^\d+$/.test(input);
    default:
      return false;
  }
};

// Sanitize input
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>'"&]/g, (match) => {
      const entities: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };
      return entities[match] || match;
    })
    .trim();
};

// Main security middleware
export const securityMiddleware: SecurityMiddleware = (req: NextRequest): NextResponse | null => {
  // Skip security checks for health endpoint
  if (req.nextUrl.pathname === '/api/health') {
    return null;
  }
  
  // Check for suspicious activity
  if (detectSuspiciousActivity(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }
  
  // Check rate limit
  if (!checkRateLimit(req)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }
  
  // Check CORS for cross-origin requests
  const origin = req.headers.get('origin');
  if (origin && !checkCors(req)) {
    return new NextResponse('CORS Policy Violation', { status: 403 });
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    addCorsHeaders(response, origin || undefined);
    return response;
  }
  
  return null; // Continue to next middleware/handler
};

// Response security middleware
export const secureResponse: ResponseSecurityMiddleware = (response: NextResponse, req: NextRequest): NextResponse => {
  // Add security headers
  addSecurityHeaders(response);
  
  // Add CORS headers if needed
  const origin = req.headers.get('origin');
  if (origin) {
    addCorsHeaders(response, origin);
  }
  
  return response;
};

// JWT token validation (for API routes)
export const validateJWT = (token: string): boolean => {
  try {
    // In a real implementation, you would validate the JWT token
    // For now, we'll just check if it exists and has the right format
    const parts = token.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
};

// Session validation
export const validateSession = (req: NextRequest): boolean => {
  const sessionToken = req.cookies.get('session-token')?.value;
  
  if (!sessionToken) {
    return false;
  }
  
  // In a real implementation, you would validate the session
  // against your session store (Redis, database, etc.)
  return true;
};

// Export configuration for external use
export { securityConfig };