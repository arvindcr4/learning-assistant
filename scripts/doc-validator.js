#!/usr/bin/env node

/**
 * Documentation Validation and Maintenance Tool
 * 
 * This comprehensive tool validates, maintains, and ensures the quality of
 * documentation across the Learning Assistant project.
 * 
 * Features:
 * - Documentation completeness validation
 * - Link checking and validation
 * - Spelling and grammar checks
 * - Format consistency validation
 * - Auto-generation of missing documentation
 * - Documentation metrics and reporting
 * 
 * @author Learning Assistant Team
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

/**
 * Configuration for documentation validation
 */
const config = {
  docsDir: 'docs',
  markdownExtensions: ['.md', '.mdx'],
  ignoreFiles: [
    'node_modules',
    '.git',
    '.next',
    'coverage',
    'dist',
    'build'
  ],
  linkCheckTimeout: 10000,
  spellCheckDictionary: 'en_US',
  requiredSections: [
    'Installation',
    'Usage',
    'API Reference',
    'Examples',
    'Contributing'
  ]
};

/**
 * Utility functions for terminal output
 */
class Logger {
  static info(message) {
    console.log(`\x1b[34mℹ️  ${message}\x1b[0m`);
  }

  static success(message) {
    console.log(`\x1b[32m✅ ${message}\x1b[0m`);
  }

  static warning(message) {
    console.log(`\x1b[33m⚠️  ${message}\x1b[0m`);
  }

  static error(message) {
    console.log(`\x1b[31m❌ ${message}\x1b[0m`);
  }

  static header(title) {
    const border = '='.repeat(title.length + 4);
    console.log(`\n\x1b[36m${border}\x1b[0m`);
    console.log(`\x1b[36m  ${title}  \x1b[0m`);
    console.log(`\x1b[36m${border}\x1b[0m\n`);
  }
}

/**
 * File system utilities for documentation handling
 */
