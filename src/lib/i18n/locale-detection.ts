import { Locale } from './provider';
import { localeConfig } from '../../../i18n/routing';

export interface LocaleDetectionOptions {
  acceptableLocales?: Locale[];
  fallbackLocale?: Locale;
  cookieName?: string;
  enableGeoLocation?: boolean;
  enableBrowserDetection?: boolean;
  enableUrlDetection?: boolean;
}

export interface DetectionResult {
  locale: Locale;
  source: 'url' | 'cookie' | 'localStorage' | 'browser' | 'geo' | 'fallback';
  confidence: number;
}

export class LocaleDetector {
  private options: Required<LocaleDetectionOptions>;

  constructor(options: LocaleDetectionOptions = {}) {
    this.options = {
      acceptableLocales: Object.keys(localeConfig) as Locale[],
      fallbackLocale: 'en',
      cookieName: 'preferred-locale',
      enableGeoLocation: false,
      enableBrowserDetection: true,
      enableUrlDetection: true,
      ...options,
    };
  }

  async detectLocale(url?: string, userAgent?: string, acceptLanguage?: string): Promise<DetectionResult> {
    const detectionMethods = [
      this.detectFromUrl,
      this.detectFromCookie,
      this.detectFromLocalStorage,
      this.detectFromBrowser,
      this.detectFromGeoLocation,
    ];

    for (const method of detectionMethods) {
      try {
        const result = await method.call(this, url, userAgent, acceptLanguage);
        if (result) {
          return result;
        }
      } catch (error) {
        console.warn('Locale detection method failed:', error);
      }
    }

    // Fallback
    return {
      locale: this.options.fallbackLocale,
      source: 'fallback',
      confidence: 0.1,
    };
  }

