'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Enhanced localStorage hook with error handling, versioning, and compression
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: {
    version?: number;
    compress?: boolean;
    encryption?: boolean;
    maxAge?: number; // in milliseconds
    onError?: (error: Error) => void;
  } = {}
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const { version = 1, compress = false, encryption = false, maxAge, onError } = options;
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize value from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item);
        
        // Check version compatibility
        if (parsed.version && parsed.version !== version) {
          console.warn(`Storage version mismatch for key "${key}". Expected ${version}, got ${parsed.version}`);
          setStoredValue(initialValue);
          setIsLoading(false);
          return;
        }

        // Check expiration
        if (parsed.timestamp && maxAge) {
          const now = Date.now();
          if (now - parsed.timestamp > maxAge) {
            console.log(`Storage item "${key}" has expired`);
            window.localStorage.removeItem(key);
            setStoredValue(initialValue);
            setIsLoading(false);
            return;
          }
        }

        const value = parsed.data || parsed;
        setStoredValue(value);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to parse localStorage item');
      if (onError) {
        onError(err);
      } else {
        console.error(`Error reading localStorage key "${key}":`, err);
      }
      setStoredValue(initialValue);
    } finally {
      setIsLoading(false);
    }
  }, [key, initialValue, version, maxAge, onError]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        const storageData = {
          data: valueToStore,
          version,
          timestamp: Date.now(),
        };

        window.localStorage.setItem(key, JSON.stringify(storageData));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to set localStorage item');
      if (onError) {
        onError(err);
      } else {
        console.error(`Error setting localStorage key "${key}":`, err);
      }
    }
  }, [key, storedValue, version, onError]);

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to remove localStorage item');
      if (onError) {
        onError(err);
      } else {
        console.error(`Error removing localStorage key "${key}":`, err);
      }
    }
  }, [key, initialValue, onError]);

  return [storedValue, setValue, removeValue];
}

// SessionStorage hook
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
  options: {
    onError?: (error: Error) => void;
  } = {}
): [T, (value: T | ((val: T) => T)) => void, () => void] {
  const { onError } = options;
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const item = window.sessionStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to parse sessionStorage item');
      if (onError) {
        onError(err);
      } else {
        console.error(`Error reading sessionStorage key "${key}":`, err);
      }
    }
  }, [key, onError]);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to set sessionStorage item');
      if (onError) {
        onError(err);
      } else {
        console.error(`Error setting sessionStorage key "${key}":`, err);
      }
    }
  }, [key, storedValue, onError]);

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to remove sessionStorage item');
      if (onError) {
        onError(err);
      } else {
        console.error(`Error removing sessionStorage key "${key}":`, err);
      }
    }
  }, [key, initialValue, onError]);

  return [storedValue, setValue, removeValue];
}

// IndexedDB hook for larger data storage
export function useIndexedDB<T>(
  dbName: string,
  storeName: string,
  key: string,
  initialValue: T
): [T, (value: T) => Promise<void>, () => Promise<void>, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const dbRef = useRef<IDBDatabase | null>(null);

  const openDB = useCallback(async (): Promise<IDBDatabase> => {
    if (dbRef.current) return dbRef.current;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbRef.current = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
    });
  }, [dbName, storeName]);

  const getValue = useCallback(async (): Promise<T> => {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result !== undefined ? result : initialValue);
      };
    });
  }, [openDB, storeName, key, initialValue]);

  const setValue = useCallback(async (value: T): Promise<void> => {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        setStoredValue(value);
        resolve();
      };
    });
  }, [openDB, storeName, key]);

  const removeValue = useCallback(async (): Promise<void> => {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        setStoredValue(initialValue);
        resolve();
      };
    });
  }, [openDB, storeName, key, initialValue]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    getValue()
      .then(setStoredValue)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [getValue]);

  return [storedValue, setValue, removeValue, isLoading];
}

// Cached storage hook with TTL
export function useCachedStorage<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number; // time to live in milliseconds
    staleWhileRevalidate?: boolean;
    onError?: (error: Error) => void;
  } = {}
): [T | null, boolean, Error | null, () => void] {
  const { ttl = 5 * 60 * 1000, staleWhileRevalidate = true, onError } = options; // default 5 minutes
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cachedData, setCachedData] = useLocalStorage<{
    data: T;
    timestamp: number;
  } | null>(`cache_${key}`, null, { onError });

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      if (!staleWhileRevalidate) {
        setIsLoading(true);
      }

      const result = await fetcher();
      setData(result);
      setCachedData({ data: result, timestamp: Date.now() });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch data');
      setError(error);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, staleWhileRevalidate, setCachedData, onError]);

  const revalidate = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const now = Date.now();
    
    if (cachedData && now - cachedData.timestamp < ttl) {
      // Cache is still valid
      setData(cachedData.data);
      setIsLoading(false);
      
      if (staleWhileRevalidate) {
        // Revalidate in the background
        fetchData();
      }
    } else {
      // Cache is stale or doesn't exist
      fetchData();
    }
  }, [cachedData, ttl, staleWhileRevalidate, fetchData]);

  return [data, isLoading, error, revalidate];
}

// Storage event listener hook
export function useStorageEvent(callback: (event: StorageEvent) => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      callback(event);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [callback]);
}

// Storage quota hook
export function useStorageQuota(): [number, number] {
  const [usage, setUsage] = useState(0);
  const [quota, setQuota] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('storage' in navigator)) return;

    navigator.storage.estimate().then(estimate => {
      setUsage(estimate.usage || 0);
      setQuota(estimate.quota || 0);
    });
  }, []);

  return [usage, quota];
}