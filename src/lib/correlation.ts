import { v4 as uuidv4 } from 'uuid';
import { NextRequest } from 'next/server';

// Conditional import for Node.js environments
let AsyncLocalStorage: any;

// Check if we're in a Node.js environment with async_hooks support
const isNodeEnvironment = typeof process !== 'undefined' && 
  process.versions?.node && 
  typeof require !== 'undefined';

if (isNodeEnvironment) {
  try {
    // Use dynamic import approach to avoid webpack bundling issues
    const asyncHooksModule = eval('require')('async_hooks');
    AsyncLocalStorage = asyncHooksModule.AsyncLocalStorage;
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Correlation] AsyncLocalStorage loaded successfully');
    }
  } catch (error) {
    // async_hooks not available, use fallback
    AsyncLocalStorage = null;
    
    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Correlation] async_hooks not available, using fallback context');
    }
  }
} else {
  // Not in Node.js environment (Edge Runtime, browser, etc.)
  AsyncLocalStorage = null;
  
  // Debug logging in development
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log('[Correlation] Not in Node.js environment, using fallback context');
  }
}

// Correlation context interface
export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  startTime?: number;
  metadata?: Record<string, any>;
}

// Async local storage for correlation context with fallback
const correlationStorage = AsyncLocalStorage ? new AsyncLocalStorage<CorrelationContext>() : null;

// Fallback storage for environments without async_hooks
let fallbackContext: CorrelationContext | undefined;

// Correlation ID utilities
export class CorrelationManager {
  private static instance: CorrelationManager;
  
  private constructor() {}
  
  static getInstance(): CorrelationManager {
    if (!CorrelationManager.instance) {
      CorrelationManager.instance = new CorrelationManager();
    }
    return CorrelationManager.instance;
  }
  
  // Generate a new correlation ID
  generateCorrelationId(): string {
    return uuidv4();
  }
  
  // Generate a new trace ID
  generateTraceId(): string {
    return uuidv4().replace(/-/g, '');
  }
  
  // Generate a new span ID
  generateSpanId(): string {
    return Math.random().toString(16).slice(2, 10);
  }
  
  // Get current correlation context
  getCurrentContext(): CorrelationContext | undefined {
    return correlationStorage?.getStore() || fallbackContext;
  }
  
  // Set correlation context
  setContext(context: CorrelationContext): void {
    if (correlationStorage) {
      correlationStorage.enterWith(context);
    } else {
      fallbackContext = context;
    }
  }
  
  // Run code with correlation context
  runWithContext<T>(context: CorrelationContext, callback: () => T): T {
    if (correlationStorage) {
      return correlationStorage.run(context, callback);
    } else {
      // Use fallback context for environments without async_hooks
      const previousContext = fallbackContext;
      fallbackContext = context;
      try {
        return callback();
      } finally {
        fallbackContext = previousContext;
      }
    }
  }
  
  // Extract correlation context from request headers
  extractFromHeaders(request: NextRequest | Request): Partial<CorrelationContext> {
    const headers = request.headers;
    
    return {
      correlationId: this.getHeaderValue(headers, 'x-correlation-id'),
      traceId: this.getHeaderValue(headers, 'x-trace-id'),
      spanId: this.getHeaderValue(headers, 'x-span-id'),
      parentSpanId: this.getHeaderValue(headers, 'x-parent-span-id'),
      requestId: this.getHeaderValue(headers, 'x-request-id'),
    };
  }
  
  private getHeaderValue(headers: Headers, key: string): string | undefined {
    return headers.get(key) || undefined;
  }
  
  // Create a new child span context
  createChildSpan(operation: string, metadata?: Record<string, any>): CorrelationContext {
    const currentContext = this.getCurrentContext();
    const traceId = currentContext?.traceId || this.generateTraceId();
    const parentSpanId = currentContext?.spanId;
    const spanId = this.generateSpanId();
    
    return {
      correlationId: currentContext?.correlationId || this.generateCorrelationId(),
      traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: Date.now(),
      userId: currentContext?.userId,
      sessionId: currentContext?.sessionId,
      requestId: currentContext?.requestId,
      metadata: {
        ...currentContext?.metadata,
        ...metadata,
      },
    };
  }
  
  // Get correlation data for logging
  getLoggingContext(): Record<string, any> {
    const context = this.getCurrentContext();
    if (!context) return {};
    
    return {
      correlationId: context.correlationId,
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId,
      operation: context.operation,
      metadata: context.metadata,
    };
  }
  
  // Calculate span duration
  calculateSpanDuration(context: CorrelationContext): number {
    if (!context.startTime) return 0;
    return Date.now() - context.startTime;
  }

  // Check if async_hooks is available
  isAsyncHooksAvailable(): boolean {
    return correlationStorage !== null;
  }

  // Get correlation storage type (for debugging)
  getStorageType(): 'async_hooks' | 'fallback' {
    return correlationStorage ? 'async_hooks' : 'fallback';
  }
}