  private async detectFromUrl(url?: string): Promise<DetectionResult | null> {
    if (!this.options.enableUrlDetection || !url) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      
      // Check for locale in pathname (e.g., /en/dashboard, /es/panel)
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0];
        if (this.isValidLocale(firstSegment)) {
          return {
            locale: firstSegment as Locale,
            source: 'url',
            confidence: 0.9,
          };
        }
      }

      // Check for locale in query parameters (e.g., ?lang=en)
      const langParam = urlObj.searchParams.get('lang') || urlObj.searchParams.get('locale');
      if (langParam && this.isValidLocale(langParam)) {
        return {
          locale: langParam as Locale,
          source: 'url',
          confidence: 0.8,
        };
      }

      // Check for locale in subdomain (e.g., en.example.com)
      const subdomain = urlObj.hostname.split('.')[0];
      if (this.isValidLocale(subdomain)) {
        return {
          locale: subdomain as Locale,
          source: 'url',
          confidence: 0.7,
        };
      }
    } catch (error) {
      console.warn('URL parsing failed:', error);
    }

    return null;
  }

  private async detectFromCookie(): Promise<DetectionResult | null> {
    if (typeof document === 'undefined') {
      return null;
    }

    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === this.options.cookieName && this.isValidLocale(value)) {
          return {
            locale: value as Locale,
            source: 'cookie',
            confidence: 0.8,
          };
        }
      }
    } catch (error) {
      console.warn('Cookie reading failed:', error);
    }

    return null;
  }

  private async detectFromLocalStorage(): Promise<DetectionResult | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const storedLocale = localStorage.getItem('preferred-locale');
      if (storedLocale && this.isValidLocale(storedLocale)) {
        return {
          locale: storedLocale as Locale,
          source: 'localStorage',
          confidence: 0.8,
        };
      }
    } catch (error) {
      console.warn('localStorage reading failed:', error);
    }

    return null;
  }

  private async detectFromBrowser(url?: string, userAgent?: string, acceptLanguage?: string): Promise<DetectionResult | null> {
    if (!this.options.enableBrowserDetection) {
      return null;
    }

    try {
      // Server-side: use Accept-Language header
      if (acceptLanguage) {
        const preferredLocale = this.parseAcceptLanguage(acceptLanguage);
        if (preferredLocale) {
          return {
            locale: preferredLocale,
            source: 'browser',
            confidence: 0.6,
          };
        }
      }

      // Client-side: use navigator.language
      if (typeof navigator !== 'undefined') {
        const browserLanguages = [
          navigator.language,
          ...(navigator.languages || []),
        ];

        for (const lang of browserLanguages) {
          const normalizedLang = this.normalizeLanguageCode(lang);
          if (this.isValidLocale(normalizedLang)) {
            return {
              locale: normalizedLang as Locale,
              source: 'browser',
              confidence: 0.6,
            };
          }
        }
      }
    } catch (error) {
      console.warn('Browser language detection failed:', error);
    }

    return null;
  }

  private async detectFromGeoLocation(): Promise<DetectionResult | null> {
    if (!this.options.enableGeoLocation || typeof navigator === 'undefined') {
      return null;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 5000); // 5 second timeout

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeout);
          const { latitude, longitude } = position.coords;
          
          // Simple geo-to-locale mapping (this could be more sophisticated)
          const geoLocale = this.getLocaleFromCoordinates(latitude, longitude);
          
          if (geoLocale) {
            resolve({
              locale: geoLocale,
              source: 'geo',
              confidence: 0.4,
            });
          } else {
            resolve(null);
          }
        },
        (error) => {
          clearTimeout(timeout);
          console.warn('Geolocation failed:', error);
          resolve(null);
        },
        {
          timeout: 5000,
          enableHighAccuracy: false,
        }
      );
    });
  }

  private parseAcceptLanguage(acceptLanguage: string): Locale | null {
    try {
      const languages = acceptLanguage
        .split(',')
        .map(lang => {
          const [code, qValue] = lang.trim().split(';q=');
          return {
            code: this.normalizeLanguageCode(code),
            quality: qValue ? parseFloat(qValue) : 1.0,
          };
        })
        .sort((a, b) => b.quality - a.quality);

      for (const { code } of languages) {
        if (this.isValidLocale(code)) {
          return code as Locale;
        }
      }
    } catch (error) {
      console.warn('Accept-Language parsing failed:', error);
    }

    return null;
  }

  private normalizeLanguageCode(languageCode: string): string {
    // Extract the primary language tag (e.g., 'en' from 'en-US')
    return languageCode.split('-')[0].toLowerCase();
  }

  private isValidLocale(locale: string): boolean {
    return this.options.acceptableLocales.includes(locale as Locale);
  }

  private getLocaleFromCoordinates(latitude: number, longitude: number): Locale | null {
    // Very basic geo-to-locale mapping
    // In a real implementation, you'd use a more sophisticated geo-location database
    
    // Europe
    if (latitude >= 35 && latitude <= 70 && longitude >= -10 && longitude <= 40) {
      if (longitude >= -10 && longitude <= 2) return 'fr'; // France/Western Europe
      if (longitude >= 2 && longitude <= 15) return 'de'; // Germany/Central Europe
      if (longitude >= -8 && longitude <= -2) return 'es'; // Spain
    }
    
    // Middle East
    if (latitude >= 15 && latitude <= 40 && longitude >= 25 && longitude <= 60) {
      return 'ar';
    }
    
    // Japan
    if (latitude >= 30 && latitude <= 46 && longitude >= 130 && longitude <= 146) {
      return 'ja';
    }
    
    // Default to English for other regions or if coordinates don't match
    return 'en';
  }

  setLocalePreference(locale: Locale): void {
    if (!this.isValidLocale(locale)) {
      throw new Error(`Invalid locale: ${locale}`);
    }

    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('preferred-locale', locale);
      } catch (error) {
        console.warn('Failed to save locale to localStorage:', error);
      }
    }

    // Save to cookie
    if (typeof document !== 'undefined') {
      try {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1); // 1 year from now
        document.cookie = `${this.options.cookieName}=${locale}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
      } catch (error) {
        console.warn('Failed to save locale to cookie:', error);
      }
    }
  }

  getLocalePreference(): Locale | null {
    // Try localStorage first
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('preferred-locale');
        if (stored && this.isValidLocale(stored)) {
          return stored as Locale;
        }
      } catch (error) {
        console.warn('Failed to read locale from localStorage:', error);
      }
    }

    // Try cookie
    if (typeof document !== 'undefined') {
      try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === this.options.cookieName && this.isValidLocale(value)) {
            return value as Locale;
          }
        }
      } catch (error) {
        console.warn('Failed to read locale from cookie:', error);
      }
    }

    return null;
  }

  clearLocalePreference(): void {
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('preferred-locale');
      } catch (error) {
        console.warn('Failed to clear locale from localStorage:', error);
      }
    }

    // Clear cookie
    if (typeof document !== 'undefined') {
      try {
        document.cookie = `${this.options.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      } catch (error) {
        console.warn('Failed to clear locale cookie:', error);
      }
    }
  }

  // Static utility methods
  static isRTL(locale: Locale): boolean {
    return localeConfig[locale]?.rtl || false;
  }

  static getDirection(locale: Locale): 'ltr' | 'rtl' {
    return LocaleDetector.isRTL(locale) ? 'rtl' : 'ltr';
  }

  static getLocaleDisplayName(locale: Locale, native = false): string {
    const config = localeConfig[locale];
    if (!config) return locale;
    return native ? config.nativeLabel : config.label;
  }

  static getSupportedLocales(): Locale[] {
    return Object.keys(localeConfig) as Locale[];
  }

  static validateLocale(locale: string): locale is Locale {
    return Object.keys(localeConfig).includes(locale);
  }
}