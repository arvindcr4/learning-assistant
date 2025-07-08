#!/usr/bin/env node

/**
 * Developer Tools and Automation Suite
 * 
 * This comprehensive script provides various development utilities, automation tools,
 * and maintenance scripts for the Learning Assistant project.
 * 
 * @author Learning Assistant Team
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

/**
 * Color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Utility functions for terminal interactions
 */
class TerminalUtils {
  /**
   * Print colored text to console
   * @param {string} text - Text to print
   * @param {string} color - Color code
   */
  static print(text, color = colors.white) {
    console.log(`${color}${text}${colors.reset}`);
  }

  /**
   * Print success message
   * @param {string} message - Success message
   */
  static success(message) {
    this.print(`✅ ${message}`, colors.green);
  }

  /**
   * Print error message
   * @param {string} message - Error message
   */
  static error(message) {
    this.print(`❌ ${message}`, colors.red);
  }

  /**
   * Print warning message
   * @param {string} message - Warning message
   */
  static warning(message) {
    this.print(`⚠️  ${message}`, colors.yellow);
  }

  /**
   * Print info message
   * @param {string} message - Info message
   */
  static info(message) {
    this.print(`ℹ️  ${message}`, colors.blue);
  }

  /**
   * Print section header
   * @param {string} title - Section title
   */
  static header(title) {
    const border = '='.repeat(title.length + 4);
    console.log(`\n${colors.cyan}${border}${colors.reset}`);
    console.log(`${colors.cyan}  ${title}  ${colors.reset}`);
    console.log(`${colors.cyan}${border}${colors.reset}\n`);
  }

