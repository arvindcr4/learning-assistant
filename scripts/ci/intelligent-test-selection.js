#!/usr/bin/env node

/**
 * Intelligent Test Selection Script
 * Analyzes changed files and selects relevant tests to run
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class IntelligentTestSelector {
  constructor() {
    this.changedFiles = [];
    this.testMap = new Map();
    this.selectedTests = new Set();
  }

  /**
   * Get changed files from git
   */
  getChangedFiles() {
    try {
      const output = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' });
      this.changedFiles = output.trim().split('\n').filter(file => file.length > 0);
      console.log(`Found ${this.changedFiles.length} changed files`);
      return this.changedFiles;
    } catch (error) {
      console.error('Error getting changed files:', error.message);
      return [];
    }
  }

  /**
   * Build test dependency map
   */
  buildTestMap() {
    const testDirs = [
      '__tests__/unit',
      '__tests__/integration',
      '__tests__/components',
      '__tests__/accessibility',
      '__tests__/performance'
    ];

    testDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        this.scanTestDirectory(dir);
      }
    });

    console.log(`Built test map with ${this.testMap.size} entries`);
  }

  /**
   * Scan test directory and build mappings
   */
  scanTestDirectory(dir) {
    const files = fs.readdirSync(dir, { recursive: true });
    
    files.forEach(file => {
      if (file.endsWith('.test.js') || file.endsWith('.test.tsx') || file.endsWith('.test.ts')) {
        const testFile = path.join(dir, file);
        const dependencies = this.extractTestDependencies(testFile);
        this.testMap.set(testFile, dependencies);
      }
    });
  }

  /**
   * Extract dependencies from test file
   */
  extractTestDependencies(testFile) {
    try {
      const content = fs.readFileSync(testFile, 'utf8');
      const dependencies = [];

      // Extract import statements
      const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        
        // Convert relative imports to actual file paths
        if (importPath.startsWith('.')) {
          const basePath = path.dirname(testFile);
          const resolvedPath = path.resolve(basePath, importPath);
          dependencies.push(this.resolveToSourceFile(resolvedPath));
        } else if (importPath.startsWith('@/') || importPath.startsWith('src/')) {
          // Handle absolute imports
          const srcPath = importPath.replace('@/', 'src/').replace('src/', 'src/');
          dependencies.push(this.resolveToSourceFile(srcPath));
        }
      }

      // Extract require statements
      const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        const requirePath = match[1];
        if (requirePath.startsWith('.')) {
          const basePath = path.dirname(testFile);
          const resolvedPath = path.resolve(basePath, requirePath);
          dependencies.push(this.resolveToSourceFile(resolvedPath));
        }
      }

      return dependencies.filter(dep => dep && fs.existsSync(dep));
    } catch (error) {
      console.warn(`Warning: Could not analyze test file ${testFile}:`, error.message);
      return [];
    }
  }

  /**
   * Resolve import path to actual source file
   */
  resolveToSourceFile(importPath) {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    
    // Try the path as-is first
    if (fs.existsSync(importPath)) {
      return importPath;
    }

    // Try with different extensions
    for (const ext of extensions) {
      const pathWithExt = importPath + ext;
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt;
      }
    }

    // Try as index file
    for (const ext of extensions) {
      const indexPath = path.join(importPath, `index${ext}`);
      if (fs.existsSync(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Select tests based on changed files
   */
  selectTests() {
    // Always run tests that directly test changed files
    this.changedFiles.forEach(changedFile => {
      this.testMap.forEach((dependencies, testFile) => {
        if (dependencies.includes(changedFile) || this.isDirectTest(changedFile, testFile)) {
          this.selectedTests.add(testFile);
        }
      });
    });

    // Add specific test selections based on file types
    this.changedFiles.forEach(file => {
      if (file.includes('components/')) {
        this.addTestsByPattern('__tests__/components/**/*.test.*');
      } else if (file.includes('lib/') || file.includes('services/')) {
        this.addTestsByPattern('__tests__/unit/**/*.test.*');
      } else if (file.includes('api/')) {
        this.addTestsByPattern('__tests__/integration/**/*.test.*');
      } else if (file.includes('styles/') || file.includes('.css')) {
        this.addTestsByPattern('__tests__/accessibility/**/*.test.*');
      } else if (file === 'package.json' || file === 'package-lock.json') {
        // If dependencies changed, run all tests
        this.addAllTests();
      }
    });

    // If no specific tests selected, run a minimal smoke test
    if (this.selectedTests.size === 0) {
      this.addTestsByPattern('__tests__/unit/smoke.test.*');
    }

    console.log(`Selected ${this.selectedTests.size} test files to run`);
    return Array.from(this.selectedTests);
  }

  /**
   * Check if test file directly tests the changed file
   */
  isDirectTest(changedFile, testFile) {
    const changedFileBase = path.basename(changedFile, path.extname(changedFile));
    const testFileBase = path.basename(testFile, path.extname(testFile));
    
    return testFileBase.includes(changedFileBase) || 
           testFileBase.replace('.test', '') === changedFileBase;
  }

  /**
   * Add tests matching a pattern
   */
  addTestsByPattern(pattern) {
    // Simple glob-like pattern matching
    this.testMap.forEach((_, testFile) => {
      if (this.matchesPattern(testFile, pattern)) {
        this.selectedTests.add(testFile);
      }
    });
  }

  /**
   * Add all tests
   */
  addAllTests() {
    this.testMap.forEach((_, testFile) => {
      this.selectedTests.add(testFile);
    });
  }

  /**
   * Simple pattern matching
   */
  matchesPattern(filePath, pattern) {
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.');
    
    return new RegExp(regex).test(filePath);
  }

  /**
   * Generate test commands for different test runners
   */
  generateTestCommands() {
    const selectedTests = this.selectTests();
    
    const commands = {
      jest: selectedTests.length > 0 
        ? `jest ${selectedTests.join(' ')} --passWithNoTests`
        : 'jest --passWithNoTests',
      
      playwright: selectedTests
        .filter(test => test.includes('e2e'))
        .map(test => `npx playwright test ${test}`)
        .join(' && ') || 'echo "No E2E tests selected"',
      
      vitest: selectedTests.length > 0
        ? `vitest run ${selectedTests.join(' ')}`
        : 'vitest run --reporter=verbose'
    };

    return commands;
  }

  /**
   * Generate GitHub Actions job matrix
   */
  generateJobMatrix() {
    const selectedTests = this.selectTests();
    
    // Group tests by type
    const testGroups = {
      unit: selectedTests.filter(test => test.includes('unit')),
      integration: selectedTests.filter(test => test.includes('integration')),
      components: selectedTests.filter(test => test.includes('components')),
      accessibility: selectedTests.filter(test => test.includes('accessibility')),
      performance: selectedTests.filter(test => test.includes('performance'))
    };

    // Create matrix entries only for groups that have tests
    const matrix = Object.entries(testGroups)
      .filter(([, tests]) => tests.length > 0)
      .map(([group, tests]) => ({
        group,
        tests: tests.join(' '),
        count: tests.length
      }));

    return {
      include: matrix.length > 0 ? matrix : [{ group: 'smoke', tests: '', count: 0 }]
    };
  }

  /**
   * Calculate test impact score
   */
  calculateImpactScore() {
    const totalTests = this.testMap.size;
    const selectedTests = this.selectedTests.size;
    const reductionPercentage = Math.round(((totalTests - selectedTests) / totalTests) * 100);
    
    return {
      total: totalTests,
      selected: selectedTests,
      reduction: reductionPercentage,
      estimatedTimeSaving: Math.round(reductionPercentage * 0.6) // Assume 60% correlation
    };
  }

  /**
   * Main execution function
   */
  run() {
    console.log('🧠 Starting Intelligent Test Selection...');
    
    this.getChangedFiles();
    this.buildTestMap();
    
    const selectedTests = this.selectTests();
    const commands = this.generateTestCommands();
    const matrix = this.generateJobMatrix();
    const impact = this.calculateImpactScore();
    
    const output = {
      changedFiles: this.changedFiles,
      selectedTests,
      commands,
      matrix,
      impact,
      timestamp: new Date().toISOString()
    };

    // Write output files for GitHub Actions
    fs.writeFileSync('test-selection.json', JSON.stringify(output, null, 2));
    fs.writeFileSync('test-matrix.json', JSON.stringify(matrix, null, 2));
    
    // Set GitHub Actions outputs
    if (process.env.GITHUB_OUTPUT) {
      const outputStr = `test_count=${selectedTests.length}\n` +
                       `reduction_percentage=${impact.reduction}\n` +
                       `matrix=${JSON.stringify(matrix)}\n` +
                       `selected_tests=${selectedTests.join(',')}\n`;
      fs.appendFileSync(process.env.GITHUB_OUTPUT, outputStr);
    }

    console.log(`✅ Test selection complete:`);
    console.log(`   - Changed files: ${this.changedFiles.length}`);
    console.log(`   - Selected tests: ${selectedTests.length}/${impact.total}`);
    console.log(`   - Reduction: ${impact.reduction}%`);
    console.log(`   - Estimated time saving: ${impact.estimatedTimeSaving}%`);

    return output;
  }
}

// Run if called directly
if (require.main === module) {
  const selector = new IntelligentTestSelector();
  try {
    selector.run();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test selection failed:', error.message);
    process.exit(1);
  }
}

module.exports = IntelligentTestSelector;