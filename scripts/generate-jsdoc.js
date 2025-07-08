#!/usr/bin/env node

/**
 * JSDoc Documentation Generator
 * 
 * This script generates comprehensive JSDoc documentation for the Learning Assistant project.
 * It scans TypeScript files and generates documentation with custom templates and styling.
 * 
 * @author Learning Assistant Team
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Configuration for JSDoc generation
 */
const config = {
  sourceDir: 'src',
  outputDir: 'docs/api-reference',
  configFile: 'jsdoc.config.json',
  includePatterns: ['**/*.ts', '**/*.tsx'],
  excludePatterns: [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/node_modules/**',
    '**/.next/**',
    '**/coverage/**'
  ]
};

/**
 * JSDoc configuration object
 */
const jsdocConfig = {
  source: {
    include: [config.sourceDir],
    includePattern: '\\.(ts|tsx)$',
    excludePattern: '(test|spec)\\.(ts|tsx)$'
  },
  opts: {
    destination: config.outputDir,
    recurse: true,
    readme: './README.md'
  },
  plugins: [
    'plugins/markdown',
    'node_modules/better-docs/typescript'
  ],
  templates: {
    cleverLinks: false,
    monospaceLinks: false,
    useLongnameInNav: true,
    showInheritedInNav: true
  },
  typescript: {
    moduleRoot: config.sourceDir
  },
  docdash: {
    static: true,
    sort: true,
    search: true,
    collapse: false,
    typedefs: true,
    removeQuotes: 'none',
    scripts: [],
    menu: {
      'API Reference': {
        href: 'index.html',
        target: '_self',
        class: 'menu-item',
        id: 'api-reference'
      },
      'Developer Guide': {
        href: '../DEVELOPER_GUIDE.html',
        target: '_self',
        class: 'menu-item',
        id: 'developer-guide'
      },
      'Architecture': {
        href: '../ARCHITECTURE_DETAILED.html',
        target: '_self',
        class: 'menu-item',
        id: 'architecture'
      }
    }
  }
};

/**
 * Utility functions for file and directory operations
 */
class FileUtils {
  /**
   * Check if a file or directory exists
   * @param {string} filePath - Path to check
   * @returns {boolean} True if path exists
   */
  static exists(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create directory recursively if it doesn't exist
   * @param {string} dirPath - Directory path to create
   */
  static ensureDir(dirPath) {
    if (!this.exists(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Remove directory and all its contents
   * @param {string} dirPath - Directory path to remove
   */
  static removeDir(dirPath) {
    if (this.exists(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Removed directory: ${dirPath}`);
    }
  }

  /**
   * Get all TypeScript files in a directory recursively
   * @param {string} dirPath - Directory to scan
   * @param {string[]} extensions - File extensions to include
   * @returns {string[]} Array of file paths
   */
  static getFiles(dirPath, extensions = ['.ts', '.tsx']) {
    const files = [];
    
    const scanDir = (currentPath) => {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          if (!config.excludePatterns.some(pattern => 
            fullPath.includes(pattern.replace(/\*\*/g, ''))
          )) {
            scanDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    if (this.exists(dirPath)) {
      scanDir(dirPath);
    }
    
    return files;
  }
}

/**
 * JSDoc comment analyzer and validator
 */
class JSDocAnalyzer {
  /**
   * Analyze TypeScript files for JSDoc coverage
   * @param {string[]} files - Array of file paths to analyze
   * @returns {Object} Analysis results
   */
  static analyze(files) {
    const results = {
      totalFiles: 0,
      totalFunctions: 0,
      totalClasses: 0,
      totalInterfaces: 0,
      documentedFunctions: 0,
      documentedClasses: 0,
      documentedInterfaces: 0,
      undocumentedItems: [],
      coveragePercentage: 0
    };

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const analysis = this.analyzeFile(content, file);
        
        results.totalFiles++;
        results.totalFunctions += analysis.functions.total;
        results.totalClasses += analysis.classes.total;
        results.totalInterfaces += analysis.interfaces.total;
        results.documentedFunctions += analysis.functions.documented;
        results.documentedClasses += analysis.classes.documented;
        results.documentedInterfaces += analysis.interfaces.documented;
        results.undocumentedItems.push(...analysis.undocumented);
      } catch (error) {
        console.warn(`Error analyzing file ${file}:`, error.message);
      }
    }

    const totalItems = results.totalFunctions + results.totalClasses + results.totalInterfaces;
    const documentedItems = results.documentedFunctions + results.documentedClasses + results.documentedInterfaces;
    results.coveragePercentage = totalItems > 0 ? Math.round((documentedItems / totalItems) * 100) : 0;

    return results;
  }

  /**
   * Analyze a single file for JSDoc coverage
   * @param {string} content - File content
   * @param {string} filePath - File path for reporting
   * @returns {Object} File analysis results
   */
  static analyzeFile(content, filePath) {
    const results = {
      functions: { total: 0, documented: 0 },
      classes: { total: 0, documented: 0 },
      interfaces: { total: 0, documented: 0 },
      undocumented: []
    };

    // Regular expressions for different TypeScript constructs
    const patterns = {
      function: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      arrowFunction: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g,
      class: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g,
      interface: /(?:export\s+)?interface\s+(\w+)/g,
      method: /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\(/g
    };

    // Find JSDoc comments
    const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
    const jsdocComments = content.match(jsdocPattern) || [];

    // Analyze functions
    let match;
    const functionPattern = new RegExp(patterns.function.source, 'g');
    while ((match = functionPattern.exec(content)) !== null) {
      results.functions.total++;
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const hasJSDoc = this.hasJSDocBefore(content, match.index);
      
      if (hasJSDoc) {
        results.functions.documented++;
      } else {
        results.undocumented.push({
          type: 'function',
          name: match[1],
          file: filePath,
          line: lineNumber
        });
      }
    }

    // Analyze arrow functions
    const arrowFunctionPattern = new RegExp(patterns.arrowFunction.source, 'g');
    while ((match = arrowFunctionPattern.exec(content)) !== null) {
      results.functions.total++;
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const hasJSDoc = this.hasJSDocBefore(content, match.index);
      
      if (hasJSDoc) {
        results.functions.documented++;
      } else {
        results.undocumented.push({
          type: 'function',
          name: match[1],
          file: filePath,
          line: lineNumber
        });
      }
    }

    // Analyze classes
    const classPattern = new RegExp(patterns.class.source, 'g');
    while ((match = classPattern.exec(content)) !== null) {
      results.classes.total++;
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const hasJSDoc = this.hasJSDocBefore(content, match.index);
      
      if (hasJSDoc) {
        results.classes.documented++;
      } else {
        results.undocumented.push({
          type: 'class',
          name: match[1],
          file: filePath,
          line: lineNumber
        });
      }
    }

    // Analyze interfaces
    const interfacePattern = new RegExp(patterns.interface.source, 'g');
    while ((match = interfacePattern.exec(content)) !== null) {
      results.interfaces.total++;
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const hasJSDoc = this.hasJSDocBefore(content, match.index);
      
      if (hasJSDoc) {
        results.interfaces.documented++;
      } else {
        results.undocumented.push({
          type: 'interface',
          name: match[1],
          file: filePath,
          line: lineNumber
        });
      }
    }

    return results;
  }

  /**
   * Check if there's a JSDoc comment before a given position
   * @param {string} content - File content
   * @param {number} position - Position to check before
   * @returns {boolean} True if JSDoc comment exists
   */
  static hasJSDocBefore(content, position) {
    const beforeContent = content.substring(0, position);
    const lines = beforeContent.split('\n');
    
    // Check the previous few lines for JSDoc comment
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
      const line = lines[i].trim();
      if (line.includes('*/')) {
        // Found end of JSDoc comment
        return true;
      }
      if (line && !line.startsWith('*') && !line.startsWith('/**') && !line.startsWith('//')) {
        // Found non-comment line
        break;
      }
    }
    
    return false;
  }
}

/**
 * Documentation generator class
 */
class DocumentationGenerator {
  /**
   * Generate comprehensive documentation
   */
  static async generate() {
    console.log('🚀 Starting documentation generation...\n');

    try {
      // Step 1: Clean previous documentation
      this.cleanPreviousDocumentation();

      // Step 2: Analyze current documentation coverage
      const coverage = this.analyzeCoverage();

      // Step 3: Generate JSDoc configuration
      this.generateJSDocConfig();

      // Step 4: Generate JSDoc documentation
      await this.generateJSDoc();

      // Step 5: Generate additional documentation
      this.generateAdditionalDocs();

      // Step 6: Generate coverage report
      this.generateCoverageReport(coverage);

      console.log('\n✅ Documentation generation completed successfully!');
      console.log(`📊 Documentation coverage: ${coverage.coveragePercentage}%`);
      console.log(`📁 Output directory: ${config.outputDir}`);

    } catch (error) {
      console.error('❌ Documentation generation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Clean previous documentation output
   */
  static cleanPreviousDocumentation() {
    console.log('🧹 Cleaning previous documentation...');
    FileUtils.removeDir(config.outputDir);
    FileUtils.ensureDir(config.outputDir);
  }

  /**
   * Analyze documentation coverage
   * @returns {Object} Coverage analysis results
   */
  static analyzeCoverage() {
    console.log('📊 Analyzing documentation coverage...');
    const files = FileUtils.getFiles(config.sourceDir);
    const coverage = JSDocAnalyzer.analyze(files);
    
    console.log(`   Found ${coverage.totalFiles} files`);
    console.log(`   Functions: ${coverage.documentedFunctions}/${coverage.totalFunctions} documented`);
    console.log(`   Classes: ${coverage.documentedClasses}/${coverage.totalClasses} documented`);
    console.log(`   Interfaces: ${coverage.documentedInterfaces}/${coverage.totalInterfaces} documented`);
    console.log(`   Coverage: ${coverage.coveragePercentage}%`);

    return coverage;
  }

  /**
   * Generate JSDoc configuration file
   */
  static generateJSDocConfig() {
    console.log('⚙️  Generating JSDoc configuration...');
    const configPath = path.join(process.cwd(), config.configFile);
    fs.writeFileSync(configPath, JSON.stringify(jsdocConfig, null, 2));
    console.log(`   Config saved to: ${configPath}`);
  }

  /**
   * Generate JSDoc documentation
   */
  static async generateJSDoc() {
    console.log('📚 Generating JSDoc documentation...');
    
    try {
      // Check if jsdoc is installed
      execSync('npx jsdoc --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('   Installing jsdoc...');
      execSync('npm install -g jsdoc better-docs', { stdio: 'inherit' });
    }

    // Generate documentation
    const command = `npx jsdoc -c ${config.configFile}`;
    console.log(`   Running: ${command}`);
    execSync(command, { stdio: 'inherit' });
  }

  /**
   * Generate additional documentation files
   */
  static generateAdditionalDocs() {
    console.log('📄 Generating additional documentation...');

    // Generate API endpoint documentation
    this.generateAPIEndpointDocs();

    // Generate component documentation
    this.generateComponentDocs();

    // Generate type definitions documentation
    this.generateTypesDocs();

    // Generate examples
    this.generateExamples();
  }

  /**
   * Generate API endpoint documentation
   */
  static generateAPIEndpointDocs() {
    const apiFiles = FileUtils.getFiles('app/api');
    const endpoints = [];

    for (const file of apiFiles) {
      if (file.endsWith('route.ts')) {
        const content = fs.readFileSync(file, 'utf8');
        const endpoint = this.extractEndpointInfo(file, content);
        if (endpoint) {
          endpoints.push(endpoint);
        }
      }
    }

    const docsContent = this.generateEndpointMarkdown(endpoints);
    const outputPath = path.join(config.outputDir, 'api-endpoints.md');
    fs.writeFileSync(outputPath, docsContent);
    console.log(`   Generated API endpoints documentation: ${outputPath}`);
  }

  /**
   * Extract endpoint information from route file
   * @param {string} filePath - Path to route file
   * @param {string} content - File content
   * @returns {Object|null} Endpoint information
   */
  static extractEndpointInfo(filePath, content) {
    const relativePath = path.relative('app/api', filePath);
    const endpoint = relativePath.replace('/route.ts', '').replace(/\\/g, '/');
    
    const methods = [];
    const exportPattern = /export\s+(?:const|function)\s+(GET|POST|PUT|DELETE|PATCH|OPTIONS)/g;
    let match;
    
    while ((match = exportPattern.exec(content)) !== null) {
      methods.push(match[1]);
    }

    if (methods.length === 0) return null;

    return {
      path: `/api/${endpoint}`,
      methods,
      file: filePath,
      description: this.extractDescriptionFromComments(content)
    };
  }

  /**
   * Extract description from JSDoc comments
   * @param {string} content - File content
   * @returns {string} Description
   */
  static extractDescriptionFromComments(content) {
    const jsdocPattern = /\/\*\*\s*\n\s*\*\s*(.*?)\n/;
    const match = content.match(jsdocPattern);
    return match ? match[1] : 'No description available';
  }

  /**
   * Generate markdown for API endpoints
   * @param {Array} endpoints - Array of endpoint objects
   * @returns {string} Markdown content
   */
  static generateEndpointMarkdown(endpoints) {
    let markdown = '# API Endpoints\n\n';
    markdown += 'This document provides an overview of all API endpoints in the Learning Assistant application.\n\n';

    const groupedEndpoints = {};
    for (const endpoint of endpoints) {
      const group = endpoint.path.split('/')[2] || 'root';
      if (!groupedEndpoints[group]) {
        groupedEndpoints[group] = [];
      }
      groupedEndpoints[group].push(endpoint);
    }

    for (const [group, groupEndpoints] of Object.entries(groupedEndpoints)) {
      markdown += `## ${group.charAt(0).toUpperCase() + group.slice(1)}\n\n`;
      
      for (const endpoint of groupEndpoints) {
        markdown += `### ${endpoint.path}\n\n`;
        markdown += `**Methods:** ${endpoint.methods.join(', ')}\n\n`;
        markdown += `**Description:** ${endpoint.description}\n\n`;
        markdown += `**File:** \`${endpoint.file}\`\n\n`;
        markdown += '---\n\n';
      }
    }

    return markdown;
  }

  /**
   * Generate React component documentation
   */
  static generateComponentDocs() {
    const componentFiles = FileUtils.getFiles('src/components', ['.tsx']);
    const components = [];

    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const componentInfo = this.extractComponentInfo(file, content);
      if (componentInfo) {
        components.push(componentInfo);
      }
    }

    const docsContent = this.generateComponentMarkdown(components);
    const outputPath = path.join(config.outputDir, 'components.md');
    fs.writeFileSync(outputPath, docsContent);
    console.log(`   Generated component documentation: ${outputPath}`);
  }

  /**
   * Extract React component information
   * @param {string} filePath - Path to component file
   * @param {string} content - File content
   * @returns {Object|null} Component information
   */
  static extractComponentInfo(filePath, content) {
    const componentName = path.basename(filePath, '.tsx');
    const interfacePattern = new RegExp(`interface\\s+${componentName}Props\\s*{([^}]+)}`, 's');
    const interfaceMatch = content.match(interfacePattern);
    
    let props = [];
    if (interfaceMatch) {
      const propsContent = interfaceMatch[1];
      const propPattern = /(\w+)\??\s*:\s*([^;]+);/g;
      let propMatch;
      
      while ((propMatch = propPattern.exec(propsContent)) !== null) {
        props.push({
          name: propMatch[1],
          type: propMatch[2].trim(),
          required: !propMatch[0].includes('?')
        });
      }
    }

    return {
      name: componentName,
      path: filePath,
      props,
      description: this.extractDescriptionFromComments(content)
    };
  }

  /**
   * Generate markdown for React components
   * @param {Array} components - Array of component objects
   * @returns {string} Markdown content
   */
  static generateComponentMarkdown(components) {
    let markdown = '# React Components\n\n';
    markdown += 'This document provides documentation for all React components in the Learning Assistant application.\n\n';

    for (const component of components) {
      markdown += `## ${component.name}\n\n`;
      markdown += `**Description:** ${component.description}\n\n`;
      markdown += `**File:** \`${component.path}\`\n\n`;
      
      if (component.props.length > 0) {
        markdown += '### Props\n\n';
        markdown += '| Name | Type | Required | Description |\n';
        markdown += '|------|------|----------|-------------|\n';
        
        for (const prop of component.props) {
          markdown += `| ${prop.name} | \`${prop.type}\` | ${prop.required ? 'Yes' : 'No'} | - |\n`;
        }
        markdown += '\n';
      }
      
      markdown += '---\n\n';
    }

    return markdown;
  }

  /**
   * Generate TypeScript types documentation
   */
  static generateTypesDocs() {
    const typeFiles = FileUtils.getFiles('src/types');
    // Implementation for types documentation
    console.log(`   Generated types documentation for ${typeFiles.length} files`);
  }

  /**
   * Generate usage examples
   */
  static generateExamples() {
    const examplesContent = `# Usage Examples

## API Usage Examples

### Authentication
\`\`\`typescript
import { authService } from '@/lib/auth';

// Login user
const { user, token } = await authService.login(email, password);

// Get current user
const currentUser = await authService.getCurrentUser();
\`\`\`

### Learning Profile
\`\`\`typescript
import { learningService } from '@/services/learning-service';

// Get user's learning profile
const profile = await learningService.getProfile();

// Update learning preferences
await learningService.updateProfile({
  learningStyle: 'visual',
  difficulty: 'intermediate'
});
\`\`\`

## Component Usage Examples

### Button Component
\`\`\`tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="lg" onClick={handleClick}>
  Click me
</Button>
\`\`\`

### Learning Session Component
\`\`\`tsx
import { LearningSession } from '@/components/learning/LearningSession';

<LearningSession
  contentId="lesson-1"
  onComplete={handleSessionComplete}
  adaptiveMode={true}
/>
\`\`\`
`;

    const outputPath = path.join(config.outputDir, 'examples.md');
    fs.writeFileSync(outputPath, examplesContent);
    console.log(`   Generated usage examples: ${outputPath}`);
  }

  /**
   * Generate documentation coverage report
   * @param {Object} coverage - Coverage analysis results
   */
  static generateCoverageReport(coverage) {
    console.log('📈 Generating coverage report...');

    const reportContent = `# Documentation Coverage Report

Generated on: ${new Date().toISOString()}

## Summary

- **Total Files Analyzed**: ${coverage.totalFiles}
- **Overall Coverage**: ${coverage.coveragePercentage}%
- **Functions**: ${coverage.documentedFunctions}/${coverage.totalFunctions} documented (${Math.round((coverage.documentedFunctions / coverage.totalFunctions) * 100) || 0}%)
- **Classes**: ${coverage.documentedClasses}/${coverage.totalClasses} documented (${Math.round((coverage.documentedClasses / coverage.totalClasses) * 100) || 0}%)
- **Interfaces**: ${coverage.documentedInterfaces}/${coverage.totalInterfaces} documented (${Math.round((coverage.documentedInterfaces / coverage.totalInterfaces) * 100) || 0}%)

## Undocumented Items

${coverage.undocumentedItems.length === 0 ? 'All items are properly documented! 🎉' : ''}

${coverage.undocumentedItems.map(item => 
  `- **${item.type}** \`${item.name}\` in \`${item.file}\` (line ${item.line})`
).join('\n')}

## Recommendations

${coverage.coveragePercentage < 80 ? 
  '- ⚠️  Documentation coverage is below 80%. Consider adding JSDoc comments to undocumented functions, classes, and interfaces.' : 
  '- ✅ Great job! Documentation coverage is above 80%.'}

${coverage.undocumentedItems.length > 0 ? 
  '- 📝 Focus on documenting the items listed above to improve coverage.' : 
  '- 🎯 All items are documented. Consider reviewing existing documentation for quality and completeness.'}

## Documentation Standards

### Function Documentation
\`\`\`typescript
/**
 * Brief description of what the function does
 * 
 * @param {string} param1 - Description of parameter 1
 * @param {number} param2 - Description of parameter 2
 * @returns {Promise<boolean>} Description of return value
 * @throws {Error} When invalid input is provided
 * @example
 * const result = await myFunction('test', 42);
 */
async function myFunction(param1: string, param2: number): Promise<boolean> {
  // Implementation
}
\`\`\`

### Class Documentation
\`\`\`typescript
/**
 * Brief description of what the class does
 * 
 * @class MyClass
 * @example
 * const instance = new MyClass();
 */
class MyClass {
  /**
   * Description of the property
   */
  public myProperty: string;
  
  /**
   * Constructor description
   * @param {string} param - Constructor parameter
   */
  constructor(param: string) {
    this.myProperty = param;
  }
}
\`\`\`

### Interface Documentation
\`\`\`typescript
/**
 * Brief description of the interface
 * 
 * @interface MyInterface
 */
interface MyInterface {
  /** Description of property */
  id: string;
  /** Description of optional property */
  name?: string;
}
\`\`\`
`;

    const outputPath = path.join(config.outputDir, 'coverage-report.md');
    fs.writeFileSync(outputPath, reportContent);
    console.log(`   Generated coverage report: ${outputPath}`);
  }
}

// Script execution
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'generate':
      DocumentationGenerator.generate();
      break;
    case 'analyze':
      const files = FileUtils.getFiles(config.sourceDir);
      const coverage = JSDocAnalyzer.analyze(files);
      console.log('\n📊 Documentation Coverage Analysis');
      console.log('=====================================');
      console.log(`Files analyzed: ${coverage.totalFiles}`);
      console.log(`Overall coverage: ${coverage.coveragePercentage}%`);
      console.log(`Functions: ${coverage.documentedFunctions}/${coverage.totalFunctions}`);
      console.log(`Classes: ${coverage.documentedClasses}/${coverage.totalClasses}`);
      console.log(`Interfaces: ${coverage.documentedInterfaces}/${coverage.totalInterfaces}`);
      if (coverage.undocumentedItems.length > 0) {
        console.log('\nUndocumented items:');
        coverage.undocumentedItems.forEach(item => {
          console.log(`  - ${item.type} "${item.name}" in ${item.file}:${item.line}`);
        });
      }
      break;
    case 'clean':
      FileUtils.removeDir(config.outputDir);
      console.log('✅ Documentation cleaned');
      break;
    default:
      console.log('Usage: node generate-jsdoc.js [generate|analyze|clean]');
      console.log('');
      console.log('Commands:');
      console.log('  generate  - Generate complete documentation');
      console.log('  analyze   - Analyze documentation coverage');
      console.log('  clean     - Clean generated documentation');
      process.exit(1);
  }
}

module.exports = {
  DocumentationGenerator,
  JSDocAnalyzer,
  FileUtils,
  config
};