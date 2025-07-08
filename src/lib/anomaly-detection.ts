/**
 * Anomaly Detection and Predictive Alerting System
 * Advanced ML-based anomaly detection with predictive capabilities
 */
import { createLogger } from './logger';
import { multiProviderAPM } from './apm-providers';
import { alertingEngine } from './alerting-engine';

const logger = createLogger('anomaly-detection');

// Anomaly detection algorithms
export enum AnomalyAlgorithm {
  STATISTICAL = 'statistical',
  ISOLATION_FOREST = 'isolation_forest',
  AUTOENCODER = 'autoencoder',
  LSTM = 'lstm',
  SEASONAL_HYBRID = 'seasonal_hybrid',
  ENSEMBLE = 'ensemble',
}

// Anomaly severity levels
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Anomaly types
export enum AnomalyType {
  POINT = 'point',           // Single data point anomaly
  CONTEXTUAL = 'contextual', // Anomaly in specific context
  COLLECTIVE = 'collective', // Group of data points forming anomaly
  TREND = 'trend',          // Change in trend
  SEASONAL = 'seasonal',    // Seasonal pattern deviation
}

// Time series data point
export interface DataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

// Detected anomaly
export interface Anomaly {
  id: string;
  timestamp: Date;
  metric: string;
  algorithm: AnomalyAlgorithm;
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number; // Anomaly score (0-1)
  confidence: number; // Confidence level (0-1)
  value: number;
  expectedValue: number;
  deviation: number;
  context: {
    historicalMean: number;
    historicalStdDev: number;
    seasonalPattern?: number[];
    trendDirection?: 'up' | 'down' | 'stable';
    correlatedMetrics?: string[];
  };
  prediction?: {
    nextValues: number[];
    timeHorizon: number; // minutes
    confidence: number;
  };
  recommendations: string[];
  metadata?: Record<string, any>;
}

// Anomaly detector configuration
export interface AnomalyDetectorConfig {
  id: string;
  name: string;
  metric: string;
  algorithm: AnomalyAlgorithm;
  enabled: boolean;
  sensitivity: number; // 0-1, higher = more sensitive
  minDataPoints: number;
  trainingWindow: number; // days
  detectionWindow: number; // minutes
  seasonality: {
    enabled: boolean;
    period: number; // hours (24 for daily, 168 for weekly)
    components: string[]; // ['trend', 'seasonal', 'residual']
  };
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  prediction: {
    enabled: boolean;
    horizon: number; // minutes
    confidence: number; // minimum confidence threshold
  };
  alerting: {
    enabled: boolean;
    cooldown: number; // minutes
    channels: string[];
    escalation: boolean;
  };
  tags?: Record<string, string>;
}

