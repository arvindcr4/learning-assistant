// i18n configuration has been completely disabled
// This file is kept for reference but all next-intl functionality is removed

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

// Export empty default to prevent any import errors
export default {};