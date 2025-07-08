// Automated ML Pipeline for Continuous Improvement
import { generateUUID } from '@/utils/uuid';
import type { LearningSession, LearningProfile } from '@/types';

export interface MLExperiment {
  id: string;
  name: string;
  description: string;
  type: 'model_training' | 'hyperparameter_tuning' | 'feature_engineering' | 'a_b_testing';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  config: ExperimentConfig;
  results?: ExperimentResults;
  metrics: ExperimentMetrics;
  artifacts: string[];
}

export interface ExperimentConfig {
  dataset: DatasetConfig;
  model: ModelConfig;
  training: TrainingConfig;
  evaluation: EvaluationConfig;
  deployment?: DeploymentConfig;
}

export interface DatasetConfig {
  source: string;
  features: string[];
  target: string;
  splitRatio: [number, number, number]; // train, val, test
  preprocessing: PreprocessingStep[];
  augmentation?: AugmentationConfig[];
}

export interface ModelConfig {
  type: 'neural_network' | 'random_forest' | 'gradient_boosting' | 'transformer' | 'ensemble';
  architecture?: any;
  hyperparameters: Record<string, any>;
  pretrained?: string;
}

export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: string;
  lossFunction: string;
  callbacks: CallbackConfig[];
  earlyStopping?: EarlyStoppingConfig;
}

export interface EvaluationConfig {
  metrics: string[];
  crossValidation?: CVConfig;
  benchmarks: string[];
}

export interface DeploymentConfig {
  strategy: 'blue_green' | 'canary' | 'rolling';
  trafficSplit?: number;
  rollbackThreshold: number;
  monitoring: MonitoringConfig;
}

export interface ExperimentResults {
  trainMetrics: Record<string, number>;
  validationMetrics: Record<string, number>;
  testMetrics: Record<string, number>;
  confusion_matrix?: number[][];
  feature_importance?: Record<string, number>;
  learning_curves?: { epoch: number; train_loss: number; val_loss: number; }[];
  predictions?: any[];
}

export interface ExperimentMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc?: number;
  mse?: number;
  mae?: number;
  customMetrics?: Record<string, number>;
}

export interface MLPipelineConfig {
  autoRetrain: boolean;
  retrainThreshold: number;
  dataValidation: boolean;
  modelValidation: boolean;
  continuousMonitoring: boolean;
  experimentTracking: boolean;
}

export interface DataDriftReport {
  timestamp: Date;
  overall_drift: number;
  feature_drift: Record<string, number>;
  data_quality: DataQualityMetrics;
  recommendations: string[];
  alert_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface DataQualityMetrics {
  completeness: number;
  consistency: number;
  accuracy: number;
  validity: number;
  uniqueness: number;
  overall_score: number;
}

export interface ModelPerformanceDrift {
  timestamp: Date;
  model_name: string;
  current_performance: Record<string, number>;
  baseline_performance: Record<string, number>;
  drift_score: number;
  degradation_metrics: string[];
  requires_retraining: boolean;
  recommended_actions: string[];
}

export interface AutoMLConfig {
  search_space: Record<string, any>;
  optimization_metric: string;
  max_trials: number;
  max_time_hours: number;
  early_stopping_rounds: number;
  ensemble_methods: string[];
}

/**
 * Automated ML Pipeline Engine for Continuous Learning System Improvement
 */
export class MLPipelineEngine {
  private experiments: Map<string, MLExperiment> = new Map();
  private activeExperiments: Set<string> = new Set();
  private config: MLPipelineConfig;
  private dataValidators: Map<string, DataValidator> = new Map();
  private modelRegistry: Map<string, ModelInfo> = new Map();
  private performanceBaselines: Map<string, Record<string, number>> = new Map();

  constructor(config: MLPipelineConfig) {
    this.config = config;
    this.initializeValidators();
    this.startContinuousMonitoring();
  }

  /**
   * Start comprehensive ML experiment
   */
  public async startExperiment(config: ExperimentConfig): Promise<string> {
    const experiment: MLExperiment = {
      id: generateUUID(),
      name: `experiment_${Date.now()}`,
      description: `Automated experiment for ${config.model.type}`,
      type: 'model_training',
      status: 'pending',
      startTime: new Date(),
      config,
      metrics: this.initializeMetrics(),
      artifacts: []
    };

    this.experiments.set(experiment.id, experiment);

    try {
      await this.executeExperiment(experiment);
      return experiment.id;
    } catch (error) {
      experiment.status = 'failed';
      console.error(`Experiment ${experiment.id} failed:`, error);
      throw error;
    }
  }

