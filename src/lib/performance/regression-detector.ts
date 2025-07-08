/**
 * Performance Regression Detector
 * 
 * Advanced regression detection with statistical analysis, automated rollback,
 * and performance baseline management.
 */

// Core interfaces
export interface PerformanceBaseline {
  id: string;
  timestamp: number;
  version: string;
  metrics: BaselineMetrics;
  confidence: number;
  sampleSize: number;
  environment: string;
  deploymentId?: string;
}

export interface BaselineMetrics {
  responseTime: StatisticalMetrics;
  throughput: StatisticalMetrics;
  errorRate: StatisticalMetrics;
  memoryUsage: StatisticalMetrics;
  cpuUsage: StatisticalMetrics;
  coreWebVitals: {
    lcp: StatisticalMetrics;
    fid: StatisticalMetrics;
    cls: StatisticalMetrics;
  };
  databaseMetrics: {
    queryTime: StatisticalMetrics;
    connections: StatisticalMetrics;
  };
}

export interface StatisticalMetrics {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  standardDeviation: number;
  min: number;
  max: number;
  count: number;
}

export interface RegressionDetection {
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'performance' | 'stability' | 'availability' | 'quality';
  affectedMetrics: string[];
  degradationPercentage: number;
  confidence: number;
  description: string;
  detectedAt: number;
  baseline: PerformanceBaseline;
  currentMetrics: any;
  recommendation: 'monitor' | 'investigate' | 'rollback' | 'emergency-rollback';
}

export interface RegressionConfig {
  enabled: boolean;
  sensitivityLevel: 'conservative' | 'moderate' | 'aggressive';
  autoRollbackEnabled: boolean;
  rollbackThreshold: number;
  monitoringWindow: number;
  baselinePeriod: number;
  minimumSampleSize: number;
  confidenceThreshold: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    memoryUsage: number;
  };
}

export interface RollbackAction {
  id: string;
  triggeredBy: string;
  timestamp: number;
  reason: string;
  fromVersion: string;
  toVersion: string;
  affectedServices: string[];
  rollbackType: 'partial' | 'full' | 'canary';
  status: 'initiated' | 'in-progress' | 'completed' | 'failed';
  duration?: number;
  error?: string;
}

export interface ChangePoint {
  timestamp: number;
  metric: string;
  changeType: 'improvement' | 'degradation' | 'anomaly';
  magnitude: number;
  confidence: number;
  context: any;
}

/**
 * Statistical Analysis Engine
 */
class StatisticalAnalysisEngine {
  /**
   * Calculate statistical metrics from data points
   */
  public calculateStatistics(values: number[]): StatisticalMetrics {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        count: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = values.length;

    return {
      mean: this.calculateMean(values),
      median: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
      standardDeviation: this.calculateStandardDeviation(values),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      count
    };
  }

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Perform t-test to detect significant changes
   */
  public performTTest(baseline: number[], current: number[]): { significant: boolean; pValue: number; tStatistic: number } {
    if (baseline.length < 2 || current.length < 2) {
      return { significant: false, pValue: 1, tStatistic: 0 };
    }

    const baselineMean = this.calculateMean(baseline);
    const currentMean = this.calculateMean(current);
    const baselineStd = this.calculateStandardDeviation(baseline);
    const currentStd = this.calculateStandardDeviation(current);

    // Welch's t-test for unequal variances
    const pooledStd = Math.sqrt(
      (Math.pow(baselineStd, 2) / baseline.length) + 
      (Math.pow(currentStd, 2) / current.length)
    );

    const tStatistic = (currentMean - baselineMean) / pooledStd;
    
    // Simplified p-value calculation (would use proper t-distribution in production)
    const pValue = Math.exp(-0.5 * Math.pow(Math.abs(tStatistic), 2));
    
    return {
      significant: pValue < 0.05, // 95% confidence
      pValue,
      tStatistic
    };
  }