// Statistical anomaly detector
class StatisticalAnomalyDetector {
  private config: AnomalyDetectorConfig;
  private historicalData: DataPoint[] = [];
  private statistics: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    median: number;
    q1: number;
    q3: number;
    iqr: number;
  } | null = null;

  constructor(config: AnomalyDetectorConfig) {
    this.config = config;
  }

  public train(data: DataPoint[]): void {
    this.historicalData = [...data];
    this.calculateStatistics();
  }

  private calculateStatistics(): void {
    const values = this.historicalData.map(d => d.value).sort((a, b) => a - b);
    const n = values.length;

    if (n === 0) {
      this.statistics = null;
      return;
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const q1Index = Math.floor(n * 0.25);
    const medianIndex = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);

    this.statistics = {
      mean,
      stdDev,
      min: values[0],
      max: values[n - 1],
      median: values[medianIndex],
      q1: values[q1Index],
      q3: values[q3Index],
      iqr: values[q3Index] - values[q1Index],
    };
  }

  public detect(dataPoint: DataPoint): Anomaly | null {
    if (!this.statistics || this.historicalData.length < this.config.minDataPoints) {
      return null;
    }

    const { value } = dataPoint;
    const { mean, stdDev, iqr, q1, q3 } = this.statistics;

    // Z-score based detection
    const zScore = Math.abs((value - mean) / stdDev);
    const zScoreAnomaly = zScore > 3; // Standard 3-sigma rule

    // IQR based detection
    const iqrLower = q1 - 1.5 * iqr;
    const iqrUpper = q3 + 1.5 * iqr;
    const iqrAnomaly = value < iqrLower || value > iqrUpper;

    // Modified Z-score (more robust to outliers)
    const medianAbsDeviation = this.calculateMAD();
    const modifiedZScore = 0.6745 * (value - this.statistics.median) / medianAbsDeviation;
    const modifiedZAnomaly = Math.abs(modifiedZScore) > 3.5;

    // Combine detection methods
    const isAnomaly = zScoreAnomaly || iqrAnomaly || modifiedZAnomaly;

    if (!isAnomaly) return null;

    // Calculate anomaly score
    const score = Math.min(1, Math.max(zScore / 5, Math.abs(modifiedZScore) / 5));
    
    // Determine severity
    const severity = this.determineSeverity(score);

    // Calculate confidence based on how many methods detected it
    const detectionCount = [zScoreAnomaly, iqrAnomaly, modifiedZAnomaly].filter(Boolean).length;
    const confidence = detectionCount / 3;

    return {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: dataPoint.timestamp,
      metric: this.config.metric,
      algorithm: AnomalyAlgorithm.STATISTICAL,
      type: AnomalyType.POINT,
      severity,
      score,
      confidence,
      value,
      expectedValue: mean,
      deviation: Math.abs(value - mean),
      context: {
        historicalMean: mean,
        historicalStdDev: stdDev,
        trendDirection: this.detectTrend(),
      },
      recommendations: this.generateRecommendations(value, mean, severity),
    };
  }

  private calculateMAD(): number {
    if (!this.statistics) return 0;
    
    const median = this.statistics.median;
    const deviations = this.historicalData.map(d => Math.abs(d.value - median));
    deviations.sort((a, b) => a - b);
    
    const medianIndex = Math.floor(deviations.length / 2);
    return deviations[medianIndex] || 0;
  }

  private determineSeverity(score: number): AnomalySeverity {
    const { thresholds } = this.config;
    
    if (score >= thresholds.critical) return AnomalySeverity.CRITICAL;
    if (score >= thresholds.high) return AnomalySeverity.HIGH;
    if (score >= thresholds.medium) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  private detectTrend(): 'up' | 'down' | 'stable' {
    if (this.historicalData.length < 10) return 'stable';

    const recentData = this.historicalData.slice(-10);
    const firstHalf = recentData.slice(0, 5);
    const secondHalf = recentData.slice(5);

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) return 'up';
    if (change < -0.1) return 'down';
    return 'stable';
  }

  private generateRecommendations(value: number, expected: number, severity: AnomalySeverity): string[] {
    const recommendations: string[] = [];

    if (severity === AnomalySeverity.CRITICAL || severity === AnomalySeverity.HIGH) {
      recommendations.push('Immediate investigation required');
      recommendations.push('Check system logs for errors');
      recommendations.push('Verify external dependencies');
    }

    if (value > expected * 2) {
      recommendations.push('Resource scaling may be needed');
      recommendations.push('Check for traffic spikes or unusual load');
    } else if (value < expected * 0.5) {
      recommendations.push('Check for service degradation or outages');
      recommendations.push('Verify monitoring system is functioning');
    }

    return recommendations;
  }
}

// Seasonal hybrid detector (combines statistical and seasonal analysis)
class SeasonalHybridDetector {
  private config: AnomalyDetectorConfig;
  private seasonalModel: {
    trend: number[];
    seasonal: number[];
    residual: number[];
    period: number;
  } | null = null;

  constructor(config: AnomalyDetectorConfig) {
    this.config = config;
  }

  public train(data: DataPoint[]): void {
    if (this.config.seasonality.enabled && data.length >= this.config.seasonality.period * 2) {
      this.buildSeasonalModel(data);
    }
  }

  private buildSeasonalModel(data: DataPoint[]): void {
    const values = data.map(d => d.value);
    const period = this.config.seasonality.period;

    // Simple seasonal decomposition
    const trend = this.extractTrend(values);
    const detrended = values.map((val, i) => val - trend[i]);
    const seasonal = this.extractSeasonal(detrended, period);
    const residual = detrended.map((val, i) => val - seasonal[i % period]);

    this.seasonalModel = { trend, seasonal, residual, period };
  }