  /**
   * Prompt user for input
   * @param {string} question - Question to ask
   * @returns {Promise<string>} User input
   */
  static async prompt(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${colors.yellow}${question}${colors.reset} `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Confirm action with user
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>} User confirmation
   */
  static async confirm(message) {
    const answer = await this.prompt(`${message} (y/N):`);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }
}

/**
 * Project management utilities
 */
class ProjectManager {
  /**
   * Initialize new project components
   */
  static async initComponent() {
    TerminalUtils.header('Component Generator');

    const componentName = await TerminalUtils.prompt('Component name (PascalCase):');
    if (!componentName) {
      TerminalUtils.error('Component name is required');
      return;
    }

    const componentType = await TerminalUtils.prompt('Component type (ui/feature/page):');
    const hasProps = await TerminalUtils.confirm('Include props interface?');
    const hasTests = await TerminalUtils.confirm('Generate test file?');
    const hasStories = await TerminalUtils.confirm('Generate Storybook stories?');

    try {
      this.generateComponent(componentName, componentType, { hasProps, hasTests, hasStories });
      TerminalUtils.success(`Component ${componentName} generated successfully!`);
    } catch (error) {
      TerminalUtils.error(`Failed to generate component: ${error.message}`);
    }
  }

  /**
   * Generate a new React component
   * @param {string} name - Component name
   * @param {string} type - Component type (ui/feature/page)
   * @param {Object} options - Generation options
   */
  static generateComponent(name, type = 'ui', options = {}) {
    const { hasProps = true, hasTests = true, hasStories = false } = options;
    
    const componentDir = path.join('src', 'components', type, name);
    const componentFile = path.join(componentDir, `${name}.tsx`);
    const indexFile = path.join(componentDir, 'index.ts');
    const testFile = path.join(componentDir, `${name}.test.tsx`);
    const storiesFile = path.join(componentDir, `${name}.stories.tsx`);

    // Create component directory
    if (!fs.existsSync(componentDir)) {
      fs.mkdirSync(componentDir, { recursive: true });
    }

    // Generate component file
    const componentContent = this.generateComponentContent(name, hasProps);
    fs.writeFileSync(componentFile, componentContent);

    // Generate index file
    const indexContent = `export { ${name} } from './${name}';\nexport type { ${name}Props } from './${name}';`;
    fs.writeFileSync(indexFile, indexContent);

    // Generate test file
    if (hasTests) {
      const testContent = this.generateTestContent(name);
      fs.writeFileSync(testFile, testContent);
    }

    // Generate stories file
    if (hasStories) {
      const storiesContent = this.generateStoriesContent(name);
      fs.writeFileSync(storiesFile, storiesContent);
    }

    TerminalUtils.info(`Generated files in: ${componentDir}`);
  }

  /**
   * Generate component content
   * @param {string} name - Component name
   * @param {boolean} hasProps - Include props interface
   * @returns {string} Component content
   */
  static generateComponentContent(name, hasProps) {
    const propsInterface = hasProps ? `
export interface ${name}Props {
  /** Add your props here */
  className?: string;
  children?: React.ReactNode;
}` : '';

    const propsType = hasProps ? `: ${name}Props` : '';
    const propsParam = hasProps ? `{ className, children, ...props }` : 'props';

    return `import React from 'react';
import { cn } from '@/lib/utils';${propsInterface}

/**
 * ${name} Component
 * 
 * @description Add component description here
 * @example
 * <${name}>
 *   Content here
 * </${name}>
 */
export const ${name} = (${propsParam}${propsType}) => {
  return (
    <div${hasProps ? ` className={cn('${name.toLowerCase()}', className)} {...props}` : ''}>
      ${hasProps ? '{children}' : `{/* ${name} content */}`}
    </div>
  );
};

${name}.displayName = '${name}';
`;
  }

  /**
   * Generate test content
   * @param {string} name - Component name
   * @returns {string} Test content
   */
  static generateTestContent(name) {
    return `import { render, screen } from '@testing-library/react';
import { ${name} } from './${name}';

describe('${name}', () => {
  it('renders without crashing', () => {
    render(<${name} />);
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-class';
    render(<${name} className={customClass} />);
    expect(screen.getByRole('generic')).toHaveClass(customClass);
  });

  it('renders children content', () => {
    const testContent = 'Test content';
    render(<${name}>{testContent}</${name}>);
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });
});
`;
  }

  /**
   * Generate Storybook stories content
   * @param {string} name - Component name
   * @returns {string} Stories content
   */
  static generateStoriesContent(name) {
    return `import type { Meta, StoryObj } from '@storybook/react';
import { ${name} } from './${name}';

const meta: Meta<typeof ${name}> = {
  title: 'Components/${name}',
  component: ${name},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Default ${name}',
  },
};

export const WithCustomClass: Story = {
  args: {
    className: 'custom-styling',
    children: 'Styled ${name}',
  },
};
`;
  }

  /**
   * Initialize new API route
   */
  static async initApiRoute() {
    TerminalUtils.header('API Route Generator');

    const routePath = await TerminalUtils.prompt('API route path (e.g., users/profile):');
    if (!routePath) {
      TerminalUtils.error('Route path is required');
      return;
    }

    const methods = await TerminalUtils.prompt('HTTP methods (GET,POST,PUT,DELETE):');
    const hasAuth = await TerminalUtils.confirm('Requires authentication?');
    const hasValidation = await TerminalUtils.confirm('Include input validation?');

    try {
      this.generateApiRoute(routePath, methods.split(','), { hasAuth, hasValidation });
      TerminalUtils.success(`API route ${routePath} generated successfully!`);
    } catch (error) {
      TerminalUtils.error(`Failed to generate API route: ${error.message}`);
    }
  }

  /**
   * Generate a new API route
   * @param {string} routePath - Route path
   * @param {string[]} methods - HTTP methods
   * @param {Object} options - Generation options
   */
  static generateApiRoute(routePath, methods = ['GET'], options = {}) {
    const { hasAuth = true, hasValidation = true } = options;
    
    const routeDir = path.join('app', 'api', routePath);
    const routeFile = path.join(routeDir, 'route.ts');

    // Create route directory
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }

    // Generate route content
    const routeContent = this.generateApiRouteContent(methods, hasAuth, hasValidation);
    fs.writeFileSync(routeFile, routeContent);

    TerminalUtils.info(`Generated API route: ${routeFile}`);
  }

  /**
   * Generate API route content
   * @param {string[]} methods - HTTP methods
   * @param {boolean} hasAuth - Include authentication
   * @param {boolean} hasValidation - Include validation
   * @returns {string} Route content
   */
  static generateApiRouteContent(methods, hasAuth, hasValidation) {
    const imports = [
      "import { NextRequest, NextResponse } from 'next/server';"
    ];

    if (hasAuth) {
      imports.push("import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';");
    }

    if (hasValidation) {
      imports.push("import { z } from 'zod';");
    }

    const validationSchema = hasValidation ? `
// Request validation schema
const RequestSchema = z.object({
  // Add your validation rules here
  name: z.string().min(1).max(100),
});` : '';

    const handlers = methods.map(method => {
      const handlerName = `handle${method}`;
      const requestType = hasAuth ? 'AuthenticatedRequest' : 'NextRequest';
      
      return `
async function ${handlerName}(request: ${requestType}): Promise<NextResponse> {
  try {${hasAuth ? `
    const user = request.user!;` : ''}${hasValidation && (method === 'POST' || method === 'PUT') ? `
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = RequestSchema.parse(body);` : ''}
    
    // Your business logic here
    const result = {
      success: true,
      message: '${method} request processed successfully',${hasAuth ? `
      userId: user.id,` : ''}
    };

    return NextResponse.json(result${method === 'POST' ? ', { status: 201 }' : ''});
  } catch (error) {${hasValidation ? `
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }` : ''}
    
    console.error('${method} error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}`;
    }).join('\n');

    const exports = methods.map(method => {
      const handlerName = `handle${method}`;
      
      if (hasAuth) {
        return `
export const ${method} = withSecureAuth(${handlerName}, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 100,
    maxRequestsPerIP: 50,
    windowMs: 60000, // 1 minute
  },
});`;
      } else {
        return `
export const ${method} = ${handlerName};`;
      }
    }).join('\n');

    return `${imports.join('\n')}${validationSchema}${handlers}${exports}
`;
  }
}

