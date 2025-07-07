import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'es', 'fr', 'de', 'ja', 'ar'],

  // Used when no locale matches
  defaultLocale: 'en',

  // The prefix for the default locale
  localePrefix: {
    mode: 'as-needed',
    prefixes: {
      // Don't prefix the default locale
      'en': ''
    }
  },

  // Domains configuration for different locales (optional) - commented out for deployment
  // domains: [
  //   {
  //     domain: 'learning-en.example.com',
  //     defaultLocale: 'en',
  //     locales: ['en']
  //   },
  //   {
  //     domain: 'learning-es.example.com',
  //     defaultLocale: 'es'
  //   },
  //   {
  //     domain: 'learning-fr.example.com',
  //     defaultLocale: 'fr'
  //   },
  //   {
  //     domain: 'learning-de.example.com',
  //     defaultLocale: 'de'
  //   },
  //   {
  //     domain: 'learning-ja.example.com',
  //     defaultLocale: 'ja'
  //   },
  //   {
  //     domain: 'learning-ar.example.com',
  //     defaultLocale: 'ar'
  //   }
  // ]
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);