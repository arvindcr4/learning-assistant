'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';

export interface PerformanceBudget {
  id: string;
  metric: string;
  threshold: number;
  current: number;
  status: 'good' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}

export interface PerformanceBudgetConfig {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  totalBlockingTime: number;
  speedIndex: number;
  memoryUsage: number;
  bundleSize: number;
  renderTime: number;
}

interface PerformanceBudgetMonitorProps {
  budgets: PerformanceBudgetConfig;
  onBudgetExceeded?: (budget: PerformanceBudget) => void;
  onBudgetWarning?: (budget: PerformanceBudget) => void;
  alertThreshold?: number;
  warningThreshold?: number;
}

export const PerformanceBudgetMonitor: React.FC<PerformanceBudgetMonitorProps> = ({
  budgets,
  onBudgetExceeded,
  onBudgetWarning,
  alertThreshold = 0.9,
  warningThreshold = 0.75
}) => {
  const [performanceBudgets, setPerformanceBudgets] = useState<PerformanceBudget[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const { getMetrics } = usePerformanceMonitoring();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const historicalDataRef = useRef<Map<string, number[]>>(new Map());

  const defaultBudgets: PerformanceBudgetConfig = {
    firstContentfulPaint: 2000,
    largestContentfulPaint: 4000,
    firstInputDelay: 100,
    cumulativeLayoutShift: 0.1,
    timeToInteractive: 5000,
    totalBlockingTime: 300,
    speedIndex: 4000,
    memoryUsage: 50 * 1024 * 1024, // 50MB
    bundleSize: 250 * 1024, // 250KB
    renderTime: 16 // 16ms for 60fps
  };

  const getBudgetStatus = (current: number, threshold: number): 'good' | 'warning' | 'critical' => {
    const ratio = current / threshold;
    if (ratio <= warningThreshold) return 'good';
    if (ratio <= alertThreshold) return 'warning';
    return 'critical';
  };

  const getTrend = (metricName: string, currentValue: number): 'improving' | 'stable' | 'declining' => {
    const history = historicalDataRef.current.get(metricName) || [];
    if (history.length < 3) return 'stable';

    const recent = history.slice(-3);
    const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const change = (currentValue - avg) / avg;

    if (change < -0.1) return 'improving';
    if (change > 0.1) return 'declining';
    return 'stable';
  };

  const updateHistoricalData = (metricName: string, value: number) => {
    const history = historicalDataRef.current.get(metricName) || [];
    history.push(value);
    if (history.length > 10) {
      history.shift();
    }
    historicalDataRef.current.set(metricName, history);
  };

  const collectWebVitals = useCallback(() => {
    const metrics = getMetrics();
    const newBudgets: PerformanceBudget[] = [];

    // Core Web Vitals
    if (metrics.firstContentfulPaint) {
      const current = metrics.firstContentfulPaint;
      const threshold = budgets.firstContentfulPaint || defaultBudgets.firstContentfulPaint;
      updateHistoricalData('firstContentfulPaint', current);
      
      newBudgets.push({
        id: 'fcp',
        metric: 'First Contentful Paint',
        threshold,
        current,
        status: getBudgetStatus(current, threshold),
        trend: getTrend('firstContentfulPaint', current),
        lastUpdated: new Date()
      });
    }

    if (metrics.largestContentfulPaint) {
      const current = metrics.largestContentfulPaint;
      const threshold = budgets.largestContentfulPaint || defaultBudgets.largestContentfulPaint;
      updateHistoricalData('largestContentfulPaint', current);
      
      newBudgets.push({
        id: 'lcp',
        metric: 'Largest Contentful Paint',
        threshold,
        current,
        status: getBudgetStatus(current, threshold),
        trend: getTrend('largestContentfulPaint', current),
        lastUpdated: new Date()
      });
    }

    if (metrics.firstInputDelay) {
      const current = metrics.firstInputDelay;
      const threshold = budgets.firstInputDelay || defaultBudgets.firstInputDelay;
      updateHistoricalData('firstInputDelay', current);
      
      newBudgets.push({
        id: 'fid',
        metric: 'First Input Delay',
        threshold,
        current,
        status: getBudgetStatus(current, threshold),
        trend: getTrend('firstInputDelay', current),
        lastUpdated: new Date()
      });
    }

    if (metrics.cumulativeLayoutShift >= 0) {
      const current = metrics.cumulativeLayoutShift;
      const threshold = budgets.cumulativeLayoutShift || defaultBudgets.cumulativeLayoutShift;
      updateHistoricalData('cumulativeLayoutShift', current);
      
      newBudgets.push({
        id: 'cls',
        metric: 'Cumulative Layout Shift',
        threshold,
        current,
        status: getBudgetStatus(current, threshold),
        trend: getTrend('cumulativeLayoutShift', current),
        lastUpdated: new Date()
      });
    }

    if (metrics.timeToInteractive) {
      const current = metrics.timeToInteractive;
      const threshold = budgets.timeToInteractive || defaultBudgets.timeToInteractive;
      updateHistoricalData('timeToInteractive', current);
      
      newBudgets.push({
        id: 'tti',
        metric: 'Time to Interactive',
        threshold,
        current,
        status: getBudgetStatus(current, threshold),
        trend: getTrend('timeToInteractive', current),
        lastUpdated: new Date()
      });
    }

    // Memory Usage
    if (metrics.memory && metrics.memory.length > 0) {
      const current = metrics.memory[metrics.memory.length - 1].used;
      const threshold = budgets.memoryUsage || defaultBudgets.memoryUsage;
      updateHistoricalData('memoryUsage', current);
      
      newBudgets.push({
        id: 'memory',
        metric: 'Memory Usage',
        threshold,
        current,
        status: getBudgetStatus(current, threshold),
        trend: getTrend('memoryUsage', current),
        lastUpdated: new Date()
      });
    }

    // Render Performance
    if (metrics.renders && metrics.renders.length > 0) {
      const avgRenderTime = metrics.renders.reduce((sum, render) => sum + render.renderTime, 0) / metrics.renders.length;
      const threshold = budgets.renderTime || defaultBudgets.renderTime;
      updateHistoricalData('renderTime', avgRenderTime);
      
      newBudgets.push({
        id: 'render',
        metric: 'Average Render Time',
        threshold,
        current: avgRenderTime,
        status: getBudgetStatus(avgRenderTime, threshold),
        trend: getTrend('renderTime', avgRenderTime),
        lastUpdated: new Date()
      });
    }

    setPerformanceBudgets(newBudgets);

    // Check for budget violations
    newBudgets.forEach(budget => {
      if (budget.status === 'critical' && onBudgetExceeded) {
        onBudgetExceeded(budget);
      } else if (budget.status === 'warning' && onBudgetWarning) {
        onBudgetWarning(budget);
      }
    });
  }, [budgets, getMetrics, onBudgetExceeded, onBudgetWarning, alertThreshold, warningThreshold]);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    
    setIsMonitoring(true);
    collectWebVitals();
    
    intervalRef.current = setInterval(() => {
      collectWebVitals();
    }, 5000); // Check every 5 seconds
  }, [isMonitoring, collectWebVitals]);

  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;
    
    setIsMonitoring(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isMonitoring]);

  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving':
        return '↗️';
      case 'declining':
        return '↘️';
      case 'stable':
      default:
        return '→';
    }
  };

  const formatValue = (value: number, metric: string) => {
    switch (metric) {
      case 'Memory Usage':
        return `${(value / 1024 / 1024).toFixed(1)}MB`;
      case 'Bundle Size':
        return `${(value / 1024).toFixed(1)}KB`;
      case 'Cumulative Layout Shift':
        return value.toFixed(3);
      default:
        return `${value.toFixed(0)}ms`;
    }
  };

  return (
    <div className="performance-budget-monitor">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Performance Budget Monitor</h3>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          <span className="text-sm text-gray-600">
            {isMonitoring ? 'Monitoring' : 'Stopped'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {performanceBudgets.map((budget) => (
          <div key={budget.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{budget.metric}</span>
              <span className="text-xs text-gray-500">{getTrendIcon(budget.trend)}</span>
            </div>
            
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-lg font-semibold ${getStatusColor(budget.status)}`}>
                  {formatValue(budget.current, budget.metric)}
                </span>
                <span className="text-xs text-gray-500">
                  / {formatValue(budget.threshold, budget.metric)}
                </span>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    budget.status === 'good' ? 'bg-green-500' :
                    budget.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((budget.current / budget.threshold) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="text-xs text-gray-500">
              Last updated: {budget.lastUpdated.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>

      {performanceBudgets.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No performance metrics available yet.</p>
          <p className="text-sm">Start interacting with the app to see budget monitoring.</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceBudgetMonitor;