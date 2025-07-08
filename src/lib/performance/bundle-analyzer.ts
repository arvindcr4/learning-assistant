/**
 * Advanced Bundle Analyzer for Performance Optimization
 * Analyzes bundle sizes, identifies optimization opportunities,
 * and provides actionable insights for A+ performance
 */

export interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkAnalysis[];
  dependencies: DependencyAnalysis[];
  recommendations: PerformanceRecommendation[];
  score: number;
  issues: BundleIssue[];
}

export interface ChunkAnalysis {
  name: string;
  size: number;
  gzippedSize: number;
  modules: ModuleAnalysis[];
  isAsync: boolean;
  priority: 'high' | 'medium' | 'low';
  loadTime: number;
  cacheability: number;
}

export interface ModuleAnalysis {
  name: string;
  size: number;
  reasons: string[];
  chunks: string[];
  optimizationPotential: number;
  duplicateRisk: boolean;
}

export interface DependencyAnalysis {
  name: string;
  version: string;
  size: number;
  usage: 'critical' | 'important' | 'optional';
  alternatives: Alternative[];
  treeShakeable: boolean;
  compressionRatio: number;
}

export interface Alternative {
  name: string;
  size: number;
  benefits: string[];
  migrationEffort: 'low' | 'medium' | 'high';
}

export interface PerformanceRecommendation {
  type: 'bundle_split' | 'dependency_optimization' | 'code_splitting' | 'lazy_loading' | 'compression';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  potentialSavings: number;
  implementation: string[];
}

export interface BundleIssue {
  type: 'large_chunk' | 'duplicate_dependency' | 'unused_code' | 'poor_compression';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file: string;
  size?: number;
  suggestions: string[];
}

export class BundleAnalyzer {
  private readonly LARGE_CHUNK_THRESHOLD = 250 * 1024; // 250KB
  private readonly POOR_COMPRESSION_RATIO = 0.3; // Below 30% compression
  private readonly DUPLICATE_SIZE_THRESHOLD = 10 * 1024; // 10KB

  /**
   * Analyze bundle performance and generate recommendations
   */
  public async analyzeBundlePerformance(
    bundleStats: any,
    webpackStats?: any
  ): Promise<BundleAnalysis> {
    const chunks = await this.analyzeChunks(bundleStats);
    const dependencies = await this.analyzeDependencies(bundleStats);
    const issues = this.identifyIssues(chunks, dependencies);
    const recommendations = this.generateRecommendations(chunks, dependencies, issues);
    const score = this.calculatePerformanceScore(chunks, dependencies, issues);

    return {
      totalSize: this.calculateTotalSize(chunks),
      gzippedSize: this.calculateGzippedSize(chunks),
      chunks,
      dependencies,
      recommendations,
      score,
      issues
    };
  }

  /**
   * Analyze individual chunks for optimization opportunities
   */
  private async analyzeChunks(bundleStats: any): Promise<ChunkAnalysis[]> {
    const chunks: ChunkAnalysis[] = [];

    if (bundleStats.chunks) {
      for (const chunk of bundleStats.chunks) {
        const modules = await this.analyzeModules(chunk.modules || []);
        
        chunks.push({
          name: chunk.name || `chunk-${chunk.id}`,
          size: chunk.size || 0,
          gzippedSize: this.estimateGzippedSize(chunk.size || 0),
          modules,
          isAsync: chunk.initial === false,
          priority: this.determineChunkPriority(chunk),
          loadTime: this.estimateLoadTime(chunk.size || 0),
          cacheability: this.calculateCacheability(chunk)
        });
      }
    }

    return chunks.sort((a, b) => b.size - a.size);
  }

  /**
   * Analyze modules within chunks
   */
  private async analyzeModules(modules: any[]): Promise<ModuleAnalysis[]> {
    return modules.map(module => ({
      name: this.extractModuleName(module.name || module.identifier),
      size: module.size || 0,
      reasons: (module.reasons || []).map((r: any) => r.moduleName || 'unknown'),
      chunks: (module.chunks || []).map((c: any) => c.toString()),
      optimizationPotential: this.calculateOptimizationPotential(module),
      duplicateRisk: this.assessDuplicateRisk(module)
    })).sort((a, b) => b.size - a.size);
  }

