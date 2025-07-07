// Cost monitoring and optimization service
import logger from '../logger';
import { metricsUtils } from '../metrics';

export interface CostMetrics {
  provider: string;
  service: string;
  region: string;
  resourceId: string;
  cost: number;
  currency: string;
  billingPeriod: string;
  timestamp: string;
}

export interface CostAlert {
  id: string;
  type: 'threshold' | 'anomaly' | 'budget';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  cost: number;
  threshold: number;
  provider: string;
  service: string;
  timestamp: string;
}

export interface CostBudget {
  name: string;
  amount: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly';
  alerts: number[];
}

// Cost thresholds configuration
const costThresholds = {
  compute: {
    daily: parseFloat(process.env.COMPUTE_DAILY_THRESHOLD || '50'),
    monthly: parseFloat(process.env.COMPUTE_MONTHLY_THRESHOLD || '1000'),
  },
  database: {
    daily: parseFloat(process.env.DATABASE_DAILY_THRESHOLD || '30'),
    monthly: parseFloat(process.env.DATABASE_MONTHLY_THRESHOLD || '500'),
  },
  storage: {
    daily: parseFloat(process.env.STORAGE_DAILY_THRESHOLD || '10'),
    monthly: parseFloat(process.env.STORAGE_MONTHLY_THRESHOLD || '200'),
  },
  network: {
    daily: parseFloat(process.env.NETWORK_DAILY_THRESHOLD || '20'),
    monthly: parseFloat(process.env.NETWORK_MONTHLY_THRESHOLD || '300'),
  },
  monitoring: {
    daily: parseFloat(process.env.MONITORING_DAILY_THRESHOLD || '15'),
    monthly: parseFloat(process.env.MONITORING_MONTHLY_THRESHOLD || '250'),
  },
  total: {
    daily: parseFloat(process.env.TOTAL_DAILY_THRESHOLD || '100'),
    monthly: parseFloat(process.env.TOTAL_MONTHLY_THRESHOLD || '2000'),
  },
};

// Cost budgets
const costBudgets: CostBudget[] = [
  {
    name: 'Monthly Infrastructure Budget',
    amount: 2000,
    currency: 'USD',
    period: 'monthly',
    alerts: [50, 80, 90, 100], // Alert at 50%, 80%, 90%, and 100% of budget
  },
  {
    name: 'Daily Operations Budget',
    amount: 100,
    currency: 'USD',
    period: 'daily',
    alerts: [80, 90, 100],
  },
];

// Cost tracking state
const costState = {
  dailyCosts: new Map<string, number>(),
  monthlyCosts: new Map<string, number>(),
  alerts: [] as CostAlert[],
  lastOptimizationCheck: Date.now(),
};

