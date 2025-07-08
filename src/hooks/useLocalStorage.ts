'use client';

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Get from local storage then parse stored json or return initialValue
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return initialValue;
      }
      
      // Additional validation for empty or malformed JSON
      if (item === '' || item === 'undefined' || item === 'null') {
        return initialValue;
      }
      
      const parsed = JSON.parse(item);
      
      // Validate that parsed value has the same type structure as initialValue
      if (typeof parsed !== typeof initialValue) {
        console.warn(`Type mismatch for localStorage key "${key}". Expected ${typeof initialValue}, got ${typeof parsed}`);
        return initialValue;
      }
      
      return parsed;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      // Clear corrupted data
      try {
        window.localStorage.removeItem(key);
      } catch (clearError) {
        console.error(`Failed to clear corrupted localStorage key "${key}":`, clearError);
      }
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that persists the new value to localStorage
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Validate that the value can be serialized
      const serialized = JSON.stringify(valueToStore);
      if (serialized === undefined) {
        throw new Error('Value cannot be serialized to JSON');
      }
      
      setStoredValue(valueToStore);
      
      // Save to local storage
      if (typeof window !== 'undefined') {
        // Check if localStorage is available and has space
        try {
          window.localStorage.setItem(key, serialized);
        } catch (storageError) {
          // Handle quota exceeded or other storage errors
          if (storageError instanceof DOMException && storageError.code === 22) {
            console.error(`localStorage quota exceeded for key "${key}"`);
            // Try to clear some space by removing old entries
            try {
              // Clear expired or less important data
              const keysToCheck = [];
              for (let i = 0; i < window.localStorage.length; i++) {
                const k = window.localStorage.key(i);
                if (k && k.startsWith('temp_') || k?.includes('cache_')) {
                  keysToCheck.push(k);
                }
              }
              keysToCheck.forEach(k => window.localStorage.removeItem(k));
              
              // Try again after clearing
              window.localStorage.setItem(key, serialized);
            } catch (retryError) {
              console.error(`Failed to store in localStorage even after cleanup:`, retryError);
            }
          } else {
            throw storageError;
          }
        }
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
      // Don't update state if storage failed
    }
  };

  return [storedValue, setValue];
}