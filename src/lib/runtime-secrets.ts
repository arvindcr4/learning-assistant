import { runtimeSecretsInjector } from './secrets';

// Runtime secrets injection for Next.js applications
// This module handles secret injection at application startup

interface RuntimeConfig {
  secrets: Record<string, string>;
  injectionEnabled: boolean;
  fallbackToEnv: boolean;
}

let runtimeConfig: RuntimeConfig | null = null;

/**
 * Initialize runtime secrets injection
 * This should be called early in the application lifecycle
 */
export async function initializeRuntimeSecrets(): Promise<void> {
  try {
    console.log('🔐 Initializing runtime secrets injection...');
    
    // Check if secrets injection is enabled
    const injectionEnabled = process.env.RUNTIME_SECRETS_INJECTION !== 'false';
    const fallbackToEnv = process.env.FALLBACK_TO_ENV !== 'false';
    
    if (!injectionEnabled) {
      console.log('⚠️  Runtime secrets injection is disabled');
      runtimeConfig = {
        secrets: {},
        injectionEnabled: false,
        fallbackToEnv: true,
      };
      return;
    }
    
    // Inject secrets from secrets manager
    const injectedEnv = await runtimeSecretsInjector.injectSecrets(process.env as Record<string, string>);
    
    // Update process.env with injected secrets
    for (const [key, value] of Object.entries(injectedEnv)) {
      if (value && value !== process.env[key]) {
        process.env[key] = value;
      }
    }
    
    runtimeConfig = {
      secrets: injectedEnv,
      injectionEnabled: true,
      fallbackToEnv,
    };
    
    console.log('✅ Runtime secrets injection completed successfully');
    
    // Log injected secrets (without values for security)
    const injectedKeys = Object.keys(injectedEnv).filter(key => 
      injectedEnv[key] !== (process.env as any)[key]
    );
    
    if (injectedKeys.length > 0) {
      console.log(`🔑 Injected ${injectedKeys.length} secrets: ${injectedKeys.join(', ')}`);
    } else {
      console.log('🔑 No new secrets were injected (all already present in environment)');
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize runtime secrets injection:', error);
    
    // Fallback to environment variables
    runtimeConfig = {
      secrets: process.env as Record<string, string>,
      injectionEnabled: false,
      fallbackToEnv: true,
    };
    
    if (process.env.NODE_ENV === 'production') {
      // In production, this is a critical error
      throw new Error('Runtime secrets injection failed in production environment');
    }
  }
}

/**
 * Get a secret value with runtime injection support
 */
export function getSecret(key: string): string | undefined {
  if (!runtimeConfig) {
    // If runtime config is not initialized, return from environment
    return process.env[key];
  }
  
  if (runtimeConfig.injectionEnabled) {
    return runtimeConfig.secrets[key] || (runtimeConfig.fallbackToEnv ? process.env[key] : undefined);
  }
  
  return process.env[key];
}

/**
 * Check if runtime secrets injection is enabled and working
 */
export function isSecretsInjectionEnabled(): boolean {
  return runtimeConfig?.injectionEnabled ?? false;
}

/**
 * Get runtime configuration status
 */
export function getRuntimeConfigStatus(): {
  initialized: boolean;
  injectionEnabled: boolean;
  fallbackToEnv: boolean;
  secretCount: number;
} {
  if (!runtimeConfig) {
    return {
      initialized: false,
      injectionEnabled: false,
      fallbackToEnv: true,
      secretCount: 0,
    };
  }
  
  return {
    initialized: true,
    injectionEnabled: runtimeConfig.injectionEnabled,
    fallbackToEnv: runtimeConfig.fallbackToEnv,
    secretCount: Object.keys(runtimeConfig.secrets).length,
  };
}

/**
 * Refresh secrets from the secrets manager
 * This can be called periodically or on-demand
 */
export async function refreshSecrets(): Promise<void> {
  if (!runtimeConfig?.injectionEnabled) {
    throw new Error('Runtime secrets injection is not enabled');
  }
  
  try {
    console.log('🔄 Refreshing runtime secrets...');
    
    const refreshedEnv = await runtimeSecretsInjector.injectSecrets(process.env as Record<string, string>);
    
    // Update runtime config
    runtimeConfig.secrets = refreshedEnv;
    
    // Update process.env with refreshed secrets
    for (const [key, value] of Object.entries(refreshedEnv)) {
      if (value) {
        process.env[key] = value;
      }
    }
    
    console.log('✅ Runtime secrets refreshed successfully');
    
  } catch (error) {
    console.error('❌ Failed to refresh runtime secrets:', error);
    throw error;
  }
}

/**
 * Validate that required secrets are available
 */
export function validateRequiredSecrets(requiredSecrets: string[]): void {
  const missingSecrets: string[] = [];
  
  for (const secretKey of requiredSecrets) {
    const value = getSecret(secretKey);
    if (!value || value.trim() === '') {
      missingSecrets.push(secretKey);
    }
  }
  
  if (missingSecrets.length > 0) {
    const errorMessage = `Missing required secrets: ${missingSecrets.join(', ')}`;
    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }
  
  console.log('✅ All required secrets are available');
}

/**
 * Setup periodic secret refresh
 */
export function setupPeriodicSecretRefresh(intervalMinutes: number = 5): NodeJS.Timeout | null {
  if (!runtimeConfig?.injectionEnabled) {
    console.log('⚠️  Periodic secret refresh not enabled (injection disabled)');
    return null;
  }
  
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`🔄 Setting up periodic secret refresh every ${intervalMinutes} minutes`);
  
  const interval = setInterval(async () => {
    try {
      await refreshSecrets();
    } catch (error) {
      console.error('❌ Periodic secret refresh failed:', error);
    }
  }, intervalMs);
  
  return interval;
}

// Auto-initialize in non-test environments
if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_AUTO_SECRETS_INIT !== 'true') {
  // Initialize secrets asynchronously
  initializeRuntimeSecrets().catch(error => {
    console.error('❌ Auto-initialization of runtime secrets failed:', error);
    
    if (process.env.NODE_ENV === 'production') {
      // In production, this might be critical
      process.exit(1);
    }
  });
}

// Default exports for common use cases
export default {
  initialize: initializeRuntimeSecrets,
  getSecret,
  refreshSecrets,
  validateRequiredSecrets,
  setupPeriodicRefresh: setupPeriodicSecretRefresh,
  isEnabled: isSecretsInjectionEnabled,
  getStatus: getRuntimeConfigStatus,
};