// Singleton instance
export const correlationManager = CorrelationManager.getInstance();

// Correlation middleware for Next.js API routes
export function correlationMiddleware(req: any, res: any, next: () => void) {
  const extractedContext = correlationManager.extractFromHeaders(req);
  
  // Create or use existing correlation context
  const context: CorrelationContext = {
    correlationId: extractedContext.correlationId || correlationManager.generateCorrelationId(),
    traceId: extractedContext.traceId || correlationManager.generateTraceId(),
    spanId: correlationManager.generateSpanId(),
    parentSpanId: extractedContext.parentSpanId,
    requestId: extractedContext.requestId || correlationManager.generateCorrelationId(),
    operation: `${req.method} ${req.url}`,
    startTime: Date.now(),
    userId: req.user?.id || req.userId,
    sessionId: req.sessionId || req.headers['x-session-id'],
  };
  
  // Add correlation headers to response
  res.setHeader('X-Correlation-Id', context.correlationId);
  res.setHeader('X-Trace-Id', context.traceId);
  res.setHeader('X-Span-Id', context.spanId);
  res.setHeader('X-Request-Id', context.requestId);
  
  // Run the request handler with correlation context
  correlationManager.runWithContext(context, () => {
    // Add correlation data to request object for easy access
    req.correlationId = context.correlationId;
    req.traceId = context.traceId;
    req.spanId = context.spanId;
    req.requestId = context.requestId;
    
    next();
  });
}

// Next.js middleware for app router
export function withCorrelation<T extends (...args: any[]) => any>(
  handler: T
): T {
  return ((...args: Parameters<T>) => {
    const [req] = args;
    
    const extractedContext = correlationManager.extractFromHeaders(req);
    
    const context: CorrelationContext = {
      correlationId: extractedContext.correlationId || correlationManager.generateCorrelationId(),
      traceId: extractedContext.traceId || correlationManager.generateTraceId(),
      spanId: correlationManager.generateSpanId(),
      parentSpanId: extractedContext.parentSpanId,
      requestId: extractedContext.requestId || correlationManager.generateCorrelationId(),
      operation: `${req.method} ${req.url}`,
      startTime: Date.now(),
    };
    
    return correlationManager.runWithContext(context, () => {
      return handler(...args);
    });
  }) as T;
}

// Hook for React components to access correlation context
export function useCorrelation() {
  return correlationManager.getCurrentContext();
}

// Utility function to wrap async operations with correlation context
export async function withCorrelationContext<T>(
  operation: string,
  callback: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const childContext = correlationManager.createChildSpan(operation, metadata);
  
  return correlationManager.runWithContext(childContext, async () => {
    try {
      const result = await callback();
      return result;
    } catch (error) {
      // Add error information to correlation context
      const errorContext = correlationManager.getCurrentContext();
      if (errorContext) {
        errorContext.metadata = {
          ...errorContext.metadata,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        };
      }
      throw error;
    }
  });
}

// Utility function to get correlation headers for external requests
export function getCorrelationHeaders(): Record<string, string> {
  const context = correlationManager.getCurrentContext();
  if (!context) return {};
  
  const headers: Record<string, string> = {};
  
  if (context.correlationId) headers['X-Correlation-Id'] = context.correlationId;
  if (context.traceId) headers['X-Trace-Id'] = context.traceId;
  if (context.spanId) headers['X-Parent-Span-Id'] = context.spanId;
  if (context.requestId) headers['X-Request-Id'] = context.requestId;
  
  return headers;
}

// Performance tracking utilities
export class PerformanceTracker {
  private operations: Map<string, number> = new Map();
  
  start(operation: string): void {
    this.operations.set(operation, Date.now());
  }
  
  end(operation: string): number {
    const startTime = this.operations.get(operation);
    if (!startTime) return 0;
    
    const duration = Date.now() - startTime;
    this.operations.delete(operation);
    return duration;
  }
  
  track<T>(operation: string, callback: () => T): T {
    this.start(operation);
    try {
      const result = callback();
      const duration = this.end(operation);
      
      // Add performance data to correlation context
      const context = correlationManager.getCurrentContext();
      if (context) {
        context.metadata = {
          ...context.metadata,
          performance: {
            ...context.metadata?.performance,
            [operation]: duration,
          },
        };
      }
      
      return result;
    } catch (error) {
      this.end(operation);
      throw error;
    }
  }
  
  async trackAsync<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    this.start(operation);
    try {
      const result = await callback();
      const duration = this.end(operation);
      
      // Add performance data to correlation context
      const context = correlationManager.getCurrentContext();
      if (context) {
        context.metadata = {
          ...context.metadata,
          performance: {
            ...context.metadata?.performance,
            [operation]: duration,
          },
        };
      }
      
      return result;
    } catch (error) {
      this.end(operation);
      throw error;
    }
  }
}

// Global performance tracker instance
export const performanceTracker = new PerformanceTracker();

// Export correlation storage for advanced use cases
export { correlationStorage };