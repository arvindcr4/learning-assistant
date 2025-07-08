/**
 * Global Test Setup
 * Runs once before all tests start
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = async function globalSetup() {
  console.log('🚀 Starting global test setup...');
  
  const startTime = Date.now();
  
  try {
    // Create test results directory
    const testResultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    // Create coverage directory
    const coverageDir = path.join(process.cwd(), 'coverage');
    if (!fs.existsSync(coverageDir)) {
      fs.mkdirSync(coverageDir, { recursive: true });
    }

    // Create jest cache directory
    const jestCacheDir = path.join(process.cwd(), '.jest-cache');
    if (!fs.existsSync(jestCacheDir)) {
      fs.mkdirSync(jestCacheDir, { recursive: true });
    }

    // Set up environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_APP_ENV = 'test';
    
    // Set up database connection for testing
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/learning_assistant_test';
    
    // Disable analytics and external services in tests
    process.env.DISABLE_ANALYTICS = 'true';
    process.env.DISABLE_SENTRY = 'true';
    process.env.DISABLE_EXTERNAL_SERVICES = 'true';
    
    // Mock JWT secrets for testing
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
    
    // Mock CSRF secret for testing
    process.env.CSRF_SECRET = 'test-csrf-secret-key-for-testing-only';
    
    // Mock encryption key for testing
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only-must-be-32-chars';
    
    // Mock API keys for testing
    process.env.OPENAI_API_KEY = 'test-openai-api-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-api-key';
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_ANON_KEY = 'test-supabase-anon-key';
    process.env.TAMBO_API_KEY = 'test-tambo-api-key';
    
    // Database setup for integration tests
    if (process.env.DATABASE_URL && process.env.SETUP_TEST_DB) {
      console.log('🗄️  Setting up test database...');
      
      // Run database migrations if needed
      try {
        await runCommand('npm', ['run', 'db:migrate']);
        console.log('✅ Database migrations completed');
      } catch (error) {
        console.warn('⚠️  Database migration failed:', error.message);
      }
    }

    // Start mock services if needed
    if (process.env.ENABLE_MOCK_SERVICES === 'true') {
      console.log('🔧 Starting mock services...');
      // Add mock service setup here
    }

    // Performance monitoring setup
    if (process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
      console.log('📊 Setting up performance monitoring...');
      
      // Set up performance observers
      const { performance, PerformanceObserver } = require('perf_hooks');
      
      const obs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'measure') {
            console.log(`📈 Performance: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
          }
        });
      });
      
      obs.observe({ entryTypes: ['measure'] });
      
      // Mark the start of test execution
      performance.mark('test-suite-start');
    }

    // Resource monitoring
    const initialMemory = process.memoryUsage();
    console.log(`🧠 Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    
    // Store initial state for cleanup
    global.__testSetupState = {
      startTime,
      initialMemory,
      testResultsDir,
      coverageDir,
      jestCacheDir,
    };

    const setupTime = Date.now() - startTime;
    console.log(`✅ Global setup completed in ${setupTime}ms`);
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
};

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'pipe',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}