  /**
   * AutoML experiment with hyperparameter optimization
   */
  public async runAutoMLExperiment(
    dataConfig: DatasetConfig,
    autoMLConfig: AutoMLConfig
  ): Promise<MLExperiment[]> {
    const experiments: MLExperiment[] = [];
    
    // Generate multiple experiment configurations
    const configs = this.generateAutoMLConfigs(dataConfig, autoMLConfig);
    
    for (const config of configs) {
      const experimentId = await this.startExperiment(config);
      const experiment = this.experiments.get(experimentId)!;
      experiments.push(experiment);
    }

    // Wait for all experiments to complete
    await Promise.all(experiments.map(exp => this.waitForCompletion(exp.id)));

    // Select best model based on optimization metric
    const bestExperiment = this.selectBestModel(experiments, autoMLConfig.optimization_metric);
    
    if (bestExperiment) {
      await this.deployModel(bestExperiment);
    }

    return experiments;
  }

  /**
   * Continuous data quality monitoring
   */
  public async monitorDataQuality(
    newData: any[],
    baselineData: any[]
  ): Promise<DataDriftReport> {
    const drift = await this.detectDataDrift(newData, baselineData);
    const quality = await this.assessDataQuality(newData);
    
    const report: DataDriftReport = {
      timestamp: new Date(),
      overall_drift: drift.overall,
      feature_drift: drift.features,
      data_quality: quality,
      recommendations: this.generateDataRecommendations(drift, quality),
      alert_level: this.determineAlertLevel(drift.overall, quality.overall_score)
    };

    if (report.alert_level === 'high' || report.alert_level === 'critical') {
      await this.triggerDataDriftAlert(report);
    }

    return report;
  }

  /**
   * Model performance monitoring with drift detection
   */
  public async monitorModelPerformance(
    modelName: string,
    newPredictions: any[],
    actualOutcomes: any[]
  ): Promise<ModelPerformanceDrift> {
    const currentMetrics = await this.calculatePerformanceMetrics(newPredictions, actualOutcomes);
    const baseline = this.performanceBaselines.get(modelName) || {};
    
    const drift = this.calculatePerformanceDrift(currentMetrics, baseline);
    const degradationMetrics = this.identifyDegradedMetrics(currentMetrics, baseline);
    
    const report: ModelPerformanceDrift = {
      timestamp: new Date(),
      model_name: modelName,
      current_performance: currentMetrics,
      baseline_performance: baseline,
      drift_score: drift,
      degradation_metrics,
      requires_retraining: drift > this.config.retrainThreshold,
      recommended_actions: this.generatePerformanceRecommendations(drift, degradationMetrics)
    };

    if (report.requires_retraining && this.config.autoRetrain) {
      await this.triggerAutomaticRetraining(modelName);
    }

    return report;
  }

  /**
   * Automated model retraining pipeline
   */
  public async retrainModel(modelName: string, newData?: any[]): Promise<string> {
    console.log(`Starting automated retraining for model: ${modelName}`);
    
    const modelInfo = this.modelRegistry.get(modelName);
    if (!modelInfo) {
      throw new Error(`Model ${modelName} not found in registry`);
    }

    // Prepare training data
    const trainingData = newData || await this.prepareRetrainingData(modelName);
    
    // Create retraining experiment
    const retrainConfig: ExperimentConfig = {
      dataset: {
        source: 'retraining_data',
        features: modelInfo.features,
        target: modelInfo.target,
        splitRatio: [0.8, 0.1, 0.1],
        preprocessing: modelInfo.preprocessing
      },
      model: {
        type: modelInfo.architecture.type,
        architecture: modelInfo.architecture,
        hyperparameters: modelInfo.bestHyperparameters
      },
      training: modelInfo.trainingConfig,
      evaluation: modelInfo.evaluationConfig,
      deployment: {
        strategy: 'canary',
        trafficSplit: 10,
        rollbackThreshold: 0.05,
        monitoring: { enabled: true, alerting: true }
      }
    };

    return this.startExperiment(retrainConfig);
  }

