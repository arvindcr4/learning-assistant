export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ar';
import fs from 'fs/promises';
import path from 'path';

export interface TranslationKey {
  key: string;
  namespace: string;
  defaultValue: string;
  description?: string;
  context?: string;
  maxLength?: number;
  placeholders?: string[];
}

export interface TranslationValue {
  value: string;
  status: 'pending' | 'translated' | 'reviewed' | 'approved';
  translatorId?: string;
  reviewerId?: string;
  lastModified: Date;
  notes?: string;
}

export interface TranslationEntry {
  key: TranslationKey;
  translations: Record<Locale, TranslationValue>;
}

export interface TranslationStats {
  locale: Locale;
  total: number;
  translated: number;
  reviewed: number;
  approved: number;
  pending: number;
  completionRate: number;
}

export class TranslationManager {
  private static instance: TranslationManager;
  private translations: Map<string, TranslationEntry> = new Map();
  private messagesPath: string;

  private constructor() {
    this.messagesPath = path.join(process.cwd(), 'messages');
  }

  public static getInstance(): TranslationManager {
    if (!TranslationManager.instance) {
      TranslationManager.instance = new TranslationManager();
    }
    return TranslationManager.instance;
  }

  // Load existing translations from JSON files
  public async loadTranslations(): Promise<void> {
    const locales: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'ar'];
    
