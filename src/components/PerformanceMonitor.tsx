/**
 * Performance Monitor Component
 * 
 * Displays real-time performance metrics and Core Web Vitals
 */

'use client';

import React, { useState, useEffect } from 'react';
import { performanceMonitor, usePerformanceMonitoring, PERFORMANCE_THRESHOLDS } from '@/lib/performance';
import { Card } from '@/components/ui/Card';

interface PerformanceMonitorProps {
  showDetails?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function PerformanceMonitor({ 
  showDetails = false, 
  autoRefresh = true,
  refreshInterval = 5000 
}: PerformanceMonitorProps) {
  const { performanceData, clearMetrics, getMetrics } = usePerformanceMonitoring();
  const [isVisible, setIsVisible] = useState(false);

  // Show only in development or when explicitly enabled
  useEffect(() => {
    setIsVisible(
      process.env.NODE_ENV === 'development' || 
      process.env.NEXT_PUBLIC_PERFORMANCE_MONITOR === 'true'
    );
  }, []);

  if (!isVisible || !performanceData) {
    return null;
  }

  const { coreWebVitals, resourceMetrics, overallScore, recommendations } = performanceData;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const formatValue = (value: number, unit: string = 'ms') => {
    if (unit === 'ms') {
      return `${Math.round(value)}${unit}`;
    }
    if (unit === 'score') {
      return `${value.toFixed(1)}%`;
    }
    return `${value.toFixed(3)}`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="bg-white/95 backdrop-blur-sm border shadow-lg">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Performance Monitor</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Hide
              </button>
              <button
                onClick={clearMetrics}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Overall Score */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Score</span>
              <span className={`text-lg font-bold ${getScoreColor(overallScore)}`}>
                {formatValue(overallScore, 'score')}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  overallScore >= 90 ? 'bg-green-500' :
                  overallScore >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
          </div>

          {/* Core Web Vitals */}
          <div className="space-y-2 mb-4">
            <h4 className="font-medium text-sm text-gray-700">Core Web Vitals</h4>
            
            {coreWebVitals.lcp && (
              <div className="flex items-center justify-between text-sm">
                <span>LCP (Largest Contentful Paint)</span>
                <div className="text-right">
                  <span className={getRatingColor(coreWebVitals.lcp.rating)}>
                    {formatValue(coreWebVitals.lcp.value)}
                  </span>
                  <div className="text-xs text-gray-500">
                    Goal: &lt;{PERFORMANCE_THRESHOLDS.LCP.GOOD}ms
                  </div>
                </div>
              </div>
            )}

            {coreWebVitals.fid && (
              <div className="flex items-center justify-between text-sm">
                <span>FID (First Input Delay)</span>
                <div className="text-right">
                  <span className={getRatingColor(coreWebVitals.fid.rating)}>
                    {formatValue(coreWebVitals.fid.value)}
                  </span>
                  <div className="text-xs text-gray-500">
                    Goal: &lt;{PERFORMANCE_THRESHOLDS.FID.GOOD}ms
                  </div>
                </div>
              </div>
            )}

            {coreWebVitals.cls && (
              <div className="flex items-center justify-between text-sm">
                <span>CLS (Cumulative Layout Shift)</span>
                <div className="text-right">
                  <span className={getRatingColor(coreWebVitals.cls.rating)}>
                    {formatValue(coreWebVitals.cls.value, '')}
                  </span>
                  <div className="text-xs text-gray-500">
                    Goal: &lt;{PERFORMANCE_THRESHOLDS.CLS.GOOD}
                  </div>
                </div>
              </div>
            )}

            {coreWebVitals.fcp && (
              <div className="flex items-center justify-between text-sm">
                <span>FCP (First Contentful Paint)</span>
                <div className="text-right">
                  <span className={getRatingColor(coreWebVitals.fcp.rating)}>
                    {formatValue(coreWebVitals.fcp.value)}
                  </span>
                  <div className="text-xs text-gray-500">
                    Goal: &lt;{PERFORMANCE_THRESHOLDS.FCP.GOOD}ms
                  </div>
                </div>
              </div>
            )}

            {coreWebVitals.ttfb && (
              <div className="flex items-center justify-between text-sm">
                <span>TTFB (Time to First Byte)</span>
                <div className="text-right">
                  <span className={getRatingColor(coreWebVitals.ttfb.rating)}>
                    {formatValue(coreWebVitals.ttfb.value)}
                  </span>
                  <div className="text-xs text-gray-500">
                    Goal: &lt;{PERFORMANCE_THRESHOLDS.TTFB.GOOD}ms
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resource Metrics */}
          <div className="space-y-2 mb-4">
            <h4 className="font-medium text-sm text-gray-700">Resource Loading</h4>
            <div className="flex items-center justify-between text-sm">
              <span>Total Resources</span>
              <span>{resourceMetrics.total}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Average Load Time</span>
              <span>{formatValue(resourceMetrics.averageLoadTime)}</span>
            </div>
          </div>

          {/* Detailed Metrics */}
          {showDetails && (
            <details className="mb-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                Resource Breakdown
              </summary>
              <div className="space-y-1 text-xs">
                {Object.entries(resourceMetrics.byType).map(([type, metrics]) => (
                  <div key={type} className="flex justify-between">
                    <span className="capitalize">{type}</span>
                    <span>{metrics.length} resources</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-yellow-700 mb-2">
                Recommendations ({recommendations.length})
              </summary>
              <div className="space-y-1">
                {recommendations.map((recommendation, index) => (
                  <div key={index} className="text-xs text-gray-600 p-2 bg-yellow-50 rounded">
                    {recommendation}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </Card>
    </div>
  );
}

// Performance Badge Component
interface PerformanceBadgeProps {
  metric: 'lcp' | 'fid' | 'cls' | 'fcp' | 'ttfb';
  value: number;
  thresholds: { GOOD: number; NEEDS_IMPROVEMENT: number };
  unit?: string;
}

export function PerformanceBadge({ 
  metric, 
  value, 
  thresholds, 
  unit = 'ms' 
}: PerformanceBadgeProps) {
  const getRating = () => {
    if (value <= thresholds.GOOD) return 'good';
    if (value <= thresholds.NEEDS_IMPROVEMENT) return 'needs-improvement';
    return 'poor';
  };

  const rating = getRating();
  const colors = {
    good: 'bg-green-100 text-green-800 border-green-200',
    'needs-improvement': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    poor: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${colors[rating]}`}>
      <span className="uppercase mr-1">{metric}</span>
      <span>
        {unit === 'ms' ? Math.round(value) : value.toFixed(3)}
        {unit}
      </span>
    </div>
  );
}

// Performance Chart Component
export function PerformanceChart() {
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    const updateMetrics = () => {
      const allMetrics = performanceMonitor.getMetrics();
      const recentMetrics = allMetrics.slice(-20); // Last 20 metrics
      setMetrics(recentMetrics);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-32 bg-gray-50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Performance Timeline</h4>
      <div className="flex items-end justify-between h-20 space-x-1">
        {metrics.map((metric, index) => {
          const height = Math.min((metric.value / 5000) * 100, 100); // Scale to max 5000ms
          const color = metric.rating === 'good' ? 'bg-green-400' :
                       metric.rating === 'needs-improvement' ? 'bg-yellow-400' : 'bg-red-400';
          
          return (
            <div
              key={index}
              className={`w-2 ${color} rounded-t`}
              style={{ height: `${height}%` }}
              title={`${metric.name}: ${Math.round(metric.value)}ms`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default PerformanceMonitor;