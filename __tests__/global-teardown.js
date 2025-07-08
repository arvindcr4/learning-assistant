/**
 * Global Test Teardown
 * Runs once after all tests complete
 */

const fs = require('fs');
const path = require('path');

module.exports = async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');
  
  const startTime = Date.now();
  
  try {
    // Get initial state from setup
    const setupState = global.__testSetupState || {};
    
    // Performance monitoring cleanup
    if (process.env.ENABLE_PERFORMANCE_MONITORING === 'true') {
      console.log('📊 Finalizing performance monitoring...');
      
      const { performance } = require('perf_hooks');
      
      // Mark the end of test execution
      performance.mark('test-suite-end');
      performance.measure('total-test-time', 'test-suite-start', 'test-suite-end');
      
      // Get all performance entries
      const entries = performance.getEntriesByType('measure');
      const totalTestTime = entries.find(entry => entry.name === 'total-test-time');
      
      if (totalTestTime) {
        console.log(`📈 Total test execution time: ${totalTestTime.duration.toFixed(2)}ms`);
      }
    }

    // Memory usage reporting
    const finalMemory = process.memoryUsage();
    const memoryDiff = finalMemory.heapUsed - (setupState.initialMemory?.heapUsed || 0);
    
    console.log(`🧠 Final memory usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`🧠 Memory difference: ${memoryDiff > 0 ? '+' : ''}${Math.round(memoryDiff / 1024 / 1024)}MB`);
    
    // Clean up test database
    if (process.env.CLEANUP_TEST_DB && process.env.DATABASE_URL) {
      console.log('🗄️  Cleaning up test database...');
      
      try {
        // Clean up test data but keep schema
        await runCommand('npm', ['run', 'db:reset']);
        console.log('✅ Database cleanup completed');
      } catch (error) {
        console.warn('⚠️  Database cleanup failed:', error.message);
      }
    }
    
    // Stop mock server
    if (process.env.CLEANUP_MOCK_SERVER) {
      console.log('🔧 Stopping mock server...');
      // Add mock server cleanup logic here if needed
    }
    
    // Clean up any global test artifacts
    if (global.testCleanup) {
      await global.testCleanup();
    }

    // Clean up cache files if requested
    if (process.env.CLEANUP_CACHE === 'true') {
      console.log('🧹 Cleaning up cache files...');
      
      const cacheFiles = [
        '.jest-cache',
        'node_modules/.cache',
        '.next/cache',
      ];
      
      for (const cacheDir of cacheFiles) {
        const fullPath = path.join(process.cwd(), cacheDir);
        if (fs.existsSync(fullPath)) {
          try {
            fs.rmSync(fullPath, { recursive: true, force: true });
            console.log(`✅ Cleaned up: ${cacheDir}`);
          } catch (error) {
            console.warn(`⚠️  Failed to clean up ${cacheDir}:`, error.message);
          }
        }
      }
    }

    // Generate final performance report
    if (process.env.GENERATE_PERF_REPORT === 'true') {
      console.log('📊 Generating performance report...');
      
      const reportData = {
        timestamp: new Date().toISOString(),
        totalTime: Date.now() - setupState.startTime,
        teardownTime: Date.now() - startTime,
        memoryUsage: {
          initial: setupState.initialMemory,
          final: finalMemory,
          difference: memoryDiff,
        },
        environment: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
          ci: process.env.CI === 'true',
          workers: process.env.JEST_WORKERS || 'auto',
        },
      };
      
      const reportPath = path.join(process.cwd(), 'test-results', 'teardown-report.json');
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📄 Performance report saved to: ${reportPath}`);
    }

    // Log test artifacts summary
    const testResultsDir = path.join(process.cwd(), 'test-results');
    if (fs.existsSync(testResultsDir)) {
      const files = fs.readdirSync(testResultsDir);
      console.log(`📁 Test artifacts generated: ${files.length} files`);
      files.forEach(file => {
        const filePath = path.join(testResultsDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    }

    const teardownTime = Date.now() - startTime;
    console.log(`✅ Global teardown completed in ${teardownTime}ms`);
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    throw error;
  }
};

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
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