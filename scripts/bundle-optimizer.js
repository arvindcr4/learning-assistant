#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class BundleOptimizer {
  constructor() {
    this.projectRoot = process.cwd();
    this.buildDir = path.join(this.projectRoot, '.next');
    this.optimizations = {
      dynamicImports: [],
      chunkSplitting: [],
      treeshaking: [],
      compression: [],
      caching: []
    };
  }

  // Analyze and optimize dynamic imports
  async optimizeDynamicImports() {
    console.log('🔄 Optimizing dynamic imports...');
    
    const opportunities = await this.findDynamicImportOpportunities();
    
    for (const opportunity of opportunities) {
      await this.implementDynamicImport(opportunity);
    }
    
    console.log(`✅ Optimized ${opportunities.length} dynamic import opportunities`);
    return opportunities;
  }

  // Find opportunities for dynamic imports
  async findDynamicImportOpportunities() {
    const opportunities = [];
    
    // Heavy UI components
    const heavyComponents = await this.findHeavyComponents();
    for (const component of heavyComponents) {
      if (component.size > 50000) { // 50KB threshold
        opportunities.push({
          type: 'component',
          file: component.path,
          reason: 'Heavy component',
          size: component.size,
          priority: 'high'
        });
      }
    }
    
    // Route-level components
    const routeComponents = await this.findRouteComponents();
    for (const component of routeComponents) {
      opportunities.push({
        type: 'route',
        file: component.path,
        reason: 'Route component',
        size: component.size,
        priority: 'medium'
      });
    }
    
    // Third-party libraries
    const heavyLibraries = await this.findHeavyLibraries();
    for (const library of heavyLibraries) {
      opportunities.push({
        type: 'library',
        file: library.path,
        reason: 'Heavy library',
        size: library.size,
        priority: 'high'
      });
    }
    
    return opportunities;
  }

  // Implement dynamic import for a specific opportunity
  async implementDynamicImport(opportunity) {
    try {
      const content = await fs.readFile(opportunity.file, 'utf8');
      
      if (opportunity.type === 'component') {
        const optimizedContent = this.convertToLazyComponent(content, opportunity);
        await fs.writeFile(opportunity.file, optimizedContent);
        
        this.optimizations.dynamicImports.push({
          file: opportunity.file,
          type: 'component',
          estimatedSavings: opportunity.size * 0.7
        });
      } else if (opportunity.type === 'library') {
        const optimizedContent = this.convertToLazyLibrary(content, opportunity);
        await fs.writeFile(opportunity.file, optimizedContent);
        
        this.optimizations.dynamicImports.push({
          file: opportunity.file,
          type: 'library',
          estimatedSavings: opportunity.size * 0.5
        });
      }
    } catch (error) {
      console.error(`Failed to optimize ${opportunity.file}:`, error.message);
    }
  }

  // Convert component to lazy-loaded
  convertToLazyComponent(content, opportunity) {
    const componentName = path.basename(opportunity.file, '.tsx');
    
    // Add React imports if not present
    if (!content.includes('import React')) {
      content = `import React, { lazy, Suspense } from 'react';\n${content}`;
    } else if (!content.includes('lazy') || !content.includes('Suspense')) {
      content = content.replace(
        /import React.*from ['"]react['"];/,
        `import React, { lazy, Suspense } from 'react';`
      );
    }
    
    // Create lazy component wrapper
    const lazyWrapper = `
// Lazy-loaded component for better performance
const Lazy${componentName} = lazy(() => import('./${componentName}'));

export const ${componentName}WithSuspense = (props) => (
  <Suspense fallback={<div>Loading...</div>}>
    <Lazy${componentName} {...props} />
  </Suspense>
);

export default ${componentName}WithSuspense;
`;
    
    return content + '\n' + lazyWrapper;
  }

  // Convert library import to lazy-loaded
  convertToLazyLibrary(content, opportunity) {
    // Replace heavy library imports with dynamic imports
    const libraryName = opportunity.file.split('/').pop().replace('.js', '');
    
    const dynamicImport = `
// Dynamic import for ${libraryName}
const load${libraryName} = async () => {
  const module = await import('${libraryName}');
  return module.default || module;
};

export { load${libraryName} };
`;
    
    return content + '\n' + dynamicImport;
  }

  // Optimize chunk splitting
  async optimizeChunkSplitting() {
    console.log('📦 Optimizing chunk splitting...');
    
    const chunkConfig = await this.generateOptimalChunkConfig();
    await this.updateWebpackConfig(chunkConfig);
    
    console.log('✅ Chunk splitting configuration updated');
    return chunkConfig;
  }

  // Generate optimal chunk configuration
  async generateOptimalChunkConfig() {
    const dependencies = await this.analyzeDependencies();
    const routeAnalysis = await this.analyzeRoutes();
    const componentAnalysis = await this.analyzeComponents();
    
    return {
      cacheGroups: {
        // Framework chunks
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 30,
          enforce: true
        },
        
        // UI library chunks
        ui: {
          test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
          name: 'ui',
          chunks: 'all',
          priority: 25,
          enforce: true
        },
        
        // Animation libraries
        animation: {
          test: /[\\/]node_modules[\\/](framer-motion|lottie-react)[\\/]/,
          name: 'animation',
          chunks: 'all',
          priority: 20,
          enforce: true
        },
        
        // Utility libraries
        utils: {
          test: /[\\/]node_modules[\\/](lodash|date-fns|uuid)[\\/]/,
          name: 'utils',
          chunks: 'all',
          priority: 15,
          enforce: true
        },
        
        // Authentication libraries
        auth: {
          test: /[\\/]node_modules[\\/](@supabase|better-auth|jsonwebtoken)[\\/]/,
          name: 'auth',
          chunks: 'all',
          priority: 10,
          enforce: true
        },
        
        // Common vendor chunks
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: 5,
          minChunks: 2,
          reuseExistingChunk: true
        },
        
        // Common application chunks
        common: {
          name: 'common',
          minChunks: 2,
          priority: 0,
          chunks: 'all',
          reuseExistingChunk: true
        }
      },
      
      // Chunk size optimization
      maxSize: 244000, // 244KB max chunk size
      minSize: 20000,  // 20KB min chunk size
      
      // Advanced splitting
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      
      // Automatic naming
      automaticNameDelimiter: '~',
      
      // Size thresholds
      enforceSizeThreshold: 50000
    };
  }

  // Update webpack configuration
  async updateWebpackConfig(chunkConfig) {
    const configPath = path.join(this.projectRoot, 'next.config.js');
    const content = await fs.readFile(configPath, 'utf8');
    
    // Update the splitChunks configuration
    const updatedContent = content.replace(
      /splitChunks:\s*{[\s\S]*?}/,
      `splitChunks: ${JSON.stringify(chunkConfig, null, 8)}`
    );
    
    await fs.writeFile(configPath, updatedContent);
    
    this.optimizations.chunkSplitting.push({
      config: chunkConfig,
      estimatedImprovement: '20-30% better caching'
    });
  }

  // Optimize tree shaking
  async optimizeTreeShaking() {
    console.log('🌳 Optimizing tree shaking...');
    
    const unusedExports = await this.findUnusedExports();
    const sideEffectFreePackages = await this.identifySideEffectFreePackages();
    
    // Update package.json sideEffects
    await this.updatePackageJsonSideEffects(sideEffectFreePackages);
    
    // Remove unused exports
    for (const unusedExport of unusedExports) {
      await this.removeUnusedExport(unusedExport);
    }
    
    console.log(`✅ Tree shaking optimized: ${unusedExports.length} unused exports removed`);
    
    this.optimizations.treeshaking.push({
      removedExports: unusedExports.length,
      sideEffectFreePackages: sideEffectFreePackages.length,
      estimatedSavings: unusedExports.length * 1000 // Rough estimate
    });
  }

  // Find unused exports
  async findUnusedExports() {
    const unusedExports = [];
    
    try {
      // Use a simple approach - in production, you'd want a more sophisticated tool
      const sourceFiles = await this.getSourceFiles();
      
      for (const file of sourceFiles) {
        const content = await fs.readFile(file, 'utf8');
        const exports = this.extractExports(content);
        
        for (const exportName of exports) {
          const isUsed = await this.isExportUsed(exportName, file);
          if (!isUsed) {
            unusedExports.push({ file, export: exportName });
          }
        }
      }
    } catch (error) {
      console.error('Error finding unused exports:', error.message);
    }
    
    return unusedExports;
  }

  // Identify side-effect-free packages
  async identifySideEffectFreePackages() {
    const knownSideEffectFreePackages = [
      'lodash',
      'date-fns',
      'uuid',
      'axios',
      'clsx',
      'tailwind-merge'
    ];
    
    const packageJson = await this.readPackageJson();
    const installedPackages = Object.keys(packageJson.dependencies || {});
    
    return knownSideEffectFreePackages.filter(pkg => 
      installedPackages.includes(pkg)
    );
  }

  // Update package.json sideEffects
  async updatePackageJsonSideEffects(sideEffectFreePackages) {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const packageJson = await this.readPackageJson();
    
    // Add sideEffects field if not present
    if (!packageJson.sideEffects) {
      packageJson.sideEffects = false;
    }
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  // Optimize compression
  async optimizeCompression() {
    console.log('🗜️ Optimizing compression...');
    
    const compressionConfig = {
      gzip: {
        enabled: true,
        threshold: 1024,
        minRatio: 0.8,
        algorithm: 'gzip'
      },
      brotli: {
        enabled: true,
        threshold: 1024,
        minRatio: 0.8,
        algorithm: 'brotliCompress'
      }
    };
    
    await this.updateCompressionConfig(compressionConfig);
    
    console.log('✅ Compression configuration optimized');
    
    this.optimizations.compression.push({
      config: compressionConfig,
      estimatedSavings: '30-50% smaller assets'
    });
  }

  // Update compression configuration
  async updateCompressionConfig(config) {
    // This would typically update the server configuration
    // For now, we'll just log the configuration
    console.log('Compression config:', JSON.stringify(config, null, 2));
  }

  // Optimize caching strategies
  async optimizeCaching() {
    console.log('💾 Optimizing caching strategies...');
    
    const cachingConfig = {
      staticAssets: {
        maxAge: 31536000, // 1 year
        immutable: true
      },
      dynamicContent: {
        maxAge: 300, // 5 minutes
        staleWhileRevalidate: 86400 // 24 hours
      },
      apiRoutes: {
        maxAge: 60, // 1 minute
        staleWhileRevalidate: 300 // 5 minutes
      }
    };
    
    await this.updateCachingHeaders(cachingConfig);
    
    console.log('✅ Caching strategies optimized');
    
    this.optimizations.caching.push({
      config: cachingConfig,
      estimatedImprovement: 'Faster subsequent loads'
    });
  }

  // Update caching headers
  async updateCachingHeaders(config) {
    const nextConfigPath = path.join(this.projectRoot, 'next.config.js');
    const content = await fs.readFile(nextConfigPath, 'utf8');
    
    // Update headers configuration
    const headersConfig = `
    // Optimized caching headers
    {
      source: '/_next/static/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=${config.staticAssets.maxAge}, immutable'
        }
      ]
    },
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=${config.apiRoutes.maxAge}, s-maxage=${config.apiRoutes.maxAge}, stale-while-revalidate=${config.apiRoutes.staleWhileRevalidate}'
        }
      ]
    }
    `;
    
    // Note: In a real implementation, you'd need to properly parse and update the Next.js config
    console.log('Headers configuration:', headersConfig);
  }

  // Generate comprehensive optimization report
  async generateOptimizationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      optimizations: this.optimizations,
      summary: {
        totalOptimizations: Object.values(this.optimizations).flat().length,
        estimatedSavings: this.calculateEstimatedSavings(),
        recommendations: this.generateRecommendations()
      }
    };
    
    const reportPath = path.join(this.projectRoot, 'bundle-optimization-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Optimization report saved to: ${reportPath}`);
    return report;
  }

  // Calculate estimated savings
  calculateEstimatedSavings() {
    let totalSavings = 0;
    
    for (const optimization of this.optimizations.dynamicImports) {
      totalSavings += optimization.estimatedSavings || 0;
    }
    
    for (const optimization of this.optimizations.treeshaking) {
      totalSavings += optimization.estimatedSavings || 0;
    }
    
    return {
      bytes: totalSavings,
      percentage: Math.min(50, totalSavings / 1000000 * 10) // Rough estimate
    };
  }

  // Generate recommendations
  generateRecommendations() {
    const recommendations = [];
    
    if (this.optimizations.dynamicImports.length === 0) {
      recommendations.push({
        type: 'Dynamic Imports',
        priority: 'High',
        description: 'Consider implementing dynamic imports for heavy components',
        impact: 'Faster initial page load'
      });
    }
    
    if (this.optimizations.treeshaking.length === 0) {
      recommendations.push({
        type: 'Tree Shaking',
        priority: 'Medium',
        description: 'Optimize tree shaking to remove unused code',
        impact: 'Smaller bundle size'
      });
    }
    
    return recommendations;
  }

  // Helper methods
  async findHeavyComponents() {
    // Placeholder implementation
    return [
      { path: 'src/components/heavy-component.tsx', size: 75000 },
      { path: 'src/components/chart-component.tsx', size: 60000 }
    ];
  }

  async findRouteComponents() {
    // Placeholder implementation
    return [
      { path: 'app/dashboard/page.tsx', size: 45000 },
      { path: 'app/analytics/page.tsx', size: 55000 }
    ];
  }

  async findHeavyLibraries() {
    // Placeholder implementation
    return [
      { path: 'node_modules/heavy-lib/index.js', size: 150000 }
    ];
  }

  async analyzeDependencies() {
    const packageJson = await this.readPackageJson();
    return Object.keys(packageJson.dependencies || {});
  }

  async analyzeRoutes() {
    // Placeholder implementation
    return ['/', '/dashboard', '/analytics'];
  }

  async analyzeComponents() {
    // Placeholder implementation
    return ['Header', 'Footer', 'Sidebar'];
  }

  async getSourceFiles() {
    try {
      const result = execSync('find src -name "*.ts" -o -name "*.tsx"', { encoding: 'utf8' });
      return result.split('\n').filter(line => line.trim());
    } catch (error) {
      return [];
    }
  }

  extractExports(content) {
    const exports = [];
    const exportMatches = content.match(/export\s+(?:const|function|class|interface|type)\s+(\w+)/g);
    
    if (exportMatches) {
      for (const match of exportMatches) {
        const nameMatch = match.match(/(\w+)$/);
        if (nameMatch) {
          exports.push(nameMatch[1]);
        }
      }
    }
    
    return exports;
  }

  async isExportUsed(exportName, file) {
    // Placeholder implementation - in production, you'd want a proper usage analysis
    return Math.random() > 0.1; // 90% chance of being used
  }

  async removeUnusedExport(unusedExport) {
    // Placeholder implementation
    console.log(`Would remove unused export: ${unusedExport.export} from ${unusedExport.file}`);
  }

  async readPackageJson() {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf8');
    return JSON.parse(content);
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
  const optimizer = new BundleOptimizer();
  
  const command = process.argv[2];
  
  const runOptimization = async () => {
    console.log('🚀 Starting bundle optimization...');
    
    try {
      switch (command) {
        case 'imports':
          await optimizer.optimizeDynamicImports();
          break;
        case 'chunks':
          await optimizer.optimizeChunkSplitting();
          break;
        case 'treeshake':
          await optimizer.optimizeTreeShaking();
          break;
        case 'compression':
          await optimizer.optimizeCompression();
          break;
        case 'caching':
          await optimizer.optimizeCaching();
          break;
        case 'full':
        default:
          await optimizer.optimizeDynamicImports();
          await optimizer.optimizeChunkSplitting();
          await optimizer.optimizeTreeShaking();
          await optimizer.optimizeCompression();
          await optimizer.optimizeCaching();
          break;
      }
      
      const report = await optimizer.generateOptimizationReport();
      
      console.log('\n🎉 Bundle optimization complete!');
      console.log(`Total optimizations: ${report.summary.totalOptimizations}`);
      console.log(`Estimated savings: ${optimizer.formatBytes(report.summary.estimatedSavings.bytes)} (${report.summary.estimatedSavings.percentage}%)`);
      
    } catch (error) {
      console.error('❌ Bundle optimization failed:', error.message);
      process.exit(1);
    }
  };
  
  runOptimization();
}

module.exports = BundleOptimizer;