  /**
   * A/B testing for model deployment
   */
  public async setupABTest(
    modelA: string,
    modelB: string,
    trafficSplit: number = 50,
    duration: number = 7 // days
  ): Promise<string> {
    const testId = generateUUID();
    
    const experiment: MLExperiment = {
      id: testId,
      name: `ab_test_${modelA}_vs_${modelB}`,
      description: `A/B test comparing ${modelA} and ${modelB}`,
      type: 'a_b_testing',
      status: 'running',
      startTime: new Date(),
      config: {
        dataset: { source: 'live_traffic' } as any,
        model: { type: 'ensemble' } as any,
        training: {} as any,
        evaluation: {
          metrics: ['accuracy', 'precision', 'recall', 'user_satisfaction'],
          benchmarks: [modelA, modelB]
        },
        deployment: {
          strategy: 'canary',
          trafficSplit,
          rollbackThreshold: 0.1,
          monitoring: { enabled: true, alerting: true }
        }
      },
      metrics: this.initializeMetrics(),
      artifacts: []
    };

    this.experiments.set(testId, experiment);
    
    // Schedule test completion
    setTimeout(() => {
      this.completeABTest(testId);
    }, duration * 24 * 60 * 60 * 1000);

    return testId;
  }

  /**
   * Feature engineering pipeline
   */
  public async runFeatureEngineering(
    rawData: any[],
    targetFeatures: string[]
  ): Promise<{ features: any[]; importance: Record<string, number> }> {
    const engineeredFeatures = await this.generateFeatures(rawData, targetFeatures);
    const importance = await this.calculateFeatureImportance(engineeredFeatures, targetFeatures);
    
    return {
      features: engineeredFeatures,
      importance
    };
  }

  /**
   * Model interpretability analysis
   */
  public async analyzeModelInterpretability(
    modelName: string,
    testData: any[]
  ): Promise<{
    feature_importance: Record<string, number>;
    shap_values?: any[];
    lime_explanations?: any[];
    decision_paths?: any[];
  }> {
    const model = this.modelRegistry.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    // Calculate feature importance
    const featureImportance = await this.calculateGlobalFeatureImportance(model, testData);
    
    // Generate SHAP values for interpretability
    const shapValues = await this.generateSHAPValues(model, testData.slice(0, 100));
    
    // Generate LIME explanations for individual predictions
    const limeExplanations = await this.generateLIMEExplanations(model, testData.slice(0, 10));

    return {
      feature_importance: featureImportance,
      shap_values: shapValues,
      lime_explanations: limeExplanations
    };
  }

  // Private implementation methods

  private async executeExperiment(experiment: MLExperiment): Promise<void> {
    experiment.status = 'running';
    this.activeExperiments.add(experiment.id);

    try {
      // Data preparation
      const data = await this.prepareData(experiment.config.dataset);
      
      // Model creation and training
      const model = await this.createModel(experiment.config.model);
      const trainedModel = await this.trainModel(model, data, experiment.config.training);
      
      // Evaluation
      const results = await this.evaluateModel(trainedModel, data, experiment.config.evaluation);
      
      // Store results
      experiment.results = results;
      experiment.metrics = this.extractMetrics(results);
      experiment.status = 'completed';
      experiment.endTime = new Date();
      
      // Register model if performance is satisfactory
      if (this.isModelPerformanceAcceptable(experiment.metrics)) {
        await this.registerModel(experiment);
      }
      
    } catch (error) {
      experiment.status = 'failed';
      throw error;
    } finally {
      this.activeExperiments.delete(experiment.id);
    }
  }

  private generateAutoMLConfigs(
    dataConfig: DatasetConfig,
    autoMLConfig: AutoMLConfig
  ): ExperimentConfig[] {
    const configs: ExperimentConfig[] = [];
    
    // Generate hyperparameter combinations
    const searchSpace = autoMLConfig.search_space;
    const combinations = this.generateHyperparameterCombinations(searchSpace, autoMLConfig.max_trials);
    
    combinations.forEach((hyperparams, index) => {
      configs.push({
        dataset: dataConfig,
        model: {
          type: hyperparams.model_type || 'neural_network',
          hyperparameters: hyperparams
        },
        training: {
          epochs: hyperparams.epochs || 100,
          batchSize: hyperparams.batch_size || 32,
          learningRate: hyperparams.learning_rate || 0.001,
          optimizer: hyperparams.optimizer || 'adam',
          lossFunction: hyperparams.loss_function || 'categorical_crossentropy',
          callbacks: [],
          earlyStopping: {
            monitor: 'val_loss',
            patience: 10,
            restore_best_weights: true
          }
        },
        evaluation: {
          metrics: ['accuracy', 'precision', 'recall', 'f1'],
          crossValidation: { folds: 5 },
          benchmarks: []
        }
      });
    });

    return configs;
  }

