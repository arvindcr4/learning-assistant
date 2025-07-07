import { defineRouting } from 'next-intl/routing';
import { createSharedPathnamesNavigation } from 'next-intl/navigation';

// Define all supported locales
export const locales = ['en', 'es', 'fr', 'de', 'ja', 'ar'] as const;
export type Locale = (typeof locales)[number];

// Default locale configuration
export const defaultLocale: Locale = 'en';

// Locale configuration with labels and RTL support
export const localeConfig = {
  en: {
    label: 'English',
    nativeLabel: 'English',
    flag: '🇺🇸',
    rtl: false,
    culturalAdaptation: true,
  },
  es: {
    label: 'Spanish',
    nativeLabel: 'Español',
    flag: '🇪🇸',
    rtl: false,
    culturalAdaptation: true,
  },
  fr: {
    label: 'French',
    nativeLabel: 'Français',
    flag: '🇫🇷',
    rtl: false,
    culturalAdaptation: true,
  },
  de: {
    label: 'German',
    nativeLabel: 'Deutsch',
    flag: '🇩🇪',
    rtl: false,
    culturalAdaptation: true,
  },
  ja: {
    label: 'Japanese',
    nativeLabel: '日本語',
    flag: '🇯🇵',
    rtl: false,
    culturalAdaptation: true,
  },
  ar: {
    label: 'Arabic',
    nativeLabel: 'العربية',
    flag: '🇸🇦',
    rtl: true,
    culturalAdaptation: true,
  },
} as const;

// Define routing configuration
export const routing = defineRouting({
  locales,
  defaultLocale,
  
  // Locale detection configuration
  localeDetection: true,
  
  // Path configuration
  pathnames: {
    // Public routes
    '/': '/',
    '/about': {
      en: '/about',
      es: '/acerca-de',
      fr: '/a-propos',
      de: '/ueber-uns',
      ja: '/について',
      ar: '/حول',
    },
    
    // Authentication routes
    '/auth/login': {
      en: '/auth/login',
      es: '/auth/iniciar-sesion',
      fr: '/auth/connexion',
      de: '/auth/anmelden',
      ja: '/auth/ログイン',
      ar: '/auth/تسجيل-الدخول',
    },
    '/auth/register': {
      en: '/auth/register',
      es: '/auth/registro',
      fr: '/auth/inscription',
      de: '/auth/registrieren',
      ja: '/auth/登録',
      ar: '/auth/التسجيل',
    },
    '/auth/reset-password': {
      en: '/auth/reset-password',
      es: '/auth/restablecer-contraseña',
      fr: '/auth/reinitialiser-mot-de-passe',
      de: '/auth/passwort-zuruecksetzen',
      ja: '/auth/パスワードリセット',
      ar: '/auth/إعادة-تعيين-كلمة-المرور',
    },
    
    // Dashboard routes
    '/dashboard': {
      en: '/dashboard',
      es: '/panel',
      fr: '/tableau-de-bord',
      de: '/dashboard',
      ja: '/ダッシュボード',
      ar: '/لوحة-القيادة',
    },
    
    // Learning routes
    '/learning': {
      en: '/learning',
      es: '/aprendizaje',
      fr: '/apprentissage',
      de: '/lernen',
      ja: '/学習',
      ar: '/التعلم',
    },
    '/learning/courses': {
      en: '/learning/courses',
      es: '/aprendizaje/cursos',
      fr: '/apprentissage/cours',
      de: '/lernen/kurse',
      ja: '/学習/コース',
      ar: '/التعلم/الدورات',
    },
    '/learning/progress': {
      en: '/learning/progress',
      es: '/aprendizaje/progreso',
      fr: '/apprentissage/progres',
      de: '/lernen/fortschritt',
      ja: '/学習/進捗',
      ar: '/التعلم/التقدم',
    },
    '/learning/analytics': {
      en: '/learning/analytics',
      es: '/aprendizaje/analiticas',
      fr: '/apprentissage/analytique',
      de: '/lernen/analytik',
      ja: '/学習/分析',
      ar: '/التعلم/التحليلات',
    },
    
    // Profile routes
    '/profile': {
      en: '/profile',
      es: '/perfil',
      fr: '/profil',
      de: '/profil',
      ja: '/プロフィール',
      ar: '/الملف-الشخصي',
    },
    '/profile/settings': {
      en: '/profile/settings',
      es: '/perfil/configuracion',
      fr: '/profil/parametres',
      de: '/profil/einstellungen',
      ja: '/プロフィール/設定',
      ar: '/الملف-الشخصي/الإعدادات',
    },
    
    // Chat routes
    '/chat': {
      en: '/chat',
      es: '/chat',
      fr: '/chat',
      de: '/chat',
      ja: '/チャット',
      ar: '/الدردشة',
    },
    '/chat/tutoring': {
      en: '/chat/tutoring',
      es: '/chat/tutoria',
      fr: '/chat/tutorat',
      de: '/chat/nachhilfe',
      ja: '/チャット/個別指導',
      ar: '/الدردشة/التدريس',
    },
    
    // Settings routes
    '/settings': {
      en: '/settings',
      es: '/configuracion',
      fr: '/parametres',
      de: '/einstellungen',
      ja: '/設定',
      ar: '/الإعدادات',
    },
    '/settings/language': {
      en: '/settings/language',
      es: '/configuracion/idioma',
      fr: '/parametres/langue',
      de: '/einstellungen/sprache',
      ja: '/設定/言語',
      ar: '/الإعدادات/اللغة',
    },
    '/settings/preferences': {
      en: '/settings/preferences',
      es: '/configuracion/preferencias',
      fr: '/parametres/preferences',
      de: '/einstellungen/praeferenzen',
      ja: '/設定/環境設定',
      ar: '/الإعدادات/التفضيلات',
    },
    
    // Help routes
    '/help': {
      en: '/help',
      es: '/ayuda',
      fr: '/aide',
      de: '/hilfe',
      ja: '/ヘルプ',
      ar: '/المساعدة',
    },
    '/help/faq': {
      en: '/help/faq',
      es: '/ayuda/preguntas-frecuentes',
      fr: '/aide/faq',
      de: '/hilfe/faq',
      ja: '/ヘルプ/よくある質問',
      ar: '/المساعدة/الأسئلة-الشائعة',
    },
  },
  
  // Locale prefix configuration
  localePrefix: {
    mode: 'always',
    prefixes: {
      // Custom prefixes for specific locales if needed
      // 'en': '/en',
      // 'es': '/es',
      // etc.
    },
  },
  
  // Domains configuration (for multi-domain setup)
  domains: [
    {
      domain: 'learning-assistant.com',
      defaultLocale: 'en',
      locales: ['en'],
    },
    {
      domain: 'learning-assistant.es',
      defaultLocale: 'es',
      locales: ['es'],
    },
    // Add more domains as needed
  ],
  
  // Alternate links configuration
  alternateLinks: true,
  
  // Locale detection from headers
  localeDetection: true,
});

