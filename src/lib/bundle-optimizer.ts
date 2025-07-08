/**
 * Bundle Optimization and Code Splitting Utilities
 * 
 * This module provides advanced bundle optimization, code splitting,
 * and performance monitoring for production builds.
 */

import { CDN_CONFIG } from './cdn';

// Bundle Analysis Types
export interface BundleAnalysis {
  totalSize: number;
  gzippedSize: number;
  brotliSize: number;
  chunks: ChunkAnalysis[];
  duplicates: DuplicateModule[];
  treeshakingOpportunities: TreeshakingOpportunity[];
  performanceScore: number;
  recommendations: string[];
}

export interface ChunkAnalysis {
  name: string;
  size: number;
  gzippedSize: number;
  modules: ModuleAnalysis[];
  loadTime: number;
  cacheability: number;
  critical: boolean;
}

export interface ModuleAnalysis {
  name: string;
  size: number;
  reasons: string[];
  dependencies: string[];
  usedExports: string[];
  unusedExports: string[];
}

export interface DuplicateModule {
  name: string;
  occurrences: number;
  totalSize: number;
  chunks: string[];
}

export interface TreeshakingOpportunity {
  module: string;
  unusedExports: string[];
  potentialSavings: number;
  recommendation: string;
}

// Bundle Optimizer Class
export class BundleOptimizer {
  private static instance: BundleOptimizer;
  private analysisData: BundleAnalysis | null = null;
  private performanceBudgets = CDN_CONFIG.PERFORMANCE_BUDGETS;
  private optimizationRules: OptimizationRule[] = [];

  private constructor() {
    this.initializeOptimizationRules();
  }

  public static getInstance(): BundleOptimizer {
    if (!BundleOptimizer.instance) {
      BundleOptimizer.instance = new BundleOptimizer();
    }
    return BundleOptimizer.instance;
  }

  /**
   * Initialize optimization rules
   */
  private initializeOptimizationRules(): void {
    this.optimizationRules = [
      {
        name: 'code-splitting',
        description: 'Split code into smaller chunks for better caching',
        priority: 'high',
        apply: (analysis: BundleAnalysis) => this.applyCodeSplitting(analysis),
        validate: (analysis: BundleAnalysis) => this.validateCodeSplitting(analysis),
      },
      {
        name: 'tree-shaking',
        description: 'Remove unused code from bundles',
        priority: 'high',
        apply: (analysis: BundleAnalysis) => this.applyTreeShaking(analysis),
        validate: (analysis: BundleAnalysis) => this.validateTreeShaking(analysis),
      },
      {
        name: 'dynamic-imports',
        description: 'Use dynamic imports for non-critical code',
        priority: 'medium',
        apply: (analysis: BundleAnalysis) => this.applyDynamicImports(analysis),
        validate: (analysis: BundleAnalysis) => this.validateDynamicImports(analysis),
      },
      {
        name: 'vendor-splitting',
        description: 'Separate vendor libraries for better caching',
        priority: 'medium',
        apply: (analysis: BundleAnalysis) => this.applyVendorSplitting(analysis),
        validate: (analysis: BundleAnalysis) => this.validateVendorSplitting(analysis),
      },
    ];
  }

  /**
   * Analyze bundle and provide optimization recommendations
   */
  public async analyzeBundlePerformance(
    bundleStats: any
  ): Promise<BundleAnalysis> {
    const analysis: BundleAnalysis = {
      totalSize: 0,
      gzippedSize: 0,
      brotliSize: 0,
      chunks: [],
      duplicates: [],
      treeshakingOpportunities: [],
      performanceScore: 0,
      recommendations: [],
    };

    // Analyze chunks
    analysis.chunks = await this.analyzeChunks(bundleStats);
    
    // Calculate total sizes
    analysis.totalSize = analysis.chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    analysis.gzippedSize = analysis.chunks.reduce((sum, chunk) => sum + chunk.gzippedSize, 0);
    analysis.brotliSize = Math.round(analysis.gzippedSize * 0.8); // Estimate brotli compression
    
    // Find duplicate modules
    analysis.duplicates = this.findDuplicateModules(analysis.chunks);
    
    // Find tree-shaking opportunities
    analysis.treeshakingOpportunities = this.findTreeshakingOpportunities(analysis.chunks);
    
    // Calculate performance score
    analysis.performanceScore = this.calculatePerformanceScore(analysis);
    
    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    this.analysisData = analysis;
    return analysis;
  }

