#!/usr/bin/env node

/**
 * Comprehensive i18n automation script
 * 
 * This script provides automation for the entire internationalization workflow:
 * - Extracting translation keys from source code
 * - Validating existing translations
 * - Auto-translating missing keys (mock implementation)
 * - Generating comprehensive reports
 * - Quality assurance checks
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  sourceLocale: 'en',
  targetLocales: ['es', 'fr', 'de', 'ja', 'ar'],
  messagesPath: path.join(__dirname, '..', 'messages'),
  srcPaths: ['src', 'app', 'components'],
  extractPatterns: [
    /\bt\s*\(\s*['"`]([^'"`]+)['"`]\s*[,)]/g,
    /useTranslation\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  ],
  validationRules: {
    maxLengthRatio: 3.0,
    minLengthRatio: 0.3,
    requirePunctuation: ['description', 'message', 'subtitle'],
  },
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = {
    info: '📝',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    progress: '🔄',
  }[type] || '📝';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

// Translation key extraction
async function extractKeysFromFile(filePath) {
  const keys = new Set();
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    for (const pattern of CONFIG.extractPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && !match[1].includes(' ')) {
          keys.add(match[1]);
        }
      }
    }
  } catch (error) {
    log(`Error scanning file ${filePath}: ${error.message}`, 'error');
  }
  
  return Array.from(keys);
}

async function scanDirectory(dirPath) {
  const allKeys = new Set();
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const subKeys = await scanDirectory(fullPath);
        subKeys.forEach(key => allKeys.add(key));
      } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const fileKeys = await extractKeysFromFile(fullPath);
        fileKeys.forEach(key => allKeys.add(key));
      }
    }
  } catch (error) {
    log(`Error scanning directory ${dirPath}: ${error.message}`, 'error');
  }
  
  return Array.from(allKeys);
}

async function extractAllKeys() {
  log('Extracting translation keys from source code...', 'progress');
  
  const allKeys = new Set();
  
  for (const srcPath of CONFIG.srcPaths) {
    const fullPath = path.join(process.cwd(), srcPath);
    
    if (await directoryExists(fullPath)) {
      const keys = await scanDirectory(fullPath);
      keys.forEach(key => allKeys.add(key));
      log(`Found ${keys.length} keys in ${srcPath}/`);
    }
  }
  
  const uniqueKeys = Array.from(allKeys).sort();
  log(`Total unique keys extracted: ${uniqueKeys.length}`, 'success');
  
  return uniqueKeys;
}

// Translation file management
async function loadTranslations(locale) {
  const filePath = path.join(CONFIG.messagesPath, `${locale}.json`);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      log(`Translation file for ${locale} not found, creating empty object`);
      return {};
    }
    throw error;
  }
}

async function saveTranslations(locale, translations) {
  const filePath = path.join(CONFIG.messagesPath, `${locale}.json`);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  
  // Save with formatting
  const formatted = JSON.stringify(translations, null, 2);
  await fs.writeFile(filePath, formatted, 'utf-8');
}

function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof value === 'string') {
      flattened[fullKey] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(flattened, flattenObject(value, fullKey));
    }
  }
  
  return flattened;
}

function unflattenObject(flat) {
  const unflattened = {};
  
  for (const [key, value] of Object.entries(flat)) {
    const keys = key.split('.');
    let current = unflattened;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  return unflattened;
}

// Validation functions
function validateTranslation(key, value, sourceValue) {
  const issues = [];
  
  // Check for empty translations
  if (!value || value.trim() === '') {
    issues.push({ severity: 'error', message: 'Translation is empty' });
    return issues;
  }
  
  // Check for untranslated placeholders
  if (value.startsWith('[') && value.endsWith(']')) {
    issues.push({ severity: 'warning', message: 'Appears to be untranslated placeholder' });
  }
  
  // Check length ratio
  if (sourceValue) {
    const ratio = value.length / sourceValue.length;
    
    if (ratio < CONFIG.validationRules.minLengthRatio) {
      issues.push({ 
        severity: 'warning', 
        message: `Translation seems too short (ratio: ${ratio.toFixed(2)})` 
      });
    } else if (ratio > CONFIG.validationRules.maxLengthRatio) {
      issues.push({ 
        severity: 'warning', 
        message: `Translation seems too long (ratio: ${ratio.toFixed(2)})` 
      });
    }
  }
  
  // Check for proper punctuation
  for (const keyType of CONFIG.validationRules.requirePunctuation) {
    if (key.includes(keyType)) {
      const lastChar = value.trim().slice(-1);
      if (!['.', '!', '?', ':', '؟', '！'].includes(lastChar)) {
        issues.push({ 
          severity: 'warning', 
          message: 'Missing punctuation at end of sentence' 
        });
      }
      break;
    }
  }
  
  // Check for placeholder consistency
  if (sourceValue) {
    const sourcePlaceholders = (sourceValue.match(/\{[^}]+\}/g) || []).sort();
    const targetPlaceholders = (value.match(/\{[^}]+\}/g) || []).sort();
    
    if (JSON.stringify(sourcePlaceholders) !== JSON.stringify(targetPlaceholders)) {
      issues.push({ 
        severity: 'error', 
        message: `Placeholder mismatch. Expected: ${sourcePlaceholders.join(', ')}, Found: ${targetPlaceholders.join(', ')}` 
      });
    }
  }
  
  return issues;
}

async function validateAllTranslations() {
  log('Validating all translations...', 'progress');
  
  const sourceTranslations = await loadTranslations(CONFIG.sourceLocale);
  const flatSource = flattenObject(sourceTranslations);
  
  const validationResults = {};
  
  for (const locale of CONFIG.targetLocales) {
    log(`Validating ${locale}...`);
    
    const translations = await loadTranslations(locale);
    const flatTranslations = flattenObject(translations);
    
    const results = {
      locale,
      totalKeys: Object.keys(flatSource).length,
      translatedKeys: 0,
      errors: [],
      warnings: [],
      missingKeys: [],
    };
    
    // Check each key
    for (const [key, sourceValue] of Object.entries(flatSource)) {
      const translatedValue = flatTranslations[key];
      
      if (!translatedValue) {
        results.missingKeys.push(key);
      } else {
        results.translatedKeys++;
        
        const issues = validateTranslation(key, translatedValue, sourceValue);
        
        for (const issue of issues) {
          const issueObj = { key, ...issue };
          
          if (issue.severity === 'error') {
            results.errors.push(issueObj);
          } else if (issue.severity === 'warning') {
            results.warnings.push(issueObj);
          }
        }
      }
    }
    
    results.completionRate = (results.translatedKeys / results.totalKeys) * 100;
    results.qualityScore = Math.max(0, 100 - (results.errors.length * 10) - (results.warnings.length * 5));
    
    validationResults[locale] = results;
    
    log(`${locale}: ${results.completionRate.toFixed(1)}% complete, ${results.qualityScore.toFixed(1)} quality score`);
  }
  
  return validationResults;
}

// Auto-translation (mock implementation)
function mockTranslate(text, sourceLocale, targetLocale) {
  // This is a mock implementation
  // In a real application, you would integrate with Google Translate, Azure Translator, etc.
  
  const prefixes = {
    es: 'ES',
    fr: 'FR', 
    de: 'DE',
    ja: 'JA',
    ar: 'AR',
  };
  
  return `[${prefixes[targetLocale] || targetLocale.toUpperCase()}] ${text}`;
}

async function autoTranslateMissing() {
  log('Auto-translating missing keys...', 'progress');
  
  const sourceTranslations = await loadTranslations(CONFIG.sourceLocale);
  const flatSource = flattenObject(sourceTranslations);
  
  for (const locale of CONFIG.targetLocales) {
    log(`Processing ${locale}...`);
    
    const translations = await loadTranslations(locale);
    const flatTranslations = flattenObject(translations);
    
    let addedCount = 0;
    
    for (const [key, sourceValue] of Object.entries(flatSource)) {
      if (!flatTranslations[key]) {
        const translatedValue = mockTranslate(sourceValue, CONFIG.sourceLocale, locale);
        flatTranslations[key] = translatedValue;
        addedCount++;
      }
    }
    
    if (addedCount > 0) {
      const unflattenedTranslations = unflattenObject(flatTranslations);
      await saveTranslations(locale, unflattenedTranslations);
      log(`Added ${addedCount} translations for ${locale}`, 'success');
    }
  }
}

// Reporting
async function generateReport() {
  log('Generating comprehensive report...', 'progress');
  
  const validationResults = await validateAllTranslations();
  const extractedKeys = await extractAllKeys();
  
  let report = '# Internationalization Report\n\n';
  report += `*Generated on ${new Date().toISOString()}*\n\n`;
  
  // Summary
  report += '## Summary\n\n';
  report += `- **Source Locale**: ${CONFIG.sourceLocale}\n`;
  report += `- **Target Locales**: ${CONFIG.targetLocales.join(', ')}\n`;
  report += `- **Extracted Keys**: ${extractedKeys.length}\n`;
  report += `- **Source Paths**: ${CONFIG.srcPaths.join(', ')}\n\n`;
  
  // Statistics table
  report += '## Translation Statistics\n\n';
  report += '| Locale | Total Keys | Translated | Missing | Completion | Quality Score | Errors | Warnings |\n';
  report += '|--------|------------|------------|---------|------------|---------------|--------|----------|\n';
  
  for (const [locale, results] of Object.entries(validationResults)) {
    report += `| ${locale.toUpperCase()} | ${results.totalKeys} | ${results.translatedKeys} | ${results.missingKeys.length} | ${results.completionRate.toFixed(1)}% | ${results.qualityScore.toFixed(1)} | ${results.errors.length} | ${results.warnings.length} |\n`;
  }
  
  // Detailed issues
  report += '\n## Validation Issues\n\n';
  
  for (const [locale, results] of Object.entries(validationResults)) {
    if (results.errors.length > 0 || results.warnings.length > 0) {
      report += `### ${locale.toUpperCase()}\n\n`;
      
      if (results.errors.length > 0) {
        report += '#### Errors\n\n';
        for (const error of results.errors.slice(0, 10)) { // Limit to first 10
          report += `- **${error.key}**: ${error.message}\n`;
        }
        if (results.errors.length > 10) {
          report += `- ... and ${results.errors.length - 10} more errors\n`;
        }
        report += '\n';
      }
      
      if (results.warnings.length > 0) {
        report += '#### Warnings\n\n';
        for (const warning of results.warnings.slice(0, 10)) { // Limit to first 10
          report += `- **${warning.key}**: ${warning.message}\n`;
        }
        if (results.warnings.length > 10) {
          report += `- ... and ${results.warnings.length - 10} more warnings\n`;
        }
        report += '\n';
      }
    }
  }
  
  // Missing keys summary
  report += '## Missing Translations\n\n';
  
  for (const [locale, results] of Object.entries(validationResults)) {
    if (results.missingKeys.length > 0) {
      report += `### ${locale.toUpperCase()} (${results.missingKeys.length} missing)\n\n`;
      
      // Group by namespace
      const grouped = {};
      for (const key of results.missingKeys) {
        const namespace = key.split('.')[0];
        if (!grouped[namespace]) grouped[namespace] = [];
        grouped[namespace].push(key);
      }
      
      for (const [namespace, keys] of Object.entries(grouped)) {
        report += `- **${namespace}**: ${keys.length} keys\n`;
      }
      report += '\n';
    }
  }
  
  // Recommendations
  report += '## Recommendations\n\n';
  
  const avgCompletion = Object.values(validationResults)
    .reduce((sum, r) => sum + r.completionRate, 0) / CONFIG.targetLocales.length;
  
  if (avgCompletion < 90) {
    report += '- 🎯 **Priority**: Increase overall completion rate to 90%+\n';
  }
  
  const totalErrors = Object.values(validationResults)
    .reduce((sum, r) => sum + r.errors.length, 0);
  
  if (totalErrors > 0) {
    report += '- 🚨 **Critical**: Fix validation errors before release\n';
  }
  
  report += '- 🔄 **Automation**: Set up continuous integration for translation validation\n';
  report += '- 👥 **Review**: Native speaker review for high-priority content\n';
  report += '- 🧪 **Testing**: UI testing in all supported locales\n\n';
  
  return report;
}

// CLI interface
async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'extract':
        await extractAllKeys();
        break;
        
      case 'validate':
        await validateAllTranslations();
        break;
        
      case 'auto-translate':
        await autoTranslateMissing();
        break;
        
      case 'report':
        const report = await generateReport();
        const reportPath = path.join(process.cwd(), 'i18n-report.md');
        await fs.writeFile(reportPath, report, 'utf-8');
        log(`Report saved to ${reportPath}`, 'success');
        break;
        
      case 'full':
        log('Running full i18n automation pipeline...', 'progress');
        
        // 1. Extract keys
        const extractedKeys = await extractAllKeys();
        
        // 2. Auto-translate missing
        await autoTranslateMissing();
        
        // 3. Validate all
        await validateAllTranslations();
        
        // 4. Generate report
        const fullReport = await generateReport();
        const fullReportPath = path.join(process.cwd(), 'i18n-automation-report.md');
        await fs.writeFile(fullReportPath, fullReport, 'utf-8');
        
        log('Full automation completed!', 'success');
        log(`Report available at: ${fullReportPath}`);
        break;
        
      default:
        console.log('i18n Automation Tool\n');
        console.log('Available commands:');
        console.log('  extract      - Extract translation keys from source code');
        console.log('  validate     - Validate existing translations');
        console.log('  auto-translate - Auto-translate missing keys (mock)');
        console.log('  report       - Generate comprehensive report');
        console.log('  full         - Run complete automation pipeline');
        console.log('\nExamples:');
        console.log('  node scripts/i18n-automation.js extract');
        console.log('  node scripts/i18n-automation.js full');
        break;
    }
  } catch (error) {
    log(`Command failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  extractAllKeys,
  validateAllTranslations,
  autoTranslateMissing,
  generateReport,
};