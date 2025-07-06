#!/usr/bin/env ts-node

import { TranslationManager, Locale } from '../lib/i18n/translation-manager';
import fs from 'fs/promises';
import path from 'path';

/**
 * Command-line tools for managing translations
 * 
 * Usage:
 * npm run translations:extract    - Extract new translation keys from code
 * npm run translations:stats      - Show translation statistics
 * npm run translations:validate   - Validate translations for issues
 * npm run translations:export     - Export translations to JSON files
 * npm run translations:report     - Generate complete translation report
 * npm run translations:missing    - Show missing translations for a locale
 */

class TranslationTools {
  private manager: TranslationManager;

  constructor() {
    this.manager = TranslationManager.getInstance();
  }

  // Extract translation keys from source code
  async extractTranslationKeys(): Promise<void> {
    console.log('🔍 Extracting translation keys from source code...');
    
    const srcPath = path.join(process.cwd(), 'src');
    const appPath = path.join(process.cwd(), 'app');
    const componentsPath = path.join(process.cwd(), 'components');
    
    const extractedKeys = new Set<string>();
    
    // Scan TypeScript/TSX files for translation calls
    await this.scanDirectory(srcPath, extractedKeys);
    await this.scanDirectory(appPath, extractedKeys);
    await this.scanDirectory(componentsPath, extractedKeys);
    
    console.log(`📝 Found ${extractedKeys.size} translation keys`);
    
    // Add new keys to translation manager
    for (const key of extractedKeys) {
      try {
        this.manager.addTranslationKey(key, `[${key}]`, {
          description: `Auto-extracted from code`
        });
      } catch (error) {
        // Key already exists, skip
      }
    }
    
    console.log('✅ Translation key extraction completed');
  }

  private async scanDirectory(dirPath: string, extractedKeys: Set<string>): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
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
      
      // Match useTranslations calls: useTranslations('namespace')
      const useTranslationsRegex = /useTranslations\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      let match;
      
      while ((match = useTranslationsRegex.exec(content)) !== null) {
        const namespace = match[1];
        
        // Find t('key') calls in the same file
        const tCallRegex = new RegExp(`t\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*[,)]`, 'g');
        let tMatch;
        
        while ((tMatch = tCallRegex.exec(content)) !== null) {
          const key = tMatch[1];
          extractedKeys.add(`${namespace}.${key}`);
        }
      }
      