  /**
   * Analyze dependencies for optimization opportunities
   */
  private async analyzeDependencies(bundleStats: any): Promise<DependencyAnalysis[]> {
    const dependencies: DependencyAnalysis[] = [];
    const packageSizes = new Map<string, number>();

    // Extract package sizes from modules
    if (bundleStats.modules) {
      for (const module of bundleStats.modules) {
        const packageName = this.extractPackageName(module.name || module.identifier);
        if (packageName) {
          const currentSize = packageSizes.get(packageName) || 0;
          packageSizes.set(packageName, currentSize + (module.size || 0));
        }
      }
    }

    // Analyze each dependency
    for (const [name, size] of packageSizes.entries()) {
      if (size > 5000) { // Only analyze packages > 5KB
        const analysis = await this.analyzeSingleDependency(name, size);
        if (analysis) {
          dependencies.push(analysis);
        }
      }
    }

    return dependencies.sort((a, b) => b.size - a.size);
  }

  /**
   * Analyze a single dependency
   */
  private async analyzeSingleDependency(
    name: string, 
    size: number
  ): Promise<DependencyAnalysis | null> {
    const alternatives = await this.findAlternatives(name);
    
    return {
      name,
      version: 'unknown', // Would need package.json analysis
      size,
      usage: this.determineDependencyUsage(name, size),
      alternatives,
      treeShakeable: this.isTreeShakeable(name),
      compressionRatio: this.estimateCompressionRatio(name)
    };
  }

  /**
   * Find alternative dependencies
   */
  private async findAlternatives(packageName: string): Promise<Alternative[]> {
    const alternatives: { [key: string]: Alternative[] } = {
      'lodash': [
        {
          name: 'lodash-es',
          size: 70000,
          benefits: ['Better tree shaking', 'ES modules', 'Smaller bundle'],
          migrationEffort: 'low'
        },
        {
          name: 'rambda',
          size: 45000,
          benefits: ['Smaller size', 'Functional programming', 'Tree shakeable'],
          migrationEffort: 'medium'
        }
      ],
      'moment': [
        {
          name: 'date-fns',
          size: 20000,
          benefits: ['Modular', 'Tree shakeable', 'Immutable'],
          migrationEffort: 'medium'
        },
        {
          name: 'dayjs',
          size: 8000,
          benefits: ['Tiny size', 'Similar API', 'Plugin system'],
          migrationEffort: 'low'
        }
      ],
      'axios': [
        {
          name: 'fetch',
          size: 0,
          benefits: ['Native browser API', 'No bundle size', 'Modern'],
          migrationEffort: 'medium'
        },
        {
          name: 'ky',
          size: 12000,
          benefits: ['Modern', 'Smaller', 'Better error handling'],
          migrationEffort: 'low'
        }
      ]
    };

    return alternatives[packageName] || [];
  }

  /**
   * Identify performance issues
   */
  private identifyIssues(
    chunks: ChunkAnalysis[], 
    dependencies: DependencyAnalysis[]
  ): BundleIssue[] {
    const issues: BundleIssue[] = [];

    // Check for large chunks
    for (const chunk of chunks) {
      if (chunk.size > this.LARGE_CHUNK_THRESHOLD) {
        issues.push({
          type: 'large_chunk',
          severity: chunk.size > this.LARGE_CHUNK_THRESHOLD * 2 ? 'critical' : 'warning',
          message: `Chunk "${chunk.name}" is ${Math.round(chunk.size / 1024)}KB, consider splitting`,
          file: chunk.name,
          size: chunk.size,
          suggestions: [
            'Implement dynamic imports for route-based code splitting',
            'Split vendor dependencies into separate chunks',
            'Use React.lazy for component-level code splitting'
          ]
        });
      }
    }

    // Check for duplicate dependencies
    const moduleMap = new Map<string, string[]>();
    for (const chunk of chunks) {
      for (const module of chunk.modules) {
        const chunks = moduleMap.get(module.name) || [];
        chunks.push(chunk.name);
        moduleMap.set(module.name, chunks);
      }
    }

    for (const [moduleName, chunkNames] of moduleMap.entries()) {
      if (chunkNames.length > 1) {
        issues.push({
          type: 'duplicate_dependency',
          severity: 'warning',
          message: `Module "${moduleName}" appears in multiple chunks: ${chunkNames.join(', ')}`,
          file: moduleName,
          suggestions: [
            'Extract common dependencies to a vendor chunk',
            'Use SplitChunksPlugin optimization',
            'Consider module federation for micro-frontends'
          ]
        });
      }
    }

    // Check for poor compression
    for (const dependency of dependencies) {
      if (dependency.compressionRatio < this.POOR_COMPRESSION_RATIO) {
        issues.push({
          type: 'poor_compression',
          severity: 'info',
          message: `Dependency "${dependency.name}" has poor compression ratio`,
          file: dependency.name,
          suggestions: [
            'Enable Brotli compression',
            'Use webpack compression plugins',
            'Consider alternative dependencies with better compression'
          ]
        });
      }
    }

    return issues;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    chunks: ChunkAnalysis[],
    dependencies: DependencyAnalysis[],
    issues: BundleIssue[]
  ): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Bundle splitting recommendations
    const largeChunks = chunks.filter(c => c.size > this.LARGE_CHUNK_THRESHOLD);
    if (largeChunks.length > 0) {
      recommendations.push({
        type: 'bundle_split',
        title: 'Implement Advanced Code Splitting',
        description: 'Split large chunks to improve initial load time and enable better caching',
        impact: 'high',
        effort: 'medium',
        potentialSavings: largeChunks.reduce((sum, c) => sum + c.size * 0.4, 0),
        implementation: [
          'Configure webpack SplitChunksPlugin with optimal chunk strategies',
          'Implement route-based code splitting with React.lazy',
          'Create vendor chunk for stable dependencies',
          'Use dynamic imports for feature modules'
        ]
      });
    }