// Create shared navigation utilities
export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation(routing);

// Utility functions for locale handling
export function getLocaleFromPathname(pathname: string): Locale {
  const segments = pathname.split('/').filter(Boolean);
  const potentialLocale = segments[0];
  
  if (locales.includes(potentialLocale as Locale)) {
    return potentialLocale as Locale;
  }
  
  return defaultLocale;
}

export function removeLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const potentialLocale = segments[0];
  
  if (locales.includes(potentialLocale as Locale)) {
    return '/' + segments.slice(1).join('/');
  }
  
  return pathname;
}

export function addLocaleToPathname(pathname: string, locale: Locale): string {
  const cleanPathname = removeLocaleFromPathname(pathname);
  
  if (locale === defaultLocale) {
    return cleanPathname || '/';
  }
  
  return `/${locale}${cleanPathname}`;
}

export function isRTLLocale(locale: Locale): boolean {
  return localeConfig[locale].rtl;
}

export function getLocaleDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRTLLocale(locale) ? 'rtl' : 'ltr';
}

export function getLocaleLabel(locale: Locale, native = false): string {
  const config = localeConfig[locale];
  return native ? config.nativeLabel : config.label;
}

export function getLocaleFlag(locale: Locale): string {
  return localeConfig[locale].flag;
}

export function getCulturalAdaptationSupport(locale: Locale): boolean {
  return localeConfig[locale].culturalAdaptation;
}

// Route validation utilities
export function isValidRoute(pathname: string, locale: Locale): boolean {
  const cleanPathname = removeLocaleFromPathname(pathname);
  
  // Check if the pathname matches any of the defined routes
  const pathnames = routing.pathnames;
  
  for (const [route, translations] of Object.entries(pathnames)) {
    if (typeof translations === 'string') {
      if (cleanPathname === route) return true;
    } else if (typeof translations === 'object') {
      if (cleanPathname === translations[locale]) return true;
    }
  }
  
  return false;
}

// Route translation utilities
export function translateRoute(route: string, locale: Locale): string {
  const pathnames = routing.pathnames;
  
  for (const [originalRoute, translations] of Object.entries(pathnames)) {
    if (originalRoute === route) {
      if (typeof translations === 'string') {
        return translations;
      } else if (typeof translations === 'object') {
        return translations[locale] || translations[defaultLocale] || route;
      }
    }
  }
  
  return route;
}

export function getOriginalRoute(translatedRoute: string, locale: Locale): string {
  const pathnames = routing.pathnames;
  
  for (const [originalRoute, translations] of Object.entries(pathnames)) {
    if (typeof translations === 'string') {
      if (translatedRoute === translations) return originalRoute;
    } else if (typeof translations === 'object') {
      if (translatedRoute === translations[locale]) return originalRoute;
    }
  }
  
  return translatedRoute;
}

// Export routing for use in other parts of the application
export default routing;