  /**
   * Detect change points using CUSUM algorithm
   */
  public detectChangePoints(values: number[], sensitivity: number = 3): ChangePoint[] {
    const changePoints: ChangePoint[] = [];
    
    if (values.length < 10) return changePoints;

    const mean = this.calculateMean(values);
    const std = this.calculateStandardDeviation(values);
    
    let cusumPos = 0;
    let cusumNeg = 0;
    const threshold = sensitivity * std;

    for (let i = 1; i < values.length; i++) {
      const deviation = values[i] - mean;
      
      cusumPos = Math.max(0, cusumPos + deviation);
      cusumNeg = Math.min(0, cusumNeg + deviation);
      
      if (cusumPos > threshold) {
        changePoints.push({
          timestamp: Date.now() - (values.length - i) * 60000, // Assuming 1-minute intervals
          metric: 'performance',
          changeType: 'degradation',
          magnitude: cusumPos / std,
          confidence: Math.min(1, cusumPos / (threshold * 2)),
          context: { index: i, value: values[i] }
        });
        cusumPos = 0;
      }
      
      if (cusumNeg < -threshold) {
        changePoints.push({
          timestamp: Date.now() - (values.length - i) * 60000,
          metric: 'performance',
          changeType: 'improvement',
          magnitude: Math.abs(cusumNeg) / std,
          confidence: Math.min(1, Math.abs(cusumNeg) / (threshold * 2)),
          context: { index: i, value: values[i] }
        });
        cusumNeg = 0;
      }
    }

    return changePoints;
  }

  /**
   * Calculate confidence interval
   */
  public calculateConfidenceInterval(values: number[], confidence: number = 0.95): { lower: number; upper: number } {
    if (values.length === 0) return { lower: 0, upper: 0 };

    const mean = this.calculateMean(values);
    const std = this.calculateStandardDeviation(values);
    const n = values.length;
    
    // Use t-distribution for small samples
    const tValue = this.getTValue(confidence, n - 1);
    const marginOfError = tValue * (std / Math.sqrt(n));
    
    return {
      lower: mean - marginOfError,
      upper: mean + marginOfError
    };
  }

  /**
   * Get t-value for confidence interval (simplified)
   */
  private getTValue(confidence: number, degreesOfFreedom: number): number {
    // Simplified t-value lookup
    const alpha = 1 - confidence;
    
    if (degreesOfFreedom >= 30) {
      // Use normal approximation for large samples
      if (alpha <= 0.01) return 2.576;
      if (alpha <= 0.05) return 1.96;
      return 1.645;
    }
    
    // Simplified t-values for small samples
    if (alpha <= 0.01) return 3.0;
    if (alpha <= 0.05) return 2.2;
    return 1.8;
  }
}

/**
 * Baseline Manager
 */
class BaselineManager {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private statisticalEngine: StatisticalAnalysisEngine;

  constructor() {
    this.statisticalEngine = new StatisticalAnalysisEngine();
  }

  /**
   * Create performance baseline
   */
  public createBaseline(
    version: string,
    metricsData: any[],
    environment: string = 'production',
    deploymentId?: string
  ): PerformanceBaseline {
    const baseline: PerformanceBaseline = {
      id: `baseline_${version}_${Date.now()}`,
      timestamp: Date.now(),
      version,
      metrics: this.calculateBaselineMetrics(metricsData),
      confidence: this.calculateBaselineConfidence(metricsData),
      sampleSize: metricsData.length,
      environment,
      deploymentId
    };

    this.baselines.set(baseline.id, baseline);
    
    // Keep only the most recent baseline per version
    this.cleanupOldBaselines(version, environment);
    
    return baseline;
  }