// AWS cost monitoring
export const awsCostMonitoring = {
  trackEC2Cost: (instanceId: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'aws',
      service: 'ec2',
      region,
      resourceId: instanceId,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackRDSCost: (instanceId: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'aws',
      service: 'rds',
      region,
      resourceId: instanceId,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackS3Cost: (bucketName: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'aws',
      service: 's3',
      region,
      resourceId: bucketName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackLambdaCost: (functionName: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'aws',
      service: 'lambda',
      region,
      resourceId: functionName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },
};

// Azure cost monitoring
export const azureCostMonitoring = {
  trackVMCost: (vmName: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'azure',
      service: 'vm',
      region,
      resourceId: vmName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackSQLDatabaseCost: (databaseName: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'azure',
      service: 'sql',
      region,
      resourceId: databaseName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackStorageCost: (accountName: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'azure',
      service: 'storage',
      region,
      resourceId: accountName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },
};

// GCP cost monitoring
export const gcpCostMonitoring = {
  trackComputeCost: (instanceName: string, cost: number, zone: string) => {
    const metric: CostMetrics = {
      provider: 'gcp',
      service: 'compute',
      region: zone,
      resourceId: instanceName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackCloudSQLCost: (instanceName: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'gcp',
      service: 'cloudsql',
      region,
      resourceId: instanceName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackCloudStorageCost: (bucketName: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'gcp',
      service: 'storage',
      region,
      resourceId: bucketName,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },
};

// Digital Ocean cost monitoring
export const digitalOceanCostMonitoring = {
  trackDropletCost: (dropletId: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'digitalocean',
      service: 'droplet',
      region,
      resourceId: dropletId,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackDatabaseCost: (databaseId: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'digitalocean',
      service: 'database',
      region,
      resourceId: databaseId,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },

  trackVolumesCost: (volumeId: string, cost: number, region: string) => {
    const metric: CostMetrics = {
      provider: 'digitalocean',
      service: 'volumes',
      region,
      resourceId: volumeId,
      cost,
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(metric);
  },
};

// Core cost monitoring service
export const costMonitoring = {
  trackCost: (metric: CostMetrics) => {
    logger.info('Cost tracked', metric);
    
    // Track in metrics
    metricsUtils.recordError(`cost_${metric.provider}_${metric.service}`, 'info', 'cost');
    
    // Update state
    const key = `${metric.provider}_${metric.service}`;
    const currentDaily = costState.dailyCosts.get(key) || 0;
    const currentMonthly = costState.monthlyCosts.get(key) || 0;
    
    costState.dailyCosts.set(key, currentDaily + metric.cost);
    costState.monthlyCosts.set(key, currentMonthly + metric.cost);
    
    // Check thresholds
    costMonitoring.checkThresholds(metric);
    
    // Check budgets
    costMonitoring.checkBudgets();
  },

  checkThresholds: (metric: CostMetrics) => {
    const serviceThresholds = costThresholds[metric.service as keyof typeof costThresholds];
    if (!serviceThresholds) return;

    const key = `${metric.provider}_${metric.service}`;
    const dailyCost = costState.dailyCosts.get(key) || 0;
    const monthlyCost = costState.monthlyCosts.get(key) || 0;

    // Check daily threshold
    if (dailyCost > serviceThresholds.daily) {
      costMonitoring.createAlert({
        id: `${key}_daily_${Date.now()}`,
        type: 'threshold',
        severity: dailyCost > serviceThresholds.daily * 1.5 ? 'critical' : 'warning',
        message: `Daily cost threshold exceeded for ${metric.service} on ${metric.provider}`,
        cost: dailyCost,
        threshold: serviceThresholds.daily,
        provider: metric.provider,
        service: metric.service,
        timestamp: new Date().toISOString(),
      });
    }

    // Check monthly threshold
    if (monthlyCost > serviceThresholds.monthly) {
      costMonitoring.createAlert({
        id: `${key}_monthly_${Date.now()}`,
        type: 'threshold',
        severity: monthlyCost > serviceThresholds.monthly * 1.5 ? 'critical' : 'warning',
        message: `Monthly cost threshold exceeded for ${metric.service} on ${metric.provider}`,
        cost: monthlyCost,
        threshold: serviceThresholds.monthly,
        provider: metric.provider,
        service: metric.service,
        timestamp: new Date().toISOString(),
      });
    }
  },

  checkBudgets: () => {
    const totalDailyCost = Array.from(costState.dailyCosts.values()).reduce((sum, cost) => sum + cost, 0);
    const totalMonthlyCost = Array.from(costState.monthlyCosts.values()).reduce((sum, cost) => sum + cost, 0);

    costBudgets.forEach(budget => {
      const currentCost = budget.period === 'daily' ? totalDailyCost : totalMonthlyCost;
      const percentage = (currentCost / budget.amount) * 100;

      budget.alerts.forEach(alertThreshold => {
        if (percentage >= alertThreshold) {
          costMonitoring.createAlert({
            id: `budget_${budget.name}_${alertThreshold}_${Date.now()}`,
            type: 'budget',
            severity: alertThreshold >= 90 ? 'critical' : alertThreshold >= 80 ? 'warning' : 'info',
            message: `Budget alert: ${budget.name} is at ${percentage.toFixed(1)}% (${alertThreshold}% threshold)`,
            cost: currentCost,
            threshold: budget.amount * (alertThreshold / 100),
            provider: 'all',
            service: 'budget',
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
  },

  createAlert: (alert: CostAlert) => {
    // Prevent duplicate alerts
    const existingAlert = costState.alerts.find(a => 
      a.type === alert.type && 
      a.provider === alert.provider && 
      a.service === alert.service &&
      Date.now() - new Date(a.timestamp).getTime() < 3600000 // 1 hour
    );

    if (existingAlert) return;

    costState.alerts.push(alert);
    
    logger.warn('Cost alert created', alert);

    // Keep only last 100 alerts
    if (costState.alerts.length > 100) {
      costState.alerts = costState.alerts.slice(-100);
    }
  },

  getCostSummary: () => {
    const totalDaily = Array.from(costState.dailyCosts.values()).reduce((sum, cost) => sum + cost, 0);
    const totalMonthly = Array.from(costState.monthlyCosts.values()).reduce((sum, cost) => sum + cost, 0);

    return {
      daily: {
        total: totalDaily,
        breakdown: Object.fromEntries(costState.dailyCosts.entries()),
      },
      monthly: {
        total: totalMonthly,
        breakdown: Object.fromEntries(costState.monthlyCosts.entries()),
      },
      alerts: costState.alerts.filter(alert => 
        Date.now() - new Date(alert.timestamp).getTime() < 86400000 // Last 24 hours
      ),
      budgets: costBudgets.map(budget => ({
        name: budget.name,
        amount: budget.amount,
        currency: budget.currency,
        period: budget.period,
        current: budget.period === 'daily' ? totalDaily : totalMonthly,
        percentage: budget.period === 'daily' 
          ? (totalDaily / budget.amount) * 100 
          : (totalMonthly / budget.amount) * 100,
      })),
    };
  },

  getOptimizationRecommendations: () => {
    const recommendations = [];

    // Check for high-cost services
    const sortedCosts = Array.from(costState.dailyCosts.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedCosts.slice(0, 5).forEach(([service, cost]) => {
      if (cost > 20) {
        recommendations.push({
          type: 'cost_optimization',
          service,
          message: `${service} has high daily cost ($${cost.toFixed(2)}). Consider optimizing or scaling down.`,
          priority: cost > 50 ? 'high' : 'medium',
          estimatedSavings: cost * 0.2, // Estimated 20% savings
        });
      }
    });

    // Generic recommendations
    recommendations.push({
      type: 'scheduled_scaling',
      message: 'Consider implementing scheduled scaling for non-production environments',
      priority: 'medium',
      estimatedSavings: 30,
    });

    recommendations.push({
      type: 'reserved_instances',
      message: 'Consider reserved instances for predictable workloads',
      priority: 'low',
      estimatedSavings: 50,
    });

    return recommendations;
  },

  resetDailyCosts: () => {
    costState.dailyCosts.clear();
    logger.info('Daily costs reset');
  },

  resetMonthlyCosts: () => {
    costState.monthlyCosts.clear();
    logger.info('Monthly costs reset');
  },
};

// Periodic cost optimization check
if (typeof setInterval !== 'undefined') {
  // Check cost optimization every 6 hours
  setInterval(() => {
    const now = Date.now();
    if (now - costState.lastOptimizationCheck > 6 * 60 * 60 * 1000) {
      costState.lastOptimizationCheck = now;
      const recommendations = costMonitoring.getOptimizationRecommendations();
      
      if (recommendations.length > 0) {
        logger.info('Cost optimization recommendations available', {
          count: recommendations.length,
          recommendations: recommendations.slice(0, 3), // Log first 3
        });
      }
    }
  }, 60 * 60 * 1000); // Check every hour
}

export default {
  awsCostMonitoring,
  azureCostMonitoring,
  gcpCostMonitoring,
  digitalOceanCostMonitoring,
  costMonitoring,
};