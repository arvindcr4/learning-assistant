'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AccessibilityPreferences {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  colorBlindFriendly: boolean;
  focusIndicators: boolean;
  audioDescriptions: boolean;
  autoplay: boolean;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  theme: 'light' | 'dark' | 'auto';
}

interface AccessibilityContextType {
  preferences: AccessibilityPreferences;
  updatePreferences: (updates: Partial<AccessibilityPreferences>) => void;
  resetPreferences: () => void;
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void;
  isAccessibilityEnabled: (feature: keyof AccessibilityPreferences) => boolean;
  getAccessibilityAttributes: (element: string) => Record<string, any>;
}

const defaultPreferences: AccessibilityPreferences = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  screenReader: false,
  keyboardNavigation: true,
  colorBlindFriendly: false,
  focusIndicators: true,
  audioDescriptions: false,
  autoplay: true,
  fontSize: 16,
  lineHeight: 1.5,
  letterSpacing: 0,
  theme: 'auto'
};

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences);
  const [screenReaderRegion, setScreenReaderRegion] = useState<HTMLElement | null>(null);

  // Initialize accessibility preferences from localStorage and system preferences
  useEffect(() => {
    const savedPreferences = localStorage.getItem('accessibility-preferences');
    if (savedPreferences) {
      try {
        const parsed = JSON.parse(savedPreferences);
        setPreferences(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.warn('Failed to parse accessibility preferences:', error);
      }
    }

    // Detect system preferences
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleReducedMotion = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, reduceMotion: e.matches }));
    };
    
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const handleHighContrast = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, highContrast: e.matches }));
    };

    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleColorScheme = (e: MediaQueryListEvent) => {
      setPreferences(prev => ({ ...prev, theme: e.matches ? 'dark' : 'light' }));
    };

    setPreferences(prev => ({
      ...prev,
      reduceMotion: mediaQuery.matches,
      highContrast: contrastQuery.matches,
      theme: prev.theme === 'auto' ? (colorSchemeQuery.matches ? 'dark' : 'light') : prev.theme
    }));

    mediaQuery.addEventListener('change', handleReducedMotion);
    contrastQuery.addEventListener('change', handleHighContrast);
    colorSchemeQuery.addEventListener('change', handleColorScheme);

    return () => {
      mediaQuery.removeEventListener('change', handleReducedMotion);
      contrastQuery.removeEventListener('change', handleHighContrast);
      colorSchemeQuery.removeEventListener('change', handleColorScheme);
    };
  }, []);

  // Create screen reader announcement region
  useEffect(() => {
    let region = document.getElementById('screen-reader-announcements');
    if (!region) {
      region = document.createElement('div');
      region.id = 'screen-reader-announcements';
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      region.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(region);
    }
    setScreenReaderRegion(region);

    return () => {
      if (region && region.parentNode) {
        region.parentNode.removeChild(region);
      }
    };
  }, []);

  // Apply accessibility preferences to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply CSS custom properties
    root.style.setProperty('--accessibility-font-size', `${preferences.fontSize}px`);
    root.style.setProperty('--accessibility-line-height', preferences.lineHeight.toString());
    root.style.setProperty('--accessibility-letter-spacing', `${preferences.letterSpacing}px`);
    
    // Apply classes
    root.classList.toggle('reduce-motion', preferences.reduceMotion);
    root.classList.toggle('high-contrast', preferences.highContrast);
    root.classList.toggle('large-text', preferences.largeText);
    root.classList.toggle('keyboard-navigation', preferences.keyboardNavigation);
    root.classList.toggle('color-blind-friendly', preferences.colorBlindFriendly);
    root.classList.toggle('focus-indicators', preferences.focusIndicators);
    root.classList.toggle('dark', preferences.theme === 'dark');
    
    // Save preferences to localStorage
    localStorage.setItem('accessibility-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = useCallback((updates: Partial<AccessibilityPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
    localStorage.removeItem('accessibility-preferences');
  }, []);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (screenReaderRegion) {
      screenReaderRegion.setAttribute('aria-live', priority);
      screenReaderRegion.textContent = message;
      
      // Clear the message after a short delay to allow for re-announcements
      setTimeout(() => {
        screenReaderRegion.textContent = '';
      }, 1000);
    }
  }, [screenReaderRegion]);

  const isAccessibilityEnabled = useCallback((feature: keyof AccessibilityPreferences) => {
    return preferences[feature] as boolean;
  }, [preferences]);

  const getAccessibilityAttributes = useCallback((element: string) => {
    const attributes: Record<string, any> = {};
    
    switch (element) {
      case 'button':
        attributes['aria-pressed'] = false;
        attributes['tabIndex'] = 0;
        break;
      case 'link':
        attributes['tabIndex'] = 0;
        break;
      case 'input':
        attributes['aria-required'] = false;
        attributes['aria-invalid'] = false;
        break;
      case 'form':
        attributes['noValidate'] = true;
        break;
      case 'region':
        attributes['role'] = 'region';
        break;
      case 'main':
        attributes['role'] = 'main';
        break;
      case 'navigation':
        attributes['role'] = 'navigation';
        break;
      case 'complementary':
        attributes['role'] = 'complementary';
        break;
      case 'contentinfo':
        attributes['role'] = 'contentinfo';
        break;
      case 'banner':
        attributes['role'] = 'banner';
        break;
    }
    
    return attributes;
  }, []);

  const value: AccessibilityContextType = {
    preferences,
    updatePreferences,
    resetPreferences,
    announceToScreenReader,
    isAccessibilityEnabled,
    getAccessibilityAttributes
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export default AccessibilityContext;