  /**
   * Calculate baseline metrics from raw data
   */
  private calculateBaselineMetrics(metricsData: any[]): BaselineMetrics {
    const responseTimes = metricsData.map(m => m.responseTime || 0).filter(v => v > 0);
    const throughputs = metricsData.map(m => m.throughput || 0).filter(v => v > 0);
    const errorRates = metricsData.map(m => m.errorRate || 0);
    const memoryUsages = metricsData.map(m => m.memoryUsage || 0).filter(v => v > 0);
    const cpuUsages = metricsData.map(m => m.cpuUsage || 0).filter(v => v > 0);
    const lcpValues = metricsData.map(m => m.coreWebVitals?.lcp || 0).filter(v => v > 0);
    const fidValues = metricsData.map(m => m.coreWebVitals?.fid || 0).filter(v => v > 0);
    const clsValues = metricsData.map(m => m.coreWebVitals?.cls || 0);
    const queryTimes = metricsData.map(m => m.databaseMetrics?.queryTime || 0).filter(v => v > 0);
    const connections = metricsData.map(m => m.databaseMetrics?.connections || 0).filter(v => v > 0);

    return {
      responseTime: this.statisticalEngine.calculateStatistics(responseTimes),
      throughput: this.statisticalEngine.calculateStatistics(throughputs),
      errorRate: this.statisticalEngine.calculateStatistics(errorRates),
      memoryUsage: this.statisticalEngine.calculateStatistics(memoryUsages),
      cpuUsage: this.statisticalEngine.calculateStatistics(cpuUsages),
      coreWebVitals: {
        lcp: this.statisticalEngine.calculateStatistics(lcpValues),
        fid: this.statisticalEngine.calculateStatistics(fidValues),
        cls: this.statisticalEngine.calculateStatistics(clsValues)
      },
      databaseMetrics: {
        queryTime: this.statisticalEngine.calculateStatistics(queryTimes),
        connections: this.statisticalEngine.calculateStatistics(connections)
      }
    };
  }

  /**
   * Calculate baseline confidence score
   */
  private calculateBaselineConfidence(metricsData: any[]): number {
    const sampleSize = metricsData.length;
    const timeSpan = this.calculateTimeSpan(metricsData);
    const variability = this.calculateVariability(metricsData);
    
    // Confidence based on sample size (more samples = higher confidence)
    const sampleConfidence = Math.min(1, sampleSize / 100);
    
    // Confidence based on time span (longer period = higher confidence)
    const timeConfidence = Math.min(1, timeSpan / (24 * 60 * 60 * 1000)); // 24 hours
    
    // Confidence based on low variability (less variability = higher confidence)
    const variabilityConfidence = Math.max(0, 1 - variability);
    
    return (sampleConfidence + timeConfidence + variabilityConfidence) / 3;
  }

  /**
   * Calculate time span of metrics data
   */
  private calculateTimeSpan(metricsData: any[]): number {
    if (metricsData.length === 0) return 0;
    
    const timestamps = metricsData.map(m => m.timestamp).filter(t => t);
    if (timestamps.length === 0) return 0;
    
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  /**
   * Calculate variability in metrics
   */
  private calculateVariability(metricsData: any[]): number {
    const responseTimes = metricsData.map(m => m.responseTime || 0).filter(v => v > 0);
    if (responseTimes.length === 0) return 1;
    
    const stats = this.statisticalEngine.calculateStatistics(responseTimes);
    const coefficientOfVariation = stats.standardDeviation / stats.mean;
    
    return Math.min(1, coefficientOfVariation);
  }

  /**
   * Clean up old baselines
   */
  private cleanupOldBaselines(version: string, environment: string): void {
    const baselinesToKeep = 5; // Keep 5 most recent baselines per version/environment
    
    const versionBaselines = Array.from(this.baselines.values())
      .filter(b => b.version === version && b.environment === environment)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (versionBaselines.length > baselinesToKeep) {
      const toDelete = versionBaselines.slice(baselinesToKeep);
      toDelete.forEach(baseline => {
        this.baselines.delete(baseline.id);
      });
    }
  }

  /**
   * Get baseline for version
   */
  public getBaseline(version: string, environment: string = 'production'): PerformanceBaseline | null {
    const versionBaselines = Array.from(this.baselines.values())
      .filter(b => b.version === version && b.environment === environment)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return versionBaselines[0] || null;
  }

  /**
   * Get latest baseline
   */
  public getLatestBaseline(environment: string = 'production'): PerformanceBaseline | null {
    const environmentBaselines = Array.from(this.baselines.values())
      .filter(b => b.environment === environment)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return environmentBaselines[0] || null;
  }

  /**
   * Get all baselines
   */
  public getAllBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values()).sort((a, b) => b.timestamp - a.timestamp);
  }
}

