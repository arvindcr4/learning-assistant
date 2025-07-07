'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBatchedUpdates } from './usePerformance';

// Storage event types
interface StorageEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

// Storage configuration
interface StorageConfig {
  prefix?: string;
  compression?: boolean;
  encryption?: boolean;
  quotaWarningThreshold?: number;
  maxRetries?: number;
  debounceMs?: number;
}

// Storage metrics
interface StorageMetrics {
  totalKeys: number;
  totalSize: number;
  quota: number;
  usage: number;
  lastCleanup: number;
  errors: number;
}

// Async storage operations
class AsyncStorage {
  private static instance: AsyncStorage;
  private config: StorageConfig;
  private listeners: Map<string, Set<(value: any) => void>>;
  private metrics: StorageMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor(config: StorageConfig = {}) {
    this.config = {
      prefix: 'learning-assistant',
      compression: false,
      encryption: false,
      quotaWarningThreshold: 0.8,
      maxRetries: 3,
      debounceMs: 100,
      ...config,
    };
    
    this.listeners = new Map();
    this.metrics = {
      totalKeys: 0,
      totalSize: 0,
      quota: 0,
      usage: 0,
      lastCleanup: Date.now(),
      errors: 0,
    };

    this.initializeCleanup();
    this.updateMetrics();
  }

  static getInstance(config?: StorageConfig): AsyncStorage {
    if (!AsyncStorage.instance) {
      AsyncStorage.instance = new AsyncStorage(config);
    }
    return AsyncStorage.instance;
  }

  private getKey(key: string): string {
    return `${this.config.prefix}:${key}`;
  }

  private async serialize(value: any): Promise<string> {
    try {
      const serialized = JSON.stringify(value, this.dateReplacer);
      
      if (this.config.compression) {
        // Simple compression using TextEncoder/TextDecoder
        const encoder = new TextEncoder();
        const data = encoder.encode(serialized);
        // In a real implementation, you'd use a compression library
        return btoa(String.fromCharCode(...data));
      }
      
      return serialized;
    } catch (error) {
      console.error('Serialization error:', error);
      throw error;
    }
  }

  private async deserialize(value: string): Promise<any> {
    try {
      let data = value;
      
      if (this.config.compression) {
        // Simple decompression
        const binaryString = atob(data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const decoder = new TextDecoder();
        data = decoder.decode(bytes);
      }
      
      return JSON.parse(data, this.dateReviver);
    } catch (error) {
      console.error('Deserialization error:', error);
      throw error;
    }
  }

  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', __value: value.toISOString() };
    }
    return value;
  }

  private dateReviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.__value);
    }
    return value;
  }

  async getItem<T = any>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);
    let retries = 0;
    
    while (retries < this.config.maxRetries!) {
      try {
        const value = localStorage.getItem(fullKey);
        if (value === null) return null;
        
        return await this.deserialize(value);
      } catch (error) {
        retries++;
        this.metrics.errors++;
        
        if (retries >= this.config.maxRetries!) {
          console.error(`Failed to get item ${key} after ${retries} retries:`, error);
          return null;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
      }
    }
    
    return null;
  }

  async setItem<T = any>(key: string, value: T): Promise<void> {
    const fullKey = this.getKey(key);
    let retries = 0;
    
    while (retries < this.config.maxRetries!) {
      try {
        const serialized = await this.serialize(value);
        
        // Check quota before writing
        await this.checkQuota(serialized.length);
        
        const oldValue = await this.getItem(key);
        localStorage.setItem(fullKey, serialized);
        
        // Notify listeners
        this.notifyListeners(key, oldValue, value);
        
        // Update metrics
        this.updateMetrics();
        
        return;
      } catch (error) {
        retries++;
        this.metrics.errors++;
        
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          await this.performCleanup();
          
          if (retries >= this.config.maxRetries!) {
            throw new Error(`Storage quota exceeded for key ${key}`);
          }
        } else if (retries >= this.config.maxRetries!) {
          console.error(`Failed to set item ${key} after ${retries} retries:`, error);
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
      }
    }
  }

  async removeItem(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    const oldValue = await this.getItem(key);
    
    localStorage.removeItem(fullKey);
    this.notifyListeners(key, oldValue, null);
    this.updateMetrics();
  }

  async clear(): Promise<void> {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`${this.config.prefix}:`)
    );
    
    for (const key of keys) {
      localStorage.removeItem(key);
    }
    
    this.listeners.clear();
    this.updateMetrics();
  }

  subscribe(key: string, listener: (value: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    const keyListeners = this.listeners.get(key)!;
    keyListeners.add(listener);
    
    return () => {
      keyListeners.delete(listener);
      if (keyListeners.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  private notifyListeners(key: string, oldValue: any, newValue: any): void {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => {
        try {
          listener(newValue);
        } catch (error) {
          console.error('Storage listener error:', error);
        }
      });
    }
  }

  private async checkQuota(additionalSize: number): Promise<void> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const { quota = 0, usage = 0 } = estimate;
      
      this.metrics.quota = quota;
      this.metrics.usage = usage;
      
      const projectedUsage = usage + additionalSize;
      const usageRatio = projectedUsage / quota;
      
      if (usageRatio > this.config.quotaWarningThreshold!) {
        console.warn(`Storage quota warning: ${(usageRatio * 100).toFixed(1)}% used`);
        
        if (usageRatio > 0.95) {
          await this.performCleanup();
        }
      }
    }
  }

  private async performCleanup(): Promise<void> {
    console.log('Performing storage cleanup...');
    
    const keys = Object.keys(localStorage)
      .filter(key => key.startsWith(`${this.config.prefix}:`))
      .map(key => ({
        key,
        timestamp: this.getItemTimestamp(key),
        size: localStorage.getItem(key)?.length || 0,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest 10% of items
    const itemsToRemove = keys.slice(0, Math.ceil(keys.length * 0.1));
    
    for (const item of itemsToRemove) {
      localStorage.removeItem(item.key);
    }
    
    this.metrics.lastCleanup = Date.now();
    this.updateMetrics();
  }

  private getItemTimestamp(key: string): number {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        const parsed = JSON.parse(value);
        return parsed.timestamp || 0;
      }
    } catch (error) {
      // Ignore parsing errors
    }
    return 0;
  }

  private updateMetrics(): void {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(`${this.config.prefix}:`)
    );
    
    this.metrics.totalKeys = keys.length;
    this.metrics.totalSize = keys.reduce((total, key) => {
      const value = localStorage.getItem(key);
      return total + (value?.length || 0);
    }, 0);
  }

  private initializeCleanup(): void {
    // Perform cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000);
  }

  getMetrics(): StorageMetrics {
    return { ...this.metrics };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.listeners.clear();
  }
}

