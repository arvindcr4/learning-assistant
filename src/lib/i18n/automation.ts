import fs from 'fs/promises';
import path from 'path';
import { TranslationManager, Locale } from '../../../lib/i18n/translation-manager';
import { TranslationValidator } from './validation';
import { LocaleDetector } from './locale-detection';

export interface AutomationConfig {
  sourceLocale: Locale;
  targetLocales: Locale[];
  messagesPath: string;
  autoTranslate?: boolean;
  translationService?: 'mock' | 'google' | 'azure' | 'aws';
  validationEnabled?: boolean;
  autoFix?: boolean;
  backupEnabled?: boolean;
  batchSize?: number;
}

export interface TranslationJob {
  id: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  keys: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  errors?: string[];
}

export class I18nAutomation {
  private config: Required<AutomationConfig>;
  private translationManager: TranslationManager;
  private validator: TranslationValidator;
  private localeDetector: LocaleDetector;
  private jobs: Map<string, TranslationJob> = new Map();

  constructor(config: AutomationConfig) {
    this.config = {
      sourceLocale: 'en',
      targetLocales: ['es', 'fr', 'de', 'ja', 'ar'],
      messagesPath: path.join(process.cwd(), 'messages'),
      autoTranslate: false,
      translationService: 'mock',
      validationEnabled: true,
      autoFix: false,
      backupEnabled: true,
      batchSize: 10,
      ...config,
    };

    this.translationManager = TranslationManager.getInstance();
    this.validator = new TranslationValidator();
    this.localeDetector = new LocaleDetector();
  }

  // Extract new translation keys from source code
  async extractNewKeys(): Promise<{ newKeys: string[]; obsoleteKeys: string[] }> {
    console.log('🔍 Extracting translation keys from source code...');
    
    const extractedKeys = new Set<string>();
    const srcDirs = ['src', 'app', 'components'];
    
    for (const dir of srcDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (await this.directoryExists(dirPath)) {
        await this.scanDirectory(dirPath, extractedKeys);
      }
    }

    // Load existing keys
    await this.translationManager.loadTranslations();
    const existingKeys = new Set<string>();
    
    try {
      const sourceFile = path.join(this.config.messagesPath, `${this.config.sourceLocale}.json`);
      const sourceContent = await fs.readFile(sourceFile, 'utf-8');
      const sourceMessages = JSON.parse(sourceContent);
      this.collectKeys(sourceMessages, '', existingKeys);
    } catch (error) {
      console.warn('Could not load existing source translations:', error);
    }

    const newKeys = Array.from(extractedKeys).filter(key => !existingKeys.has(key));
    const obsoleteKeys = Array.from(existingKeys).filter(key => !extractedKeys.has(key));

    console.log(`📝 Found ${newKeys.length} new keys, ${obsoleteKeys.length} obsolete keys`);
    
    return { newKeys, obsoleteKeys };
  }

  // Add new translation keys to all locales
  async addNewKeys(keys: string[]): Promise<void> {
    console.log(`➕ Adding ${keys.length} new keys to all locales...`);
    
    for (const key of keys) {
      // Add to translation manager
      this.translationManager.addTranslationKey(key, `[${key}]`, {
        description: 'Auto-extracted from source code',
      });
    }

    // Export to files
    await this.translationManager.exportTranslations();
    console.log('✅ New keys added successfully');
  }

  // Remove obsolete keys from all locales
  async removeObsoleteKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    
    console.log(`🗑️  Removing ${keys.length} obsolete keys from all locales...`);
    
