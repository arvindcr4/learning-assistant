/**
 * Browser-compatible logger for client-side components
 * This avoids importing server-only packages like winston
 */

export interface BrowserLogger {
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  info: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
  http: (message: string, meta?: any) => void;
}

export const createBrowserLogger = (context?: string): BrowserLogger => {
  const prefix = context ? `[${context}]` : '';
  
  return {
    error: (message: string, meta?: any) => {
      console.error(`${prefix} ${message}`, meta || '');
    },
    warn: (message: string, meta?: any) => {
      console.warn(`${prefix} ${message}`, meta || '');
    },
    info: (message: string, meta?: any) => {
      console.log(`${prefix} ${message}`, meta || '');
    },
    debug: (message: string, meta?: any) => {
      console.debug(`${prefix} ${message}`, meta || '');
    },
    http: (message: string, meta?: any) => {
      console.log(`${prefix} [HTTP] ${message}`, meta || '');
    },
  };
};

// Default browser logger instance
export const browserLogger = createBrowserLogger();

// Export commonly used logging functions
export const logError = (error: Error, context?: string, meta?: any) => {
  const contextStr = context ? `[${context}]` : '';
  console.error(`${contextStr} ${error.message}`, { ...meta, stack: error.stack });
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  console.log(`[Performance] ${operation}: ${duration}ms`, metadata || '');
};

export const logSecurityEvent = (event: string, details: any) => {
  console.warn(`[Security] ${event}`, details);
};

export const logBusinessEvent = (event: string, details: any) => {
  console.log(`[Business] ${event}`, details);
};

export default browserLogger;