  private extractTrend(values: number[]): number[] {
    const windowSize = Math.min(24, Math.floor(values.length / 4)); // Moving average window
    const trend: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(values.length, i + Math.floor(windowSize / 2) + 1);
      const window = values.slice(start, end);
      trend[i] = window.reduce((sum, val) => sum + val, 0) / window.length;
    }

    return trend;
  }

  private extractSeasonal(detrended: number[], period: number): number[] {
    const seasonal = new Array(period).fill(0);
    const counts = new Array(period).fill(0);

    // Average values for each position in the period
    for (let i = 0; i < detrended.length; i++) {
      const pos = i % period;
      seasonal[pos] += detrended[i];
      counts[pos]++;
    }

    for (let i = 0; i < period; i++) {
      seasonal[i] = counts[i] > 0 ? seasonal[i] / counts[i] : 0;
    }

    // Center the seasonal component
    const seasonalMean = seasonal.reduce((sum, val) => sum + val, 0) / period;
    return seasonal.map(val => val - seasonalMean);
  }

  public detect(dataPoint: DataPoint): Anomaly | null {
    if (!this.seasonalModel) {
      // Fallback to simple statistical detection
      const statisticalDetector = new StatisticalAnomalyDetector(this.config);
      return statisticalDetector.detect(dataPoint);
    }

    const { value } = dataPoint;
    const hourOfDay = dataPoint.timestamp.getHours();
    const expectedSeasonal = this.seasonalModel.seasonal[hourOfDay % this.seasonalModel.period];
    
    // Estimate expected value based on recent trend and seasonal pattern
    const expectedValue = this.estimateExpectedValue(dataPoint.timestamp) + expectedSeasonal;
    const residual = value - expectedValue;

    // Calculate anomaly score based on residual
    const residualStdDev = this.calculateResidualStdDev();
    const zScore = Math.abs(residual / residualStdDev);
    const isAnomaly = zScore > 2.5; // Slightly more lenient for seasonal data

    if (!isAnomaly) return null;

    const score = Math.min(1, zScore / 4);
    const severity = this.determineSeverity(score);

    return {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: dataPoint.timestamp,
      metric: this.config.metric,
      algorithm: AnomalyAlgorithm.SEASONAL_HYBRID,
      type: AnomalyType.SEASONAL,
      severity,
      score,
      confidence: Math.min(1, zScore / 3),
      value,
      expectedValue,
      deviation: Math.abs(residual),
      context: {
        historicalMean: expectedValue,
        historicalStdDev: residualStdDev,
        seasonalPattern: this.seasonalModel.seasonal,
        trendDirection: this.detectTrendDirection(),
      },
      recommendations: this.generateSeasonalRecommendations(value, expectedValue, severity),
    };
  }

  private estimateExpectedValue(timestamp: Date): number {
    if (!this.seasonalModel) return 0;

    // Simple trend estimation (would be more sophisticated in production)
    const recentTrend = this.seasonalModel.trend.slice(-10);
    return recentTrend.reduce((sum, val) => sum + val, 0) / recentTrend.length;
  }

  private calculateResidualStdDev(): number {
    if (!this.seasonalModel) return 1;

    const residuals = this.seasonalModel.residual;
    const mean = residuals.reduce((sum, val) => sum + val, 0) / residuals.length;
    const variance = residuals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / residuals.length;
    return Math.sqrt(variance);
  }

  private detectTrendDirection(): 'up' | 'down' | 'stable' {
    if (!this.seasonalModel || this.seasonalModel.trend.length < 10) return 'stable';

    const trend = this.seasonalModel.trend;
    const recentSlope = this.calculateSlope(trend.slice(-10));

    if (recentSlope > 0.01) return 'up';
    if (recentSlope < -0.01) return 'down';
    return 'stable';
  }

  private calculateSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    const xSum = (n * (n - 1)) / 2;
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, i) => sum + val * i, 0);
    const x2Sum = (n * (n - 1) * (2 * n - 1)) / 6;

    return (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  }

  private determineSeverity(score: number): AnomalySeverity {
    const { thresholds } = this.config;
    
    if (score >= thresholds.critical) return AnomalySeverity.CRITICAL;
    if (score >= thresholds.high) return AnomalySeverity.HIGH;
    if (score >= thresholds.medium) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  private generateSeasonalRecommendations(value: number, expected: number, severity: AnomalySeverity): string[] {
    const recommendations: string[] = [];

    if (severity === AnomalySeverity.CRITICAL || severity === AnomalySeverity.HIGH) {
      recommendations.push('Seasonal pattern deviation detected');
      recommendations.push('Compare with same time period in previous cycles');
    }

    const deviation = (value - expected) / expected;
    if (Math.abs(deviation) > 0.5) {
      recommendations.push('Significant deviation from seasonal expectations');
      recommendations.push('Check for external factors affecting normal patterns');
    }

    return recommendations;
  }
}