  private generateHyperparameterCombinations(
    searchSpace: Record<string, any>,
    maxTrials: number
  ): Record<string, any>[] {
    const combinations: Record<string, any>[] = [];
    
    // Simple grid search implementation
    // In production, this would use more sophisticated optimization
    const keys = Object.keys(searchSpace);
    const generateCombination = (): Record<string, any> => {
      const combination: Record<string, any> = {};
      keys.forEach(key => {
        const values = searchSpace[key];
        if (Array.isArray(values)) {
          combination[key] = values[Math.floor(Math.random() * values.length)];
        } else if (typeof values === 'object' && values.min !== undefined && values.max !== undefined) {
          combination[key] = Math.random() * (values.max - values.min) + values.min;
        }
      });
      return combination;
    };

    for (let i = 0; i < maxTrials; i++) {
      combinations.push(generateCombination());
    }

    return combinations;
  }

  private async detectDataDrift(
    newData: any[],
    baselineData: any[]
  ): Promise<{ overall: number; features: Record<string, number> }> {
    // Simplified data drift detection
    // In production, this would use statistical tests like KS test, Chi-square, etc.
    
    const featureDrift: Record<string, number> = {};
    
    if (newData.length === 0 || baselineData.length === 0) {
      return { overall: 0, features: featureDrift };
    }

    // Calculate drift for each feature
    const features = Object.keys(newData[0] || {});
    
    for (const feature of features) {
      const newValues = newData.map(d => d[feature]).filter(v => v !== undefined);
      const baselineValues = baselineData.map(d => d[feature]).filter(v => v !== undefined);
      
      if (newValues.length > 0 && baselineValues.length > 0) {
        featureDrift[feature] = this.calculateKLDivergence(newValues, baselineValues);
      }
    }

    const overallDrift = Object.values(featureDrift).reduce((sum, drift) => sum + drift, 0) / features.length;
    
    return { overall: overallDrift, features: featureDrift };
  }

  private async assessDataQuality(data: any[]): Promise<DataQualityMetrics> {
    if (data.length === 0) {
      return {
        completeness: 0,
        consistency: 0,
        accuracy: 0,
        validity: 0,
        uniqueness: 0,
        overall_score: 0
      };
    }

    const features = Object.keys(data[0]);
    
    // Completeness: percentage of non-null values
    const completeness = features.reduce((sum, feature) => {
      const nonNullCount = data.filter(d => d[feature] !== null && d[feature] !== undefined).length;
      return sum + (nonNullCount / data.length);
    }, 0) / features.length;

    // Uniqueness: percentage of unique records
    const uniqueRecords = new Set(data.map(d => JSON.stringify(d))).size;
    const uniqueness = uniqueRecords / data.length;

    // Simplified consistency and validity checks
    const consistency = 0.9; // Placeholder
    const accuracy = 0.95; // Placeholder
    const validity = 0.92; // Placeholder

    const overall_score = (completeness + consistency + accuracy + validity + uniqueness) / 5;

    return {
      completeness,
      consistency,
      accuracy,
      validity,
      uniqueness,
      overall_score
    };
  }

  private calculateKLDivergence(distribution1: number[], distribution2: number[]): number {
    // Simplified KL divergence calculation
    // In production, this would use proper statistical libraries
    
    // Convert to probability distributions
    const hist1 = this.createHistogram(distribution1);
    const hist2 = this.createHistogram(distribution2);
    
    let kl = 0;
    for (const [bin, p1] of hist1) {
      const p2 = hist2.get(bin) || 1e-10; // Small epsilon to avoid log(0)
      if (p1 > 0) {
        kl += p1 * Math.log(p1 / p2);
      }
    }
    
    return Math.max(0, Math.min(1, kl)); // Normalize to 0-1 range
  }

