#!/usr/bin/env node

/**
 * JSDoc Templates and Code Documentation Generator
 * Provides standardized JSDoc templates and documentation patterns
 * 
 * @fileoverview This utility generates JSDoc templates for consistent documentation
 * @author Learning Assistant Team
 * @version 1.0.0
 * @since 2024-07-08
 */

const fs = require('fs');
const path = require('path');

/**
 * JSDoc template for React functional components
 */
const REACT_COMPONENT_TEMPLATE = `/**
 * [ComponentName] Component
 * [Brief description of what the component does]
 * 
 * @example
 * \`\`\`tsx
 * <ComponentName 
 *   prop1="value1"
 *   prop2={value2}
 *   onAction={handleAction}
 * />
 * \`\`\`
 * 
 * @param props - Component props
 * @param props.prop1 - Description of prop1
 * @param props.prop2 - Description of prop2
 * @param props.onAction - Callback function for action
 * @returns JSX element
 */`;

/**
 * JSDoc template for custom hooks
 */
const CUSTOM_HOOK_TEMPLATE = `/**
 * [hookName] Hook
 * [Brief description of what the hook does and when to use it]
 * 
 * @example
 * \`\`\`tsx
 * const { data, loading, error, refetch } = useHookName(params);
 * \`\`\`
 * 
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 * @returns Hook return object
 * @returns returns.data - The data returned by the hook
 * @returns returns.loading - Loading state
 * @returns returns.error - Error state if any
 * @returns returns.refetch - Function to refetch data
 */`;

/**
 * JSDoc template for utility functions
 */
const UTILITY_FUNCTION_TEMPLATE = `/**
 * [functionName] - [Brief description]
 * [Detailed description of what the function does, when to use it, and any important notes]
 * 
 * @example
 * \`\`\`typescript
 * const result = functionName(param1, param2);
 * console.log(result); // Expected output
 * \`\`\`
 * 
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2
 * @returns Description of return value
 * @throws {ErrorType} When error condition occurs
 * @since 1.0.0
 */`;

/**
 * JSDoc template for API functions
 */
const API_FUNCTION_TEMPLATE = `/**
 * [apiFunction] - [Brief description of API call]
 * [Detailed description including endpoint, authentication requirements, etc.]
 * 
 * @example
 * \`\`\`typescript
 * const result = await apiFunction({ id: 123 });
 * if (result.success) {
 *   console.log(result.data);
 * }
 * \`\`\`
 * 
 * @param params - API request parameters
 * @param params.id - Resource ID
 * @param options - Request options
 * @param options.signal - Abort signal for request cancellation
 * @returns Promise resolving to API response
 * @throws {NetworkError} When network request fails
 * @throws {ValidationError} When request parameters are invalid
 */`;

/**
 * JSDoc template for class methods
 */
const CLASS_METHOD_TEMPLATE = `/**
 * [methodName] - [Brief description]
 * [Detailed description of what the method does]
 * 
 * @example
 * \`\`\`typescript
 * const instance = new ClassName();
 * const result = instance.methodName(param1);
 * \`\`\`
 * 
 * @param param1 - Description of parameter
 * @returns Description of return value
 * @throws {Error} When error condition occurs
 * @memberof ClassName
 * @since 1.0.0
 */`;

/**
 * JSDoc template for type definitions
 */
const TYPE_DEFINITION_TEMPLATE = `/**
 * [TypeName] interface
 * [Description of what this type represents and when to use it]
 * 
 * @example
 * \`\`\`typescript
 * const data: TypeName = {
 *   property1: 'value',
 *   property2: 123
 * };
 * \`\`\`
 * 
 * @interface TypeName
 * @property {string} property1 - Description of property1
 * @property {number} property2 - Description of property2
 * @since 1.0.0
 */`;

/**
 * JSDoc template for file headers
 */
const FILE_HEADER_TEMPLATE = `/**
 * [Module Name]
 * [Brief description of the module's purpose]
 * 
 * @fileoverview [Detailed description of what this file contains]
 * @module [ModuleName]
 * @author Learning Assistant Team
 * @version 1.0.0
 * @since 2024-07-08
 * 
 * @example
 * \`\`\`typescript
 * import { exportedFunction } from './module-name';
 * 
 * const result = exportedFunction();
 * \`\`\`
 */`;