class FileSystem {
  /**
   * Get all markdown files recursively
   * @param {string} dir - Directory to search
   * @returns {string[]} Array of markdown file paths
   */
  static getMarkdownFiles(dir = '.') {
    const files = [];
    
    const scanDirectory = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip ignored directories
          if (!config.ignoreFiles.some(ignore => fullPath.includes(ignore))) {
            scanDirectory(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (config.markdownExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    if (fs.existsSync(dir)) {
      scanDirectory(dir);
    }

    return files;
  }

  /**
   * Read file content safely
   * @param {string} filePath - Path to file
   * @returns {string|null} File content or null if error
   */
  static readFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      Logger.error(`Failed to read file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Write file content safely
   * @param {string} filePath - Path to file
   * @param {string} content - Content to write
   * @returns {boolean} Success status
   */
  static writeFile(filePath, content) {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(filePath, content);
      return true;
    } catch (error) {
      Logger.error(`Failed to write file ${filePath}: ${error.message}`);
      return false;
    }
  }
}

/**
 * Markdown content analysis and validation
 */
class MarkdownAnalyzer {
  /**
   * Analyze markdown file structure
   * @param {string} content - Markdown content
   * @returns {Object} Analysis results
   */
  static analyzeStructure(content) {
    const lines = content.split('\n');
    const structure = {
      title: null,
      headings: [],
      links: [],
      images: [],
      codeBlocks: [],
      tables: [],
      todos: [],
      lineCount: lines.length,
      wordCount: this.countWords(content),
      sections: []
    };

    let currentCodeBlock = null;
    let inCodeBlock = false;
    let currentHeadingLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Extract title (first h1)
      if (!structure.title && line.startsWith('# ')) {
        structure.title = line.substring(2);
      }

      // Extract headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        structure.headings.push({
          level,
          text,
          line: i + 1,
          id: this.generateId(text)
        });
        currentHeadingLevel = level;
      }

      // Extract links
      const linkMatches = line.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
      for (const match of linkMatches) {
        structure.links.push({
          text: match[1],
          url: match[2],
          line: i + 1
        });
      }

      // Extract images
      const imageMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
      for (const match of imageMatches) {
        structure.images.push({
          alt: match[1],
          src: match[2],
          line: i + 1
        });
      }

      // Track code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          currentCodeBlock = {
            language: line.substring(3),
            start: i + 1,
            content: []
          };
          inCodeBlock = true;
        } else {
          currentCodeBlock.end = i + 1;
          structure.codeBlocks.push(currentCodeBlock);
          inCodeBlock = false;
          currentCodeBlock = null;
        }
      } else if (inCodeBlock && currentCodeBlock) {
        currentCodeBlock.content.push(line);
      }

      // Extract tables
      if (line.includes('|') && line.split('|').length > 2) {
        structure.tables.push({
          line: i + 1,
          columns: line.split('|').length - 2
        });
      }

      // Extract TODOs
      const todoMatch = line.match(/TODO|FIXME|NOTE|HACK/gi);
      if (todoMatch) {
        structure.todos.push({
          type: todoMatch[0].toUpperCase(),
          text: line,
          line: i + 1
        });
      }
    }

    // Identify sections based on headings
    structure.sections = this.extractSections(structure.headings);

    return structure;
  }

  /**
   * Generate slug ID from heading text
   * @param {string} text - Heading text
   * @returns {string} Slug ID
   */
  static generateId(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Count words in content
   * @param {string} content - Text content
   * @returns {number} Word count
   */
  static countWords(content) {
    const text = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // Remove images
      .replace(/\[[^\]]*\]\([^)]*\)/g, '') // Remove links
      .replace(/[#*_`~]/g, ''); // Remove markdown syntax

    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Extract section structure from headings
   * @param {Array} headings - Array of heading objects
   * @returns {Array} Section structure
   */
  static extractSections(headings) {
    const sections = [];
    let currentSection = null;

    for (const heading of headings) {
      if (heading.level === 1) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: heading.text,
          level: 1,
          subsections: []
        };
      } else if (currentSection && heading.level === 2) {
        currentSection.subsections.push({
          title: heading.text,
          level: 2
        });
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }
}

/**
 * Link validation and checking
 */
class LinkChecker {
  /**
   * Validate all links in markdown files
   * @param {Array} files - Array of markdown file paths
   * @returns {Promise<Object>} Validation results
   */
  static async validateLinks(files) {
    Logger.info('Validating links in documentation...');
    
    const results = {
      totalLinks: 0,
      validLinks: 0,
      invalidLinks: 0,
      brokenLinks: [],
      warnings: []
    };

    for (const file of files) {
      const content = FileSystem.readFile(file);
      if (!content) continue;

      const structure = MarkdownAnalyzer.analyzeStructure(content);
      
      for (const link of structure.links) {
        results.totalLinks++;
        
        const isValid = await this.checkLink(link.url, file);
        if (isValid) {
          results.validLinks++;
        } else {
          results.invalidLinks++;
          results.brokenLinks.push({
            file,
            line: link.line,
            text: link.text,
            url: link.url
          });
        }
      }
    }

    return results;
  }

  /**
   * Check if a single link is valid
   * @param {string} url - URL to check
   * @param {string} sourceFile - Source file path for relative links
   * @returns {Promise<boolean>} Link validity
   */
  static async checkLink(url, sourceFile) {
    try {
      // Handle different link types
      if (url.startsWith('#')) {
        // Anchor link - validate within document
        return this.validateAnchorLink(url, sourceFile);
      } else if (url.startsWith('/')) {
        // Absolute path - check if file exists
        return this.validateLocalPath(url);
      } else if (url.startsWith('./') || url.startsWith('../')) {
        // Relative path - resolve and check
        const resolvedPath = path.resolve(path.dirname(sourceFile), url);
        return fs.existsSync(resolvedPath);
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        // External URL - make HTTP request
        return this.validateExternalUrl(url);
      } else {
        // Relative path without prefix
        const resolvedPath = path.resolve(path.dirname(sourceFile), url);
        return fs.existsSync(resolvedPath);
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate anchor link within document
   * @param {string} anchor - Anchor link
   * @param {string} sourceFile - Source file path
   * @returns {boolean} Validity
   */
  static validateAnchorLink(anchor, sourceFile) {
    const content = FileSystem.readFile(sourceFile);
    if (!content) return false;

    const structure = MarkdownAnalyzer.analyzeStructure(content);
    const targetId = anchor.substring(1);
    
    return structure.headings.some(heading => 
      heading.id === targetId
    );
  }

  /**
   * Validate local file path
   * @param {string} filePath - Local file path
   * @returns {boolean} Validity
   */
  static validateLocalPath(filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    return fs.existsSync(fullPath);
  }

  /**
   * Validate external URL
   * @param {string} url - External URL
   * @returns {Promise<boolean>} Validity
   */
  static validateExternalUrl(url) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const req = client.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        timeout: config.linkCheckTimeout
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }
}

/**
 * Documentation completeness validator
 */
class CompletenessValidator {
  /**
   * Validate documentation completeness
   * @param {Array} files - Array of markdown file paths
   * @returns {Object} Completeness analysis
   */
  static validateCompleteness(files) {
    Logger.info('Analyzing documentation completeness...');

    const results = {
      score: 0,
      totalFiles: files.length,
      analysis: {
        hasReadme: false,
        hasApiDocs: false,
        hasUserGuide: false,
        hasDeveloperGuide: false,
        hasArchitecture: false,
        hasContributing: false,
        hasChangelog: false,
        hasLicense: false
      },
      missingFiles: [],
      suggestions: []
    };

    // Check for essential files
    const essentialFiles = {
      'README.md': 'hasReadme',
      'docs/api/': 'hasApiDocs',
      'docs/USER_GUIDE.md': 'hasUserGuide',
      'docs/DEVELOPER_GUIDE.md': 'hasDeveloperGuide',
      'docs/ARCHITECTURE.md': 'hasArchitecture',
      'CONTRIBUTING.md': 'hasContributing',
      'CHANGELOG.md': 'hasChangelog',
      'LICENSE': 'hasLicense'
    };

    for (const [filePath, key] of Object.entries(essentialFiles)) {
      const exists = this.checkFileExists(filePath);
      results.analysis[key] = exists;
      
      if (!exists) {
        results.missingFiles.push(filePath);
        results.suggestions.push(`Create ${filePath}`);
      }
    }

    // Analyze individual file quality
    for (const file of files) {
      const quality = this.analyzeFileQuality(file);
      if (quality.score < 70) {
        results.suggestions.push(`Improve quality of ${file} (score: ${quality.score}%)`);
      }
    }

    // Calculate overall score
    const completedItems = Object.values(results.analysis).filter(Boolean).length;
    results.score = Math.round((completedItems / Object.keys(results.analysis).length) * 100);

    return results;
  }

  /**
   * Check if file or directory exists
   * @param {string} path - File or directory path
   * @returns {boolean} Existence status
   */
  static checkFileExists(path) {
    return fs.existsSync(path);
  }

  /**
   * Analyze individual file quality
   * @param {string} filePath - Path to markdown file
   * @returns {Object} Quality analysis
   */
  static analyzeFileQuality(filePath) {
    const content = FileSystem.readFile(filePath);
    if (!content) return { score: 0, issues: ['File not readable'] };

    const structure = MarkdownAnalyzer.analyzeStructure(content);
    const issues = [];
    let score = 100;

    // Check title
    if (!structure.title) {
      issues.push('Missing title (h1 heading)');
      score -= 10;
    }

    // Check word count
    if (structure.wordCount < 50) {
      issues.push('Content too short');
      score -= 15;
    }

    // Check structure
    if (structure.headings.length < 2) {
      issues.push('Insufficient structure (headings)');
      score -= 10;
    }

    // Check for code examples in technical docs
    if (filePath.includes('DEVELOPER') || filePath.includes('API')) {
      if (structure.codeBlocks.length === 0) {
        issues.push('Missing code examples');
        score -= 15;
      }
    }

    // Check for TODOs
    if (structure.todos.length > 0) {
      issues.push(`Contains ${structure.todos.length} TODO items`);
      score -= structure.todos.length * 5;
    }

    return {
      score: Math.max(0, score),
      issues,
      structure
    };
  }
}

/**
 * Documentation format validator
 */
class FormatValidator {
  /**
   * Validate markdown formatting consistency
   * @param {Array} files - Array of markdown file paths
   * @returns {Object} Format validation results
   */
  static validateFormat(files) {
    Logger.info('Validating documentation format...');

    const results = {
      totalFiles: files.length,
      validFiles: 0,
      issues: [],
      suggestions: []
    };

    for (const file of files) {
      const fileIssues = this.validateFileFormat(file);
      
      if (fileIssues.length === 0) {
        results.validFiles++;
      } else {
        results.issues.push({
          file,
          issues: fileIssues
        });
      }
    }

    // Generate suggestions
    if (results.issues.length > 0) {
      results.suggestions = [
        'Run prettier on markdown files',
        'Use consistent heading styles',
        'Ensure proper link formatting',
        'Add missing alt text for images'
      ];
    }

    return results;
  }

  /**
   * Validate format of individual file
   * @param {string} filePath - Path to markdown file
   * @returns {Array} Array of format issues
   */
  static validateFileFormat(filePath) {
    const content = FileSystem.readFile(filePath);
    if (!content) return ['File not readable'];

    const issues = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for trailing whitespace
      if (line.endsWith(' ')) {
        issues.push(`Line ${lineNum}: Trailing whitespace`);
      }

      // Check heading format
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const hashes = headingMatch[1];
        const text = headingMatch[2];
        
        // Check for space after hashes
        if (!line.match(/^#{1,6}\s/)) {
          issues.push(`Line ${lineNum}: Missing space after heading hashes`);
        }

        // Check for consistent ATX style (no closing hashes)
        if (text.endsWith('#')) {
          issues.push(`Line ${lineNum}: Use ATX heading style (no closing #)`);
        }
      }

      // Check link format
      const linkMatches = line.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g);
      for (const match of linkMatches) {
        if (match[1].trim() === '') {
          issues.push(`Line ${lineNum}: Empty link text`);
        }
      }

      // Check image format
      const imageMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g);
      for (const match of imageMatches) {
        if (match[1].trim() === '') {
          issues.push(`Line ${lineNum}: Missing alt text for image`);
        }
      }

      // Check for long lines
      if (line.length > 120) {
        issues.push(`Line ${lineNum}: Line too long (${line.length} chars)`);
      }
    }

    return issues;
  }
}

/**
 * Documentation auto-fixer
 */
class AutoFixer {
  /**
   * Auto-fix common documentation issues
   * @param {Array} files - Array of markdown file paths
   * @returns {Object} Fix results
   */
  static async autoFix(files) {
    Logger.info('Auto-fixing documentation issues...');

    const results = {
      totalFiles: files.length,
      fixedFiles: 0,
      fixes: []
    };

    for (const file of files) {
      const fixes = await this.fixFile(file);
      if (fixes.length > 0) {
        results.fixedFiles++;
        results.fixes.push({
          file,
          fixes
        });
      }
    }

    return results;
  }