    // Dependency optimization recommendations
    const largeDependencies = dependencies.filter(d => d.size > 50000);
    if (largeDependencies.length > 0) {
      recommendations.push({
        type: 'dependency_optimization',
        title: 'Optimize Large Dependencies',
        description: 'Replace or optimize large dependencies to reduce bundle size',
        impact: 'high',
        effort: 'medium',
        potentialSavings: largeDependencies.reduce((sum, d) => sum + d.size * 0.6, 0),
        implementation: [
          'Replace large dependencies with smaller alternatives',
          'Enable tree shaking for modular dependencies',
          'Use babel-plugin-import for selective imports',
          'Consider polyfill services for browser APIs'
        ]
      });
    }

    // Lazy loading recommendations
    const asyncChunks = chunks.filter(c => !c.isAsync && c.priority !== 'high');
    if (asyncChunks.length > 0) {
      recommendations.push({
        type: 'lazy_loading',
        title: 'Implement Lazy Loading',
        description: 'Convert non-critical chunks to lazy-loaded modules',
        impact: 'medium',
        effort: 'low',
        potentialSavings: asyncChunks.reduce((sum, c) => sum + c.size * 0.8, 0),
        implementation: [
          'Use React.lazy for component lazy loading',
          'Implement intersection observer for image lazy loading',
          'Defer loading of non-critical third-party scripts',
          'Use dynamic imports for feature detection'
        ]
      });
    }

    // Compression recommendations
    const poorCompression = dependencies.filter(d => d.compressionRatio < 0.5);
    if (poorCompression.length > 0) {
      recommendations.push({
        type: 'compression',
        title: 'Improve Compression Efficiency',
        description: 'Enable advanced compression for better transfer efficiency',
        impact: 'medium',
        effort: 'low',
        potentialSavings: poorCompression.reduce((sum, d) => sum + d.size * 0.3, 0),
        implementation: [
          'Enable Brotli compression on server',
          'Use webpack CompressionPlugin',
          'Optimize static assets with imagemin',
          'Implement progressive JPEG for images'
        ]
      });
    }

