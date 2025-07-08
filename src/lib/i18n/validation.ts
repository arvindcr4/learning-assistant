import { Locale } from './provider';

export interface ValidationRule {
  name: string;
  description: string;
  validate: (value: string, key: string, locale: Locale, context?: any) => ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  severity: 'error' | 'warning' | 'info';
  message?: string;
  suggestion?: string;
}

export interface TranslationValidationReport {
  locale: Locale;
  totalKeys: number;
  validKeys: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
  completionRate: number;
  qualityScore: number;
}

export interface ValidationIssue {
  key: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
  value: string;
}

export class TranslationValidator {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    // Required field validation
    this.addRule({
      name: 'required',
      description: 'Translation must not be empty',
      validate: (value: string) => ({
        isValid: value.trim().length > 0,
        severity: 'error',
        message: value.trim().length === 0 ? 'Translation is required' : undefined,
      }),
    });

    // Placeholder validation
    this.addRule({
      name: 'placeholders',
      description: 'All placeholders from source must be present',
      validate: (value: string, key: string, locale: Locale, context?: { sourceValue?: string }) => {
        if (!context?.sourceValue) {
          return { isValid: true, severity: 'info' };
        }

        const sourcePlaceholders = this.extractPlaceholders(context.sourceValue);
        const translationPlaceholders = this.extractPlaceholders(value);
        
        const missingPlaceholders = sourcePlaceholders.filter(
          placeholder => !translationPlaceholders.includes(placeholder)
        );
        
        const extraPlaceholders = translationPlaceholders.filter(
          placeholder => !sourcePlaceholders.includes(placeholder)
        );

        if (missingPlaceholders.length > 0) {
          return {
            isValid: false,
            severity: 'error',
            message: `Missing placeholders: ${missingPlaceholders.join(', ')}`,
            suggestion: `Add these placeholders: ${missingPlaceholders.map(p => `{${p}}`).join(', ')}`,
          };
        }

        if (extraPlaceholders.length > 0) {
          return {
            isValid: false,
            severity: 'warning',
            message: `Extra placeholders: ${extraPlaceholders.join(', ')}`,
            suggestion: `Remove these placeholders: ${extraPlaceholders.map(p => `{${p}}`).join(', ')}`,
          };
        }

        return { isValid: true, severity: 'info' };
      },
    });

    // Length validation
    this.addRule({
      name: 'length',
      description: 'Translation length should be reasonable compared to source',
      validate: (value: string, key: string, locale: Locale, context?: { sourceValue?: string; maxLength?: number }) => {
        if (context?.maxLength && value.length > context.maxLength) {
          return {
            isValid: false,
            severity: 'warning',
            message: `Translation exceeds maximum length (${value.length}/${context.maxLength})`,
            suggestion: 'Consider shortening the translation',
          };
        }

        if (context?.sourceValue) {
          const sourceLength = context.sourceValue.length;
          const ratio = value.length / sourceLength;
          
          // Flag translations that are unusually short or long
          if (ratio < 0.3) {
            return {
              isValid: true,
              severity: 'warning',
              message: 'Translation seems unusually short compared to source',
              suggestion: 'Verify that the translation is complete',
            };
          }
          
          if (ratio > 3.0) {
            return {
              isValid: true,
              severity: 'warning',
              message: 'Translation seems unusually long compared to source',
              suggestion: 'Consider making the translation more concise',
            };
          }
        }

        return { isValid: true, severity: 'info' };
      },
    });

    // HTML/markup validation
    this.addRule({
      name: 'markup',
      description: 'HTML tags should be preserved correctly',
      validate: (value: string, key: string, locale: Locale, context?: { sourceValue?: string }) => {
        if (!context?.sourceValue) {
          return { isValid: true, severity: 'info' };
        }

        const sourceTags = this.extractHtmlTags(context.sourceValue);
        const translationTags = this.extractHtmlTags(value);
        
        const missingTags = sourceTags.filter(tag => !translationTags.includes(tag));
        const extraTags = translationTags.filter(tag => !sourceTags.includes(tag));

        if (missingTags.length > 0 || extraTags.length > 0) {
          return {
            isValid: false,
            severity: 'error',
            message: `HTML tag mismatch. Missing: [${missingTags.join(', ')}], Extra: [${extraTags.join(', ')}]`,
            suggestion: 'Ensure all HTML tags from source are preserved in translation',
          };
        }

        return { isValid: true, severity: 'info' };
      },
    });

