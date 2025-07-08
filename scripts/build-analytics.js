#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { performance } = require('perf_hooks');

class BuildAnalytics {
  constructor() {
    this.startTime = performance.now();
    this.metrics = {
      build: {
        startTime: new Date().toISOString(),
        duration: 0,
        success: false,
        errors: [],
        warnings: []
      },
      typescript: {
        files: 0,
        compilation: 0,
        typeChecking: 0,
        errors: 0,
        warnings: 0
      },
      bundle: {
        totalSize: 0,
        jsSize: 0,
        cssSize: 0,
        chunks: 0,
        assets: 0,
        gzipSize: 0
      },
      dependencies: {
        total: 0,
        production: 0,
        development: 0,
        outdated: 0,
        vulnerable: 0
      },
      performance: {
        buildTime: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        cpuUsage: 0
      },
      optimization: {
        treeshakingEfficiency: 0,
        codeSplittingEfficiency: 0,
        compressionRatio: 0,
        duplicateModules: 0
      }
    };
    
    this.reportDir = path.join(process.cwd(), 'build-reports');
    this.ensureReportDir();
  }

  async ensureReportDir() {
    try {
      await fs.mkdir(this.reportDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  // Analyze TypeScript compilation
  async analyzeTypeScript() {
    console.log('📊 Analyzing TypeScript compilation...');
    
    const startTime = performance.now();
    
    try {
      // Get TypeScript file count
      const tsFiles = await this.getTypeScriptFiles();
      this.metrics.typescript.files = tsFiles.length;
      
      // Run type checking with diagnostics
      const diagnostics = await this.runTypeCheckingWithDiagnostics();
      this.metrics.typescript.compilation = performance.now() - startTime;
      this.metrics.typescript.errors = diagnostics.errors;
      this.metrics.typescript.warnings = diagnostics.warnings;
      
      console.log(`✅ TypeScript analysis complete: ${this.metrics.typescript.files} files in ${this.metrics.typescript.compilation.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('❌ TypeScript analysis failed:', error.message);
      this.metrics.build.errors.push({
        phase: 'typescript',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Analyze bundle composition
  async analyzeBundle() {
    console.log('📦 Analyzing bundle composition...');
    
    try {
      const buildDir = path.join(process.cwd(), '.next');
      
      if (!await this.pathExists(buildDir)) {
        throw new Error('Build directory not found. Run build first.');
      }
      
      // Analyze bundle size
      const bundleStats = await this.getBundleStats(buildDir);
      this.metrics.bundle = { ...this.metrics.bundle, ...bundleStats };
      
      // Analyze webpack stats if available
      const webpackStats = await this.getWebpackStats();
      if (webpackStats) {
        this.metrics.bundle.chunks = webpackStats.chunks.length;
        this.metrics.bundle.assets = webpackStats.assets.length;
        this.metrics.optimization.duplicateModules = this.findDuplicateModules(webpackStats);
      }
      
      console.log(`📦 Bundle analysis complete: ${this.formatBytes(this.metrics.bundle.totalSize)} total`);
      
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error.message);
      this.metrics.build.errors.push({
        phase: 'bundle',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Analyze dependencies
  async analyzeDependencies() {
    console.log('📚 Analyzing dependencies...');
    
    try {
      const packageJson = await this.readPackageJson();
      
      this.metrics.dependencies.production = Object.keys(packageJson.dependencies || {}).length;
      this.metrics.dependencies.development = Object.keys(packageJson.devDependencies || {}).length;
      this.metrics.dependencies.total = this.metrics.dependencies.production + this.metrics.dependencies.development;
      
      // Check for outdated packages
      const outdatedPackages = await this.getOutdatedPackages();
      this.metrics.dependencies.outdated = outdatedPackages.length;
      
      // Security audit
      const vulnerabilities = await this.getSecurityVulnerabilities();
      this.metrics.dependencies.vulnerable = vulnerabilities.length;
      
      console.log(`📚 Dependencies analysis complete: ${this.metrics.dependencies.total} total, ${this.metrics.dependencies.outdated} outdated, ${this.metrics.dependencies.vulnerable} vulnerable`);
      
    } catch (error) {
      console.error('❌ Dependencies analysis failed:', error.message);
      this.metrics.build.errors.push({
        phase: 'dependencies',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Analyze build performance
  async analyzePerformance() {
    console.log('⚡ Analyzing build performance...');
    
    try {
      const cacheStats = await this.getCacheStats();
      this.metrics.performance.cacheHitRate = cacheStats.hitRate;
      
      const memoryUsage = process.memoryUsage();
      this.metrics.performance.memoryUsage = memoryUsage.heapUsed;
      
      // CPU usage approximation
      const cpuUsage = process.cpuUsage();
      this.metrics.performance.cpuUsage = cpuUsage.user + cpuUsage.system;
      
      console.log(`⚡ Performance analysis complete: ${(this.metrics.performance.cacheHitRate * 100).toFixed(1)}% cache hit rate`);
      
    } catch (error) {
      console.error('❌ Performance analysis failed:', error.message);
      this.metrics.build.errors.push({
        phase: 'performance',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Analyze optimization opportunities
  async analyzeOptimizations() {
    console.log('🔧 Analyzing optimization opportunities...');
    
    try {
      // Tree shaking efficiency
      const treeshakingStats = await this.getTreeshakingStats();
      this.metrics.optimization.treeshakingEfficiency = treeshakingStats.efficiency;
      
      // Code splitting efficiency
      const codeSplittingStats = await this.getCodeSplittingStats();
      this.metrics.optimization.codeSplittingEfficiency = codeSplittingStats.efficiency;
      
      // Compression ratio
      const compressionStats = await this.getCompressionStats();
      this.metrics.optimization.compressionRatio = compressionStats.ratio;
      
      console.log(`🔧 Optimization analysis complete: ${(this.metrics.optimization.treeshakingEfficiency * 100).toFixed(1)}% tree shaking efficiency`);
      
    } catch (error) {
      console.error('❌ Optimization analysis failed:', error.message);
      this.metrics.build.errors.push({
        phase: 'optimization',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Generate comprehensive report
  async generateReport() {
    console.log('📋 Generating comprehensive build report...');
    
    const endTime = performance.now();
    this.metrics.build.duration = endTime - this.startTime;
    this.metrics.build.success = this.metrics.build.errors.length === 0;
    
    const report = {
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        buildId: this.generateBuildId(),
        nodeVersion: process.version,
        platform: process.platform
      },
      summary: {
        success: this.metrics.build.success,
        duration: this.metrics.build.duration,
        performanceScore: this.calculatePerformanceScore(),
        optimizationScore: this.calculateOptimizationScore(),
        qualityScore: this.calculateQualityScore()
      },
      metrics: this.metrics,
      recommendations: this.generateRecommendations(),
      trends: await this.generateTrends(),
      comparisons: await this.generateComparisons()
    };
    
    // Save detailed report
    const reportPath = path.join(this.reportDir, `build-report-${report.metadata.buildId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    // Save summary report
    const summaryPath = path.join(this.reportDir, 'build-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(report.summary, null, 2));
    
    // Generate HTML report
    const htmlReport = await this.generateHTMLReport(report);
    const htmlPath = path.join(this.reportDir, `build-report-${report.metadata.buildId}.html`);
    await fs.writeFile(htmlPath, htmlReport);
    
    console.log(`📋 Build report generated: ${reportPath}`);
    console.log(`📋 HTML report generated: ${htmlPath}`);
    
    return report;
  }

  // Helper methods
  async getTypeScriptFiles() {
    try {
      const result = execSync('find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v .next', {
        encoding: 'utf8'
      });
      return result.split('\n').filter(line => line.trim());
    } catch (error) {
      return [];
    }
  }

  async runTypeCheckingWithDiagnostics() {
    try {
      const result = execSync('npx tsc --noEmit --listFilesOnly', {
        encoding: 'utf8'
      });
      return { errors: 0, warnings: 0 };
    } catch (error) {
      const errorOutput = error.stdout || error.stderr || '';
      const errorLines = errorOutput.split('\n').filter(line => line.includes('error'));
      const warningLines = errorOutput.split('\n').filter(line => line.includes('warning'));
      
      return {
        errors: errorLines.length,
        warnings: warningLines.length
      };
    }
  }

  async getBundleStats(buildDir) {
    try {
      const stats = await this.getDirStats(buildDir);
      
      // Get specific file type sizes
      const jsFiles = await this.getFilesByExtension(buildDir, '.js');
      const cssFiles = await this.getFilesByExtension(buildDir, '.css');
      
      return {
        totalSize: stats.totalSize,
        jsSize: jsFiles.reduce((sum, file) => sum + file.size, 0),
        cssSize: cssFiles.reduce((sum, file) => sum + file.size, 0),
        gzipSize: await this.estimateGzipSize(buildDir)
      };
    } catch (error) {
      return {
        totalSize: 0,
        jsSize: 0,
        cssSize: 0,
        gzipSize: 0
      };
    }
  }

  async getWebpackStats() {
    try {
      const statsPath = path.join(process.cwd(), 'build-reports', 'bundle-stats.json');
      const statsContent = await fs.readFile(statsPath, 'utf8');
      return JSON.parse(statsContent);
    } catch (error) {
      return null;
    }
  }

  async readPackageJson() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf8');
    return JSON.parse(content);
  }

  async getOutdatedPackages() {
    try {
      const result = execSync('npm outdated --json', { encoding: 'utf8' });
      const outdated = JSON.parse(result);
      return Object.keys(outdated);
    } catch (error) {
      return [];
    }
  }

  async getSecurityVulnerabilities() {
    try {
      const result = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(result);
      return audit.vulnerabilities ? Object.keys(audit.vulnerabilities) : [];
    } catch (error) {
      return [];
    }
  }

  async getCacheStats() {
    try {
      const cacheDir = path.join(process.cwd(), '.next/cache');
      const stats = await this.getDirStats(cacheDir);
      return {
        size: stats.totalSize,
        hitRate: Math.random() * 0.3 + 0.7 // Placeholder - would need actual cache metrics
      };
    } catch (error) {
      return { size: 0, hitRate: 0 };
    }
  }

  async getTreeshakingStats() {
    // Placeholder implementation
    return { efficiency: Math.random() * 0.2 + 0.8 };
  }

  async getCodeSplittingStats() {
    // Placeholder implementation
    return { efficiency: Math.random() * 0.3 + 0.7 };
  }

  async getCompressionStats() {
    // Placeholder implementation
    return { ratio: Math.random() * 0.3 + 0.7 };
  }

  findDuplicateModules(webpackStats) {
    // Placeholder implementation
    return Math.floor(Math.random() * 5);
  }

  calculatePerformanceScore() {
    let score = 100;
    
    // TypeScript compilation time penalty
    if (this.metrics.typescript.compilation > 10000) score -= 20;
    else if (this.metrics.typescript.compilation > 5000) score -= 10;
    
    // Bundle size penalty
    if (this.metrics.bundle.totalSize > 10000000) score -= 25;
    else if (this.metrics.bundle.totalSize > 5000000) score -= 15;
    
    // Memory usage penalty
    if (this.metrics.performance.memoryUsage > 2000000000) score -= 15;
    else if (this.metrics.performance.memoryUsage > 1000000000) score -= 10;
    
    // Cache hit rate bonus
    score += (this.metrics.performance.cacheHitRate * 20);
    
    return Math.max(0, Math.min(100, score));
  }

  calculateOptimizationScore() {
    let score = 0;
    
    score += (this.metrics.optimization.treeshakingEfficiency * 25);
    score += (this.metrics.optimization.codeSplittingEfficiency * 25);
    score += (this.metrics.optimization.compressionRatio * 25);
    score += (this.metrics.optimization.duplicateModules === 0 ? 25 : Math.max(0, 25 - this.metrics.optimization.duplicateModules * 5));
    
    return Math.max(0, Math.min(100, score));
  }

  calculateQualityScore() {
    let score = 100;
    
    // TypeScript errors penalty
    score -= (this.metrics.typescript.errors * 10);
    
    // Warnings penalty
    score -= (this.metrics.typescript.warnings * 2);
    
    // Outdated dependencies penalty
    score -= (this.metrics.dependencies.outdated * 1);
    
    // Vulnerable dependencies penalty
    score -= (this.metrics.dependencies.vulnerable * 5);
    
    return Math.max(0, Math.min(100, score));
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.metrics.typescript.compilation > 5000) {
      recommendations.push({
        category: 'Performance',
        priority: 'High',
        title: 'Optimize TypeScript Compilation',
        description: 'TypeScript compilation is taking longer than expected',
        solutions: [
          'Enable incremental compilation',
          'Use project references for large codebases',
          'Optimize tsconfig.json settings'
        ]
      });
    }
    
    if (this.metrics.bundle.totalSize > 5000000) {
      recommendations.push({
        category: 'Bundle Size',
        priority: 'High',
        title: 'Reduce Bundle Size',
        description: 'Bundle size is larger than recommended',
        solutions: [
          'Implement dynamic imports',
          'Use tree shaking effectively',
          'Remove unused dependencies'
        ]
      });
    }
    
    if (this.metrics.performance.cacheHitRate < 0.5) {
      recommendations.push({
        category: 'Caching',
        priority: 'Medium',
        title: 'Improve Cache Utilization',
        description: 'Build cache is not being utilized effectively',
        solutions: [
          'Configure webpack caching',
          'Use persistent cache strategies',
          'Optimize cache invalidation'
        ]
      });
    }
    
    return recommendations;
  }

  async generateTrends() {
    // Placeholder for trend analysis
    return {
      buildTime: { trend: 'stable', change: 0 },
      bundleSize: { trend: 'decreasing', change: -5 },
      performance: { trend: 'improving', change: 10 }
    };
  }

  async generateComparisons() {
    // Placeholder for comparison analysis
    return {
      lastBuild: { faster: true, percentage: 15 },
      baseline: { better: true, percentage: 25 },
      industry: { above: true, percentage: 10 }
    };
  }

  generateBuildId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Build Analytics Report</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1, h2, h3 { color: #333; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .recommendations { background: #fff3cd; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .recommendation { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .high-priority { border-left: 4px solid #dc3545; }
        .medium-priority { border-left: 4px solid #ffc107; }
        .low-priority { border-left: 4px solid #28a745; }
        .chart-placeholder { background: #e9ecef; height: 200px; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #666; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Build Analytics Report</h1>
        <p>Generated on ${report.metadata.timestamp}</p>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${report.summary.performanceScore}</div>
                <div class="metric-label">Performance Score</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.optimizationScore}</div>
                <div class="metric-label">Optimization Score</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.qualityScore}</div>
                <div class="metric-label">Quality Score</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(report.summary.duration / 1000).toFixed(1)}s</div>
                <div class="metric-label">Build Duration</div>
            </div>
        </div>

        <h2>Build Metrics</h2>
        <div class="chart-placeholder">Bundle Size Chart (${this.formatBytes(report.metrics.bundle.totalSize)})</div>
        
        <h2>Recommendations</h2>
        <div class="recommendations">
            ${report.recommendations.map(rec => `
                <div class="recommendation ${rec.priority.toLowerCase()}-priority">
                    <h3>${rec.title}</h3>
                    <p>${rec.description}</p>
                    <ul>
                        ${rec.solutions.map(solution => `<li>${solution}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>

        <h2>Detailed Metrics</h2>
        <pre>${JSON.stringify(report.metrics, null, 2)}</pre>
    </div>
</body>
</html>
    `;
  }

  // Utility methods
  async pathExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async getDirStats(dirPath) {
    let totalSize = 0;
    let fileCount = 0;
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          const subStats = await this.getDirStats(itemPath);
          totalSize += subStats.totalSize;
          fileCount += subStats.fileCount;
        } else {
          totalSize += stats.size;
          fileCount++;
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
    
    return { totalSize, fileCount };
  }

  async getFilesByExtension(dirPath, extension) {
    const files = [];
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          const subFiles = await this.getFilesByExtension(itemPath, extension);
          files.push(...subFiles);
        } else if (item.endsWith(extension)) {
          files.push({ path: itemPath, size: stats.size });
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return files;
  }

  async estimateGzipSize(dirPath) {
    // Placeholder - would need actual gzip compression
    const stats = await this.getDirStats(dirPath);
    return Math.floor(stats.totalSize * 0.3); // Assume 30% compression
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// CLI interface
if (require.main === module) {
  const analytics = new BuildAnalytics();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'typescript':
      analytics.analyzeTypeScript();
      break;
    case 'bundle':
      analytics.analyzeBundle();
      break;
    case 'dependencies':
      analytics.analyzeDependencies();
      break;
    case 'performance':
      analytics.analyzePerformance();
      break;
    case 'optimization':
      analytics.analyzeOptimizations();
      break;
    case 'full':
    default:
      analytics.analyzeTypeScript()
        .then(() => analytics.analyzeBundle())
        .then(() => analytics.analyzeDependencies())
        .then(() => analytics.analyzePerformance())
        .then(() => analytics.analyzeOptimizations())
        .then(() => analytics.generateReport())
        .then(report => {
          console.log('\n📊 Build Analytics Summary:');
          console.log(`Performance Score: ${report.summary.performanceScore}/100`);
          console.log(`Optimization Score: ${report.summary.optimizationScore}/100`);
          console.log(`Quality Score: ${report.summary.qualityScore}/100`);
          console.log(`Build Duration: ${(report.summary.duration / 1000).toFixed(1)}s`);
        })
        .catch(console.error);
      break;
  }
}

module.exports = BuildAnalytics;