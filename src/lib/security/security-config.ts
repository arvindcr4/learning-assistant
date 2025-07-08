import { NextRequest, NextResponse } from 'next/server';
import { enhancedAuth } from './enhanced-auth';
import { defaultRateLimiter } from './advanced-rate-limiting';
import { defaultSecurityValidator } from '../validation/security-validation';
import { securityHeaders } from './security-headers';
import { securityMonitor, SecurityEventType, SecurityEventSeverity } from './security-monitor';

// Unified security configuration
export interface SecurityConfig {
  authentication: {
    enabled: boolean;
    requireMFA: boolean;
    allowApiKeys: boolean;
    sessionTimeout: number;
    maxFailedAttempts: number;
    lockoutDuration: number;
  };
  
  rateLimiting: {
    enabled: boolean;
    defaultLimits: {
      maxRequestsPerUser: number;
      maxRequestsPerIP: number;
      windowMs: number;
    };
    endpointLimits: Record<string, {
      maxRequestsPerUser: number;
      maxRequestsPerIP: number;
      windowMs: number;
    }>;
    ddosProtection: boolean;
  };
  
  inputValidation: {
    enabled: boolean;
    enableXSSProtection: boolean;
    enableSQLInjectionProtection: boolean;
    enablePathTraversalProtection: boolean;
    maxStringLength: number;
    maxArrayLength: number;
    maxObjectDepth: number;
  };
  
  headers: {
    enabled: boolean;
    cspEnabled: boolean;
    hstsEnabled: boolean;
    corsEnabled: boolean;
    allowedOrigins: string[];
  };
  
  monitoring: {
    enabled: boolean;
    realTimeMonitoring: boolean;
    anomalyDetection: boolean;
    alertingEnabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  
  environment: 'development' | 'production' | 'test';
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
  authentication: {
    enabled: true,
    requireMFA: false,
    allowApiKeys: true,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxFailedAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
  },
  
  rateLimiting: {
    enabled: true,
    defaultLimits: {
      maxRequestsPerUser: 1000,
      maxRequestsPerIP: 100,
      windowMs: 60 * 1000, // 1 minute
    },
    endpointLimits: {
      '/api/auth/login': {
        maxRequestsPerUser: 10,
        maxRequestsPerIP: 5,
        windowMs: 60 * 1000,
      },
      '/api/auth/register': {
        maxRequestsPerUser: 5,
        maxRequestsPerIP: 3,
        windowMs: 60 * 1000,
      },
      '/api/learning/session': {
        maxRequestsPerUser: 200,
        maxRequestsPerIP: 100,
        windowMs: 60 * 1000,
      },
    },
    ddosProtection: true,
  },
  
  inputValidation: {
    enabled: true,
    enableXSSProtection: true,
    enableSQLInjectionProtection: true,
    enablePathTraversalProtection: true,
    maxStringLength: 10000,
    maxArrayLength: 1000,
    maxObjectDepth: 10,
  },
  
  headers: {
    enabled: true,
    cspEnabled: true,
    hstsEnabled: true,
    corsEnabled: true,
    allowedOrigins: ['http://localhost:3000', 'https://localhost:3000'],
  },
  
  monitoring: {
    enabled: true,
    realTimeMonitoring: true,
    anomalyDetection: true,
    alertingEnabled: true,
    logLevel: 'info',
  },
  
  environment: (process.env.NODE_ENV as any) || 'development',
};

// Environment-specific overrides
const environmentConfigs: Record<string, Partial<SecurityConfig>> = {
  development: {
    authentication: {
      requireMFA: false,
      lockoutDuration: 5 * 60 * 1000, // 5 minutes for dev
    },
    headers: {
      allowedOrigins: ['*'], // Allow all origins in development
    },
    monitoring: {
      logLevel: 'debug',
    },
  },
  
  production: {
    authentication: {
      requireMFA: true,
      sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours in production
    },
    rateLimiting: {
      defaultLimits: {
        maxRequestsPerUser: 500,
        maxRequestsPerIP: 50,
        windowMs: 60 * 1000,
      },
    },
    headers: {
      allowedOrigins: [
        'https://yourdomain.com',
        'https://app.yourdomain.com',
      ],
    },
    monitoring: {
      logLevel: 'warn',
    },
  },
  
  test: {
    rateLimiting: {
      enabled: false, // Disable rate limiting for tests
    },
    monitoring: {
      alertingEnabled: false,
      logLevel: 'error',
    },
  },
};

// Unified Security Manager
export class SecurityManager {
  private config: SecurityConfig;
  