    // Cultural appropriateness validation
    this.addRule({
      name: 'cultural',
      description: 'Check for culturally appropriate content',
      validate: (value: string, key: string, locale: Locale) => {
        const culturalChecks = this.getCulturalChecks(locale);
        
        for (const check of culturalChecks) {
          if (check.pattern.test(value)) {
            return {
              isValid: false,
              severity: 'warning',
              message: check.message,
              suggestion: check.suggestion,
            };
          }
        }

        return { isValid: true, severity: 'info' };
      },
    });

    // Consistency validation
    this.addRule({
      name: 'consistency',
      description: 'Check for consistent terminology',
      validate: (value: string, key: string, locale: Locale, context?: { glossary?: Record<string, string> }) => {
        if (!context?.glossary) {
          return { isValid: true, severity: 'info' };
        }

        const inconsistencies: string[] = [];
        
        for (const [term, preferredTranslation] of Object.entries(context.glossary)) {
          const termRegex = new RegExp(`\\b${term}\\b`, 'i');
          const preferredRegex = new RegExp(`\\b${preferredTranslation}\\b`, 'i');
          
          if (termRegex.test(value) && !preferredRegex.test(value)) {
            inconsistencies.push(`"${term}" should be translated as "${preferredTranslation}"`);
          }
        }

        if (inconsistencies.length > 0) {
          return {
            isValid: false,
            severity: 'warning',
            message: `Terminology inconsistency: ${inconsistencies.join(', ')}`,
            suggestion: 'Use consistent terminology as defined in the glossary',
          };
        }

        return { isValid: true, severity: 'info' };
      },
    });