/**
 * Template mapping for different code patterns
 */
const TEMPLATES = {
  component: REACT_COMPONENT_TEMPLATE,
  hook: CUSTOM_HOOK_TEMPLATE,
  function: UTILITY_FUNCTION_TEMPLATE,
  api: API_FUNCTION_TEMPLATE,
  method: CLASS_METHOD_TEMPLATE,
  type: TYPE_DEFINITION_TEMPLATE,
  header: FILE_HEADER_TEMPLATE,
};

/**
 * Documentation standards and best practices
 */
const DOCUMENTATION_STANDARDS = {
  /**
   * Required JSDoc tags for functions
   */
  requiredTags: {
    functions: ['@param', '@returns', '@example'],
    components: ['@param', '@returns', '@example'],
    hooks: ['@param', '@returns', '@example'],
    classes: ['@class', '@param', '@returns', '@example'],
    interfaces: ['@interface', '@property', '@example'],
  },

  /**
   * Description length guidelines
   */
  descriptionLengths: {
    brief: { min: 10, max: 80 },
    detailed: { min: 50, max: 300 },
  },

  /**
   * Common JSDoc tags and their usage
   */
  commonTags: {
    '@param': 'Documents function/method parameters',
    '@returns': 'Documents return value',
    '@throws': 'Documents exceptions that may be thrown',
    '@example': 'Provides usage examples',
    '@since': 'Documents version when feature was added',
    '@deprecated': 'Marks deprecated features',
    '@see': 'References related documentation',
    '@todo': 'Notes for future improvements',
    '@memberof': 'Associates method with class',
    '@namespace': 'Documents namespaces',
    '@readonly': 'Marks read-only properties',
    '@static': 'Marks static methods/properties',
    '@override': 'Indicates method overrides parent',
    '@abstract': 'Marks abstract methods/classes',
    '@async': 'Indicates async functions',
  },
};

/**
 * Analyzes a file and suggests documentation improvements
 * @param {string} filePath - Path to the file to analyze
 * @returns {Object} Analysis results with suggestions
 */