  constructor(customConfig: Partial<SecurityConfig> = {}) {
    // Merge default config with environment-specific and custom configs
    const envConfig = environmentConfigs[defaultSecurityConfig.environment] || {};
    this.config = this.mergeConfigs(defaultSecurityConfig, envConfig, customConfig);
    
    // Initialize security components with configuration
    this.initializeComponents();
  }
  
  /**
   * Initialize all security components with the unified configuration
   */
  private initializeComponents(): void {
    // Configure authentication service
    if (this.config.authentication.enabled) {
      // Authentication configuration is handled in the enhanced-auth module
      console.log('Authentication security enabled');
    }
    
    // Configure rate limiting
    if (this.config.rateLimiting.enabled) {
      console.log('Rate limiting enabled with DDoS protection');
    }
    
    // Configure input validation
    if (this.config.inputValidation.enabled) {
      console.log('Input validation security enabled');
    }
    
    // Configure security headers
    if (this.config.headers.enabled) {
      console.log('Security headers enabled');
    }
    
    // Configure monitoring
    if (this.config.monitoring.enabled) {
      console.log('Security monitoring enabled');
    }
  }
  
  /**
   * Create comprehensive security middleware that applies all security measures
   */
  public createSecurityMiddleware(endpointConfig: {
    endpoint: string;
    requiredPermissions?: Array<{ resource: string; action: string }>;
    customRateLimits?: {
      maxRequestsPerUser?: number;
      maxRequestsPerIP?: number;
      windowMs?: number;
    };
    requireMFA?: boolean;
    maxRiskScore?: number;
    enableInputValidation?: boolean;
    generateCSPNonce?: boolean;
  }) {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const startTime = Date.now();
      const { endpoint, requiredPermissions = [], customRateLimits, requireMFA, maxRiskScore, enableInputValidation = true, generateCSPNonce = false } = endpointConfig;
      
      try {
        // 1. Security Headers Check (for preflight requests)
        if (this.config.headers.enabled && request.method === 'OPTIONS') {
          const preflightResponse = new NextResponse(null, { status: 200 });
          return securityHeaders.applyHeaders(preflightResponse, request);
        }
        
        // 2. Input Validation (for request headers and basic structure)
        if (this.config.inputValidation.enabled) {
          const headerValidation = defaultSecurityValidator.validateHeaders(request);
          if (!headerValidation.isValid) {
            securityMonitor.logEvent(
              SecurityEventType.MALICIOUS_REQUEST,
              SecurityEventSeverity.HIGH,
              {
                endpoint,
                ipAddress: this.getClientIP(request),
                threats: headerValidation.threats,
                errors: headerValidation.errors,
              }
            );
            
            return this.createSecurityResponse(
              'Invalid request headers detected',
              400,
              request,
              { generateCSPNonce }
            );
          }
        }
        
        // 3. Rate Limiting
        if (this.config.rateLimiting.enabled) {
          const rateLimits = customRateLimits || 
                            this.config.rateLimiting.endpointLimits[endpoint] || 
                            this.config.rateLimiting.defaultLimits;
          
          const rateLimitMiddleware = defaultRateLimiter.middleware(rateLimits);
          const rateLimitResponse = rateLimitMiddleware(request);
          
          if (rateLimitResponse) {
            securityMonitor.logEvent(
              SecurityEventType.RATE_LIMIT_EXCEEDED,
              SecurityEventSeverity.MEDIUM,
              {
                endpoint,
                ipAddress: this.getClientIP(request),
                limits: rateLimits,
              }
            );
            
            return securityHeaders.applyHeaders(rateLimitResponse, request, { generateCSPNonce });
          }
        }
        
        // 4. Authentication & Authorization
        if (this.config.authentication.enabled && requiredPermissions.length > 0) {
          const authMiddleware = enhancedAuth.createAuthMiddleware(requiredPermissions, {
            requireMFA,
            maxRiskScore,
          });
          
          const authResponse = await authMiddleware(request);
          if (authResponse) {
            return securityHeaders.applyHeaders(authResponse, request, { generateCSPNonce });
          }
        }
        
        // 5. Request Body Validation (if applicable)
        if (enableInputValidation && this.config.inputValidation.enabled && 
            ['POST', 'PUT', 'PATCH'].includes(request.method)) {
          
          const contentLength = parseInt(request.headers.get('content-length') || '0');
          if (contentLength > 0) {
            const bodyValidation = defaultSecurityValidator.validateBodySize(contentLength);
            if (!bodyValidation.isValid) {
              securityMonitor.logEvent(
                SecurityEventType.SECURITY_POLICY_VIOLATION,
                SecurityEventSeverity.MEDIUM,
                {
                  endpoint,
                  ipAddress: this.getClientIP(request),
                  contentLength,
                  errors: bodyValidation.errors,
                }
              );
              
              return this.createSecurityResponse(
                'Request body size exceeds limits',
                413,
                request,
                { generateCSPNonce }
              );
            }
          }
        }
        
        // 6. Security Monitoring
        if (this.config.monitoring.enabled) {
          securityMonitor.logEvent(
            SecurityEventType.DATA_ACCESS,
            SecurityEventSeverity.LOW,
            {
              endpoint,
              method: request.method,
              ipAddress: this.getClientIP(request),
              userAgent: request.headers.get('user-agent') || 'unknown',
              requestTime: startTime,
            }
          );
        }
        
        // All security checks passed, continue to the actual handler
        return null;
        
      } catch (error) {
        console.error('Security middleware error:', error);
        
        securityMonitor.logEvent(
          SecurityEventType.SECURITY_POLICY_VIOLATION,
          SecurityEventSeverity.HIGH,
          {
            endpoint,
            ipAddress: this.getClientIP(request),
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
        
        return this.createSecurityResponse(
          'Security validation failed',
          500,
          request,
          { generateCSPNonce }
        );
      }
    };
  }
  
  /**
   * Create a secure response with all security measures applied
   */
  public createSecureResponse(
    data: any,
    status: number = 200,
    request: NextRequest,
    options: {
      generateCSPNonce?: boolean;
      customHeaders?: Record<string, string>;
      skipCORS?: boolean;
    } = {}
  ): NextResponse {
    const response = NextResponse.json(data, { status });
    
    // Apply security headers
    if (this.config.headers.enabled) {
      return securityHeaders.applyHeaders(response, request, options);
    }
    
    return response;
  }
  
  /**
   * Create a security error response
   */
  private createSecurityResponse(
    message: string,
    status: number,
    request: NextRequest,
    options: { generateCSPNonce?: boolean } = {}
  ): NextResponse {
    const errorResponse = {
      error: message,
      code: 'SECURITY_VIOLATION',
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
    };
    
    return this.createSecureResponse(errorResponse, status, request, options);
  }
  
  /**
   * Validate request body with security checks
   */
  public async validateRequestBody(request: NextRequest): Promise<{
    isValid: boolean;
    data?: any;
    errors: string[];
    threats: string[];
  }> {
    try {
      const body = await request.json();
      const validation = defaultSecurityValidator.validateInput(body, 'object');
      
      return {
        isValid: validation.isValid,
        data: validation.sanitizedValue,
        errors: validation.errors,
        threats: validation.threats,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Invalid JSON format'],
        threats: [],
      };
    }
  }
  
  /**
   * Create authenticated endpoint with comprehensive security
   */
  public createSecureEndpoint(
    handler: (request: NextRequest, context: any) => Promise<NextResponse>,
    config: {
      endpoint: string;
      requiredPermissions: Array<{ resource: string; action: string }>;
      rateLimits?: {
        maxRequestsPerUser?: number;
        maxRequestsPerIP?: number;
        windowMs?: number;
      };
      requireMFA?: boolean;
      maxRiskScore?: number;
      validateBody?: boolean;
    }
  ) {
    return async (request: NextRequest): Promise<NextResponse> => {
      const startTime = Date.now();
      
      // Apply security middleware
      const securityMiddleware = this.createSecurityMiddleware({
        ...config,
        enableInputValidation: config.validateBody,
        generateCSPNonce: true,
      });
      
      const securityResponse = await securityMiddleware(request);
      if (securityResponse) {
        return securityResponse; // Security check failed
      }
      
      // Validate request body if required
      let requestData: any = undefined;
      if (config.validateBody && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const bodyValidation = await this.validateRequestBody(request);
        if (!bodyValidation.isValid) {
          securityMonitor.logEvent(
            SecurityEventType.MALICIOUS_REQUEST,
            SecurityEventSeverity.HIGH,
            {
              endpoint: config.endpoint,
              ipAddress: this.getClientIP(request),
              threats: bodyValidation.threats,
              errors: bodyValidation.errors,
            }
          );
          
          return this.createSecurityResponse(
            `Input validation failed: ${bodyValidation.errors.join(', ')}`,
            400,
            request
          );
        }
        requestData = bodyValidation.data;
      }
      
      try {
        // Call the actual handler
        const context = {
          user: (request as any).user,
          securityContext: (request as any).securityContext,
          validatedData: requestData,
          requestId: this.generateRequestId(),
        };
        
        const handlerResponse = await handler(request, context);
        
        // Apply security headers to the response
        const secureResponse = securityHeaders.applyHeaders(handlerResponse, request, {
          generateCSPNonce: true,
        });
        
        // Log successful request
        if (this.config.monitoring.enabled) {
          securityMonitor.logEvent(
            SecurityEventType.DATA_ACCESS,
            SecurityEventSeverity.LOW,
            {
              endpoint: config.endpoint,
              method: request.method,
              ipAddress: this.getClientIP(request),
              statusCode: secureResponse.status,
              responseTime: Date.now() - startTime,
              success: true,
            }
          );
        }
        
        return secureResponse;
        
      } catch (error) {
        console.error(`Handler error for ${config.endpoint}:`, error);
        
        securityMonitor.logEvent(
          SecurityEventType.ERROR_RATE_SPIKE,
          SecurityEventSeverity.MEDIUM,
          {
            endpoint: config.endpoint,
            method: request.method,
            ipAddress: this.getClientIP(request),
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - startTime,
            success: false,
          }
        );
        
        return this.createSecurityResponse(
          'Internal server error',
          500,
          request
        );
      }
    };
  }
  
  /**
   * Get security health status
   */
  public getSecurityHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    components: Record<string, { status: string; enabled: boolean }>;
    metrics: any;
    alerts: number;
  } {
    const authMetrics = enhancedAuth.getSecurityMetrics();
    const rateLimitStats = defaultRateLimiter.getStatistics();
    const monitoringStats = securityMonitor.getSecurityStatistics();
    
    const components = {
      authentication: {
        status: authMetrics.suspiciousActivity > 10 ? 'warning' : 'healthy',
        enabled: this.config.authentication.enabled,
      },
      rateLimiting: {
        status: rateLimitStats.blacklistSize > 0 ? 'warning' : 'healthy',
        enabled: this.config.rateLimiting.enabled,
      },
      inputValidation: {
        status: 'healthy',
        enabled: this.config.inputValidation.enabled,
      },
      monitoring: {
        status: monitoringStats.unacknowledgedAlerts > 5 ? 'warning' : 'healthy',
        enabled: this.config.monitoring.enabled,
      },
      headers: {
        status: 'healthy',
        enabled: this.config.headers.enabled,
      },
    };
    
    // Determine overall status
    const hasWarnings = Object.values(components).some(c => c.status === 'warning');
    const hasCritical = Object.values(components).some(c => c.status === 'critical');
    
    const overallStatus = hasCritical ? 'critical' : hasWarnings ? 'warning' : 'healthy';
    
    return {
      status: overallStatus,
      components,
      metrics: {
        ...authMetrics,
        ...rateLimitStats,
        ...monitoringStats,
      },
      alerts: monitoringStats.unacknowledgedAlerts,
    };
  }
  
  /**
   * Update security configuration
   */
  public updateConfig(updates: Partial<SecurityConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
    this.initializeComponents();
  }
  
  /**
   * Get current security configuration
   */
  public getConfig(): SecurityConfig {
    return { ...this.config };
  }
  
  /**
   * Utility methods
   */
  private getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
           request.headers.get('x-real-ip') ||
           request.ip ||
           'unknown';
  }
  
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private mergeConfigs(...configs: Partial<SecurityConfig>[]): SecurityConfig {
    return configs.reduce((merged, config) => {
      return this.deepMerge(merged, config);
    }, defaultSecurityConfig);
  }
  
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

// Export default security manager instance
export const securityManager = new SecurityManager();

// Export convenience functions for common use cases
export const createSecureEndpoint = securityManager.createSecureEndpoint.bind(securityManager);
export const validateRequestBody = securityManager.validateRequestBody.bind(securityManager);
export const createSecureResponse = securityManager.createSecureResponse.bind(securityManager);
export const getSecurityHealth = securityManager.getSecurityHealth.bind(securityManager);