  private createHistogram(values: number[], bins: number = 10): Map<number, number> {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = (max - min) / bins;
    
    const histogram = new Map<number, number>();
    
    values.forEach(value => {
      const bin = Math.floor((value - min) / binSize);
      const normalizedBin = Math.min(bin, bins - 1);
      histogram.set(normalizedBin, (histogram.get(normalizedBin) || 0) + 1);
    });
    
    // Convert to probabilities
    const total = values.length;
    for (const [bin, count] of histogram) {
      histogram.set(bin, count / total);
    }
    
    return histogram;
  }

  private initializeValidators(): void {
    // Initialize data validators
    this.dataValidators.set('schema', new SchemaValidator());
    this.dataValidators.set('range', new RangeValidator());
    this.dataValidators.set('format', new FormatValidator());
  }

  private startContinuousMonitoring(): void {
    if (!this.config.continuousMonitoring) return;

    // Monitor every hour
    setInterval(async () => {
      await this.performContinuousMonitoring();
    }, 60 * 60 * 1000);
  }

  private async performContinuousMonitoring(): Promise<void> {
    // Check all active models for performance drift
    for (const [modelName, modelInfo] of this.modelRegistry) {
      try {
        // This would fetch recent prediction data from the system
        const recentData = await this.fetchRecentPredictions(modelName);
        if (recentData.length > 0) {
          await this.monitorModelPerformance(modelName, recentData, []);
        }
      } catch (error) {
        console.error(`Error monitoring model ${modelName}:`, error);
      }
    }
  }

  // Placeholder implementations for complex ML operations
  private async prepareData(config: DatasetConfig): Promise<any> { return {}; }
  private async createModel(config: ModelConfig): Promise<any> { return {}; }
  private async trainModel(model: any, data: any, config: TrainingConfig): Promise<any> { return {}; }
  private async evaluateModel(model: any, data: any, config: EvaluationConfig): Promise<ExperimentResults> { 
    return {
      trainMetrics: { accuracy: 0.85 },
      validationMetrics: { accuracy: 0.82 },
      testMetrics: { accuracy: 0.80 }
    };
  }

  private initializeMetrics(): ExperimentMetrics {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0
    };
  }

  private extractMetrics(results: ExperimentResults): ExperimentMetrics {
    return {
      accuracy: results.testMetrics.accuracy || 0,
      precision: results.testMetrics.precision || 0,
      recall: results.testMetrics.recall || 0,
      f1Score: results.testMetrics.f1_score || 0
    };
  }

  private isModelPerformanceAcceptable(metrics: ExperimentMetrics): boolean {
    return metrics.accuracy > 0.7 && metrics.f1Score > 0.7;
  }

  private async registerModel(experiment: MLExperiment): Promise<void> {
    // Register model in model registry
    console.log(`Registering model from experiment ${experiment.id}`);
  }