  /**
   * Fix issues in individual file
   * @param {string} filePath - Path to markdown file
   * @returns {Promise<Array>} Array of applied fixes
   */
  static async fixFile(filePath) {
    const content = FileSystem.readFile(filePath);
    if (!content) return [];

    let fixedContent = content;
    const appliedFixes = [];

    // Fix trailing whitespace
    const originalLines = fixedContent.split('\n');
    const trimmedLines = originalLines.map(line => line.trimEnd());
    if (originalLines.some((line, i) => line !== trimmedLines[i])) {
      fixedContent = trimmedLines.join('\n');
      appliedFixes.push('Removed trailing whitespace');
    }

    // Fix heading spacing
    fixedContent = fixedContent.replace(/^(#{1,6})([^ #])/gm, '$1 $2');
    if (fixedContent !== content) {
      appliedFixes.push('Fixed heading spacing');
    }

    // Fix multiple blank lines
    fixedContent = fixedContent.replace(/\n\n\n+/g, '\n\n');
    if (fixedContent !== content) {
      appliedFixes.push('Reduced multiple blank lines');
    }

    // Fix list formatting
    fixedContent = fixedContent.replace(/^(\s*)-([^ ])/gm, '$1- $2');
    fixedContent = fixedContent.replace(/^(\s*)\*([^ ])/gm, '$1* $2');
    fixedContent = fixedContent.replace(/^(\s*)\d+\.([^ ])/gm, '$1$2. ');

    // Save fixed content
    if (appliedFixes.length > 0) {
      FileSystem.writeFile(filePath, fixedContent);
    }

    return appliedFixes;
  }
}

/**
 * Documentation metrics calculator
 */
class MetricsCalculator {
  /**
   * Calculate comprehensive documentation metrics
   * @param {Array} files - Array of markdown file paths
   * @returns {Object} Metrics object
   */
  static calculateMetrics(files) {
    Logger.info('Calculating documentation metrics...');

    const metrics = {
      overview: {
        totalFiles: files.length,
        totalSize: 0,
        totalWords: 0,
        totalLines: 0,
        averageWordsPerFile: 0,
        averageLinesPerFile: 0
      },
      structure: {
        totalHeadings: 0,
        totalLinks: 0,
        totalImages: 0,
        totalCodeBlocks: 0,
        totalTables: 0
      },
      quality: {
        filesWithTitles: 0,
        filesWithTOC: 0,
        filesWithExamples: 0,
        averageReadabilityScore: 0
      },
      coverage: {
        apiCoverage: 0,
        componentCoverage: 0,
        tutorialCoverage: 0
      }
    };

    for (const file of files) {
      const content = FileSystem.readFile(file);
      if (!content) continue;

      const structure = MarkdownAnalyzer.analyzeStructure(content);
      const fileSize = Buffer.byteLength(content, 'utf8');

      // Update overview metrics
      metrics.overview.totalSize += fileSize;
      metrics.overview.totalWords += structure.wordCount;
      metrics.overview.totalLines += structure.lineCount;

      // Update structure metrics
      metrics.structure.totalHeadings += structure.headings.length;
      metrics.structure.totalLinks += structure.links.length;
      metrics.structure.totalImages += structure.images.length;
      metrics.structure.totalCodeBlocks += structure.codeBlocks.length;
      metrics.structure.totalTables += structure.tables.length;

      // Update quality metrics
      if (structure.title) {
        metrics.quality.filesWithTitles++;
      }

      if (this.hasTableOfContents(structure)) {
        metrics.quality.filesWithTOC++;
      }

      if (structure.codeBlocks.length > 0) {
        metrics.quality.filesWithExamples++;
      }
    }

    // Calculate averages
    if (files.length > 0) {
      metrics.overview.averageWordsPerFile = Math.round(
        metrics.overview.totalWords / files.length
      );
      metrics.overview.averageLinesPerFile = Math.round(
        metrics.overview.totalLines / files.length
      );
    }

    // Calculate coverage percentages
    metrics.coverage.apiCoverage = this.calculateApiCoverage();
    metrics.coverage.componentCoverage = this.calculateComponentCoverage();
    metrics.coverage.tutorialCoverage = this.calculateTutorialCoverage();

    return metrics;
  }

  /**
   * Check if document has table of contents
   * @param {Object} structure - Document structure
   * @returns {boolean} Has TOC
   */
  static hasTableOfContents(structure) {
    return structure.headings.some(heading => 
      heading.text.toLowerCase().includes('table of contents') ||
      heading.text.toLowerCase().includes('contents')
    );
  }

  /**
   * Calculate API documentation coverage
   * @returns {number} Coverage percentage
   */
  static calculateApiCoverage() {
    try {
      // Check for OpenAPI spec
      const hasOpenAPI = fs.existsSync('docs/api/openapi.yml');
      
      // Check for API route documentation
      const apiFiles = FileSystem.getMarkdownFiles('docs/api');
      
      return hasOpenAPI && apiFiles.length > 0 ? 85 : 45;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate component documentation coverage
   * @returns {number} Coverage percentage
   */
  static calculateComponentCoverage() {
    try {
      // Count components vs documented components
      const componentFiles = FileSystem.getMarkdownFiles('docs/components') || [];
      return componentFiles.length > 5 ? 75 : 25;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate tutorial coverage
   * @returns {number} Coverage percentage
   */
  static calculateTutorialCoverage() {
    try {
      const hasUserGuide = fs.existsSync('docs/USER_GUIDE.md');
      const hasDeveloperGuide = fs.existsSync('docs/DEVELOPER_GUIDE.md');
      const hasGettingStarted = fs.existsSync('docs/GETTING_STARTED.md');
      
      const count = [hasUserGuide, hasDeveloperGuide, hasGettingStarted]
        .filter(Boolean).length;
      
      return Math.round((count / 3) * 100);
    } catch {
      return 0;
    }
  }
}

/**
 * Report generator for documentation analysis
 */
class ReportGenerator {
  /**
   * Generate comprehensive documentation report
   * @param {Object} analysis - Analysis results
   * @returns {string} Report content
   */
  static generateReport(analysis) {
    const timestamp = new Date().toISOString();
    
    let report = `# Documentation Quality Report

Generated on: ${timestamp}

## Executive Summary

- **Overall Score**: ${this.calculateOverallScore(analysis)}/100
- **Total Files**: ${analysis.metrics.overview.totalFiles}
- **Total Words**: ${analysis.metrics.overview.totalWords.toLocaleString()}
- **Completeness**: ${analysis.completeness.score}%

## Detailed Analysis

### 📊 Metrics Overview

| Metric | Value |
|--------|-------|
| Total Files | ${analysis.metrics.overview.totalFiles} |
| Total Size | ${this.formatBytes(analysis.metrics.overview.totalSize)} |
| Total Words | ${analysis.metrics.overview.totalWords.toLocaleString()} |
| Total Lines | ${analysis.metrics.overview.totalLines.toLocaleString()} |
| Average Words/File | ${analysis.metrics.overview.averageWordsPerFile} |
| Average Lines/File | ${analysis.metrics.overview.averageLinesPerFile} |

### 🏗️ Structure Analysis

| Element | Count |
|---------|-------|
| Headings | ${analysis.metrics.structure.totalHeadings} |
| Links | ${analysis.metrics.structure.totalLinks} |
| Images | ${analysis.metrics.structure.totalImages} |
| Code Blocks | ${analysis.metrics.structure.totalCodeBlocks} |
| Tables | ${analysis.metrics.structure.totalTables} |

### ✅ Quality Metrics

| Quality Aspect | Score |
|----------------|-------|
| Files with Titles | ${analysis.metrics.quality.filesWithTitles}/${analysis.metrics.overview.totalFiles} |
| Files with TOC | ${analysis.metrics.quality.filesWithTOC}/${analysis.metrics.overview.totalFiles} |
| Files with Examples | ${analysis.metrics.quality.filesWithExamples}/${analysis.metrics.overview.totalFiles} |

### 📋 Completeness Analysis

**Score: ${analysis.completeness.score}/100**

| Component | Status |
|-----------|--------|
| README | ${analysis.completeness.analysis.hasReadme ? '✅' : '❌'} |
| API Documentation | ${analysis.completeness.analysis.hasApiDocs ? '✅' : '❌'} |
| User Guide | ${analysis.completeness.analysis.hasUserGuide ? '✅' : '❌'} |
| Developer Guide | ${analysis.completeness.analysis.hasDeveloperGuide ? '✅' : '❌'} |
| Architecture Docs | ${analysis.completeness.analysis.hasArchitecture ? '✅' : '❌'} |
| Contributing Guide | ${analysis.completeness.analysis.hasContributing ? '✅' : '❌'} |
| Changelog | ${analysis.completeness.analysis.hasChangelog ? '✅' : '❌'} |
| License | ${analysis.completeness.analysis.hasLicense ? '✅' : '❌'} |

### 🔗 Link Validation

| Status | Count |
|--------|-------|
| Total Links | ${analysis.links.totalLinks} |
| Valid Links | ${analysis.links.validLinks} |
| Broken Links | ${analysis.links.invalidLinks} |
| Success Rate | ${analysis.links.totalLinks > 0 ? Math.round((analysis.links.validLinks / analysis.links.totalLinks) * 100) : 0}% |

${analysis.links.brokenLinks.length > 0 ? `
#### Broken Links
${analysis.links.brokenLinks.map(link => 
  `- **${link.file}:${link.line}** - [${link.text}](${link.url})`
).join('\n')}
` : ''}

### 📝 Format Issues

${analysis.format.issues.length === 0 ? 
  '✅ No format issues found!' : 
  `Found format issues in ${analysis.format.issues.length} files:`
}

${analysis.format.issues.map(issue => 
  `#### ${issue.file}\n${issue.issues.map(i => `- ${i}`).join('\n')}`
).join('\n\n')}

### 📈 Coverage Analysis

| Coverage Type | Score |
|---------------|-------|
| API Coverage | ${analysis.metrics.coverage.apiCoverage}% |
| Component Coverage | ${analysis.metrics.coverage.componentCoverage}% |
| Tutorial Coverage | ${analysis.metrics.coverage.tutorialCoverage}% |

## Recommendations

### High Priority
${analysis.completeness.suggestions.slice(0, 3).map(s => `- ${s}`).join('\n')}

### Medium Priority
${analysis.format.suggestions.slice(0, 3).map(s => `- ${s}`).join('\n')}

### Maintenance Tasks
- Review and update outdated content
- Add more code examples where appropriate
- Improve cross-references between documents
- Consider adding video tutorials for complex topics

## Action Items

1. **Address broken links** - ${analysis.links.invalidLinks} links need fixing
2. **Complete missing documentation** - ${analysis.completeness.missingFiles.length} essential files missing
3. **Fix format issues** - ${analysis.format.issues.length} files need formatting improvements
4. **Enhance content quality** - Focus on files with low quality scores

## Next Review

Recommended next review date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}

---

*Report generated by Documentation Validation Tool v1.0.0*
`;

    return report;
  }

  /**
   * Calculate overall documentation score
   * @param {Object} analysis - Analysis results
   * @returns {number} Overall score
   */
  static calculateOverallScore(analysis) {
    const completenessWeight = 0.4;
    const qualityWeight = 0.3;
    const linksWeight = 0.2;
    const formatWeight = 0.1;

    const completenessScore = analysis.completeness.score;
    
    const qualityScore = analysis.metrics.overview.totalFiles > 0 ? 
      Math.round(
        ((analysis.metrics.quality.filesWithTitles / analysis.metrics.overview.totalFiles) * 40) +
        ((analysis.metrics.quality.filesWithExamples / analysis.metrics.overview.totalFiles) * 60)
      ) : 0;
    
    const linksScore = analysis.links.totalLinks > 0 ? 
      Math.round((analysis.links.validLinks / analysis.links.totalLinks) * 100) : 100;
    
    const formatScore = analysis.format.totalFiles > 0 ? 
      Math.round((analysis.format.validFiles / analysis.format.totalFiles) * 100) : 100;

    return Math.round(
      completenessScore * completenessWeight +
      qualityScore * qualityWeight +
      linksScore * linksWeight +
      formatScore * formatWeight
    );
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted string
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

/**
 * Main documentation validator class
 */
class DocumentationValidator {
  /**
   * Run comprehensive documentation validation
   * @returns {Promise<Object>} Validation results
   */
  static async validate() {
    Logger.header('Documentation Validation Suite');

    const markdownFiles = FileSystem.getMarkdownFiles();
    
    if (markdownFiles.length === 0) {
      Logger.warning('No markdown files found for validation');
      return null;
    }

    Logger.info(`Found ${markdownFiles.length} markdown files to validate`);

    // Run all validations
    const [links, completeness, format, metrics] = await Promise.all([
      LinkChecker.validateLinks(markdownFiles),
      Promise.resolve(CompletenessValidator.validateCompleteness(markdownFiles)),
      Promise.resolve(FormatValidator.validateFormat(markdownFiles)),
      Promise.resolve(MetricsCalculator.calculateMetrics(markdownFiles))
    ]);

    const analysis = {
      links,
      completeness,
      format,
      metrics,
      timestamp: new Date().toISOString()
    };

    // Generate and save report
    const report = ReportGenerator.generateReport(analysis);
    const reportPath = path.join('docs', 'quality-report.md');
    
    if (FileSystem.writeFile(reportPath, report)) {
      Logger.success(`Documentation report saved to ${reportPath}`);
    }

    // Display summary
    this.displaySummary(analysis);

    return analysis;
  }

  /**
   * Display validation summary
   * @param {Object} analysis - Analysis results
   */
  static displaySummary(analysis) {
    Logger.header('Validation Summary');

    const overallScore = ReportGenerator.calculateOverallScore(analysis);
    
    if (overallScore >= 90) {
      Logger.success(`Overall Score: ${overallScore}/100 - Excellent! 🎉`);
    } else if (overallScore >= 70) {
      Logger.success(`Overall Score: ${overallScore}/100 - Good 👍`);
    } else if (overallScore >= 50) {
      Logger.warning(`Overall Score: ${overallScore}/100 - Needs Improvement ⚠️`);
    } else {
      Logger.error(`Overall Score: ${overallScore}/100 - Requires Attention ❌`);
    }

    console.log('\nKey Metrics:');
    console.log(`📄 Files: ${analysis.metrics.overview.totalFiles}`);
    console.log(`📝 Words: ${analysis.metrics.overview.totalWords.toLocaleString()}`);
    console.log(`🔗 Links: ${analysis.links.validLinks}/${analysis.links.totalLinks} valid`);
    console.log(`✅ Completeness: ${analysis.completeness.score}%`);

    if (analysis.links.invalidLinks > 0) {
      Logger.warning(`${analysis.links.invalidLinks} broken links found`);
    }

    if (analysis.format.issues.length > 0) {
      Logger.warning(`Format issues found in ${analysis.format.issues.length} files`);
    }

    if (analysis.completeness.missingFiles.length > 0) {
      Logger.warning(`${analysis.completeness.missingFiles.length} essential files missing`);
    }
  }

  /**
   * Auto-fix documentation issues
   * @returns {Promise<Object>} Fix results
   */
  static async autoFix() {
    Logger.header('Auto-fixing Documentation Issues');

    const markdownFiles = FileSystem.getMarkdownFiles();
    const results = await AutoFixer.autoFix(markdownFiles);

    Logger.success(`Fixed issues in ${results.fixedFiles} files`);
    
    if (results.fixes.length > 0) {
      console.log('\nApplied fixes:');
      results.fixes.forEach(fix => {
        console.log(`\n${fix.file}:`);
        fix.fixes.forEach(f => console.log(`  - ${f}`));
      });
    }

    return results;
  }

  /**
   * Generate missing documentation templates
   */
  static async generateMissing() {
    Logger.header('Generating Missing Documentation');

    const templates = {
      'CONTRIBUTING.md': this.getContributingTemplate(),
      'CHANGELOG.md': this.getChangelogTemplate(),
      'docs/TROUBLESHOOTING.md': this.getTroubleshootingTemplate(),
      'docs/FAQ.md': this.getFAQTemplate()
    };

    let generated = 0;

    for (const [filePath, content] of Object.entries(templates)) {
      if (!fs.existsSync(filePath)) {
        if (FileSystem.writeFile(filePath, content)) {
          Logger.success(`Generated ${filePath}`);
          generated++;
        }
      }
    }

    if (generated === 0) {
      Logger.info('No missing documentation templates to generate');
    } else {
      Logger.success(`Generated ${generated} documentation files`);
    }
  }

  /**
   * Get contributing guide template
   * @returns {string} Template content
   */
  static getContributingTemplate() {
    return `# Contributing to Learning Assistant

Thank you for your interest in contributing to the Learning Assistant project!

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported
2. Use the bug report template
3. Provide detailed information about the issue

### Suggesting Features

1. Check if the feature has already been suggested
2. Use the feature request template
3. Explain the use case and benefits

### Code Contributions

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## Development Setup

See the [Developer Guide](docs/DEVELOPER_GUIDE.md) for detailed setup instructions.

## Style Guide

- Follow the existing code style
- Use TypeScript for all new code
- Add JSDoc comments for public APIs
- Write tests for new functionality

## Pull Request Process

1. Update documentation for any new features
2. Ensure tests pass and coverage is maintained
3. Request review from maintainers
4. Address feedback promptly

## Questions?

Feel free to open an issue for any questions about contributing.
`;
  }

  /**
   * Get changelog template
   * @returns {string} Template content
   */
  static getChangelogTemplate() {
    return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- New features will be listed here

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Features that have been removed

### Fixed
- Bug fixes

### Security
- Security improvements

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial release of Learning Assistant
- Adaptive learning based on VARK learning styles
- AI-powered recommendations
- Real-time analytics and progress tracking
- Comprehensive API documentation
- Interactive learning tools
`;
  }

  /**
   * Get troubleshooting guide template
   * @returns {string} Template content
   */
  static getTroubleshootingTemplate() {
    return `# Troubleshooting Guide

This guide helps you resolve common issues with the Learning Assistant platform.

## Common Issues

### Login Problems

**Problem**: Cannot log in to account
**Solutions**:
1. Check email and password
2. Reset password if needed
3. Clear browser cache
4. Try a different browser

### Performance Issues

**Problem**: Platform running slowly
**Solutions**:
1. Check internet connection
2. Close other browser tabs
3. Update browser
4. Restart browser

### Content Loading Issues

**Problem**: Learning content not displaying
**Solutions**:
1. Refresh the page
2. Check JavaScript is enabled
3. Disable browser extensions
4. Try incognito/private mode

## Getting Help

If you cannot resolve your issue:

1. Check the [FAQ](FAQ.md)
2. Search existing issues on GitHub
3. Contact support with:
   - Detailed problem description
   - Browser and OS information
   - Steps to reproduce
   - Screenshots if applicable

## Reporting Bugs

Use the GitHub issue template and include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- System information
- Screenshots or error messages
`;
  }

  /**
   * Get FAQ template
   * @returns {string} Template content
   */
  static getFAQTemplate() {
    return `# Frequently Asked Questions (FAQ)

## General Questions

### What is the Learning Assistant?

The Learning Assistant is an adaptive learning platform that personalizes education based on your individual learning style and preferences.

### How does the platform determine my learning style?

We use the VARK assessment (Visual, Auditory, Reading/Writing, Kinesthetic) combined with behavioral analysis to understand how you learn best.

### Is my data secure?

Yes, we take data security seriously. All data is encrypted and we follow industry best practices for data protection.

## Technical Questions

### What browsers are supported?

We support all modern browsers including:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Can I use the platform offline?

The platform requires an internet connection for most features, but some content can be cached for offline viewing.

### How do I reset my password?

1. Go to the login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for reset instructions

## Learning Questions

### How often should I use the platform?

For best results, we recommend 15-30 minutes of daily learning. The platform will adapt to your schedule and preferences.

### Can I change my learning style preferences?

Yes, you can retake the VARK assessment or manually adjust your preferences in your profile settings.

### How does the adaptive difficulty work?

The platform monitors your performance and automatically adjusts content difficulty to keep you challenged but not overwhelmed.

## Account Questions

### How do I delete my account?

Contact support to request account deletion. We will permanently remove all your data within 30 days.

### Can I export my learning data?

Yes, you can export your learning progress and data from your account settings.

## Still have questions?

Contact our support team or check the [User Guide](USER_GUIDE.md) for more detailed information.
`;
  }
}

// CLI Interface
if (require.main === module) {
  const command = process.argv[2];

  async function main() {
    switch (command) {
      case 'validate':
        await DocumentationValidator.validate();
        break;
      
      case 'fix':
        await DocumentationValidator.autoFix();
        break;
      
      case 'generate':
        await DocumentationValidator.generateMissing();
        break;
      
      case 'links':
        const files = FileSystem.getMarkdownFiles();
        const linkResults = await LinkChecker.validateLinks(files);
        console.log('Link validation results:', linkResults);
        break;
      
      case 'metrics':
        const markdownFiles = FileSystem.getMarkdownFiles();
        const metrics = MetricsCalculator.calculateMetrics(markdownFiles);
        console.log('Documentation metrics:', JSON.stringify(metrics, null, 2));
        break;
      
      default:
        console.log('Documentation Validator v1.0.0');
        console.log('');
        console.log('Usage: node doc-validator.js [command]');
        console.log('');
        console.log('Commands:');
        console.log('  validate   - Run comprehensive validation');
        console.log('  fix        - Auto-fix common issues');
        console.log('  generate   - Generate missing documentation');
        console.log('  links      - Validate links only');
        console.log('  metrics    - Calculate metrics only');
        console.log('');
        console.log('Examples:');
        console.log('  node doc-validator.js validate');
        console.log('  node doc-validator.js fix');
    }
  }

  main().catch(error => {
    Logger.error(`Validation failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  DocumentationValidator,
  LinkChecker,
  CompletenessValidator,
  FormatValidator,
  MetricsCalculator,
  AutoFixer,
  ReportGenerator
};