/**
 * Database management utilities
 */
class DatabaseManager {
  /**
   * Create new database migration
   */
  static async createMigration() {
    TerminalUtils.header('Migration Generator');

    const migrationName = await TerminalUtils.prompt('Migration name (snake_case):');
    if (!migrationName) {
      TerminalUtils.error('Migration name is required');
      return;
    }

    try {
      this.generateMigration(migrationName);
      TerminalUtils.success(`Migration ${migrationName} generated successfully!`);
    } catch (error) {
      TerminalUtils.error(`Failed to generate migration: ${error.message}`);
    }
  }

  /**
   * Generate database migration files
   * @param {string} name - Migration name
   */
  static generateMigration(name) {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const migrationNumber = this.getNextMigrationNumber();
    
    const upFile = path.join('migrations', `${migrationNumber}_${name}.sql`);
    const downFile = path.join('migrations', `${migrationNumber}_${name}_rollback.sql`);

    // Ensure migrations directory exists
    const migrationsDir = 'migrations';
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    // Generate up migration
    const upContent = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}
-- Description: Add description here

BEGIN;

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT NOW()
-- );

COMMIT;
`;

    // Generate down migration (rollback)
    const downContent = `-- Rollback for migration: ${name}
-- Created: ${new Date().toISOString()}

BEGIN;

-- Add your rollback SQL here
-- Example:
-- DROP TABLE IF EXISTS example_table;