  /**
   * Analyze individual chunks
   */
  private async analyzeChunks(bundleStats: any): Promise<ChunkAnalysis[]> {
    const chunks: ChunkAnalysis[] = [];
    
    for (const chunk of bundleStats.chunks || []) {
      const chunkAnalysis: ChunkAnalysis = {
        name: chunk.names?.[0] || chunk.id,
        size: chunk.size || 0,
        gzippedSize: Math.round((chunk.size || 0) * 0.3), // Estimate gzip compression
        modules: [],
        loadTime: this.estimateLoadTime(chunk.size || 0),
        cacheability: this.calculateCacheability(chunk),
        critical: this.isCriticalChunk(chunk),
      };

      // Analyze modules within chunk
      chunkAnalysis.modules = await this.analyzeModules(chunk.modules || []);
      
      chunks.push(chunkAnalysis);
    }

    return chunks;
  }

  /**
   * Analyze modules within chunks
   */
  private async analyzeModules(modules: any[]): Promise<ModuleAnalysis[]> {
    return modules.map(module => ({
      name: module.name || module.identifier,
      size: module.size || 0,
      reasons: module.reasons?.map((r: any) => r.moduleName) || [],
      dependencies: module.dependencies?.map((d: any) => d.name) || [],
      usedExports: module.usedExports || [],
      unusedExports: module.unusedExports || [],
    }));
  }

  /**
   * Find duplicate modules across chunks
   */
  private findDuplicateModules(chunks: ChunkAnalysis[]): DuplicateModule[] {
    const moduleOccurrences = new Map<string, { chunks: string[], totalSize: number }>();

    chunks.forEach(chunk => {
      chunk.modules.forEach(module => {
        const existing = moduleOccurrences.get(module.name);
        if (existing) {
          existing.chunks.push(chunk.name);
          existing.totalSize += module.size;
        } else {
          moduleOccurrences.set(module.name, {
            chunks: [chunk.name],
            totalSize: module.size,
          });
        }
      });
    });

    return Array.from(moduleOccurrences.entries())
      .filter(([_, data]) => data.chunks.length > 1)
      .map(([name, data]) => ({
        name,
        occurrences: data.chunks.length,
        totalSize: data.totalSize,
        chunks: data.chunks,
      }));
  }