    // Formatting validation
    this.addRule({
      name: 'formatting',
      description: 'Check for proper formatting (punctuation, capitalization)',
      validate: (value: string, key: string, locale: Locale) => {
        const issues: string[] = [];
        
        // Check for double spaces
        if (value.includes('  ')) {
          issues.push('Contains double spaces');
        }
        
        // Check for trailing/leading whitespace
        if (value !== value.trim()) {
          issues.push('Has leading or trailing whitespace');
        }
        
        // Check for proper sentence ending (for specific key types)
        if (key.includes('.description') || key.includes('.message')) {
          const lastChar = value.trim().slice(-1);
          if (!['.', '!', '?', ':', '؟', '！'].includes(lastChar)) {
            issues.push('Sentence should end with punctuation');
          }
        }

        if (issues.length > 0) {
          return {
            isValid: false,
            severity: 'warning',
            message: issues.join(', '),
            suggestion: 'Fix formatting issues',
          };
        }

        return { isValid: true, severity: 'info' };
      },
    });
  }

  addRule(rule: ValidationRule) {
    this.rules.push(rule);
  }

  removeRule(name: string) {
    this.rules = this.rules.filter(rule => rule.name !== name);
  }

  async validateTranslation(
    key: string,
    value: string,
    locale: Locale,
    context?: {
      sourceValue?: string;
      maxLength?: number;
      glossary?: Record<string, string>;
    }
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.validate(value, key, locale, context);
        
        if (!result.isValid && result.message) {
          issues.push({
            key,
            rule: rule.name,
            severity: result.severity,
            message: result.message,
            suggestion: result.suggestion,
            value,
          });
        }
      } catch (error) {
        console.error(`Validation rule "${rule.name}" failed for key "${key}":`, error);
      }
    }

    return issues;
  }

  async validateTranslations(
    translations: Record<string, string>,
    locale: Locale,
    sourceTranslations?: Record<string, string>,
    options?: {
      maxLength?: Record<string, number>;
      glossary?: Record<string, string>;
    }
  ): Promise<TranslationValidationReport> {
    const allIssues: ValidationIssue[] = [];
    const totalKeys = Object.keys(translations).length;
    let validKeys = 0;

    for (const [key, value] of Object.entries(translations)) {
      const context = {
        sourceValue: sourceTranslations?.[key],
        maxLength: options?.maxLength?.[key],
        glossary: options?.glossary,
      };

      const issues = await this.validateTranslation(key, value, locale, context);
      allIssues.push(...issues);

      if (issues.every(issue => issue.severity !== 'error')) {
        validKeys++;
      }
    }

    const errors = allIssues.filter(issue => issue.severity === 'error');
    const warnings = allIssues.filter(issue => issue.severity === 'warning');
    const suggestions = allIssues.filter(issue => issue.severity === 'info');

    const completionRate = totalKeys > 0 ? (validKeys / totalKeys) * 100 : 0;
    const qualityScore = this.calculateQualityScore(totalKeys, errors.length, warnings.length);

    return {
      locale,
      totalKeys,
      validKeys,
      errors,
      warnings,
      suggestions,
      completionRate,
      qualityScore,
    };
  }

  private extractPlaceholders(text: string): string[] {
    const matches = text.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }

  private extractHtmlTags(text: string): string[] {
    const matches = text.match(/<[^>]+>/g);
    return matches ? matches.sort() : [];
  }

  private getCulturalChecks(locale: Locale): Array<{ pattern: RegExp; message: string; suggestion: string }> {
    const checks: Array<{ pattern: RegExp; message: string; suggestion: string }> = [];

    switch (locale) {
      case 'ar':
        checks.push({
          pattern: /\bleft\b/i,
          message: 'Reference to "left" may not be appropriate in RTL context',
          suggestion: 'Consider using directional terms like "start" or "end"',
        });
        checks.push({
          pattern: /\bright\b/i,
          message: 'Reference to "right" may not be appropriate in RTL context',
          suggestion: 'Consider using directional terms like "start" or "end"',
        });
        break;
      
      case 'ja':
        checks.push({
          pattern: /[A-Z]{2,}/,
          message: 'All-caps text may not be appropriate in Japanese',
          suggestion: 'Consider using normal case',
        });
        break;
    }

    return checks;
  }

  private calculateQualityScore(total: number, errors: number, warnings: number): number {
    if (total === 0) return 0;
    
    const errorPenalty = (errors / total) * 50;
    const warningPenalty = (warnings / total) * 20;
    
    return Math.max(0, 100 - errorPenalty - warningPenalty);
  }

  generateReport(validationResults: TranslationValidationReport[]): string {
    let report = '# Translation Validation Report\n\n';
    
    report += '## Summary\n\n';
    report += '| Locale | Total Keys | Valid Keys | Completion Rate | Quality Score | Errors | Warnings |\n';
    report += '|--------|------------|------------|-----------------|---------------|--------|----------|\n';
    
    for (const result of validationResults) {
      report += `| ${result.locale.toUpperCase()} | ${result.totalKeys} | ${result.validKeys} | ${result.completionRate.toFixed(1)}% | ${result.qualityScore.toFixed(1)} | ${result.errors.length} | ${result.warnings.length} |\n`;
    }
    
    report += '\n## Detailed Issues\n\n';
    
    for (const result of validationResults) {
      if (result.errors.length > 0 || result.warnings.length > 0) {
        report += `### ${result.locale.toUpperCase()}\n\n`;
        
        if (result.errors.length > 0) {
          report += '#### Errors\n\n';
          for (const error of result.errors) {
            report += `- **${error.key}**: ${error.message}\n`;
            if (error.suggestion) {
              report += `  - *Suggestion*: ${error.suggestion}\n`;
            }
          }
          report += '\n';
        }
        
        if (result.warnings.length > 0) {
          report += '#### Warnings\n\n';
          for (const warning of result.warnings) {
            report += `- **${warning.key}**: ${warning.message}\n`;
            if (warning.suggestion) {
              report += `  - *Suggestion*: ${warning.suggestion}\n`;
            }
          }
          report += '\n';
        }
      }
    }
    
    return report;
  }
}