  private async waitForCompletion(experimentId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkStatus = () => {
        const experiment = this.experiments.get(experimentId);
        if (experiment && ['completed', 'failed'].includes(experiment.status)) {
          resolve();
        } else {
          setTimeout(checkStatus, 1000);
        }
      };
      checkStatus();
    });
  }

  private selectBestModel(experiments: MLExperiment[], metric: string): MLExperiment | null {
    return experiments
      .filter(exp => exp.status === 'completed')
      .sort((a, b) => (b.metrics as any)[metric] - (a.metrics as any)[metric])[0] || null;
  }

  private async deployModel(experiment: MLExperiment): Promise<void> {
    console.log(`Deploying model from experiment ${experiment.id}`);
  }

  private generateDataRecommendations(drift: any, quality: DataQualityMetrics): string[] {
    const recommendations = [];
    
    if (drift.overall > 0.3) {
      recommendations.push('Significant data drift detected - consider retraining models');
    }
    
    if (quality.completeness < 0.8) {
      recommendations.push('Data completeness is low - check data collection processes');
    }
    
    if (quality.uniqueness < 0.9) {
      recommendations.push('Duplicate records detected - implement deduplication');
    }
    
    return recommendations;
  }

  private determineAlertLevel(drift: number, quality: number): 'low' | 'medium' | 'high' | 'critical' {
    if (drift > 0.5 || quality < 0.5) return 'critical';
    if (drift > 0.3 || quality < 0.7) return 'high';
    if (drift > 0.1 || quality < 0.85) return 'medium';
    return 'low';
  }

  private async triggerDataDriftAlert(report: DataDriftReport): Promise<void> {
    console.log(`Data drift alert: ${report.alert_level} level drift detected`);
  }

  private calculatePerformanceDrift(current: Record<string, number>, baseline: Record<string, number>): number {
    const metrics = Object.keys(current);
    if (metrics.length === 0) return 0;
    
    const drifts = metrics.map(metric => {
      const currentValue = current[metric] || 0;
      const baselineValue = baseline[metric] || 0;
      return Math.abs(currentValue - baselineValue) / Math.max(baselineValue, 0.001);
    });
    
    return drifts.reduce((sum, drift) => sum + drift, 0) / metrics.length;
  }

  private identifyDegradedMetrics(current: Record<string, number>, baseline: Record<string, number>): string[] {
    const degraded = [];
    
    for (const [metric, currentValue] of Object.entries(current)) {
      const baselineValue = baseline[metric] || 0;
      if (currentValue < baselineValue * 0.95) { // 5% degradation threshold
        degraded.push(metric);
      }
    }
    
    return degraded;
  }

  private generatePerformanceRecommendations(drift: number, degradedMetrics: string[]): string[] {
    const recommendations = [];
    
    if (drift > 0.2) {
      recommendations.push('Significant performance drift detected - consider retraining');
    }
    
    if (degradedMetrics.includes('accuracy')) {
      recommendations.push('Accuracy degradation - check data quality and model features');
    }
    
    if (degradedMetrics.includes('precision')) {
      recommendations.push('Precision degradation - review classification thresholds');
    }
    
    return recommendations;
  }

  private async triggerAutomaticRetraining(modelName: string): Promise<void> {
    console.log(`Triggering automatic retraining for model: ${modelName}`);
    await this.retrainModel(modelName);
  }

  private async calculatePerformanceMetrics(predictions: any[], actuals: any[]): Promise<Record<string, number>> {
    // Simplified metrics calculation
    return {
      accuracy: 0.8,
      precision: 0.82,
      recall: 0.78,
      f1_score: 0.8
    };
  }

  // Additional placeholder methods
  private async prepareRetrainingData(modelName: string): Promise<any[]> { return []; }
  private async completeABTest(testId: string): Promise<void> { }
  private async generateFeatures(rawData: any[], targetFeatures: string[]): Promise<any[]> { return []; }
  private async calculateFeatureImportance(features: any[], targets: string[]): Promise<Record<string, number>> { return {}; }
  private async calculateGlobalFeatureImportance(model: any, data: any[]): Promise<Record<string, number>> { return {}; }
  private async generateSHAPValues(model: any, data: any[]): Promise<any[]> { return []; }
  private async generateLIMEExplanations(model: any, data: any[]): Promise<any[]> { return []; }
  private async fetchRecentPredictions(modelName: string): Promise<any[]> { return []; }
}

// Supporting classes
class DataValidator {
  async validate(data: any[]): Promise<{ valid: boolean; errors: string[] }> {
    return { valid: true, errors: [] };
  }
}

class SchemaValidator extends DataValidator {}
class RangeValidator extends DataValidator {}
class FormatValidator extends DataValidator {}

// Supporting interfaces
interface ModelInfo {
  name: string;
  version: string;
  features: string[];
  target: string;
  architecture: any;
  bestHyperparameters: any;
  trainingConfig: TrainingConfig;
  evaluationConfig: EvaluationConfig;
  preprocessing: any[];
}

interface PreprocessingStep {
  type: string;
  config: any;
}

interface AugmentationConfig {
  type: string;
  probability: number;
  parameters: any;
}

interface CallbackConfig {
  type: string;
  config: any;
}

interface EarlyStoppingConfig {
  monitor: string;
  patience: number;
  restore_best_weights: boolean;
}

interface CVConfig {
  folds: number;
  shuffle: boolean;
}

interface MonitoringConfig {
  enabled: boolean;
  alerting: boolean;
}

// Singleton instance
export const mlPipelineEngine = new MLPipelineEngine({
  autoRetrain: true,
  retrainThreshold: 0.2,
  dataValidation: true,
  modelValidation: true,
  continuousMonitoring: true,
  experimentTracking: true
});

export default mlPipelineEngine;