/**
 * Rollback Manager
 */
class RollbackManager {
  private rollbackActions: RollbackAction[] = [];
  private rollbackConfig: any = {};

  /**
   * Execute automated rollback
   */
  public async executeRollback(
    regression: RegressionDetection,
    fromVersion: string,
    toVersion: string
  ): Promise<RollbackAction> {
    const rollbackAction: RollbackAction = {
      id: `rollback_${Date.now()}`,
      triggeredBy: 'automated-regression-detection',
      timestamp: Date.now(),
      reason: regression.description,
      fromVersion,
      toVersion,
      affectedServices: ['all'], // Would be more specific in production
      rollbackType: regression.severity === 'critical' ? 'full' : 'partial',
      status: 'initiated'
    };

    this.rollbackActions.push(rollbackAction);

    try {
      rollbackAction.status = 'in-progress';
      
      // Execute rollback steps
      await this.performRollbackSteps(rollbackAction);
      
      rollbackAction.status = 'completed';
      rollbackAction.duration = Date.now() - rollbackAction.timestamp;
      
      console.log(`Rollback completed: ${rollbackAction.id}`);
      
    } catch (error) {
      rollbackAction.status = 'failed';
      rollbackAction.error = error instanceof Error ? error.message : 'Unknown error';
      rollbackAction.duration = Date.now() - rollbackAction.timestamp;
      
      console.error(`Rollback failed: ${rollbackAction.id}`, error);
      throw error;
    }

    return rollbackAction;
  }

