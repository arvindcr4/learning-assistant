#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { performance } = require('perf_hooks');

class BuildPerformanceMonitor {
  constructor() {
    this.metrics = {
      typescript: {
        compilation: 0,
        typeChecking: 0,
        totalFiles: 0,
        errors: 0,
        warnings: 0
      },
      webpack: {
        buildTime: 0,
        bundleSize: 0,
        chunks: 0,
        modules: 0,
        assets: 0
      },
      nextjs: {
        buildTime: 0,
        pageCount: 0,
        staticGeneration: 0,
        serverSideRendering: 0
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        size: 0
      },
      memory: {
        peak: 0,
        average: 0,
        final: 0
      }
    };
    
    this.startTime = performance.now();
    this.reportPath = path.join(process.cwd(), 'build-performance-report.json');
    this.logPath = path.join(process.cwd(), 'build-performance.log');
  }

  // Monitor TypeScript compilation
  async monitorTypeScript() {
    console.log('🔍 Monitoring TypeScript compilation...');
    const startTime = performance.now();
    
    try {
      const result = execSync('npx tsc --noEmit --listFiles', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      const files = result.split('\n').filter(line => line.trim());
      this.metrics.typescript.totalFiles = files.length;
      this.metrics.typescript.compilation = performance.now() - startTime;
      
      console.log(`✅ TypeScript compilation completed in ${this.metrics.typescript.compilation.toFixed(2)}ms`);
      console.log(`📁 Processed ${this.metrics.typescript.totalFiles} files`);
      
      return true;
    } catch (error) {
      this.metrics.typescript.errors = 1;
      console.error('❌ TypeScript compilation failed:', error.message);
      return false;
    }
  }

  // Monitor type checking separately
  async monitorTypeChecking() {
    console.log('🔍 Monitoring TypeScript type checking...');
    const startTime = performance.now();
    
    try {
      execSync('npx tsc --noEmit --skipLibCheck', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      this.metrics.typescript.typeChecking = performance.now() - startTime;
      console.log(`✅ Type checking completed in ${this.metrics.typescript.typeChecking.toFixed(2)}ms`);
      
      return true;
    } catch (error) {
      this.metrics.typescript.errors++;
      console.error('❌ Type checking failed:', error.message);
      return false;
    }
  }

  // Monitor Next.js build
  async monitorNextBuild() {
    console.log('🔍 Monitoring Next.js build...');
    const startTime = performance.now();
    
    try {
      const result = execSync('npm run build', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      this.metrics.nextjs.buildTime = performance.now() - startTime;
      
      // Parse build output for metrics
      const buildOutput = result.toString();
      const pageMatches = buildOutput.match(/(\d+)\s+pages?/);
      const staticMatches = buildOutput.match(/(\d+)\s+static/);
      
      if (pageMatches) {
        this.metrics.nextjs.pageCount = parseInt(pageMatches[1]);
      }
      
      if (staticMatches) {
        this.metrics.nextjs.staticGeneration = parseInt(staticMatches[1]);
      }
      
      console.log(`✅ Next.js build completed in ${this.metrics.nextjs.buildTime.toFixed(2)}ms`);
      console.log(`📄 Generated ${this.metrics.nextjs.pageCount} pages`);
      
      return true;
    } catch (error) {
      console.error('❌ Next.js build failed:', error.message);
      return false;
    }
  }

  // Monitor cache performance
  async monitorCachePerformance() {
    console.log('🔍 Monitoring cache performance...');
    
    const nextCacheDir = path.join(process.cwd(), '.next/cache');
    const jestCacheDir = path.join(process.cwd(), '.jest-cache');
    
    try {
      let totalSize = 0;
      
      if (fs.existsSync(nextCacheDir)) {
        totalSize += this.getDirSize(nextCacheDir);
      }
      
      if (fs.existsSync(jestCacheDir)) {
        totalSize += this.getDirSize(jestCacheDir);
      }
      
      this.metrics.cache.size = totalSize;
      console.log(`💾 Cache size: ${this.formatBytes(totalSize)}`);
      
      return true;
    } catch (error) {
      console.error('❌ Cache monitoring failed:', error.message);
      return false;
    }
  }

  // Monitor memory usage
  monitorMemoryUsage() {
    const memUsage = process.memoryUsage();
    
    this.metrics.memory.final = memUsage.heapUsed;
    this.metrics.memory.peak = Math.max(this.metrics.memory.peak, memUsage.heapUsed);
    
    if (this.metrics.memory.average === 0) {
      this.metrics.memory.average = memUsage.heapUsed;
    } else {
      this.metrics.memory.average = (this.metrics.memory.average + memUsage.heapUsed) / 2;
    }
  }

  // Analyze bundle size
  async analyzeBundleSize() {
    console.log('🔍 Analyzing bundle size...');
    
    try {
      const nextDir = path.join(process.cwd(), '.next');
      
      if (!fs.existsSync(nextDir)) {
        console.log('⚠️  No build directory found');
        return false;
      }
      
      const bundleSize = this.getDirSize(nextDir);
      this.metrics.webpack.bundleSize = bundleSize;
      
      console.log(`📦 Bundle size: ${this.formatBytes(bundleSize)}`);
      
      return true;
    } catch (error) {
      console.error('❌ Bundle size analysis failed:', error.message);
      return false;
    }
  }

  // Generate performance recommendations
  generateRecommendations() {
    const recommendations = [];
    
    if (this.metrics.typescript.compilation > 10000) {
      recommendations.push({
        category: 'TypeScript',
        severity: 'high',
        message: 'TypeScript compilation is slow (>10s). Consider using incremental compilation or reducing strict checks in development.',
        suggestion: 'Enable incremental compilation and use tsconfig.dev.json for development'
      });
    }
    
    if (this.metrics.nextjs.buildTime > 60000) {
      recommendations.push({
        category: 'Next.js',
        severity: 'high',
        message: 'Next.js build is slow (>1min). Consider optimizing webpack configuration or enabling SWC.',
        suggestion: 'Enable SWC compiler and optimize webpack configuration'
      });
    }
    
    if (this.metrics.webpack.bundleSize > 5000000) {
      recommendations.push({
        category: 'Bundle Size',
        severity: 'medium',
        message: 'Bundle size is large (>5MB). Consider code splitting and tree shaking.',
        suggestion: 'Implement dynamic imports and analyze bundle composition'
      });
    }
    
    if (this.metrics.memory.peak > 2000000000) {
      recommendations.push({
        category: 'Memory',
        severity: 'medium',
        message: 'High memory usage detected (>2GB). Consider optimizing memory-intensive operations.',
        suggestion: 'Review memory usage patterns and optimize large data structures'
      });
    }
    
    if (this.metrics.cache.size < 100000) {
      recommendations.push({
        category: 'Cache',
        severity: 'low',
        message: 'Cache size is small, may not be effectively utilized.',
        suggestion: 'Ensure build cache is properly configured'
      });
    }
    
    return recommendations;
  }

  // Run complete performance analysis
  async runCompleteAnalysis() {
    console.log('🚀 Starting comprehensive build performance analysis...');
    
    const startTime = performance.now();
    
    // Monitor memory usage throughout
    const memoryInterval = setInterval(() => {
      this.monitorMemoryUsage();
    }, 1000);
    
    try {
      // Run all monitoring tasks
      await this.monitorTypeScript();
      await this.monitorTypeChecking();
      await this.monitorCachePerformance();
      await this.analyzeBundleSize();
      
      // Clear memory monitoring
      clearInterval(memoryInterval);
      
      const totalTime = performance.now() - startTime;
      
      // Generate report
      const report = {
        timestamp: new Date().toISOString(),
        totalAnalysisTime: totalTime,
        metrics: this.metrics,
        recommendations: this.generateRecommendations(),
        summary: {
          performanceScore: this.calculatePerformanceScore(),
          buildEfficiency: this.calculateBuildEfficiency(),
          optimizationOpportunities: this.getOptimizationOpportunities()
        }
      };
      
      // Save report
      await this.saveReport(report);
      
      // Print summary
      this.printSummary(report);
      
      return report;
    } catch (error) {
      clearInterval(memoryInterval);
      console.error('❌ Performance analysis failed:', error.message);
      throw error;
    }
  }

  // Calculate performance score (0-100)
  calculatePerformanceScore() {
    let score = 100;
    
    // Penalize slow TypeScript compilation
    if (this.metrics.typescript.compilation > 5000) {
      score -= 20;
    } else if (this.metrics.typescript.compilation > 2000) {
      score -= 10;
    }
    
    // Penalize slow Next.js build
    if (this.metrics.nextjs.buildTime > 30000) {
      score -= 25;
    } else if (this.metrics.nextjs.buildTime > 15000) {
      score -= 15;
    }
    
    // Penalize large bundle size
    if (this.metrics.webpack.bundleSize > 10000000) {
      score -= 20;
    } else if (this.metrics.webpack.bundleSize > 5000000) {
      score -= 10;
    }
    
    // Penalize high memory usage
    if (this.metrics.memory.peak > 3000000000) {
      score -= 15;
    } else if (this.metrics.memory.peak > 2000000000) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  // Calculate build efficiency
  calculateBuildEfficiency() {
    const totalTime = this.metrics.typescript.compilation + this.metrics.nextjs.buildTime;
    const filesPerSecond = this.metrics.typescript.totalFiles / (totalTime / 1000);
    
    return {
      totalTime,
      filesPerSecond: filesPerSecond.toFixed(2),
      cacheUtilization: this.metrics.cache.size > 0 ? 'Good' : 'Poor',
      memoryEfficiency: this.metrics.memory.peak < 2000000000 ? 'Good' : 'Poor'
    };
  }

  // Get optimization opportunities
  getOptimizationOpportunities() {
    const opportunities = [];
    
    if (this.metrics.typescript.compilation > 3000) {
      opportunities.push('Enable TypeScript incremental compilation');
    }
    
    if (this.metrics.nextjs.buildTime > 20000) {
      opportunities.push('Optimize webpack configuration');
    }
    
    if (this.metrics.webpack.bundleSize > 3000000) {
      opportunities.push('Implement advanced code splitting');
    }
    
    if (this.metrics.cache.size === 0) {
      opportunities.push('Configure build caching');
    }
    
    return opportunities;
  }

  // Helper methods
  getDirSize(dirPath) {
    let size = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          size += this.getDirSize(filePath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
    
    return size;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async saveReport(report) {
    try {
      await fs.promises.writeFile(this.reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Performance report saved to: ${this.reportPath}`);
    } catch (error) {
      console.error('❌ Failed to save report:', error.message);
    }
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 BUILD PERFORMANCE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Performance Score: ${report.summary.performanceScore}/100`);
    console.log(`Total Analysis Time: ${report.totalAnalysisTime.toFixed(2)}ms`);
    console.log(`TypeScript Compilation: ${report.metrics.typescript.compilation.toFixed(2)}ms`);
    console.log(`Next.js Build Time: ${report.metrics.nextjs.buildTime.toFixed(2)}ms`);
    console.log(`Bundle Size: ${this.formatBytes(report.metrics.webpack.bundleSize)}`);
    console.log(`Cache Size: ${this.formatBytes(report.metrics.cache.size)}`);
    console.log(`Peak Memory: ${this.formatBytes(report.metrics.memory.peak)}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n🔧 RECOMMENDATIONS:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.severity.toUpperCase()}] ${rec.message}`);
        console.log(`   💡 ${rec.suggestion}`);
      });
    }
    
    if (report.summary.optimizationOpportunities.length > 0) {
      console.log('\n🎯 OPTIMIZATION OPPORTUNITIES:');
      report.summary.optimizationOpportunities.forEach((opp, index) => {
        console.log(`${index + 1}. ${opp}`);
      });
    }
    
    console.log('='.repeat(60));
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new BuildPerformanceMonitor();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'typescript':
      monitor.monitorTypeScript();
      break;
    case 'type-check':
      monitor.monitorTypeChecking();
      break;
    case 'build':
      monitor.monitorNextBuild();
      break;
    case 'cache':
      monitor.monitorCachePerformance();
      break;
    case 'bundle':
      monitor.analyzeBundleSize();
      break;
    case 'full':
    default:
      monitor.runCompleteAnalysis().catch(console.error);
      break;
  }
}

module.exports = BuildPerformanceMonitor;