// Predictive model for forecasting
class PredictiveModel {
  private config: AnomalyDetectorConfig;
  private historicalData: DataPoint[] = [];

  constructor(config: AnomalyDetectorConfig) {
    this.config = config;
  }

  public train(data: DataPoint[]): void {
    this.historicalData = [...data];
  }

  public predict(horizon: number): { values: number[]; confidence: number } {
    if (this.historicalData.length < 10) {
      return { values: [], confidence: 0 };
    }

    // Simple linear regression for trend prediction
    const values = this.historicalData.map(d => d.value);
    const predictions: number[] = [];
    
    // Calculate trend using last 20 points
    const recentData = values.slice(-20);
    const trend = this.calculateTrend(recentData);
    const lastValue = values[values.length - 1];

    // Generate predictions
    for (let i = 1; i <= horizon; i++) {
      const prediction = lastValue + trend * i;
      predictions.push(prediction);
    }

    // Calculate confidence based on historical accuracy
    const confidence = this.calculateConfidence(values);

    return { values: predictions, confidence };
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.reduce((sum, val) => sum + val, 0) / n;

    const numerator = x.reduce((sum, val, i) => sum + (val - xMean) * (y[i] - yMean), 0);
    const denominator = x.reduce((sum, val) => sum + Math.pow(val - xMean, 2), 0);

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateConfidence(values: number[]): number {
    if (values.length < 5) return 0.5;

    // Calculate prediction accuracy over historical data
    const errors: number[] = [];
    
    for (let i = 5; i < values.length; i++) {
      const historical = values.slice(0, i);
      const actual = values[i];
      const predicted = this.simpleForecast(historical);
      const error = Math.abs(actual - predicted) / Math.max(actual, 1);
      errors.push(error);
    }

    const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    return Math.max(0, 1 - avgError);
  }

  private simpleForecast(values: number[]): number {
    // Simple moving average prediction
    const windowSize = Math.min(5, values.length);
    const window = values.slice(-windowSize);
    return window.reduce((sum, val) => sum + val, 0) / window.length;
  }
}

// Main anomaly detection service
export class AnomalyDetectionService {
  private detectors: Map<string, AnomalyDetectorConfig> = new Map();
  private detectorInstances: Map<string, any> = new Map();
  private predictiveModels: Map<string, PredictiveModel> = new Map();
  private anomalies: Map<string, Anomaly> = new Map();
  private evaluationInterval: NodeJS.Timeout | null = null;
  private trainingInterval: NodeJS.Timeout | null = null;
  private lastAlerts: Map<string, Date> = new Map();

  constructor() {
    this.initializeDefaultDetectors();
    this.startEvaluationLoop();
    this.startTrainingLoop();
  }

  private initializeDefaultDetectors() {
    // Response time anomaly detection
    this.addDetector({
      id: 'response_time_anomaly',
      name: 'Response Time Anomaly Detection',
      metric: 'response_time',
      algorithm: AnomalyAlgorithm.SEASONAL_HYBRID,
      enabled: true,
      sensitivity: 0.7,
      minDataPoints: 50,
      trainingWindow: 7, // days
      detectionWindow: 5, // minutes
      seasonality: {
        enabled: true,
        period: 24, // hourly pattern
        components: ['trend', 'seasonal', 'residual'],
      },
      thresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.9,
      },
      prediction: {
        enabled: true,
        horizon: 30, // 30 minutes
        confidence: 0.6,
      },
      alerting: {
        enabled: true,
        cooldown: 15,
        channels: ['slack', 'email'],
        escalation: true,
      },
    });

