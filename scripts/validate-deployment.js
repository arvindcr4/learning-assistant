#!/usr/bin/env node

/**
 * Validate deployment configuration for the Learning Assistant application
 * This script checks environment variables and configuration before deployment
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'white') {
  console.log(colors[color] + message + colors.reset);
}

function validateEnvironmentVariables() {
  const requiredVars = {
    production: [
      'NODE_ENV',
      'DATABASE_URL',
      'BETTER_AUTH_SECRET',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'CSRF_SECRET',
      'NEXT_PUBLIC_APP_URL',
    ],
    development: [
      'NODE_ENV',
    ],
  };
  
  const optionalVars = [
    'RESEND_API_KEY',
    'TAMBO_API_KEY',
    'LINGO_DEV_API_KEY',
    'FIRECRAWL_API_KEY',
    'SENTRY_DSN',
    'NEXT_PUBLIC_SENTRY_DSN',
    'REDIS_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ];
  
  const env = process.env.NODE_ENV || 'development';
  const required = requiredVars[env] || requiredVars.development;
  
  log(`\n🔍 Validating Environment Variables for ${env} environment`, 'blue');
  log('=' .repeat(60), 'cyan');
  
  let hasErrors = false;
  const missingRequired = [];
  const missingOptional = [];
  
  // Check required variables
  required.forEach(varName => {
    if (!process.env[varName]) {
      missingRequired.push(varName);
      hasErrors = true;
    }
  });
  
  // Check optional variables
  optionalVars.forEach(varName => {
    if (!process.env[varName]) {
      missingOptional.push(varName);
    }
  });
  
  // Display results
  if (missingRequired.length > 0) {
    log('❌ Missing Required Variables:', 'red');
    missingRequired.forEach(varName => {
      log(`  - ${varName}`, 'red');
    });
  } else {
    log('✅ All required variables are present', 'green');
  }
  
  if (missingOptional.length > 0) {
    log('\n⚠️  Missing Optional Variables (features may be disabled):', 'yellow');
    missingOptional.forEach(varName => {
      log(`  - ${varName}`, 'yellow');
    });
  }
  
  return !hasErrors;
}

function validateSecrets() {
  const secrets = [
    'BETTER_AUTH_SECRET',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CSRF_SECRET',
  ];
  
  log('\n🔐 Validating Secret Security', 'blue');
  log('=' .repeat(40), 'cyan');
  
  let hasErrors = false;
  
  secrets.forEach(secretName => {
    const secret = process.env[secretName];
    if (!secret) {
      log(`❌ ${secretName} is missing`, 'red');
      hasErrors = true;
      return;
    }
    
    // Check secret length
    if (secret.length < 32) {
      log(`❌ ${secretName} is too short (minimum 32 characters)`, 'red');
      hasErrors = true;
      return;
    }
    
    // Check for common weak secrets
    const weakPatterns = [
      /^dev-/,
      /^test-/,
      /^your-/,
      /^secret/,
      /^password/,
      /^123456/,
      /^abcdef/,
    ];
    
    const isWeak = weakPatterns.some(pattern => pattern.test(secret.toLowerCase()));
    if (isWeak) {
      log(`⚠️  ${secretName} appears to be a weak or default secret`, 'yellow');
    }
    
    log(`✅ ${secretName} is properly configured`, 'green');
  });
  
  return !hasErrors;
}

function validateDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  
  log('\n🗄️  Validating Database Configuration', 'blue');
  log('=' .repeat(40), 'cyan');
  
  if (!databaseUrl) {
    log('❌ DATABASE_URL is not set', 'red');
    return false;
  }
  
  // Basic URL validation
  try {
    const url = new URL(databaseUrl);
    const protocol = url.protocol.replace(':', '');
    
    if (!['postgresql', 'postgres', 'mysql', 'sqlite'].includes(protocol)) {
      log(`⚠️  Unsupported database protocol: ${protocol}`, 'yellow');
    }
    
    if (protocol === 'sqlite' && process.env.NODE_ENV === 'production') {
      log('⚠️  SQLite is not recommended for production deployments', 'yellow');
    }
    
    log('✅ Database URL is properly formatted', 'green');
    return true;
  } catch (error) {
    log(`❌ Invalid DATABASE_URL format: ${error.message}`, 'red');
    return false;
  }
}

function validateDeploymentFiles() {
  const deploymentFiles = [
    'package.json',
    'next.config.js',
    'Dockerfile',
    'fly.toml',
    'deploy/config/railway/production.env',
    'deploy/config/fly/production.env',
  ];
  
  log('\n📋 Validating Deployment Files', 'blue');
  log('=' .repeat(40), 'cyan');
  
  let hasErrors = false;
  
  deploymentFiles.forEach(filePath => {
    const fullPath = path.join(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      log(`✅ ${filePath} exists`, 'green');
    } else {
      log(`⚠️  ${filePath} not found`, 'yellow');
    }
  });
  
  return !hasErrors;
}

function validateNetworkConfiguration() {
  log('\n🌐 Validating Network Configuration', 'blue');
  log('=' .repeat(40), 'cyan');
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const corsOrigin = process.env.CORS_ORIGIN;
  
  if (!appUrl) {
    log('⚠️  NEXT_PUBLIC_APP_URL is not set', 'yellow');
  } else {
    try {
      new URL(appUrl);
      log('✅ NEXT_PUBLIC_APP_URL is valid', 'green');
    } catch (error) {
      log(`❌ Invalid NEXT_PUBLIC_APP_URL: ${error.message}`, 'red');
    }
  }
  
  if (corsOrigin) {
    log('✅ CORS_ORIGIN is configured', 'green');
  } else {
    log('⚠️  CORS_ORIGIN is not set (may cause CORS issues)', 'yellow');
  }
  
  return true;
}

function generateDeploymentReport() {
  log('\n📊 Deployment Readiness Report', 'blue');
  log('=' .repeat(50), 'cyan');
  
  const checks = [
    { name: 'Environment Variables', fn: validateEnvironmentVariables },
    { name: 'Secret Security', fn: validateSecrets },
    { name: 'Database Configuration', fn: validateDatabaseConnection },
    { name: 'Deployment Files', fn: validateDeploymentFiles },
    { name: 'Network Configuration', fn: validateNetworkConfiguration },
  ];
  
  const results = checks.map(check => ({
    name: check.name,
    passed: check.fn(),
  }));
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  log(`\n📋 Summary: ${passedCount}/${totalCount} checks passed`, 'blue');
  
  if (passedCount === totalCount) {
    log('✅ Deployment is ready!', 'green');
    return true;
  } else {
    log('❌ Please fix the issues above before deploying', 'red');
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'env':
      validateEnvironmentVariables();
      break;
      
    case 'secrets':
      validateSecrets();
      break;
      
    case 'database':
      validateDatabaseConnection();
      break;
      
    case 'files':
      validateDeploymentFiles();
      break;
      
    case 'network':
      validateNetworkConfiguration();
      break;
      
    case 'all':
    default:
      const isReady = generateDeploymentReport();
      process.exit(isReady ? 0 : 1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateEnvironmentVariables,
  validateSecrets,
  validateDatabaseConnection,
  validateDeploymentFiles,
  validateNetworkConfiguration,
};