    for (const locale of this.config.targetLocales) {
      const filePath = path.join(this.config.messagesPath, `${locale}.json`);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const messages = JSON.parse(content);
        
        // Remove obsolete keys
        for (const key of keys) {
          this.deleteKey(messages, key);
        }
        
        await fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf-8');
      } catch (error) {
        console.error(`Error removing keys from ${locale}:`, error);
      }
    }
    
    console.log('✅ Obsolete keys removed successfully');
  }

  // Auto-translate missing keys
  async autoTranslate(targetLocale: Locale, keys?: string[]): Promise<TranslationJob> {
    const jobId = `translate-${targetLocale}-${Date.now()}`;
    const job: TranslationJob = {
      id: jobId,
      sourceLocale: this.config.sourceLocale,
      targetLocale,
      keys: keys || [],
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);

    try {
      job.status = 'processing';
      
      // Load source translations
      const sourceFile = path.join(this.config.messagesPath, `${this.config.sourceLocale}.json`);
      const sourceContent = await fs.readFile(sourceFile, 'utf-8');
      const sourceMessages = JSON.parse(sourceContent);

      // Load target translations
      const targetFile = path.join(this.config.messagesPath, `${targetLocale}.json`);
      let targetMessages = {};
      
      try {
        const targetContent = await fs.readFile(targetFile, 'utf-8');
        targetMessages = JSON.parse(targetContent);
      } catch (error) {
        console.warn(`Creating new translation file for ${targetLocale}`);
      }

      // Find missing keys
      const missingKeys = keys || this.findMissingKeys(sourceMessages, targetMessages);
      job.keys = missingKeys;

      console.log(`🤖 Auto-translating ${missingKeys.length} keys for ${targetLocale}...`);

      // Process in batches
      for (let i = 0; i < missingKeys.length; i += this.config.batchSize) {
        const batch = missingKeys.slice(i, i + this.config.batchSize);
        
        for (const key of batch) {
          const sourceValue = this.getValueByKey(sourceMessages, key);
          if (sourceValue) {
            const translatedValue = await this.translateText(sourceValue, this.config.sourceLocale, targetLocale);
            this.setValueByKey(targetMessages, key, translatedValue);
          }
        }

        job.progress = Math.round(((i + batch.length) / missingKeys.length) * 100);
        console.log(`Progress: ${job.progress}%`);
      }

      // Save translations
      await fs.writeFile(targetFile, JSON.stringify(targetMessages, null, 2), 'utf-8');

      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();

      console.log(`✅ Auto-translation completed for ${targetLocale}`);
      
    } catch (error) {
      job.status = 'failed';
      job.errors = [error instanceof Error ? error.message : String(error)];
      console.error(`❌ Auto-translation failed for ${targetLocale}:`, error);
    }

    return job;
  }

  // Validate all translations
  async validateAllTranslations(): Promise<{ [locale: string]: any }> {
    if (!this.config.validationEnabled) {
      return {};
    }

    console.log('🔍 Validating all translations...');
    const results: { [locale: string]: any } = {};

    // Load source translations for reference
    const sourceFile = path.join(this.config.messagesPath, `${this.config.sourceLocale}.json`);
    let sourceTranslations = {};
    
    try {
      const sourceContent = await fs.readFile(sourceFile, 'utf-8');
      sourceTranslations = JSON.parse(sourceContent);
    } catch (error) {
      console.error('Could not load source translations for validation:', error);
      return results;
    }

    const flatSourceTranslations = this.flattenObject(sourceTranslations);

    // Validate each target locale
    for (const locale of this.config.targetLocales) {
      try {
        const file = path.join(this.config.messagesPath, `${locale}.json`);
        const content = await fs.readFile(file, 'utf-8');
        const translations = JSON.parse(content);
        const flatTranslations = this.flattenObject(translations);

        const validationReport = await this.validator.validateTranslations(
          flatTranslations,
          locale,
          flatSourceTranslations
        );

        results[locale] = validationReport;

        console.log(
          `${locale.toUpperCase()}: ${validationReport.completionRate.toFixed(1)}% complete, ` +
          `${validationReport.qualityScore.toFixed(1)} quality score, ` +
          `${validationReport.errors.length} errors, ${validationReport.warnings.length} warnings`
        );
      } catch (error) {
        console.error(`Validation failed for ${locale}:`, error);
        results[locale] = { error: error instanceof Error ? error.message : String(error) };
      }
    }

    return results;
  }

  // Generate comprehensive report
  async generateComprehensiveReport(): Promise<string> {
    console.log('📊 Generating comprehensive i18n report...');
    
    let report = '# Internationalization Report\n\n';
    report += `*Generated on ${new Date().toISOString()}*\n\n`;

    // Summary statistics
    report += '## Summary\n\n';
    
    const stats = this.translationManager.getTranslationStats();
    report += '| Locale | Total Keys | Completion Rate | Errors | Warnings |\n';
    report += '|--------|------------|-----------------|--------|----------|\n';
    
    let totalKeys = 0;
    let averageCompletion = 0;
    
    for (const [locale, stat] of Object.entries(stats)) {
      totalKeys = stat.total;
      averageCompletion += stat.completionRate;
      
      // Get validation results
      const filePath = path.join(this.config.messagesPath, `${locale}.json`);
      let errors = 0;
      let warnings = 0;
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const translations = this.flattenObject(JSON.parse(content));
        const validationReport = await this.validator.validateTranslations(translations, locale as Locale);
        errors = validationReport.errors.length;
        warnings = validationReport.warnings.length;
      } catch (error) {
        // Handle validation errors
      }
      
      report += `| ${locale.toUpperCase()} | ${stat.total} | ${stat.completionRate.toFixed(1)}% | ${errors} | ${warnings} |\n`;
    }
    
    averageCompletion /= Object.keys(stats).length;
    
    report += '\n### Key Metrics\n\n';
    report += `- **Total Translation Keys**: ${totalKeys}\n`;
    report += `- **Supported Languages**: ${this.config.targetLocales.length}\n`;
    report += `- **Average Completion**: ${averageCompletion.toFixed(1)}%\n`;
    report += `- **RTL Languages Supported**: ${this.config.targetLocales.filter(l => LocaleDetector.isRTL(l)).length}\n\n`;

    // Cultural adaptations
    report += '## Cultural Adaptations\n\n';
    for (const locale of this.config.targetLocales) {
      const config = this.localeDetector['options'];
      report += `### ${LocaleDetector.getLocaleDisplayName(locale)}\n`;
      report += `- **Native Name**: ${LocaleDetector.getLocaleDisplayName(locale, true)}\n`;
      report += `- **Text Direction**: ${LocaleDetector.getDirection(locale)}\n`;
      report += `- **Cultural Context**: Implemented\n\n`;
    }

    // Recent activity
    report += '## Recent Translation Activity\n\n';
    const recentJobs = Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);
    
    if (recentJobs.length > 0) {
      report += '| Job ID | Target Locale | Status | Keys | Progress |\n';
      report += '|--------|---------------|--------|------|----------|\n';
      
      for (const job of recentJobs) {
        report += `| ${job.id} | ${job.targetLocale.toUpperCase()} | ${job.status} | ${job.keys.length} | ${job.progress}% |\n`;
      }
    } else {
      report += '*No recent translation activity*\n';
    }

    report += '\n## Validation Report\n\n';
    const validationResults = await this.validateAllTranslations();
    
    for (const [locale, result] of Object.entries(validationResults)) {
      if (result.error) {
        report += `### ${locale.toUpperCase()}\n**Error**: ${result.error}\n\n`;
      } else {
        report += `### ${locale.toUpperCase()}\n`;
        report += `- **Completion Rate**: ${result.completionRate?.toFixed(1)}%\n`;
        report += `- **Quality Score**: ${result.qualityScore?.toFixed(1)}\n`;
        report += `- **Errors**: ${result.errors?.length || 0}\n`;
        report += `- **Warnings**: ${result.warnings?.length || 0}\n\n`;
      }
    }

    // Recommendations
    report += '## Recommendations\n\n';
    
    if (averageCompletion < 90) {
      report += '- 🎯 **Priority**: Increase translation completion rate to 90%+\n';
    }
    
    if (this.config.targetLocales.some(l => LocaleDetector.isRTL(l))) {
      report += '- 🌐 **RTL Support**: Continue testing RTL language implementations\n';
    }
    
    report += '- 🔄 **Automation**: Regular validation and auto-translation for new keys\n';
    report += '- 📱 **Testing**: Cross-browser testing for all supported locales\n';
    report += '- 👥 **Review**: Native speaker review for critical translations\n\n';

    return report;
  }

  // Utility methods
  private async scanDirectory(dirPath: string, extractedKeys: Set<string>): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, extractedKeys);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          await this.scanFile(fullPath, extractedKeys);
        }
      }
    } catch (error) {
      // Directory doesn't exist or no permission
    }
  }

  private async scanFile(filePath: string, extractedKeys: Set<string>): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Match t('key') calls
      const tCallRegex = /\bt\s*\(\s*['"`]([^'"`]+)['"`]\s*[,)]/g;
      let match;
      
      while ((match = tCallRegex.exec(content)) !== null) {
        extractedKeys.add(match[1]);
      }
      
      // Match useTranslation hook usage
      const useTranslationRegex = /useTranslation\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      while ((match = useTranslationRegex.exec(content)) !== null) {
        // This would need more sophisticated parsing to find the actual keys
        // For now, we'll rely on the t() calls
      }
      
    } catch (error) {
      console.warn(`Could not scan file ${filePath}:`, error);
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private collectKeys(obj: any, prefix: string, keys: Set<string>): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        keys.add(fullKey);
      } else if (typeof value === 'object' && value !== null) {
        this.collectKeys(value, fullKey, keys);
      }
    }
  }

  private findMissingKeys(sourceObj: any, targetObj: any, prefix = ''): string[] {
    const missing: string[] = [];
    
    for (const [key, value] of Object.entries(sourceObj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        if (!this.hasKey(targetObj, fullKey)) {
          missing.push(fullKey);
        }
      } else if (typeof value === 'object' && value !== null) {
        missing.push(...this.findMissingKeys(value, targetObj, fullKey));
      }
    }
    
    return missing;
  }

  private hasKey(obj: any, key: string): boolean {
    const keys = key.split('.');
    let current = obj;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return false;
      }
    }
    
    return typeof current === 'string' && current.trim() !== '';
  }

  private getValueByKey(obj: any, key: string): string | null {
    const keys = key.split('.');
    let current = obj;
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return null;
      }
    }
    
    return typeof current === 'string' ? current : null;
  }

  private setValueByKey(obj: any, key: string, value: string): void {
    const keys = key.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  private deleteKey(obj: any, key: string): void {
    const keys = key.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return; // Key doesn't exist
      }
    }
    
    if (current && typeof current === 'object') {
      delete current[keys[keys.length - 1]];
    }
  }

  private flattenObject(obj: any, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'string') {
        flattened[fullKey] = value;
      } else if (typeof value === 'object' && value !== null) {
        Object.assign(flattened, this.flattenObject(value, fullKey));
      }
    }
    
    return flattened;
  }

  private async translateText(text: string, sourceLocale: Locale, targetLocale: Locale): Promise<string> {
    // Mock translation service
    // In a real implementation, you would integrate with Google Translate, Azure Translator, etc.
    
    switch (this.config.translationService) {
      case 'mock':
        return `[${targetLocale.toUpperCase()}] ${text}`;
      
      case 'google':
        // Integration with Google Translate API
        throw new Error('Google Translate integration not implemented');
      
      case 'azure':
        // Integration with Azure Translator
        throw new Error('Azure Translator integration not implemented');
      
      case 'aws':
        // Integration with AWS Translate
        throw new Error('AWS Translate integration not implemented');
      
      default:
        return `[AUTO-${targetLocale.toUpperCase()}] ${text}`;
    }
  }

  // Public API methods
  getJob(jobId: string): TranslationJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): TranslationJob[] {
    return Array.from(this.jobs.values());
  }

  async runFullAutomation(): Promise<void> {
    console.log('🚀 Running full i18n automation...');
    
    // 1. Extract new keys
    const { newKeys, obsoleteKeys } = await this.extractNewKeys();
    
    // 2. Add new keys
    if (newKeys.length > 0) {
      await this.addNewKeys(newKeys);
    }
    
    // 3. Remove obsolete keys
    if (obsoleteKeys.length > 0) {
      await this.removeObsoleteKeys(obsoleteKeys);
    }
    
    // 4. Auto-translate if enabled
    if (this.config.autoTranslate) {
      for (const locale of this.config.targetLocales) {
        await this.autoTranslate(locale);
      }
    }
    
    // 5. Validate all translations
    await this.validateAllTranslations();
    
    // 6. Generate report
    const report = await this.generateComprehensiveReport();
    const reportPath = path.join(process.cwd(), 'i18n-automation-report.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    
    console.log(`✅ Full automation completed. Report saved to ${reportPath}`);
  }
}