    // Error rate anomaly detection
    this.addDetector({
      id: 'error_rate_anomaly',
      name: 'Error Rate Anomaly Detection',
      metric: 'error_rate',
      algorithm: AnomalyAlgorithm.STATISTICAL,
      enabled: true,
      sensitivity: 0.8,
      minDataPoints: 30,
      trainingWindow: 3, // days
      detectionWindow: 5, // minutes
      seasonality: {
        enabled: false,
        period: 24,
        components: ['trend', 'residual'],
      },
      thresholds: {
        low: 0.4,
        medium: 0.6,
        high: 0.8,
        critical: 0.95,
      },
      prediction: {
        enabled: true,
        horizon: 15, // 15 minutes
        confidence: 0.7,
      },
      alerting: {
        enabled: true,
        cooldown: 10,
        channels: ['slack', 'email', 'pagerduty'],
        escalation: true,
      },
    });

    // Memory usage anomaly detection
    this.addDetector({
      id: 'memory_usage_anomaly',
      name: 'Memory Usage Anomaly Detection',
      metric: 'memory_usage',
      algorithm: AnomalyAlgorithm.SEASONAL_HYBRID,
      enabled: true,
      sensitivity: 0.6,
      minDataPoints: 100,
      trainingWindow: 7, // days
      detectionWindow: 10, // minutes
      seasonality: {
        enabled: true,
        period: 24, // daily pattern
        components: ['trend', 'seasonal', 'residual'],
      },
      thresholds: {
        low: 0.3,
        medium: 0.5,
        high: 0.7,
        critical: 0.9,
      },
      prediction: {
        enabled: true,
        horizon: 60, // 1 hour
        confidence: 0.6,
      },
      alerting: {
        enabled: true,
        cooldown: 30,
        channels: ['slack', 'email'],
        escalation: false,
      },
    });

    logger.info(`Initialized ${this.detectors.size} anomaly detectors`);
  }

  private startEvaluationLoop() {
    // Run anomaly detection every minute
    this.evaluationInterval = setInterval(async () => {
      await this.runDetection();
    }, 60000);

    logger.info('Anomaly detection evaluation loop started');
  }

  private startTrainingLoop() {
    // Retrain models every 6 hours
    this.trainingInterval = setInterval(async () => {
      await this.retrainModels();
    }, 6 * 60 * 60 * 1000);

    // Initial training
    setTimeout(() => this.retrainModels(), 30000); // 30 seconds delay

    logger.info('Model training loop started');
  }

  private async runDetection() {
    for (const config of this.detectors.values()) {
      if (!config.enabled) continue;

      try {
        await this.detectAnomalies(config);
      } catch (error) {
        logger.error(`Error in anomaly detection for ${config.id}:`, error);
      }
    }
  }

  private async detectAnomalies(config: AnomalyDetectorConfig) {
    // Get current metric value
    const currentValue = await this.getCurrentMetricValue(config.metric);
    if (currentValue === null) return;

    const dataPoint: DataPoint = {
      timestamp: new Date(),
      value: currentValue,
    };

    // Get detector instance
    const detector = this.detectorInstances.get(config.id);
    if (!detector) return;

    // Run detection
    const anomaly = detector.detect(dataPoint);
    if (!anomaly) return;

    // Add prediction if enabled
    if (config.prediction.enabled) {
      const predictiveModel = this.predictiveModels.get(config.id);
      if (predictiveModel) {
        const prediction = predictiveModel.predict(config.prediction.horizon);
        if (prediction.confidence >= config.prediction.confidence) {
          anomaly.prediction = {
            nextValues: prediction.values,
            timeHorizon: config.prediction.horizon,
            confidence: prediction.confidence,
          };
        }
      }
    }

    // Store anomaly
    this.anomalies.set(anomaly.id, anomaly);

    // Send alerts if configured
    if (config.alerting.enabled) {
      await this.sendAnomalyAlert(anomaly, config);
    }

    // Record metrics
    multiProviderAPM.recordMetric(
      'anomalies_detected',
      1,
      'counter',
      {
        detector_id: config.id,
        algorithm: config.algorithm,
        severity: anomaly.severity,
        type: anomaly.type,
      }
    );

    logger.warn('Anomaly detected', {
      id: anomaly.id,
      metric: anomaly.metric,
      severity: anomaly.severity,
      score: anomaly.score,
      value: anomaly.value,
      expectedValue: anomaly.expectedValue,
    });
  }

