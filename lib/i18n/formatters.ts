export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ar';

export interface FormattingOptions {
  locale: Locale;
  timeZone?: string;
  currency?: string;
}

export class LocalizedFormatters {
  private locale: Locale;
  private timeZone: string;
  private currency: string;

  constructor(options: FormattingOptions) {
    this.locale = options.locale;
    this.timeZone = options.timeZone || this.getDefaultTimeZone(options.locale);
    this.currency = options.currency || this.getDefaultCurrency(options.locale);
  }

  private getDefaultTimeZone(locale: Locale): string {
    const timeZones: Record<Locale, string> = {
      'en': 'America/New_York',
      'es': 'Europe/Madrid',
      'fr': 'Europe/Paris',
      'de': 'Europe/Berlin',
      'ja': 'Asia/Tokyo',
      'ar': 'Asia/Dubai'
    };
    return timeZones[locale] || 'UTC';
  }

  private getDefaultCurrency(locale: Locale): string {
    const currencies: Record<Locale, string> = {
      'en': 'USD',
      'es': 'EUR',
      'fr': 'EUR',
      'de': 'EUR',
      'ja': 'JPY',
      'ar': 'AED'
    };
    return currencies[locale] || 'USD';
  }

  // Date formatting
  formatDate(date: Date, style: 'full' | 'long' | 'medium' | 'short' = 'medium'): string {
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: style,
      timeZone: this.timeZone
    }).format(date);
  }

  formatTime(date: Date, style: 'full' | 'long' | 'medium' | 'short' = 'short'): string {
    return new Intl.DateTimeFormat(this.locale, {
      timeStyle: style,
      timeZone: this.timeZone
    }).format(date);
  }

  formatDateTime(date: Date, dateStyle: 'full' | 'long' | 'medium' | 'short' = 'medium', timeStyle: 'full' | 'long' | 'medium' | 'short' = 'short'): string {
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle,
      timeStyle,
      timeZone: this.timeZone
    }).format(date);
  }

  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    const rtf = new Intl.RelativeTimeFormat(this.locale, { numeric: 'auto' });

    if (Math.abs(diffSeconds) < 60) {
      return rtf.format(diffSeconds, 'second');
    } else if (Math.abs(diffMinutes) < 60) {
      return rtf.format(diffMinutes, 'minute');
    } else if (Math.abs(diffHours) < 24) {
      return rtf.format(diffHours, 'hour');
    } else if (Math.abs(diffDays) < 30) {
      return rtf.format(diffDays, 'day');
    } else {
      const diffMonths = Math.round(diffDays / 30);
      return rtf.format(diffMonths, 'month');
    }
  }

  // Number formatting
  formatNumber(number: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.locale, options).format(number);
  }

  formatCurrency(amount: number, currency?: string): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: currency || this.currency
    }).format(amount);
  }

  formatPercent(number: number, minimumFractionDigits: number = 0, maximumFractionDigits: number = 1): string {
    return new Intl.NumberFormat(this.locale, {
      style: 'percent',
      minimumFractionDigits,
      maximumFractionDigits
    }).format(number);
  }

  formatCompactNumber(number: number): string {
    return new Intl.NumberFormat(this.locale, {
      notation: 'compact',
      compactDisplay: 'short'
    }).format(number);
  }

  formatOrdinal(number: number): string {
    const pr = new Intl.PluralRules(this.locale, { type: 'ordinal' });
    const rule = pr.select(number);
    
    const suffixes: Record<string, Record<string, string>> = {
      'en': { 'one': 'st', 'two': 'nd', 'few': 'rd', 'other': 'th' },
      'es': { 'other': 'º' },
      'fr': { 'one': 'er', 'other': 'e' },
      'de': { 'other': '.' },
      'ja': { 'other': '番目' },
      'ar': { 'other': '' }
    };

    const localeSuffixes = suffixes[this.locale] || suffixes['en']!;
    const suffix = localeSuffixes![rule] || localeSuffixes!['other'];
    
    return `${number}${suffix}`;
  }

  // Duration formatting
  formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return this.formatDurationUnit(remainingMinutes, 'minute');
    } else if (remainingMinutes === 0) {
      return this.formatDurationUnit(hours, 'hour');
    } else {
      return `${this.formatDurationUnit(hours, 'hour')} ${this.formatDurationUnit(remainingMinutes, 'minute')}`;
    }
  }

  private formatDurationUnit(value: number, unit: 'hour' | 'minute'): string {
    const units: Record<Locale, Record<string, { singular: string; plural: string }>> = {
      'en': {
        'hour': { singular: 'hour', plural: 'hours' },
        'minute': { singular: 'minute', plural: 'minutes' }
      },
      'es': {
        'hour': { singular: 'hora', plural: 'horas' },
        'minute': { singular: 'minuto', plural: 'minutos' }
      },
      'fr': {
        'hour': { singular: 'heure', plural: 'heures' },
        'minute': { singular: 'minute', plural: 'minutes' }
      },
      'de': {
        'hour': { singular: 'Stunde', plural: 'Stunden' },
        'minute': { singular: 'Minute', plural: 'Minuten' }
      },
      'ja': {
        'hour': { singular: '時間', plural: '時間' },
        'minute': { singular: '分', plural: '分' }
      },
      'ar': {
        'hour': { singular: 'ساعة', plural: 'ساعات' },
        'minute': { singular: 'دقيقة', plural: 'دقائق' }
      }
    };

    const localeUnits = units[this.locale] || units['en']!;
    const unitText = value === 1 ? localeUnits![unit]!.singular : localeUnits![unit]!.plural;
    
    return `${value} ${unitText}`;
  }

  // Learning-specific formatting
  formatScore(score: number, total: number): string {
    const percentage = (score / total) * 100;
    return `${score}/${total} (${this.formatPercent(percentage / 100)})`;
  }

  formatLearningStreak(days: number): string {
    const streakTexts: Record<Locale, { singular: string; plural: string }> = {
      'en': { singular: 'day streak', plural: 'day streak' },
      'es': { singular: 'día seguido', plural: 'días seguidos' },
      'fr': { singular: 'jour consécutif', plural: 'jours consécutifs' },
      'de': { singular: 'Tag hintereinander', plural: 'Tage hintereinander' },
      'ja': { singular: '日連続', plural: '日連続' },
      'ar': { singular: 'يوم متتالي', plural: 'أيام متتالية' }
    };

    const streakText = streakTexts[this.locale] || streakTexts['en'];
    const text = days === 1 ? streakText.singular : streakText.plural;
    
    return `${days} ${text}`;
  }

  formatStudyTime(minutes: number): string {
    if (minutes < 60) {
      return this.formatDurationUnit(minutes, 'minute');
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      
      if (remainingMinutes === 0) {
        return this.formatDurationUnit(hours, 'hour');
      } else {
        return `${this.formatDurationUnit(hours, 'hour')} ${this.formatDurationUnit(remainingMinutes, 'minute')}`;
      }
    }
  }

  formatProgressPercentage(completed: number, total: number): string {
    const percentage = total > 0 ? (completed / total) : 0;
    return this.formatPercent(percentage);
  }

  // List formatting
  formatList(items: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
    return new Intl.ListFormat(this.locale, { 
      style: 'long', 
      type 
    }).format(items);
  }

  // Display names
  formatLanguageName(languageCode: string): string {
    return new Intl.DisplayNames([this.locale], { type: 'language' }).of(languageCode) || languageCode;
  }

  formatCountryName(countryCode: string): string {
    return new Intl.DisplayNames([this.locale], { type: 'region' }).of(countryCode) || countryCode;
  }

  formatCurrencyName(currencyCode: string): string {
    return new Intl.DisplayNames([this.locale], { type: 'currency' }).of(currencyCode) || currencyCode;
  }

  // Cultural number preferences
  getNumberFormat(): { decimal: string; thousands: string } {
    const sample = new Intl.NumberFormat(this.locale).formatToParts(1234.5);
    const decimal = sample.find(part => part.type === 'decimal')?.value || '.';
    const thousands = sample.find(part => part.type === 'group')?.value || ',';
    
    return { decimal, thousands };
  }

  // Cultural date preferences
  getDateFormat(): string {
    const sample = new Intl.DateTimeFormat(this.locale).formatToParts(new Date('2023-12-25'));
    const order = sample
      .filter(part => ['year', 'month', 'day'].includes(part.type))
      .map(part => part.type.charAt(0).toUpperCase())
      .join('/');
    
    return order;
  }

  // Validation helpers
  isValidNumber(input: string): boolean {
    const { decimal, thousands } = this.getNumberFormat();
    const normalizedInput = input
      .replace(new RegExp(`\\${thousands}`, 'g'), '')
      .replace(new RegExp(`\\${decimal}`), '.');
    
    return !isNaN(parseFloat(normalizedInput));
  }

  parseLocalizedNumber(input: string): number {
    const { decimal, thousands } = this.getNumberFormat();
    const normalizedInput = input
      .replace(new RegExp(`\\${thousands}`, 'g'), '')
      .replace(new RegExp(`\\${decimal}`), '.');
    
    return parseFloat(normalizedInput);
  }
}