import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that the incoming locale is valid
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    // Configure time zone if needed
    timeZone: getTimeZoneForLocale(locale),
    // Configure additional options
    formats: {
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
        medium: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          weekday: 'long',
        },
      },
      number: {
        precise: {
          maximumFractionDigits: 5,
        },
      },
    },
  };
});

function getTimeZoneForLocale(locale: string): string {
  // Return appropriate timezone based on locale
  switch (locale) {
    case 'en':
      return 'America/New_York';
    case 'es':
      return 'Europe/Madrid';
    case 'fr':
      return 'Europe/Paris';
    case 'de':
      return 'Europe/Berlin';
    case 'ja':
      return 'Asia/Tokyo';
    case 'ar':
      return 'Asia/Dubai';
    default:
      return 'UTC';
  }
}