function analyzeFileDocumentation(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const analysis = {
      file: filePath,
      totalLines: lines.length,
      documentedFunctions: 0,
      undocumentedFunctions: 0,
      documentedComponents: 0,
      undocumentedComponents: 0,
      suggestions: [],
      score: 0,
    };

    // Count functions and their documentation
    const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(/g) || [];
    const componentMatches = content.match(/(?:export\s+)?const\s+[A-Z]\w*\s*[:=]|function\s+[A-Z]\w*\s*\(/g) || [];
    
    // Check for JSDoc comments
    const jsdocMatches = content.match(/\/\*\*[\s\S]*?\*\//g) || [];
    
    analysis.documentedFunctions = Math.min(jsdocMatches.length, functionMatches.length);
    analysis.undocumentedFunctions = Math.max(0, functionMatches.length - jsdocMatches.length);
    
    analysis.documentedComponents = Math.min(jsdocMatches.length, componentMatches.length);
    analysis.undocumentedComponents = Math.max(0, componentMatches.length - jsdocMatches.length);

    // Generate suggestions
    if (analysis.undocumentedFunctions > 0) {
      analysis.suggestions.push(`Add JSDoc documentation for ${analysis.undocumentedFunctions} undocumented functions`);
    }
    
    if (analysis.undocumentedComponents > 0) {
      analysis.suggestions.push(`Add JSDoc documentation for ${analysis.undocumentedComponents} undocumented components`);
    }
    
    if (!content.includes('@fileoverview')) {
      analysis.suggestions.push('Add file header with @fileoverview description');
    }
    
    if (!content.includes('@example')) {
      analysis.suggestions.push('Add @example tags to show usage patterns');
    }

    // Calculate documentation score
    const totalDocumentable = functionMatches.length + componentMatches.length;
    const totalDocumented = analysis.documentedFunctions + analysis.documentedComponents;
    analysis.score = totalDocumentable > 0 ? (totalDocumented / totalDocumentable) * 100 : 100;

    return analysis;
  } catch (error) {
    return {
      file: filePath,
      error: error.message,
      score: 0,
    };
  }
}

/**
 * Generates a documentation report for the entire project
 * @param {string} srcDir - Source directory to analyze
 * @returns {Object} Complete documentation report
 */
function generateDocumentationReport(srcDir = 'src') {
  const report = {
    summary: {
      totalFiles: 0,
      averageScore: 0,
      wellDocumented: 0, // Score >= 80
      needsImprovement: 0, // Score < 80
    },
    details: [],
    recommendations: [],
  };

  /**
   * Recursively analyzes all TypeScript files
   * @param {string} dir - Directory to analyze
   */
  function analyzeDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          analyzeDirectory(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          const analysis = analyzeFileDocumentation(fullPath);
          report.details.push(analysis);
          report.summary.totalFiles++;
          
          if (analysis.score >= 80) {
            report.summary.wellDocumented++;
          } else {
            report.summary.needsImprovement++;
          }
        }
      }
    } catch (error) {
      console.error(`Error analyzing directory ${dir}:`, error.message);
    }
  }

  analyzeDirectory(srcDir);

  // Calculate average score
  if (report.summary.totalFiles > 0) {
    const totalScore = report.details.reduce((sum, detail) => sum + (detail.score || 0), 0);
    report.summary.averageScore = totalScore / report.summary.totalFiles;
  }

  // Generate recommendations
  if (report.summary.averageScore < 70) {
    report.recommendations.push('📚 Overall documentation coverage is low. Focus on adding JSDoc comments to all public functions and components.');
  }
  
  if (report.summary.needsImprovement > report.summary.wellDocumented) {
    report.recommendations.push('⚠️ Most files need documentation improvement. Consider setting up documentation standards and review processes.');
  }
  
  report.recommendations.push('✅ Use the provided JSDoc templates for consistent documentation style.');
  report.recommendations.push('🔍 Run documentation linting as part of your CI/CD pipeline.');

  return report;
}

/**
 * Prints documentation templates to console
 */
function printTemplates() {
  console.log('📝 JSDoc Documentation Templates\n');
  console.log('=' * 50);
  
  Object.entries(TEMPLATES).forEach(([type, template]) => {
    console.log(`\n🏷️  ${type.toUpperCase()} TEMPLATE:`);
    console.log('-' * 30);
    console.log(template);
  });
  
  console.log('\n📋 Documentation Standards:');
  console.log(JSON.stringify(DOCUMENTATION_STANDARDS, null, 2));
}

/**
 * Main function to run documentation analysis
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'templates':
      printTemplates();
      break;
      
    case 'analyze':
      const srcDir = args[1] || 'src';
      const report = generateDocumentationReport(srcDir);
      
      console.log('📊 DOCUMENTATION ANALYSIS REPORT\n');
      console.log('=' * 40);
      console.log(`\n📈 SUMMARY:`);
      console.log(`Total Files: ${report.summary.totalFiles}`);
      console.log(`Average Score: ${report.summary.averageScore.toFixed(1)}%`);
      console.log(`Well Documented (≥80%): ${report.summary.wellDocumented}`);
      console.log(`Needs Improvement (<80%): ${report.summary.needsImprovement}`);
      
      console.log('\n💡 RECOMMENDATIONS:');
      report.recommendations.forEach(rec => console.log(`  ${rec}`));
      
      console.log('\n📂 FILES NEEDING ATTENTION:');
      report.details
        .filter(detail => detail.score < 80)
        .sort((a, b) => a.score - b.score)
        .slice(0, 10)
        .forEach(detail => {
          console.log(`  ${detail.file}: ${detail.score.toFixed(1)}% - ${detail.suggestions?.join(', ') || 'No specific suggestions'}`);
        });
      
      break;
      
    default:
      console.log('Usage:');
      console.log('  node jsdoc-templates.js templates  - Show JSDoc templates');
      console.log('  node jsdoc-templates.js analyze [srcDir]  - Analyze documentation coverage');
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  TEMPLATES,
  DOCUMENTATION_STANDARDS,
  analyzeFileDocumentation,
  generateDocumentationReport,
};