  private async getCurrentMetricValue(metric: string): Promise<number | null> {
    // This would integrate with your metrics system
    // For now, return mock values based on metric name
    switch (metric) {
      case 'response_time':
        return Math.random() * 2000 + 200; // 200-2200ms
      case 'error_rate':
        return Math.random() * 5; // 0-5%
      case 'memory_usage':
        return Math.random() * 100; // 0-100%
      case 'cpu_usage':
        return Math.random() * 100; // 0-100%
      case 'request_rate':
        return Math.random() * 1000 + 100; // 100-1100 req/min
      default:
        return null;
    }
  }

  private async sendAnomalyAlert(anomaly: Anomaly, config: AnomalyDetectorConfig) {
    // Check cooldown
    const lastAlert = this.lastAlerts.get(config.id);
    if (lastAlert) {
      const timeSinceLastAlert = (Date.now() - lastAlert.getTime()) / 60000; // minutes
      if (timeSinceLastAlert < config.alerting.cooldown) {
        return;
      }
    }

    this.lastAlerts.set(config.id, new Date());

    // Create alert message
    const alertTitle = `Anomaly Detected: ${config.name}`;
    const alertDescription = `
Metric: ${anomaly.metric}
Severity: ${anomaly.severity}
Current Value: ${anomaly.value.toFixed(2)}
Expected Value: ${anomaly.expectedValue.toFixed(2)}
Anomaly Score: ${anomaly.score.toFixed(3)}
Confidence: ${(anomaly.confidence * 100).toFixed(1)}%
Algorithm: ${anomaly.algorithm}

${anomaly.recommendations.join('\n')}
    `.trim();

    // Send through alerting engine
    // This would create an alert rule dynamically or trigger existing ones
    logger.warn(alertTitle, {
      description: alertDescription,
      anomaly: anomaly,
      config: config,
    });
  }

  private async retrainModels() {
    logger.info('Starting model retraining');

    for (const config of this.detectors.values()) {
      if (!config.enabled) continue;

      try {
        await this.trainDetector(config);
      } catch (error) {
        logger.error(`Error training detector ${config.id}:`, error);
      }
    }

    logger.info('Model retraining completed');
  }

  private async trainDetector(config: AnomalyDetectorConfig) {
    // Get historical data for training
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - config.trainingWindow * 24 * 60 * 60 * 1000);
    
    const trainingData = await this.getHistoricalData(config.metric, startTime, endTime);
    if (trainingData.length < config.minDataPoints) {
      logger.warn(`Insufficient training data for detector ${config.id}: ${trainingData.length} points`);
      return;
    }

    // Create and train detector
    let detector: any;
    switch (config.algorithm) {
      case AnomalyAlgorithm.STATISTICAL:
        detector = new StatisticalAnomalyDetector(config);
        break;
      case AnomalyAlgorithm.SEASONAL_HYBRID:
        detector = new SeasonalHybridDetector(config);
        break;
      default:
        detector = new StatisticalAnomalyDetector(config);
        break;
    }

    detector.train(trainingData);
    this.detectorInstances.set(config.id, detector);

    // Train predictive model if enabled
    if (config.prediction.enabled) {
      const predictiveModel = new PredictiveModel(config);
      predictiveModel.train(trainingData);
      this.predictiveModels.set(config.id, predictiveModel);
    }