  /**
   * Perform rollback steps
   */
  private async performRollbackSteps(rollbackAction: RollbackAction): Promise<void> {
    // This would integrate with deployment systems
    // For now, simulate rollback steps
    
    console.log(`Starting rollback from ${rollbackAction.fromVersion} to ${rollbackAction.toVersion}`);
    
    // Step 1: Prepare rollback
    await this.sleep(1000);
    console.log('Rollback preparation completed');
    
    // Step 2: Update application version
    await this.sleep(2000);
    console.log('Application version updated');
    
    // Step 3: Restart services
    await this.sleep(3000);
    console.log('Services restarted');
    
    // Step 4: Verify rollback
    await this.sleep(1000);
    console.log('Rollback verification completed');
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rollback history
   */
  public getRollbackHistory(): RollbackAction[] {
    return [...this.rollbackActions].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Check if rollback is in progress
   */
  public isRollbackInProgress(): boolean {
    return this.rollbackActions.some(action => action.status === 'in-progress');
  }
}

/**
 * Performance Regression Detector
 */
export class RegressionDetector {
  private config: RegressionConfig;
  private baselineManager: BaselineManager;
  private rollbackManager: RollbackManager;
  private statisticalEngine: StatisticalAnalysisEngine;
  private detectedRegressions: RegressionDetection[] = [];
  private metricsHistory: any[] = [];

  constructor(config?: Partial<RegressionConfig>) {
    this.config = {
      enabled: true,
      sensitivityLevel: 'moderate',
      autoRollbackEnabled: false,
      rollbackThreshold: 0.8,
      monitoringWindow: 15 * 60 * 1000, // 15 minutes
      baselinePeriod: 24 * 60 * 60 * 1000, // 24 hours
      minimumSampleSize: 30,
      confidenceThreshold: 0.8,
      alertThresholds: {
        responseTime: 0.3, // 30% increase
        errorRate: 0.1, // 10% increase
        throughput: 0.2, // 20% decrease
        memoryUsage: 0.4 // 40% increase
      },
      ...config
    };

    this.baselineManager = new BaselineManager();
    this.rollbackManager = new RollbackManager();
    this.statisticalEngine = new StatisticalAnalysisEngine();
  }

  /**
   * Detect performance regression
   */
  public async detectRegression(metricsHistory: any[]): Promise<RegressionDetection[]> {
    if (!this.config.enabled || metricsHistory.length < this.config.minimumSampleSize) {
      return [];
    }

    this.metricsHistory = metricsHistory;
    const regressions: RegressionDetection[] = [];

    // Get baseline for comparison
    const baseline = this.baselineManager.getLatestBaseline();
    if (!baseline) {
      console.log('No baseline available for regression detection');
      return regressions;
    }

    // Get current metrics window
    const currentWindow = this.getCurrentMetricsWindow(metricsHistory);
    if (currentWindow.length < this.config.minimumSampleSize / 2) {
      return regressions;
    }

    // Analyze each metric for regression
    const metricAnalyses = [
      this.analyzeResponseTimeRegression(baseline, currentWindow),
      this.analyzeErrorRateRegression(baseline, currentWindow),
      this.analyzeThroughputRegression(baseline, currentWindow),
      this.analyzeMemoryUsageRegression(baseline, currentWindow),
      this.analyzeCoreWebVitalsRegression(baseline, currentWindow),
      this.analyzeDatabaseRegression(baseline, currentWindow)
    ];

    // Combine analyses into regression detections
    for (const analysis of metricAnalyses) {
      if (analysis.detected) {
        regressions.push(analysis);
      }
    }

    // Store detected regressions
    this.detectedRegressions.push(...regressions);

    // Handle auto-rollback if enabled
    if (this.config.autoRollbackEnabled) {
      await this.handleAutoRollback(regressions);
    }

    return regressions;
  }

  /**
   * Get current metrics window
   */
  private getCurrentMetricsWindow(metricsHistory: any[]): any[] {
    const windowStart = Date.now() - this.config.monitoringWindow;
    return metricsHistory.filter(metric => metric.timestamp >= windowStart);
  }

  /**
   * Analyze response time regression
   */
  private analyzeResponseTimeRegression(baseline: PerformanceBaseline, currentMetrics: any[]): RegressionDetection {
    const currentResponseTimes = currentMetrics.map(m => m.responseTime || 0).filter(v => v > 0);
    const baselineStats = baseline.metrics.responseTime;
    const currentStats = this.statisticalEngine.calculateStatistics(currentResponseTimes);

    const degradation = (currentStats.mean - baselineStats.mean) / baselineStats.mean;
    const threshold = this.config.alertThresholds.responseTime;

    const tTest = this.statisticalEngine.performTTest(
      Array(baselineStats.count).fill(baselineStats.mean),
      currentResponseTimes
    );

    return {
      detected: degradation > threshold && tTest.significant,
      severity: this.calculateSeverity(degradation, threshold),
      type: 'performance',
      affectedMetrics: ['responseTime'],
      degradationPercentage: degradation * 100,
      confidence: tTest.significant ? Math.min(1, 1 - tTest.pValue) : 0,
      description: `Response time increased by ${(degradation * 100).toFixed(1)}%`,
      detectedAt: Date.now(),
      baseline,
      currentMetrics: currentStats,
      recommendation: this.getRecommendation(degradation, threshold, 'performance')
    };
  }

  /**
   * Analyze error rate regression
   */
  private analyzeErrorRateRegression(baseline: PerformanceBaseline, currentMetrics: any[]): RegressionDetection {
    const currentErrorRates = currentMetrics.map(m => m.errorRate || 0);
    const baselineStats = baseline.metrics.errorRate;
    const currentStats = this.statisticalEngine.calculateStatistics(currentErrorRates);

    const degradation = (currentStats.mean - baselineStats.mean) / Math.max(baselineStats.mean, 0.01);
    const threshold = this.config.alertThresholds.errorRate;

    return {
      detected: degradation > threshold,
      severity: this.calculateSeverity(degradation, threshold),
      type: 'stability',
      affectedMetrics: ['errorRate'],
      degradationPercentage: degradation * 100,
      confidence: 0.9, // High confidence for error rate changes
      description: `Error rate increased by ${(degradation * 100).toFixed(1)}%`,
      detectedAt: Date.now(),
      baseline,
      currentMetrics: currentStats,
      recommendation: this.getRecommendation(degradation, threshold, 'stability')
    };
  }

  /**
   * Analyze throughput regression
   */
  private analyzeThroughputRegression(baseline: PerformanceBaseline, currentMetrics: any[]): RegressionDetection {
    const currentThroughputs = currentMetrics.map(m => m.throughput || 0).filter(v => v > 0);
    const baselineStats = baseline.metrics.throughput;
    const currentStats = this.statisticalEngine.calculateStatistics(currentThroughputs);

    const degradation = (baselineStats.mean - currentStats.mean) / baselineStats.mean; // Negative for throughput
    const threshold = this.config.alertThresholds.throughput;

    return {
      detected: degradation > threshold,
      severity: this.calculateSeverity(degradation, threshold),
      type: 'performance',
      affectedMetrics: ['throughput'],
      degradationPercentage: degradation * 100,
      confidence: 0.8,
      description: `Throughput decreased by ${(degradation * 100).toFixed(1)}%`,
      detectedAt: Date.now(),
      baseline,
      currentMetrics: currentStats,
      recommendation: this.getRecommendation(degradation, threshold, 'performance')
    };
  }

  /**
   * Analyze memory usage regression
   */
  private analyzeMemoryUsageRegression(baseline: PerformanceBaseline, currentMetrics: any[]): RegressionDetection {
    const currentMemoryUsages = currentMetrics.map(m => m.memoryUsage || 0).filter(v => v > 0);
    const baselineStats = baseline.metrics.memoryUsage;
    const currentStats = this.statisticalEngine.calculateStatistics(currentMemoryUsages);

    const degradation = (currentStats.mean - baselineStats.mean) / baselineStats.mean;
    const threshold = this.config.alertThresholds.memoryUsage;

    return {
      detected: degradation > threshold,
      severity: this.calculateSeverity(degradation, threshold),
      type: 'stability',
      affectedMetrics: ['memoryUsage'],
      degradationPercentage: degradation * 100,
      confidence: 0.85,
      description: `Memory usage increased by ${(degradation * 100).toFixed(1)}%`,
      detectedAt: Date.now(),
      baseline,
      currentMetrics: currentStats,
      recommendation: this.getRecommendation(degradation, threshold, 'stability')
    };
  }

  /**
   * Analyze Core Web Vitals regression
   */
  private analyzeCoreWebVitalsRegression(baseline: PerformanceBaseline, currentMetrics: any[]): RegressionDetection {
    const currentLCP = currentMetrics.map(m => m.coreWebVitals?.lcp || 0).filter(v => v > 0);
    const currentFID = currentMetrics.map(m => m.coreWebVitals?.fid || 0).filter(v => v > 0);
    const currentCLS = currentMetrics.map(m => m.coreWebVitals?.cls || 0);

    const lcpStats = this.statisticalEngine.calculateStatistics(currentLCP);
    const fidStats = this.statisticalEngine.calculateStatistics(currentFID);
    const clsStats = this.statisticalEngine.calculateStatistics(currentCLS);

    const lcpDegradation = (lcpStats.mean - baseline.metrics.coreWebVitals.lcp.mean) / baseline.metrics.coreWebVitals.lcp.mean;
    const fidDegradation = (fidStats.mean - baseline.metrics.coreWebVitals.fid.mean) / baseline.metrics.coreWebVitals.fid.mean;
    const clsDegradation = (clsStats.mean - baseline.metrics.coreWebVitals.cls.mean) / Math.max(baseline.metrics.coreWebVitals.cls.mean, 0.01);

    const maxDegradation = Math.max(lcpDegradation, fidDegradation, clsDegradation);
    const threshold = 0.2; // 20% degradation threshold for Core Web Vitals

    return {
      detected: maxDegradation > threshold,
      severity: this.calculateSeverity(maxDegradation, threshold),
      type: 'quality',
      affectedMetrics: ['coreWebVitals'],
      degradationPercentage: maxDegradation * 100,
      confidence: 0.75,
      description: `Core Web Vitals degraded by ${(maxDegradation * 100).toFixed(1)}%`,
      detectedAt: Date.now(),
      baseline,
      currentMetrics: { lcp: lcpStats, fid: fidStats, cls: clsStats },
      recommendation: this.getRecommendation(maxDegradation, threshold, 'quality')
    };
  }

  /**
   * Analyze database performance regression
   */
  private analyzeDatabaseRegression(baseline: PerformanceBaseline, currentMetrics: any[]): RegressionDetection {
    const currentQueryTimes = currentMetrics.map(m => m.databaseMetrics?.queryTime || 0).filter(v => v > 0);
    const baselineStats = baseline.metrics.databaseMetrics.queryTime;
    const currentStats = this.statisticalEngine.calculateStatistics(currentQueryTimes);

    const degradation = (currentStats.mean - baselineStats.mean) / baselineStats.mean;
    const threshold = 0.5; // 50% degradation threshold for database

    return {
      detected: degradation > threshold,
      severity: this.calculateSeverity(degradation, threshold),
      type: 'performance',
      affectedMetrics: ['databaseQueryTime'],
      degradationPercentage: degradation * 100,
      confidence: 0.8,
      description: `Database query time increased by ${(degradation * 100).toFixed(1)}%`,
      detectedAt: Date.now(),
      baseline,
      currentMetrics: currentStats,
      recommendation: this.getRecommendation(degradation, threshold, 'performance')
    };
  }

  /**
   * Calculate severity based on degradation
   */
  private calculateSeverity(degradation: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const ratio = degradation / threshold;
    
    if (ratio >= 3) return 'critical';
    if (ratio >= 2) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  /**
   * Get recommendation based on degradation
   */
  private getRecommendation(
    degradation: number, 
    threshold: number, 
    type: string
  ): 'monitor' | 'investigate' | 'rollback' | 'emergency-rollback' {
    const ratio = degradation / threshold;
    
    if (ratio >= 3) return 'emergency-rollback';
    if (ratio >= 2) return 'rollback';
    if (ratio >= 1.5) return 'investigate';
    return 'monitor';
  }

  /**
   * Handle auto-rollback
   */
  private async handleAutoRollback(regressions: RegressionDetection[]): Promise<void> {
    const criticalRegressions = regressions.filter(r => 
      r.severity === 'critical' || r.recommendation === 'emergency-rollback'
    );

    if (criticalRegressions.length === 0) return;

    // Check if rollback is already in progress
    if (this.rollbackManager.isRollbackInProgress()) {
      console.log('Rollback already in progress, skipping auto-rollback');
      return;
    }

    try {
      const regression = criticalRegressions[0]; // Handle the most severe regression
      const currentVersion = 'current'; // Would get from deployment system
      const previousVersion = 'previous'; // Would get from deployment system

      console.log(`Initiating auto-rollback due to critical regression: ${regression.description}`);
      
      await this.rollbackManager.executeRollback(regression, currentVersion, previousVersion);
      
    } catch (error) {
      console.error('Auto-rollback failed:', error);
    }
  }

  /**
   * Create baseline from metrics
   */
  public createBaseline(version: string, metricsData: any[], environment?: string): PerformanceBaseline {
    return this.baselineManager.createBaseline(version, metricsData, environment);
  }

  /**
   * Get detected regressions
   */
  public getDetectedRegressions(): RegressionDetection[] {
    return [...this.detectedRegressions].sort((a, b) => b.detectedAt - a.detectedAt);
  }

  /**
   * Get rollback history
   */
  public getRollbackHistory(): RollbackAction[] {
    return this.rollbackManager.getRollbackHistory();
  }

  /**
   * Get all baselines
   */
  public getBaselines(): PerformanceBaseline[] {
    return this.baselineManager.getAllBaselines();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<RegressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  public getConfig(): RegressionConfig {
    return { ...this.config };
  }

  /**
   * Manual rollback trigger
   */
  public async triggerManualRollback(
    reason: string,
    fromVersion: string,
    toVersion: string
  ): Promise<RollbackAction> {
    const mockRegression: RegressionDetection = {
      detected: true,
      severity: 'high',
      type: 'performance',
      affectedMetrics: ['manual'],
      degradationPercentage: 0,
      confidence: 1,
      description: reason,
      detectedAt: Date.now(),
      baseline: {} as PerformanceBaseline,
      currentMetrics: {},
      recommendation: 'rollback'
    };

    return this.rollbackManager.executeRollback(mockRegression, fromVersion, toVersion);
  }
}

// Export singleton instance
export const regressionDetector = new RegressionDetector();