      // Also match direct translation calls: t('namespace.key')
      const directCallRegex = /t\s*\(\s*['"`]([^'"`]+)['"`]\s*[,)]/g;
      while ((match = directCallRegex.exec(content)) !== null) {
        const fullKey = match[1];
        if (fullKey.includes('.')) {
          extractedKeys.add(fullKey);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️  Could not scan file ${filePath}:`, error);
    }
  }

  // Show translation statistics
  async showStats(): Promise<void> {
    console.log('📊 Translation Statistics\n');
    
    await this.manager.loadTranslations();
    const stats = this.manager.getTranslationStats();
    
    console.log('┌─────────┬───────┬────────────┬──────────┬──────────┬─────────┬─────────────┐');
    console.log('│ Locale  │ Total │ Translated │ Reviewed │ Approved │ Pending │ Completion  │');
    console.log('├─────────┼───────┼────────────┼──────────┼──────────┼─────────┼─────────────┤');
    
    for (const [locale, stat] of Object.entries(stats)) {
      const completion = `${stat.completionRate.toFixed(1)}%`;
      console.log(`│ ${locale.padEnd(7)} │ ${stat.total.toString().padStart(5)} │ ${stat.translated.toString().padStart(10)} │ ${stat.reviewed.toString().padStart(8)} │ ${stat.approved.toString().padStart(8)} │ ${stat.pending.toString().padStart(7)} │ ${completion.padStart(11)} │`);
    }
    
    console.log('└─────────┴───────┴────────────┴──────────┴──────────┴─────────┴─────────────┘');
  }

  // Validate translations
  async validateTranslations(): Promise<void> {
    console.log('🔍 Validating translations...\n');
    
    await this.manager.loadTranslations();
    const issues = this.manager.validateTranslations();
    
    if (issues.length === 0) {
      console.log('✅ No validation issues found!');
      return;
    }
    
    console.log(`⚠️  Found ${issues.length} validation issues:\n`);
    
    for (const issue of issues) {
      console.log(`🔑 ${issue.key}`);
      for (const problem of issue.issues) {
        console.log(`   ❌ ${problem}`);
      }
      console.log();
    }
  }

  // Export translations
  async exportTranslations(): Promise<void> {
    console.log('📤 Exporting translations to JSON files...');
    
    await this.manager.loadTranslations();
    await this.manager.exportTranslations();
    
    console.log('✅ Translation export completed');
  }

  // Generate translation report
  async generateReport(): Promise<void> {
    console.log('📋 Generating translation report...');
    
    await this.manager.loadTranslations();
    const report = this.manager.generateTranslationReport();
    
    const reportPath = path.join(process.cwd(), 'translation-report.md');
    await fs.writeFile(reportPath, report, 'utf-8');
    
    console.log(`✅ Translation report saved to ${reportPath}`);
  }

  // Show missing translations for a locale
  async showMissingTranslations(locale: Locale): Promise<void> {
    console.log(`🔍 Missing translations for ${locale.toUpperCase()}:\n`);
    
    await this.manager.loadTranslations();
    const missing = this.manager.getMissingTranslations(locale);
    
    if (missing.length === 0) {
      console.log('✅ No missing translations!');
      return;
    }
    
    console.log(`📝 Found ${missing.length} missing translations:\n`);
    
    for (const key of missing) {
      console.log(`   • ${key.key}`);
      if (key.description) {
        console.log(`     ${key.description}`);
      }
      if (key.defaultValue) {
        console.log(`     Default: "${key.defaultValue}"`);
      }
      console.log();
    }
  }

  // Search translations
  async searchTranslations(query: string, locale?: Locale): Promise<void> {
    console.log(`🔍 Searching for "${query}"${locale ? ` in ${locale.toUpperCase()}` : ''}:\n`);
    
    await this.manager.loadTranslations();
    const results = this.manager.searchTranslations(query, locale);
    
    if (results.length === 0) {
      console.log('❌ No results found');
      return;
    }
    
    console.log(`📝 Found ${results.length} results:\n`);
    
    for (const result of results) {
      console.log(`🔑 ${result.key.key}`);
      if (result.key.description) {
        console.log(`   Description: ${result.key.description}`);
      }
      
      if (locale) {
        const translation = result.translations[locale];
        if (translation) {
          console.log(`   ${locale.toUpperCase()}: "${translation.value}" [${translation.status}]`);
        }
      } else {
        for (const [loc, translation] of Object.entries(result.translations)) {
          console.log(`   ${loc.toUpperCase()}: "${translation.value}" [${translation.status}]`);
        }
      }
      console.log();
    }
  }
}

// CLI Interface
async function main() {
  const tools = new TranslationTools();
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'extract':
      await tools.extractTranslationKeys();
      break;
    
    case 'stats':
      await tools.showStats();
      break;
    
    case 'validate':
      await tools.validateTranslations();
      break;
    
    case 'export':
      await tools.exportTranslations();
      break;
    
    case 'report':
      await tools.generateReport();
      break;
    
    case 'missing':
      if (!arg || !['en', 'es', 'fr', 'de', 'ja', 'ar'].includes(arg)) {
        console.error('❌ Please specify a valid locale: en, es, fr, de, ja, ar');
        process.exit(1);
      }
      await tools.showMissingTranslations(arg as Locale);
      break;
    
    case 'search':
      if (!arg) {
        console.error('❌ Please provide a search query');
        process.exit(1);
      }
      const locale = process.argv[4] as Locale | undefined;
      await tools.searchTranslations(arg, locale);
      break;
    
    default:
      console.log('📚 Translation Tools\n');
      console.log('Available commands:');
      console.log('  extract              - Extract translation keys from code');
      console.log('  stats                - Show translation statistics');
      console.log('  validate             - Validate translations for issues');
      console.log('  export               - Export translations to JSON files');
      console.log('  report               - Generate complete translation report');
      console.log('  missing <locale>     - Show missing translations for locale');
      console.log('  search <query> [locale] - Search translations');
      console.log('\nExamples:');
      console.log('  npm run translations:stats');
      console.log('  npm run translations:missing es');
      console.log('  npm run translations:search "welcome" ar');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { TranslationTools };