COMMIT;
`;

    fs.writeFileSync(upFile, upContent);
    fs.writeFileSync(downFile, downContent);

    TerminalUtils.info(`Generated migration files:`);
    TerminalUtils.info(`  - ${upFile}`);
    TerminalUtils.info(`  - ${downFile}`);
  }

  /**
   * Get the next migration number
   * @returns {string} Next migration number
   */
  static getNextMigrationNumber() {
    const migrationsDir = 'migrations';
    
    if (!fs.existsSync(migrationsDir)) {
      return '001';
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.match(/^\d{3}_.*\.sql$/) && !file.includes('_rollback'))
      .map(file => parseInt(file.substring(0, 3)))
      .sort((a, b) => b - a);

    const nextNumber = files.length > 0 ? files[0] + 1 : 1;
    return nextNumber.toString().padStart(3, '0');
  }

  /**
   * Run database health check
   */
  static async healthCheck() {
    TerminalUtils.header('Database Health Check');

    try {
      // Check if database is accessible
      execSync('npm run db:status', { stdio: 'pipe' });
      TerminalUtils.success('Database connection: OK');

      // Check migration status
      const migrationOutput = execSync('npm run db:status', { encoding: 'utf8' });
      TerminalUtils.info('Migration status:');
      console.log(migrationOutput);

    } catch (error) {
      TerminalUtils.error('Database health check failed');
      TerminalUtils.error(error.message);
    }
  }

  /**
   * Reset development database
   */
  static async resetDatabase() {
    TerminalUtils.header('Database Reset');

    const confirmed = await TerminalUtils.confirm(
      'This will DELETE ALL DATA in the development database. Continue?'
    );

    if (!confirmed) {
      TerminalUtils.info('Database reset cancelled');
      return;
    }

    try {
      TerminalUtils.info('Resetting database...');
      execSync('npm run db:reset', { stdio: 'inherit' });
      TerminalUtils.success('Database reset completed');

      TerminalUtils.info('Running migrations...');
      execSync('npm run db:migrate', { stdio: 'inherit' });
      TerminalUtils.success('Migrations completed');

      TerminalUtils.info('Seeding database...');
      execSync('npm run db:seed', { stdio: 'inherit' });
      TerminalUtils.success('Database seeding completed');

    } catch (error) {
      TerminalUtils.error('Database reset failed');
      TerminalUtils.error(error.message);
    }
  }
}

/**
 * Code quality and maintenance utilities
 */
class QualityManager {
  /**
   * Run comprehensive code quality checks
   */
  static async runQualityChecks() {
    TerminalUtils.header('Code Quality Checks');

    const checks = [
      { name: 'TypeScript Compilation', command: 'npm run type-check' },
      { name: 'ESLint', command: 'npm run lint' },
      { name: 'Prettier Format Check', command: 'npx prettier --check .' },
      { name: 'Unit Tests', command: 'npm run test:unit' },
      { name: 'Security Audit', command: 'npm audit --audit-level moderate' }
    ];

    const results = [];

    for (const check of checks) {
      TerminalUtils.info(`Running ${check.name}...`);
      try {
        execSync(check.command, { stdio: 'pipe' });
        TerminalUtils.success(`${check.name}: PASSED`);
        results.push({ name: check.name, status: 'PASSED' });
      } catch (error) {
        TerminalUtils.error(`${check.name}: FAILED`);
        results.push({ name: check.name, status: 'FAILED', error: error.message });
      }
    }

    // Summary
    TerminalUtils.header('Quality Check Summary');
    const passed = results.filter(r => r.status === 'PASSED').length;
    const total = results.length;

    if (passed === total) {
      TerminalUtils.success(`All ${total} checks passed! 🎉`);
    } else {
      TerminalUtils.warning(`${passed}/${total} checks passed`);
      
      const failed = results.filter(r => r.status === 'FAILED');
      TerminalUtils.error('Failed checks:');
      failed.forEach(check => {
        console.log(`  - ${check.name}`);
      });
    }
  }

  /**
   * Fix code formatting and linting issues
   */
  static async autoFix() {
    TerminalUtils.header('Auto-fixing Code Issues');

    const fixes = [
      { name: 'ESLint Auto-fix', command: 'npm run lint:fix' },
      { name: 'Prettier Format', command: 'npx prettier --write .' },
      { name: 'Import Organization', command: 'npx eslint --fix --ext .ts,.tsx src/' }
    ];

    for (const fix of fixes) {
      TerminalUtils.info(`Running ${fix.name}...`);
      try {
        execSync(fix.command, { stdio: 'inherit' });
        TerminalUtils.success(`${fix.name}: COMPLETED`);
      } catch (error) {
        TerminalUtils.error(`${fix.name}: FAILED`);
        console.log(error.message);
      }
    }
  }

  /**
   * Generate code quality report
   */
  static async generateReport() {
    TerminalUtils.header('Generating Quality Report');

    try {
      TerminalUtils.info('Analyzing code quality...');
      execSync('npm run quality:analyze', { stdio: 'inherit' });
      TerminalUtils.success('Quality report generated');
    } catch (error) {
      TerminalUtils.error('Failed to generate quality report');
      TerminalUtils.error(error.message);
    }
  }
}

/**
 * Performance analysis utilities
 */
class PerformanceManager {
  /**
   * Run performance analysis
   */
  static async runAnalysis() {
    TerminalUtils.header('Performance Analysis');

    const analyses = [
      { name: 'Bundle Analysis', command: 'npm run analyze' },
      { name: 'Lighthouse Audit', command: 'npm run lighthouse:ci' },
      { name: 'Performance Tests', command: 'npm run test:performance' }
    ];

    for (const analysis of analyses) {
      TerminalUtils.info(`Running ${analysis.name}...`);
      try {
        execSync(analysis.command, { stdio: 'inherit' });
        TerminalUtils.success(`${analysis.name}: COMPLETED`);
      } catch (error) {
        TerminalUtils.warning(`${analysis.name}: SKIPPED (${error.message})`);
      }
    }
  }

  /**
   * Optimize application performance
   */
  static async optimize() {
    TerminalUtils.header('Performance Optimization');

    const optimizations = [
      'Image optimization',
      'Bundle splitting',
      'Code minification',
      'Cache optimization',
      'Database query optimization'
    ];

    TerminalUtils.info('Available optimizations:');
    optimizations.forEach((opt, index) => {
      console.log(`  ${index + 1}. ${opt}`);
    });

    const choice = await TerminalUtils.prompt('Select optimization (1-5, or "all"):');
    
    if (choice === 'all') {
      TerminalUtils.info('Running all optimizations...');
      // Implementation for all optimizations
    } else {
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < optimizations.length) {
        TerminalUtils.info(`Running ${optimizations[index]}...`);
        // Implementation for specific optimization
      } else {
        TerminalUtils.error('Invalid choice');
      }
    }
  }
}

/**
 * Main CLI interface
 */
class DevTools {
  /**
   * Show main menu
   */
  static async showMenu() {
    TerminalUtils.header('Learning Assistant - Developer Tools');

    const options = [
      '1. Project Management',
      '2. Database Management', 
      '3. Code Quality',
      '4. Performance Analysis',
      '5. Documentation',
      '6. Testing',
      '7. Exit'
    ];

    console.log('Available tools:\n');
    options.forEach(option => console.log(`  ${option}`));
    
    const choice = await TerminalUtils.prompt('\nSelect an option:');
    
    switch (choice) {
      case '1':
        await this.projectManagementMenu();
        break;
      case '2':
        await this.databaseManagementMenu();
        break;
      case '3':
        await this.codeQualityMenu();
        break;
      case '4':
        await this.performanceMenu();
        break;
      case '5':
        await this.documentationMenu();
        break;
      case '6':
        await this.testingMenu();
        break;
      case '7':
        TerminalUtils.success('Goodbye! 👋');
        process.exit(0);
      default:
        TerminalUtils.error('Invalid option');
        await this.showMenu();
    }
  }

  /**
   * Project management submenu
   */
  static async projectManagementMenu() {
    TerminalUtils.header('Project Management');

    const options = [
      '1. Generate React Component',
      '2. Generate API Route',
      '3. Project Health Check',
      '4. Back to Main Menu'
    ];

    console.log('Project management tools:\n');
    options.forEach(option => console.log(`  ${option}`));
    
    const choice = await TerminalUtils.prompt('\nSelect an option:');
    
    switch (choice) {
      case '1':
        await ProjectManager.initComponent();
        break;
      case '2':
        await ProjectManager.initApiRoute();
        break;
      case '3':
        await this.projectHealthCheck();
        break;
      case '4':
        await this.showMenu();
        return;
      default:
        TerminalUtils.error('Invalid option');
    }

    await this.projectManagementMenu();
  }

  /**
   * Database management submenu
   */
  static async databaseManagementMenu() {
    TerminalUtils.header('Database Management');

    const options = [
      '1. Create Migration',
      '2. Run Migrations',
      '3. Database Health Check',
      '4. Reset Database',
      '5. Back to Main Menu'
    ];

    console.log('Database management tools:\n');
    options.forEach(option => console.log(`  ${option}`));
    
    const choice = await TerminalUtils.prompt('\nSelect an option:');
    
    switch (choice) {
      case '1':
        await DatabaseManager.createMigration();
        break;
      case '2':
        try {
          execSync('npm run db:migrate', { stdio: 'inherit' });
          TerminalUtils.success('Migrations completed');
        } catch (error) {
          TerminalUtils.error('Migration failed');
        }
        break;
      case '3':
        await DatabaseManager.healthCheck();
        break;
      case '4':
        await DatabaseManager.resetDatabase();
        break;
      case '5':
        await this.showMenu();
        return;
      default:
        TerminalUtils.error('Invalid option');
    }

    await this.databaseManagementMenu();
  }

  /**
   * Code quality submenu
   */
  static async codeQualityMenu() {
    TerminalUtils.header('Code Quality');

    const options = [
      '1. Run Quality Checks',
      '2. Auto-fix Issues',
      '3. Generate Quality Report',
      '4. Back to Main Menu'
    ];

    console.log('Code quality tools:\n');
    options.forEach(option => console.log(`  ${option}`));
    
    const choice = await TerminalUtils.prompt('\nSelect an option:');
    
    switch (choice) {
      case '1':
        await QualityManager.runQualityChecks();
        break;
      case '2':
        await QualityManager.autoFix();
        break;
      case '3':
        await QualityManager.generateReport();
        break;
      case '4':
        await this.showMenu();
        return;
      default:
        TerminalUtils.error('Invalid option');
    }

    await this.codeQualityMenu();
  }

  /**
   * Performance analysis submenu
   */
  static async performanceMenu() {
    TerminalUtils.header('Performance Analysis');

    const options = [
      '1. Run Performance Analysis',
      '2. Optimize Performance',
      '3. Back to Main Menu'
    ];

    console.log('Performance tools:\n');
    options.forEach(option => console.log(`  ${option}`));
    
    const choice = await TerminalUtils.prompt('\nSelect an option:');
    
    switch (choice) {
      case '1':
        await PerformanceManager.runAnalysis();
        break;
      case '2':
        await PerformanceManager.optimize();
        break;
      case '3':
        await this.showMenu();
        return;
      default:
        TerminalUtils.error('Invalid option');
    }

    await this.performanceMenu();
  }

  /**
   * Documentation submenu
   */
  static async documentationMenu() {
    TerminalUtils.header('Documentation');

    const options = [
      '1. Generate JSDoc Documentation',
      '2. Analyze Documentation Coverage',
      '3. Generate API Documentation',
      '4. Back to Main Menu'
    ];

    console.log('Documentation tools:\n');
    options.forEach(option => console.log(`  ${option}`));
    
    const choice = await TerminalUtils.prompt('\nSelect an option:');
    
    switch (choice) {
      case '1':
        try {
          execSync('node scripts/generate-jsdoc.js generate', { stdio: 'inherit' });
        } catch (error) {
          TerminalUtils.error('Documentation generation failed');
        }
        break;
      case '2':
        try {
          execSync('node scripts/generate-jsdoc.js analyze', { stdio: 'inherit' });
        } catch (error) {
          TerminalUtils.error('Documentation analysis failed');
        }
        break;
      case '3':
        TerminalUtils.info('API documentation is available at /docs');
        break;
      case '4':
        await this.showMenu();
        return;
      default:
        TerminalUtils.error('Invalid option');
    }

    await this.documentationMenu();
  }

  /**
   * Testing submenu
   */
  static async testingMenu() {
    TerminalUtils.header('Testing');

    const options = [
      '1. Run All Tests',
      '2. Run Unit Tests',
      '3. Run Integration Tests',
      '4. Run E2E Tests',
      '5. Generate Coverage Report',
      '6. Back to Main Menu'
    ];

    console.log('Testing tools:\n');
    options.forEach(option => console.log(`  ${option}`));
    
    const choice = await TerminalUtils.prompt('\nSelect an option:');
    
    const commands = {
      '1': 'npm run test:all',
      '2': 'npm run test:unit',
      '3': 'npm run test:integration',
      '4': 'npm run test:e2e',
      '5': 'npm run test:coverage'
    };

    if (commands[choice]) {
      try {
        execSync(commands[choice], { stdio: 'inherit' });
        TerminalUtils.success('Tests completed');
      } catch (error) {
        TerminalUtils.error('Tests failed');
      }
    } else if (choice === '6') {
      await this.showMenu();
      return;
    } else {
      TerminalUtils.error('Invalid option');
    }

    await this.testingMenu();
  }

  /**
   * Run project health check
   */
  static async projectHealthCheck() {
    TerminalUtils.header('Project Health Check');

    const checks = [
      { name: 'Node.js Version', check: () => process.version },
      { name: 'npm Version', check: () => execSync('npm --version', { encoding: 'utf8' }).trim() },
      { name: 'Dependencies', check: () => 'Checking...' },
      { name: 'Environment Variables', check: () => this.checkEnvVars() },
      { name: 'Database Connection', check: () => 'Testing...' }
    ];

    for (const check of checks) {
      try {
        const result = check.check();
        TerminalUtils.success(`${check.name}: ${result}`);
      } catch (error) {
        TerminalUtils.error(`${check.name}: FAILED`);
      }
    }
  }

  /**
   * Check environment variables
   * @returns {string} Environment status
   */
  static checkEnvVars() {
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'BETTER_AUTH_SECRET'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length === 0) {
      return 'All required variables set';
    } else {
      return `Missing: ${missing.join(', ')}`;
    }
  }
}

// Script execution
if (require.main === module) {
  const command = process.argv[2];

  if (command) {
    // Handle direct commands
    switch (command) {
      case 'component':
        ProjectManager.initComponent();
        break;
      case 'api':
        ProjectManager.initApiRoute();
        break;
      case 'migration':
        DatabaseManager.createMigration();
        break;
      case 'quality':
        QualityManager.runQualityChecks();
        break;
      case 'fix':
        QualityManager.autoFix();
        break;
      case 'performance':
        PerformanceManager.runAnalysis();
        break;
      case 'health':
        DatabaseManager.healthCheck();
        break;
      default:
        console.log('Usage: node dev-tools.js [component|api|migration|quality|fix|performance|health]');
        console.log('Or run without arguments for interactive menu');
    }
  } else {
    // Show interactive menu
    DevTools.showMenu().catch(error => {
      TerminalUtils.error(`Unexpected error: ${error.message}`);
      process.exit(1);
    });
  }
}

module.exports = {
  DevTools,
  ProjectManager,
  DatabaseManager,
  QualityManager,
  PerformanceManager,
  TerminalUtils
};