  /**
   * Find tree-shaking opportunities
   */
  private findTreeshakingOpportunities(chunks: ChunkAnalysis[]): TreeshakingOpportunity[] {
    const opportunities: TreeshakingOpportunity[] = [];

    chunks.forEach(chunk => {
      chunk.modules.forEach(module => {
        if (module.unusedExports.length > 0) {
          const potentialSavings = Math.round(
            (module.unusedExports.length / (module.usedExports.length + module.unusedExports.length)) * module.size
          );

          opportunities.push({
            module: module.name,
            unusedExports: module.unusedExports,
            potentialSavings,
            recommendation: `Remove unused exports from ${module.name}`,
          });
        }
      });
    });

    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Calculate performance score based on bundle analysis
   */
  private calculatePerformanceScore(analysis: BundleAnalysis): number {
    let score = 100;

    // Penalize for large bundle size
    if (analysis.totalSize > this.performanceBudgets.INITIAL_BUNDLE_SIZE) {
      score -= 30;
    }

    // Penalize for many duplicates
    if (analysis.duplicates.length > 5) {
      score -= 20;
    }

    // Penalize for poor tree-shaking
    const treeshakingSavings = analysis.treeshakingOpportunities.reduce(
      (sum, opp) => sum + opp.potentialSavings, 0
    );
    if (treeshakingSavings > 50000) { // 50KB
      score -= 25;
    }

    // Reward for good chunk splitting
    const criticalChunks = analysis.chunks.filter(c => c.critical).length;
    if (criticalChunks === 1 && analysis.chunks.length > 1) {
      score += 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(analysis: BundleAnalysis): string[] {
    const recommendations: string[] = [];

    // Bundle size recommendations
    if (analysis.totalSize > this.performanceBudgets.INITIAL_BUNDLE_SIZE) {
      recommendations.push(
        `Bundle size (${Math.round(analysis.totalSize / 1024)}KB) exceeds budget (${Math.round(this.performanceBudgets.INITIAL_BUNDLE_SIZE / 1024)}KB). Consider code splitting.`
      );
    }

    // Duplicate module recommendations
    if (analysis.duplicates.length > 0) {
      recommendations.push(
        `Found ${analysis.duplicates.length} duplicate modules. Consider using optimization.splitChunks to deduplicate.`
      );
    }

    // Tree-shaking recommendations
    if (analysis.treeshakingOpportunities.length > 0) {
      const totalSavings = analysis.treeshakingOpportunities.reduce(
        (sum, opp) => sum + opp.potentialSavings, 0
      );
      recommendations.push(
        `Potential tree-shaking savings: ${Math.round(totalSavings / 1024)}KB across ${analysis.treeshakingOpportunities.length} modules.`
      );
    }

    // Chunk splitting recommendations
    const largeChunks = analysis.chunks.filter(c => c.size > 250000); // 250KB
    if (largeChunks.length > 0) {
      recommendations.push(
        `Consider splitting large chunks: ${largeChunks.map(c => c.name).join(', ')}`
      );
    }

    return recommendations;
  }

  /**
   * Optimization rule implementations
   */
  private applyCodeSplitting(analysis: BundleAnalysis): OptimizationResult {
    const recommendations: string[] = [];
    const largeChunks = analysis.chunks.filter(c => c.size > 250000);

    if (largeChunks.length > 0) {
      recommendations.push(
        'Configure webpack splitChunks to automatically split large chunks'
      );
      recommendations.push(
        'Use dynamic imports for route-based code splitting'
      );
    }

    return {
      applied: largeChunks.length > 0,
      recommendations,
      estimatedSavings: largeChunks.reduce((sum, chunk) => sum + chunk.size * 0.3, 0),
    };
  }

  private applyTreeShaking(analysis: BundleAnalysis): OptimizationResult {
    const opportunities = analysis.treeshakingOpportunities;
    const recommendations: string[] = [];

    if (opportunities.length > 0) {
      recommendations.push(
        'Enable sideEffects: false in package.json for better tree-shaking'
      );
      recommendations.push(
        'Use ES modules instead of CommonJS for better tree-shaking'
      );
      recommendations.push(
        'Review and remove unused exports from modules'
      );
    }

    return {
      applied: opportunities.length > 0,
      recommendations,
      estimatedSavings: opportunities.reduce((sum, opp) => sum + opp.potentialSavings, 0),
    };
  }

  private applyDynamicImports(analysis: BundleAnalysis): OptimizationResult {
    const nonCriticalChunks = analysis.chunks.filter(c => !c.critical);
    const recommendations: string[] = [];

    if (nonCriticalChunks.length > 0) {
      recommendations.push(
        'Convert non-critical imports to dynamic imports'
      );
      recommendations.push(
        'Use React.lazy() for component-based code splitting'
      );
    }

    return {
      applied: nonCriticalChunks.length > 0,
      recommendations,
      estimatedSavings: nonCriticalChunks.reduce((sum, chunk) => sum + chunk.size * 0.2, 0),
    };
  }

  private applyVendorSplitting(analysis: BundleAnalysis): OptimizationResult {
    const vendorModules = analysis.chunks.flatMap(c => 
      c.modules.filter(m => m.name.includes('node_modules'))
    );
    const recommendations: string[] = [];

    if (vendorModules.length > 10) {
      recommendations.push(
        'Split vendor libraries into separate chunks for better caching'
      );
      recommendations.push(
        'Group similar vendor libraries together'
      );
    }

    return {
      applied: vendorModules.length > 10,
      recommendations,
      estimatedSavings: vendorModules.reduce((sum, module) => sum + module.size * 0.1, 0),
    };
  }

  /**
   * Utility methods
   */
  private estimateLoadTime(size: number): number {
    // Estimate load time based on size and typical 3G connection (1.6 Mbps)
    const bytesPerSecond = 1600000 / 8; // 1.6 Mbps to bytes per second
    return Math.round((size / bytesPerSecond) * 1000); // milliseconds
  }

  private calculateCacheability(chunk: any): number {
    // Simple heuristic: static chunks are more cacheable
    const isVendor = chunk.names?.some((name: string) => 
      name.includes('vendor') || name.includes('node_modules')
    );
    return isVendor ? 0.9 : 0.6;
  }

  private isCriticalChunk(chunk: any): boolean {
    // Critical chunks are main entry points
    return chunk.names?.some((name: string) => 
      name === 'main' || name === 'runtime' || name.includes('critical')
    ) || false;
  }

  private validateCodeSplitting(analysis: BundleAnalysis): ValidationResult {
    const maxChunkSize = this.performanceBudgets.INITIAL_BUNDLE_SIZE;
    const largeChunks = analysis.chunks.filter(c => c.size > maxChunkSize);
    
    return {
      passed: largeChunks.length === 0,
      score: largeChunks.length === 0 ? 100 : Math.max(0, 100 - largeChunks.length * 20),
      issues: largeChunks.map(c => `Chunk ${c.name} exceeds size limit`),
    };
  }

  private validateTreeShaking(analysis: BundleAnalysis): ValidationResult {
    const unusedExports = analysis.treeshakingOpportunities.length;
    const maxUnusedExports = 10;
    
    return {
      passed: unusedExports <= maxUnusedExports,
      score: Math.max(0, 100 - Math.max(0, unusedExports - maxUnusedExports) * 5),
      issues: unusedExports > maxUnusedExports ? 
        [`Found ${unusedExports} modules with unused exports`] : [],
    };
  }

  private validateDynamicImports(analysis: BundleAnalysis): ValidationResult {
    const totalChunks = analysis.chunks.length;
    const criticalChunks = analysis.chunks.filter(c => c.critical).length;
    const hasGoodSplitting = totalChunks > 1 && criticalChunks === 1;
    
    return {
      passed: hasGoodSplitting,
      score: hasGoodSplitting ? 100 : 60,
      issues: hasGoodSplitting ? [] : ['Consider using dynamic imports for better code splitting'],
    };
  }

  private validateVendorSplitting(analysis: BundleAnalysis): ValidationResult {
    const hasVendorChunk = analysis.chunks.some(c => 
      c.name.includes('vendor') || c.name.includes('node_modules')
    );
    
    return {
      passed: hasVendorChunk,
      score: hasVendorChunk ? 100 : 80,
      issues: hasVendorChunk ? [] : ['Consider separating vendor libraries into their own chunk'],
    };
  }

  /**
   * Public API methods
   */
  public generateOptimizationReport(): OptimizationReport | null {
    if (!this.analysisData) return null;

    const ruleResults = this.optimizationRules.map(rule => ({
      name: rule.name,
      description: rule.description,
      priority: rule.priority,
      result: rule.apply(this.analysisData!),
      validation: rule.validate(this.analysisData!),
    }));

    return {
      analysis: this.analysisData,
      rules: ruleResults,
      overallScore: this.calculateOverallOptimizationScore(ruleResults),
      totalEstimatedSavings: ruleResults.reduce((sum, r) => sum + r.result.estimatedSavings, 0),
    };
  }

  private calculateOverallOptimizationScore(rules: any[]): number {
    const totalScore = rules.reduce((sum, rule) => sum + rule.validation.score, 0);
    return Math.round(totalScore / rules.length);
  }

  public getAnalysisData(): BundleAnalysis | null {
    return this.analysisData;
  }
}

// Type definitions
export interface OptimizationRule {
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  apply: (analysis: BundleAnalysis) => OptimizationResult;
  validate: (analysis: BundleAnalysis) => ValidationResult;
}

export interface OptimizationResult {
  applied: boolean;
  recommendations: string[];
  estimatedSavings: number;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: string[];
}

export interface OptimizationReport {
  analysis: BundleAnalysis;
  rules: Array<{
    name: string;
    description: string;
    priority: string;
    result: OptimizationResult;
    validation: ValidationResult;
  }>;
  overallScore: number;
  totalEstimatedSavings: number;
}

// Singleton instance
export const bundleOptimizer = BundleOptimizer.getInstance();

// React hook for bundle optimization
export function useBundleOptimization() {
  const [optimizationReport, setOptimizationReport] = React.useState<OptimizationReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  const analyzeBundlePerformance = React.useCallback(async (bundleStats: any) => {
    setIsAnalyzing(true);
    try {
      await bundleOptimizer.analyzeBundlePerformance(bundleStats);
      const report = bundleOptimizer.generateOptimizationReport();
      setOptimizationReport(report);
    } catch (error) {
      console.error('Bundle analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return {
    optimizationReport,
    isAnalyzing,
    analyzeBundlePerformance,
  };
}

// React import for hooks
import React from 'react';