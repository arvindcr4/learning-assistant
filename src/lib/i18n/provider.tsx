'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LocalizedFormatters } from '../../../lib/i18n/formatters';
import { ContentManager } from '../../../lib/i18n/content-manager';
import { localeConfig } from '../../../i18n/routing';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ar';

interface Messages {
  [key: string]: any;
}

interface I18nContextType {
  locale: Locale;
  messages: Messages;
  formatters: LocalizedFormatters;
  contentManager: ContentManager;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, any>) => string;
  isRTL: boolean;
  direction: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
  initialMessages?: Messages;
}

export function I18nProvider({ 
  children, 
  initialLocale = 'en', 
  initialMessages = {} 
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [messages, setMessages] = useState<Messages>(initialMessages);
  const [formatters, setFormatters] = useState<LocalizedFormatters>(
    new LocalizedFormatters({ locale: initialLocale })
  );
  const [contentManager] = useState<ContentManager>(ContentManager.getInstance());

  // Load messages when locale changes
  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(`/messages/${locale}.json`);
        if (response.ok) {
          const newMessages = await response.json();
          setMessages(newMessages);
        } else {
          console.warn(`Failed to load messages for locale: ${locale}`);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    }

    loadMessages();
  }, [locale]);

  // Update formatters when locale changes
  useEffect(() => {
    setFormatters(new LocalizedFormatters({ locale }));
  }, [locale]);

  // Save locale preference to localStorage
  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-locale', newLocale);
      document.documentElement.lang = newLocale;
      document.documentElement.dir = localeConfig[newLocale].rtl ? 'rtl' : 'ltr';
    }
  };

  // Initialize locale from localStorage or browser preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Try to get saved preference
      const savedLocale = localStorage.getItem('preferred-locale') as Locale;
      if (savedLocale && Object.keys(localeConfig).includes(savedLocale)) {
        setLocale(savedLocale);
        return;
      }

      // Try to detect from browser language
      const browserLanguage = navigator.language.split('-')[0];
      if (Object.keys(localeConfig).includes(browserLanguage)) {
        setLocale(browserLanguage as Locale);
        return;
      }

      // Fall back to English
      setLocale('en');
    }
  }, []);

  // Translation function with interpolation support
  const t = (key: string, values?: Record<string, any>): string => {
    const keys = key.split('.');
    let result: any = messages;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return `[${key}]`;
      }
    }

    if (typeof result !== 'string') {
      console.warn(`Translation key does not resolve to string: ${key}`);
      return `[${key}]`;
    }

    // Handle interpolation
    if (values) {
      return result.replace(/\{(\w+)\}/g, (match, param) => {
        if (param in values) {
          const value = values[param];
          return typeof value === 'string' ? value : String(value);
        }
        return match;
      });
    }

    return result;
  };

  const isRTL = localeConfig[locale]?.rtl || false;
  const direction = isRTL ? 'rtl' : 'ltr';

  const contextValue: I18nContextType = {
    locale,
    messages,
    formatters,
    contentManager,
    setLocale,
    t,
    isRTL,
    direction,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Specialized hooks for common use cases
export function useTranslation() {
  const { t } = useI18n();
  return { t };
}

export function useLocale() {
  const { locale, setLocale } = useI18n();
  return { locale, setLocale };
}

export function useFormatters() {
  const { formatters } = useI18n();
  return formatters;
}

export function useDirection() {
  const { isRTL, direction } = useI18n();
  return { isRTL, direction };
}

export function useContentManager() {
  const { contentManager } = useI18n();
  return contentManager;
}

// HOC for class components
export function withI18n<P extends object>(
  Component: React.ComponentType<P & { i18n: I18nContextType }>
) {
  const WrappedComponent = (props: P) => {
    const i18n = useI18n();
    return <Component {...props} i18n={i18n} />;
  };

  WrappedComponent.displayName = `withI18n(${Component.displayName || Component.name})`;
  return WrappedComponent;
}