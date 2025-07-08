#!/usr/bin/env node

/**
 * Code Quality Analyzer for A+ Quality Standards
 * Analyzes TypeScript/JavaScript codebase for quality metrics
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

class CodeQualityAnalyzer {
  constructor(srcDir = 'src') {
    this.srcDir = srcDir;
    this.metrics = {
      totalFiles: 0,
      totalLines: 0,
      totalComponents: 0,
      totalHooks: 0,
      totalUtilities: 0,
      codeComplexity: 0,
      duplicationScore: 0,
      typeScriptCoverage: 0,
      documentationCoverage: 0,
      issues: [],
      warnings: [],
      suggestions: []
    };
  }

  /**
   * Analyzes the entire codebase for quality metrics
   * @returns {Promise<Object>} Analysis results
   */
  async analyze() {
    console.log('🔍 Starting Code Quality Analysis...\n');
    
    try {
      const files = await this.getAllFiles(this.srcDir);
      const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      
      console.log(`📊 Found ${tsFiles.length} TypeScript files to analyze`);
      
      for (const file of tsFiles) {
        await this.analyzeFile(file);
      }
      
      this.calculateOverallMetrics();
      return this.generateReport();
      
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Recursively gets all files in a directory
   * @param {string} dir - Directory path
   * @returns {Promise<string[]>} Array of file paths
   */
  async getAllFiles(dir) {
    const files = [];
    const items = await readdir(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (stats.isFile()) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Analyzes a single file for quality metrics
   * @param {string} filePath - Path to the file
   */
  async analyzeFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      this.metrics.totalFiles++;
      this.metrics.totalLines += lines.length;
      
      // Analyze different aspects
      this.analyzeComplexity(filePath, content);
      this.analyzeDocumentation(filePath, content);
      this.analyzeTypeScript(filePath, content);
      this.analyzeStructure(filePath, content);
      this.analyzeCodeSmells(filePath, content);
      
    } catch (error) {
      this.metrics.issues.push({
        file: filePath,
        type: 'READ_ERROR',
        message: `Failed to read file: ${error.message}`
      });
    }
  }

  /**
   * Analyzes code complexity
   * @param {string} filePath - File path
   * @param {string} content - File content
   */
  analyzeComplexity(filePath, content) {
    // Count cyclomatic complexity indicators
    const complexityPatterns = [
      /if\s*\(/g,
      /else\s*if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /switch\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /&&|\|\|/g,
      /\?\s*:/g
    ];
    
    let complexity = 1; // Base complexity
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    this.metrics.codeComplexity += complexity;
    
    // Flag high complexity files
    if (complexity > 20) {
      this.metrics.issues.push({
        file: filePath,
        type: 'HIGH_COMPLEXITY',
        message: `Cyclomatic complexity is ${complexity} (threshold: 20)`
      });
    } else if (complexity > 15) {
      this.metrics.warnings.push({
        file: filePath,
        type: 'MODERATE_COMPLEXITY',
        message: `Cyclomatic complexity is ${complexity} (consider refactoring)`
      });
    }
  }

  /**
   * Analyzes documentation coverage
   * @param {string} filePath - File path
   * @param {string} content - File content
   */
  analyzeDocumentation(filePath, content) {
    // Count functions and classes
    const functionCount = (content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(|export\s+(?:async\s+)?function)/g) || []).length;
    const classCount = (content.match(/(?:class\s+\w+|interface\s+\w+|type\s+\w+)/g) || []).length;
    const componentCount = (content.match(/(?:const\s+\w+(?:\s*:\s*React\.FC)?|function\s+\w+(?:\s*\(\s*\)\s*\{|\s*\([^)]+\)\s*\{))/g) || []).length;
    
    // Count documentation
    const jsdocCount = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    const commentCount = (content.match(/\/\/[^\n]*/g) || []).length;
    
    const totalDocumentableItems = functionCount + classCount + componentCount;
    const documentationRatio = totalDocumentableItems > 0 ? (jsdocCount / totalDocumentableItems) * 100 : 100;
    
    this.metrics.documentationCoverage += documentationRatio;
    
    // Check for React components
    if (filePath.endsWith('.tsx') && componentCount > 0) {
      this.metrics.totalComponents += componentCount;
    }
    
    // Check for custom hooks
    if (content.includes('use') && content.match(/(?:export\s+)?const\s+use\w+/g)) {
      this.metrics.totalHooks += (content.match(/(?:export\s+)?const\s+use\w+/g) || []).length;
    }
    
    // Flag low documentation
    if (documentationRatio < 50 && totalDocumentableItems > 0) {
      this.metrics.warnings.push({
        file: filePath,
        type: 'LOW_DOCUMENTATION',
        message: `Documentation coverage is ${documentationRatio.toFixed(1)}% (${jsdocCount}/${totalDocumentableItems} items documented)`
      });
    }
  }

  /**
   * Analyzes TypeScript usage
   * @param {string} filePath - File path
   * @param {string} content - File content
   */
  analyzeTypeScript(filePath, content) {
    // Count 'any' usage
    const anyUsage = (content.match(/:\s*any\b/g) || []).length;
    
    // Count proper type definitions
    const typeDefinitions = (content.match(/:\s*(?!any\b)\w+(?:\[\])?/g) || []).length;
    
    // Calculate TypeScript coverage
    const totalTypes = anyUsage + typeDefinitions;
    const typeCoverage = totalTypes > 0 ? (typeDefinitions / totalTypes) * 100 : 100;
    
    this.metrics.typeScriptCoverage += typeCoverage;
    
    // Flag excessive 'any' usage
    if (anyUsage > 5) {
      this.metrics.issues.push({
        file: filePath,
        type: 'EXCESSIVE_ANY_USAGE',
        message: `Found ${anyUsage} 'any' types (should be < 5)`
      });
    } else if (anyUsage > 2) {
      this.metrics.warnings.push({
        file: filePath,
        type: 'MODERATE_ANY_USAGE',
        message: `Found ${anyUsage} 'any' types (consider specific typing)`
      });
    }
  }

  /**
   * Analyzes code structure
   * @param {string} filePath - File path
   * @param {string} content - File content
   */
  analyzeStructure(filePath, content) {
    const lines = content.split('\n');
    
    // Check file length
    if (lines.length > 500) {
      this.metrics.issues.push({
        file: filePath,
        type: 'LARGE_FILE',
        message: `File has ${lines.length} lines (threshold: 500)`
      });
    } else if (lines.length > 300) {
      this.metrics.warnings.push({
        file: filePath,
        type: 'MODERATE_FILE_SIZE',
        message: `File has ${lines.length} lines (consider splitting)`
      });
    }
    
    // Check for utility functions
    if (filePath.includes('utils') || filePath.includes('helpers')) {
      this.metrics.totalUtilities++;
    }
    
    // Check for long functions
    const functionMatches = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\()[^}]*\{([^}]*\{[^}]*\}[^}]*)*[^}]*\}/g);
    if (functionMatches) {
      functionMatches.forEach(func => {
        const funcLines = func.split('\n').length;
        if (funcLines > 50) {
          this.metrics.issues.push({
            file: filePath,
            type: 'LONG_FUNCTION',
            message: `Function has ${funcLines} lines (threshold: 50)`
          });
        }
      });
    }
  }

  /**
   * Analyzes code smells
   * @param {string} filePath - File path
   * @param {string} content - File content
   */
  analyzeCodeSmells(filePath, content) {
    // Check for TODO/FIXME comments
    const todoCount = (content.match(/(?:TODO|FIXME|XXX|HACK):/gi) || []).length;
    if (todoCount > 0) {
      this.metrics.warnings.push({
        file: filePath,
        type: 'TECHNICAL_DEBT',
        message: `Found ${todoCount} TODO/FIXME comments`
      });
    }
    
    // Check for console.log
    const consoleLogCount = (content.match(/console\.log\(/g) || []).length;
    if (consoleLogCount > 0) {
      this.metrics.warnings.push({
        file: filePath,
        type: 'CONSOLE_LOG',
        message: `Found ${consoleLogCount} console.log statements`
      });
    }
    
    // Check for magic numbers
    const magicNumbers = content.match(/\b(?!0|1|2|100|1000)\d{2,}\b/g);
    if (magicNumbers && magicNumbers.length > 3) {
      this.metrics.suggestions.push({
        file: filePath,
        type: 'MAGIC_NUMBERS',
        message: `Consider extracting magic numbers into constants`
      });
    }
    
    // Check for long parameter lists
    const longParamLists = content.match(/\([^)]{100,}\)/g);
    if (longParamLists && longParamLists.length > 0) {
      this.metrics.suggestions.push({
        file: filePath,
        type: 'LONG_PARAMETER_LIST',
        message: `Consider using objects for long parameter lists`
      });
    }
  }

  /**
   * Calculates overall metrics
   */
  calculateOverallMetrics() {
    if (this.metrics.totalFiles > 0) {
      this.metrics.codeComplexity = this.metrics.codeComplexity / this.metrics.totalFiles;
      this.metrics.typeScriptCoverage = this.metrics.typeScriptCoverage / this.metrics.totalFiles;
      this.metrics.documentationCoverage = this.metrics.documentationCoverage / this.metrics.totalFiles;
    }
    
    // Calculate duplication score (simplified)
    this.metrics.duplicationScore = Math.max(0, 100 - (this.metrics.issues.length * 2) - (this.metrics.warnings.length * 1));
  }

  /**
   * Generates a comprehensive report
   * @returns {Object} Report object
   */
  generateReport() {
    const qualityScore = this.calculateQualityScore();
    const grade = this.calculateGrade(qualityScore);
    
    const report = {
      summary: {
        totalFiles: this.metrics.totalFiles,
        totalLines: this.metrics.totalLines,
        totalComponents: this.metrics.totalComponents,
        totalHooks: this.metrics.totalHooks,
        totalUtilities: this.metrics.totalUtilities,
        qualityScore: qualityScore.toFixed(1),
        grade: grade
      },
      metrics: {
        codeComplexity: this.metrics.codeComplexity.toFixed(1),
        typeScriptCoverage: this.metrics.typeScriptCoverage.toFixed(1),
        documentationCoverage: this.metrics.documentationCoverage.toFixed(1),
        duplicationScore: this.metrics.duplicationScore.toFixed(1)
      },
      issues: {
        critical: this.metrics.issues.length,
        warnings: this.metrics.warnings.length,
        suggestions: this.metrics.suggestions.length
      },
      details: {
        criticalIssues: this.metrics.issues,
        warnings: this.metrics.warnings,
        suggestions: this.metrics.suggestions
      }
    };
    
    this.printReport(report);
    return report;
  }

  /**
   * Calculates overall quality score
   * @returns {number} Quality score (0-100)
   */
  calculateQualityScore() {
    const weights = {
      typeScriptCoverage: 0.25,
      documentationCoverage: 0.20,
      duplicationScore: 0.20,
      complexityScore: 0.15,
      issuesScore: 0.20
    };
    
    const complexityScore = Math.max(0, 100 - (this.metrics.codeComplexity * 2));
    const issuesScore = Math.max(0, 100 - (this.metrics.issues.length * 5) - (this.metrics.warnings.length * 2));
    
    return (
      this.metrics.typeScriptCoverage * weights.typeScriptCoverage +
      this.metrics.documentationCoverage * weights.documentationCoverage +
      this.metrics.duplicationScore * weights.duplicationScore +
      complexityScore * weights.complexityScore +
      issuesScore * weights.issuesScore
    );
  }

  /**
   * Calculates grade based on quality score
   * @param {number} score - Quality score
   * @returns {string} Grade (A+, A, B+, B, C+, C, D, F)
   */
  calculateGrade(score) {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Prints the analysis report
   * @param {Object} report - Report object
   */
  printReport(report) {
    console.log('\n📊 CODE QUALITY ANALYSIS REPORT\n');
    console.log('=' * 50);
    
    console.log('\n🎯 SUMMARY');
    console.log(`Grade: ${report.summary.grade} (${report.summary.qualityScore}%)`);
    console.log(`Total Files: ${report.summary.totalFiles}`);
    console.log(`Total Lines: ${report.summary.totalLines}`);
    console.log(`Components: ${report.summary.totalComponents}`);
    console.log(`Custom Hooks: ${report.summary.totalHooks}`);
    console.log(`Utilities: ${report.summary.totalUtilities}`);
    
    console.log('\n📈 METRICS');
    console.log(`TypeScript Coverage: ${report.metrics.typeScriptCoverage}%`);
    console.log(`Documentation Coverage: ${report.metrics.documentationCoverage}%`);
    console.log(`Code Duplication Score: ${report.metrics.duplicationScore}%`);
    console.log(`Average Complexity: ${report.metrics.codeComplexity}`);
    
    console.log('\n🚨 ISSUES');
    console.log(`Critical Issues: ${report.issues.critical}`);
    console.log(`Warnings: ${report.issues.warnings}`);
    console.log(`Suggestions: ${report.issues.suggestions}`);
    
    if (report.details.criticalIssues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES');
      report.details.criticalIssues.forEach(issue => {
        console.log(`  ${issue.file}: ${issue.message}`);
      });
    }
    
    if (report.details.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS');
      report.details.warnings.slice(0, 10).forEach(warning => {
        console.log(`  ${warning.file}: ${warning.message}`);
      });
      if (report.details.warnings.length > 10) {
        console.log(`  ... and ${report.details.warnings.length - 10} more warnings`);
      }
    }
    
    console.log('\n💡 RECOMMENDATIONS');
    if (report.summary.qualityScore < 95) {
      console.log('  • Add comprehensive JSDoc documentation');
      console.log('  • Reduce usage of "any" types');
      console.log('  • Refactor complex functions');
      console.log('  • Remove TODO/FIXME comments');
    } else {
      console.log('  🎉 Excellent code quality! Keep up the good work!');
    }
    
    console.log('\n' + '=' * 50);
  }
}

// Run the analyzer if called directly
if (require.main === module) {
  const analyzer = new CodeQualityAnalyzer();
  analyzer.analyze()
    .then(() => {
      console.log('\n✅ Analysis complete!');
    })
    .catch(error => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = CodeQualityAnalyzer;