// Optimized storage hook
export function useOptimizedStorage<T>(
  key: string,
  defaultValue: T,
  config?: StorageConfig
): [T, (value: T) => Promise<void>, { isLoading: boolean; error: string | null; metrics: StorageMetrics }] {
  const storage = AsyncStorage.getInstance(config);
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToBatch, processBatch } = useBatchedUpdates<T>();

  // Initialize value from storage
  useEffect(() => {
    const loadValue = async () => {
      try {
        setIsLoading(true);
        const storedValue = await storage.getItem<T>(key);
        setValue(storedValue !== null ? storedValue : defaultValue);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load from storage');
        setValue(defaultValue);
      } finally {
        setIsLoading(false);
      }
    };

    loadValue();
  }, [key, defaultValue, storage]);

  // Subscribe to storage changes
  useEffect(() => {
    const unsubscribe = storage.subscribe(key, (newValue) => {
      setValue(newValue !== null ? newValue : defaultValue);
    });

    return unsubscribe;
  }, [key, defaultValue, storage]);

  // Optimized setter with batching
  const setStorageValue = useCallback(async (newValue: T) => {
    try {
      setValue(newValue);
      await storage.setItem(key, newValue);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to storage');
      // Revert local state on error
      const storedValue = await storage.getItem<T>(key);
      setValue(storedValue !== null ? storedValue : defaultValue);
    }
  }, [key, defaultValue, storage]);

  const metrics = storage.getMetrics();

  return [value, setStorageValue, { isLoading, error, metrics }];
}

// Batch storage operations
export function useBatchedStorage(): {
  batchSet: <T>(operations: Array<{ key: string; value: T }>) => Promise<void>;
  batchGet: <T>(keys: string[]) => Promise<Array<{ key: string; value: T | null }>>;
  batchRemove: (keys: string[]) => Promise<void>;
} {
  const storage = AsyncStorage.getInstance();

  const batchSet = useCallback(async <T>(operations: Array<{ key: string; value: T }>) => {
    const promises = operations.map(({ key, value }) => storage.setItem(key, value));
    await Promise.all(promises);
  }, [storage]);

  const batchGet = useCallback(async <T>(keys: string[]) => {
    const promises = keys.map(async (key) => ({
      key,
      value: await storage.getItem<T>(key),
    }));
    return Promise.all(promises);
  }, [storage]);

  const batchRemove = useCallback(async (keys: string[]) => {
    const promises = keys.map(key => storage.removeItem(key));
    await Promise.all(promises);
  }, [storage]);

  return { batchSet, batchGet, batchRemove };
}

// Storage performance monitoring
export function useStoragePerformance(): {
  metrics: StorageMetrics;
  clearMetrics: () => void;
  exportMetrics: () => void;
} {
  const storage = AsyncStorage.getInstance();
  const [metrics, setMetrics] = useState<StorageMetrics>(storage.getMetrics());

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(storage.getMetrics());
    }, 1000);

    return () => clearInterval(interval);
  }, [storage]);

  const clearMetrics = useCallback(() => {
    // Reset error count
    const currentMetrics = storage.getMetrics();
    currentMetrics.errors = 0;
    setMetrics(currentMetrics);
  }, [storage]);

  const exportMetrics = useCallback(() => {
    const data = {
      ...metrics,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storage-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [metrics]);

  return { metrics, clearMetrics, exportMetrics };
}

// Cleanup on app unmount
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const storage = AsyncStorage.getInstance();
    storage.destroy();
  });
}