    return recommendations.sort((a, b) => {
      const impactWeight = { high: 3, medium: 2, low: 1 };
      const effortWeight = { low: 3, medium: 2, high: 1 };
      
      const aScore = impactWeight[a.impact] * effortWeight[a.effort];
      const bScore = impactWeight[b.impact] * effortWeight[b.effort];
      
      return bScore - aScore;
    });
  }

  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(
    chunks: ChunkAnalysis[],
    dependencies: DependencyAnalysis[],
    issues: BundleIssue[]
  ): number {
    let score = 100;

    // Deduct points for large chunks
    const largeChunks = chunks.filter(c => c.size > this.LARGE_CHUNK_THRESHOLD);
    score -= largeChunks.length * 10;

    // Deduct points for critical issues
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    score -= criticalIssues.length * 15;

    // Deduct points for warnings
    const warnings = issues.filter(i => i.severity === 'warning');
    score -= warnings.length * 5;

    // Deduct points for large dependencies
    const largeDeps = dependencies.filter(d => d.size > 100000);
    score -= largeDeps.length * 8;

    // Deduct points for poor tree shaking
    const nonTreeShakeable = dependencies.filter(d => !d.treeShakeable);
    score -= nonTreeShakeable.length * 3;

    return Math.max(0, Math.min(100, score));
  }

  // Helper methods
  private calculateTotalSize(chunks: ChunkAnalysis[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  }

  private calculateGzippedSize(chunks: ChunkAnalysis[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.gzippedSize, 0);
  }

  private estimateGzippedSize(size: number): number {
    // Estimate ~70% compression for typical web assets
    return Math.round(size * 0.3);
  }

  private determineChunkPriority(chunk: any): 'high' | 'medium' | 'low' {
    if (chunk.initial) return 'high';
    if (chunk.name && chunk.name.includes('vendor')) return 'medium';
    return 'low';
  }

  private estimateLoadTime(size: number): number {
    // Estimate load time based on typical 3G connection (1.6 Mbps)
    const bitsPerSecond = 1600000;
    const bytesPerSecond = bitsPerSecond / 8;
    return (size / bytesPerSecond) * 1000; // Convert to milliseconds
  }

  private calculateCacheability(chunk: any): number {
    // Higher score for chunks that change less frequently
    if (chunk.name && chunk.name.includes('vendor')) return 90;
    if (chunk.name && chunk.name.includes('runtime')) return 10;
    return 50;
  }

  private extractModuleName(identifier: string): string {
    if (!identifier) return 'unknown';
    
    // Extract meaningful module name
    const parts = identifier.split('/');
    const filename = parts[parts.length - 1];
    
    if (filename.includes('node_modules')) {
      const nodeModulesIndex = parts.indexOf('node_modules');
      if (nodeModulesIndex >= 0 && nodeModulesIndex < parts.length - 1) {
        return parts[nodeModulesIndex + 1];
      }
    }
    
    return filename || identifier;
  }

  private extractPackageName(identifier: string): string | null {
    if (!identifier || !identifier.includes('node_modules')) return null;
    
    const parts = identifier.split('/');
    const nodeModulesIndex = parts.lastIndexOf('node_modules');
    
    if (nodeModulesIndex >= 0 && nodeModulesIndex < parts.length - 1) {
      let packageName = parts[nodeModulesIndex + 1];
      
      // Handle scoped packages
      if (packageName.startsWith('@') && nodeModulesIndex < parts.length - 2) {
        packageName += '/' + parts[nodeModulesIndex + 2];
      }
      
      return packageName;
    }
    
    return null;
  }

  private calculateOptimizationPotential(module: any): number {
    let potential = 0;
    
    // Higher potential for large modules
    if (module.size > 50000) potential += 30;
    else if (module.size > 20000) potential += 20;
    else if (module.size > 10000) potential += 10;
    
    // Higher potential for modules in multiple chunks
    if (module.chunks && module.chunks.length > 1) potential += 25;
    
    // Higher potential for node_modules
    if (module.name && module.name.includes('node_modules')) potential += 15;
    
    return Math.min(100, potential);
  }

  private assessDuplicateRisk(module: any): boolean {
    return (module.chunks && module.chunks.length > 1) ||
           (module.reasons && module.reasons.length > 3);
  }

  private determineDependencyUsage(name: string, size: number): 'critical' | 'important' | 'optional' {
    const criticalPackages = ['react', 'react-dom', 'next'];
    const importantPackages = ['axios', 'lodash', 'moment', 'framer-motion'];
    
    if (criticalPackages.some(pkg => name.includes(pkg))) return 'critical';
    if (importantPackages.some(pkg => name.includes(pkg)) || size > 100000) return 'important';
    return 'optional';
  }

  private isTreeShakeable(packageName: string): boolean {
    const treeShakeablePackages = [
      'lodash-es', 'rxjs', 'ramda', 'date-fns', 'material-ui'
    ];
    const nonTreeShakeablePackages = [
      'lodash', 'moment', 'jquery', 'bootstrap'
    ];
    
    if (treeShakeablePackages.some(pkg => packageName.includes(pkg))) return true;
    if (nonTreeShakeablePackages.some(pkg => packageName.includes(pkg))) return false;
    
    // Default assumption for modern packages
    return true;
  }

  private estimateCompressionRatio(packageName: string): number {
    // Estimated compression ratios for common package types
    const compressionRatios: { [key: string]: number } = {
      'react': 0.65,
      'lodash': 0.45,
      'moment': 0.35,
      'bootstrap': 0.25,
      'material-ui': 0.55
    };
    
    for (const [pkg, ratio] of Object.entries(compressionRatios)) {
      if (packageName.includes(pkg)) return ratio;
    }
    
    // Default compression ratio
    return 0.6;
  }
}