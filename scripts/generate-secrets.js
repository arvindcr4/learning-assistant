#!/usr/bin/env node

/**
 * Generate secure secrets for the Learning Assistant application
 * This script helps generate production-ready secrets for deployment
 */

const crypto = require('crypto');
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

function generateSecureSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function generateSecrets() {
  const secrets = {
    BETTER_AUTH_SECRET: generateSecureSecret(32),
    JWT_SECRET: generateSecureSecret(32),
    JWT_REFRESH_SECRET: generateSecureSecret(32),
    CSRF_SECRET: generateSecureSecret(32),
    ENCRYPTION_KEY: generateSecureSecret(32),
    SESSION_SECRET: generateSecureSecret(32),
  };

  return secrets;
}

function displaySecrets(secrets) {
  log('\n🔐 Generated Secure Secrets for Production Deployment', 'green');
  log('=' .repeat(60), 'cyan');
  log('⚠️  IMPORTANT: Store these secrets securely and never commit them to version control!', 'yellow');
  log('=' .repeat(60), 'cyan');
  
  Object.entries(secrets).forEach(([key, value]) => {
    log(`${key}="${value}"`, 'white');
  });
  
  log('\n📝 Deployment Instructions:', 'blue');
  log('=' .repeat(40), 'cyan');
  
  log('\nFor Railway:', 'magenta');
  Object.entries(secrets).forEach(([key, value]) => {
    log(`railway variables set ${key}="${value}"`, 'white');
  });
  
  log('\nFor Fly.io:', 'magenta');
  Object.entries(secrets).forEach(([key, value]) => {
    log(`fly secrets set ${key}="${value}"`, 'white');
  });
  
  log('\nFor Vercel:', 'magenta');
  Object.entries(secrets).forEach(([key, value]) => {
    log(`vercel env add ${key}`, 'white');
  });
  
  log('\nFor Docker/Docker Compose:', 'magenta');
  log('Add to your docker-compose.yml or .env file:', 'white');
  Object.entries(secrets).forEach(([key, value]) => {
    log(`${key}="${value}"`, 'white');
  });
  
  log('\n🔒 Security Best Practices:', 'blue');
  log('=' .repeat(40), 'cyan');
  log('• Use environment variables or secrets management', 'white');
  log('• Rotate secrets regularly (every 90 days)', 'white');
  log('• Use different secrets for different environments', 'white');
  log('• Never expose secrets in logs or error messages', 'white');
  log('• Use secure communication channels when sharing', 'white');
}

function saveToFile(secrets, filename = 'secrets.env') {
  const secretsPath = path.join(__dirname, '..', 'deploy', 'secrets', filename);
  
  // Create directory if it doesn't exist
  const dir = path.dirname(secretsPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const content = [
    '# Generated secrets for production deployment',
    '# Generated on: ' + new Date().toISOString(),
    '# SECURITY: Do not commit this file to version control!',
    '',
    ...Object.entries(secrets).map(([key, value]) => `${key}="${value}"`),
    '',
    '# Add these to your deployment platform secrets/environment variables',
    '# Delete this file after deployment for security',
  ].join('\n');
  
  fs.writeFileSync(secretsPath, content);
  log(`\n💾 Secrets saved to: ${secretsPath}`, 'green');
  log('⚠️  Remember to delete this file after deployment!', 'yellow');
}

function validateExistingSecrets() {
  const requiredSecrets = [
    'BETTER_AUTH_SECRET',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CSRF_SECRET'
  ];
  
  const missingSecrets = requiredSecrets.filter(key => !process.env[key]);
  
  if (missingSecrets.length > 0) {
    log('\n❌ Missing required secrets:', 'red');
    missingSecrets.forEach(key => log(`  - ${key}`, 'red'));
    return false;
  }
  
  log('\n✅ All required secrets are present', 'green');
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'generate':
      const secrets = generateSecrets();
      displaySecrets(secrets);
      
      if (args.includes('--save')) {
        const filename = args[args.indexOf('--save') + 1] || 'secrets.env';
        saveToFile(secrets, filename);
      }
      break;
      
    case 'validate':
      validateExistingSecrets();
      break;
      
    default:
      log('\n🔐 Learning Assistant Secret Generator', 'green');
      log('=' .repeat(40), 'cyan');
      log('Usage:', 'blue');
      log('  node scripts/generate-secrets.js generate [--save [filename]]', 'white');
      log('  node scripts/generate-secrets.js validate', 'white');
      log('\nExamples:', 'blue');
      log('  node scripts/generate-secrets.js generate', 'white');
      log('  node scripts/generate-secrets.js generate --save production.env', 'white');
      log('  node scripts/generate-secrets.js validate', 'white');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateSecrets,
  validateExistingSecrets,
  generateSecureSecret,
};