    for (const locale of locales) {
      try {
        const filePath = path.join(this.messagesPath, `${locale}.json`);
        const content = await fs.readFile(filePath, 'utf-8');
        const messages = JSON.parse(content);
        
        this.processNestedMessages(messages, '', locale);
      } catch (error) {
        console.warn(`Could not load translations for ${locale}:`, error);
      }
    }
  }

  private processNestedMessages(obj: any, prefix: string, locale: Locale): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        this.addOrUpdateTranslation(fullKey, value, locale);
      } else if (typeof value === 'object' && value !== null) {
        this.processNestedMessages(value, fullKey, locale);
      }
    }
  }

  private addOrUpdateTranslation(keyPath: string, value: string, locale: Locale): void {
    const [namespace, ...keyParts] = keyPath.split('.');
    const key = keyParts.join('.');
    
    const translationKey: TranslationKey = {
      key: keyPath,
      namespace: namespace || 'default',
      defaultValue: locale === 'en' ? value : '',
      description: `Translation for ${keyPath}`,
      placeholders: this.extractPlaceholders(value)
    };

    const translationValue: TranslationValue = {
      value,
      status: locale === 'en' ? 'approved' : 'translated',
      lastModified: new Date()
    };

    let entry = this.translations.get(keyPath);
    if (!entry) {
      entry = {
        key: translationKey,
        translations: {} as Record<Locale, TranslationValue>
      };
      this.translations.set(keyPath, entry);
    }

    entry.translations[locale] = translationValue;
  }

  private extractPlaceholders(text: string): string[] {
    const placeholderRegex = /\{([^}]+)\}/g;
    const placeholders: string[] = [];
    let match;
    
    while ((match = placeholderRegex.exec(text)) !== null) {
      placeholders.push(match[1]);
    }
    
    return placeholders;
  }

  // Add new translation key
  public addTranslationKey(
    keyPath: string, 
    defaultValue: string, 
    options: {
      description?: string;
      context?: string;
      maxLength?: number;
    } = {}
  ): void {
    const [namespace, ...keyParts] = keyPath.split('.');
    const key = keyParts.join('.');
    
    const translationKey: TranslationKey = {
      key: keyPath,
      namespace,
      defaultValue,
      description: options.description,
      context: options.context,
      maxLength: options.maxLength,
      placeholders: this.extractPlaceholders(defaultValue)
    };

    const entry: TranslationEntry = {
      key: translationKey,
      translations: {
        en: {
          value: defaultValue,
          status: 'approved',
          lastModified: new Date()
        }
      } as Record<Locale, TranslationValue>
    };

    this.translations.set(keyPath, entry);
  }

  // Update translation for a specific locale
  public updateTranslation(
    keyPath: string, 
    locale: Locale, 
    value: string, 
    translatorId?: string
  ): void {
    const entry = this.translations.get(keyPath);
    if (!entry) {
      throw new Error(`Translation key ${keyPath} not found`);
    }

    entry.translations[locale] = {
      value,
      status: 'translated',
      translatorId,
      lastModified: new Date()
    };
  }

  // Review translation
  public reviewTranslation(
    keyPath: string, 
    locale: Locale, 
    approved: boolean, 
    reviewerId: string, 
    notes?: string
  ): void {
    const entry = this.translations.get(keyPath);
    if (!entry || !entry.translations[locale]) {
      throw new Error(`Translation for ${keyPath} in ${locale} not found`);
    }

    entry.translations[locale] = {
      ...entry.translations[locale],
      status: approved ? 'approved' : 'pending',
      reviewerId,
      notes,
      lastModified: new Date()
    };
  }

  // Get translation statistics
  public getTranslationStats(): Record<Locale, TranslationStats> {
    const locales: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'ar'];
    const stats: Record<Locale, TranslationStats> = {} as Record<Locale, TranslationStats>;

    for (const locale of locales) {
      const total = this.translations.size;
      let translated = 0;
      let reviewed = 0;
      let approved = 0;
      let pending = 0;

      for (const entry of this.translations.values()) {
        const translation = entry.translations[locale];
        if (translation) {
          switch (translation.status) {
            case 'translated':
              translated++;
              break;
            case 'reviewed':
              reviewed++;
              break;
            case 'approved':
              approved++;
              break;
            case 'pending':
              pending++;
              break;
          }
        } else {
          pending++;
        }
      }

      stats[locale] = {
        locale,
        total,
        translated,
        reviewed,
        approved,
        pending,
        completionRate: total > 0 ? ((translated + reviewed + approved) / total) * 100 : 0
      };
    }

    return stats;
  }

  // Get missing translations for a locale
  public getMissingTranslations(locale: Locale): TranslationKey[] {
    const missing: TranslationKey[] = [];

    for (const entry of this.translations.values()) {
      if (!entry.translations[locale] || entry.translations[locale].status === 'pending') {
        missing.push(entry.key);
      }
    }

    return missing;
  }

  // Export translations to JSON files
  public async exportTranslations(): Promise<void> {
    const locales: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'ar'];

    for (const locale of locales) {
      const messages: any = {};

      for (const entry of this.translations.values()) {
        const translation = entry.translations[locale];
        if (translation && translation.status !== 'pending') {
          this.setNestedProperty(messages, entry.key.key, translation.value);
        }
      }

      const filePath = path.join(this.messagesPath, `${locale}.json`);
      await fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf-8');
    }
  }

  private setNestedProperty(obj: any, path: string, value: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  // Validate translations for consistency
  public validateTranslations(): { key: string; issues: string[] }[] {
    const issues: { key: string; issues: string[] }[] = [];

    for (const entry of this.translations.values()) {
      const keyIssues: string[] = [];
      const englishTranslation = entry.translations['en'];

      if (!englishTranslation) {
        keyIssues.push('Missing English translation (source)');
      }

      // Check placeholders consistency
      if (englishTranslation && entry.key.placeholders) {
        for (const [locale, translation] of Object.entries(entry.translations)) {
          if (locale !== 'en' && translation) {
            const translationPlaceholders = this.extractPlaceholders(translation.value);
            const missingPlaceholders = entry.key.placeholders.filter(
              p => !translationPlaceholders.includes(p)
            );
            const extraPlaceholders = translationPlaceholders.filter(
              p => !entry.key.placeholders!.includes(p)
            );

            if (missingPlaceholders.length > 0) {
              keyIssues.push(`${locale}: Missing placeholders: ${missingPlaceholders.join(', ')}`);
            }
            if (extraPlaceholders.length > 0) {
              keyIssues.push(`${locale}: Extra placeholders: ${extraPlaceholders.join(', ')}`);
            }
          }
        }
      }

      // Check length constraints
      if (entry.key.maxLength) {
        for (const [locale, translation] of Object.entries(entry.translations)) {
          if (translation && translation.value.length > entry.key.maxLength) {
            keyIssues.push(`${locale}: Translation exceeds maximum length (${translation.value.length}/${entry.key.maxLength})`);
          }
        }
      }

      if (keyIssues.length > 0) {
        issues.push({
          key: entry.key.key,
          issues: keyIssues
        });
      }
    }

    return issues;
  }

  // Generate translation report
  public generateTranslationReport(): string {
    const stats = this.getTranslationStats();
    const issues = this.validateTranslations();

    let report = '# Translation Report\n\n';
    
    report += '## Statistics\n\n';
    for (const [locale, stat] of Object.entries(stats)) {
      report += `### ${locale.toUpperCase()}\n`;
      report += `- Total keys: ${stat.total}\n`;
      report += `- Translated: ${stat.translated}\n`;
      report += `- Reviewed: ${stat.reviewed}\n`;
      report += `- Approved: ${stat.approved}\n`;
      report += `- Pending: ${stat.pending}\n`;
      report += `- Completion rate: ${stat.completionRate.toFixed(1)}%\n\n`;
    }

    if (issues.length > 0) {
      report += '## Issues\n\n';
      for (const issue of issues) {
        report += `### ${issue.key}\n`;
        for (const problemDescription of issue.issues) {
          report += `- ${problemDescription}\n`;
        }
        report += '\n';
      }
    }

    return report;
  }

  // Search translations
  public searchTranslations(query: string, locale?: Locale): TranslationEntry[] {
    const results: TranslationEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const entry of this.translations.values()) {
      let matches = false;

      // Search in key
      if (entry.key.key.toLowerCase().includes(lowerQuery)) {
        matches = true;
      }

      // Search in description
      if (entry.key.description?.toLowerCase().includes(lowerQuery)) {
        matches = true;
      }

      // Search in translations
      if (locale) {
        const translation = entry.translations[locale];
        if (translation?.value.toLowerCase().includes(lowerQuery)) {
          matches = true;
        }
      } else {
        for (const translation of Object.values(entry.translations)) {
          if (translation.value.toLowerCase().includes(lowerQuery)) {
            matches = true;
            break;
          }
        }
      }

      if (matches) {
        results.push(entry);
      }
    }

    return results;
  }
}