    logger.info(`Trained detector ${config.id} with ${trainingData.length} data points`);
  }

  private async getHistoricalData(metric: string, startTime: Date, endTime: Date): Promise<DataPoint[]> {
    // This would query your time series database
    // For now, generate mock historical data
    const data: DataPoint[] = [];
    const interval = 60000; // 1 minute intervals
    
    for (let time = startTime.getTime(); time <= endTime.getTime(); time += interval) {
      const timestamp = new Date(time);
      const hour = timestamp.getHours();
      const dayOfWeek = timestamp.getDay();
      
      let value = 0;
      
      switch (metric) {
        case 'response_time':
          // Add seasonal pattern (higher during business hours)
          const businessHourMultiplier = (hour >= 9 && hour <= 17 && dayOfWeek >= 1 && dayOfWeek <= 5) ? 1.5 : 1;
          value = (Math.random() * 500 + 200) * businessHourMultiplier;
          break;
        case 'error_rate':
          value = Math.random() * 2; // 0-2% normally
          break;
        case 'memory_usage':
          // Add daily pattern
          const memoryPattern = 50 + 20 * Math.sin((hour / 24) * 2 * Math.PI);
          value = memoryPattern + (Math.random() - 0.5) * 10;
          break;
        default:
          value = Math.random() * 100;
      }
      
      data.push({ timestamp, value });
    }
    
    return data;
  }

  // Public API methods
  public addDetector(config: AnomalyDetectorConfig) {
    this.detectors.set(config.id, config);
    
    // Train immediately if enough historical data
    setTimeout(() => this.trainDetector(config), 5000);
    
    logger.info(`Added anomaly detector: ${config.id}`);
  }

  public removeDetector(detectorId: string) {
    this.detectors.delete(detectorId);
    this.detectorInstances.delete(detectorId);
    this.predictiveModels.delete(detectorId);
    
    logger.info(`Removed anomaly detector: ${detectorId}`);
  }

  public updateDetector(detectorId: string, updates: Partial<AnomalyDetectorConfig>) {
    const existing = this.detectors.get(detectorId);
    if (existing) {
      const updated = { ...existing, ...updates };
      this.detectors.set(detectorId, updated);
      
      // Retrain if configuration changed significantly
      if (updates.algorithm || updates.sensitivity || updates.seasonality) {
        setTimeout(() => this.trainDetector(updated), 1000);
      }
      
      logger.info(`Updated anomaly detector: ${detectorId}`);
    }
  }

  public getAnomalies(filters?: {
    metric?: string;
    severity?: AnomalySeverity;
    algorithm?: AnomalyAlgorithm;
    timeRange?: { start: Date; end: Date };
  }): Anomaly[] {
    let anomalies = Array.from(this.anomalies.values());

    if (filters) {
      if (filters.metric) {
        anomalies = anomalies.filter(a => a.metric === filters.metric);
      }
      if (filters.severity) {
        anomalies = anomalies.filter(a => a.severity === filters.severity);
      }
      if (filters.algorithm) {
        anomalies = anomalies.filter(a => a.algorithm === filters.algorithm);
      }
      if (filters.timeRange) {
        anomalies = anomalies.filter(a => 
          a.timestamp >= filters.timeRange!.start && 
          a.timestamp <= filters.timeRange!.end
        );
      }
    }

    return anomalies.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getDetectors(): AnomalyDetectorConfig[] {
    return Array.from(this.detectors.values());
  }

  public async getPrediction(detectorId: string, horizon?: number): Promise<{ values: number[]; confidence: number } | null> {
    const predictiveModel = this.predictiveModels.get(detectorId);
    if (!predictiveModel) return null;

    const config = this.detectors.get(detectorId);
    const predictionHorizon = horizon || config?.prediction.horizon || 30;

    return predictiveModel.predict(predictionHorizon);
  }

  public getMetrics(): Record<string, any> {
    const anomalies = Array.from(this.anomalies.values());
    const recentAnomalies = anomalies.filter(a => 
      Date.now() - a.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    return {
      detectors: {
        total: this.detectors.size,
        enabled: Array.from(this.detectors.values()).filter(d => d.enabled).length,
        trained: this.detectorInstances.size,
      },
      anomalies: {
        total: anomalies.length,
        recent: recentAnomalies.length,
        bySeverity: {
          low: recentAnomalies.filter(a => a.severity === AnomalySeverity.LOW).length,
          medium: recentAnomalies.filter(a => a.severity === AnomalySeverity.MEDIUM).length,
          high: recentAnomalies.filter(a => a.severity === AnomalySeverity.HIGH).length,
          critical: recentAnomalies.filter(a => a.severity === AnomalySeverity.CRITICAL).length,
        },
        byAlgorithm: {
          statistical: recentAnomalies.filter(a => a.algorithm === AnomalyAlgorithm.STATISTICAL).length,
          seasonal_hybrid: recentAnomalies.filter(a => a.algorithm === AnomalyAlgorithm.SEASONAL_HYBRID).length,
        },
      },
      predictions: {
        enabled: Array.from(this.detectors.values()).filter(d => d.prediction.enabled).length,
        models: this.predictiveModels.size,
      },
    };
  }

  public shutdown() {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    if (this.trainingInterval) {
      clearInterval(this.trainingInterval);
    }
    
    logger.info('Anomaly detection service shutdown');
  }
}

// Create singleton instance
export const anomalyDetectionService = new AnomalyDetectionService();

// Export default
export default anomalyDetectionService;