/**
 * Performance Monitoring Dashboard
 * 
 * Real-time performance monitoring with Core Web Vitals,
 * bundle analysis, CDN metrics, and optimization recommendations.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { useCoreWebVitals } from '../../lib/core-web-vitals-optimizer';
import { useBundleOptimization } from '../../lib/bundle-optimizer';
import { useCDN } from '../../lib/cdn';
import { usePerformanceMonitoring } from '../../lib/performance';

interface PerformanceMetric {
  name: string;
  value: number;
  threshold: number;
  unit: string;
  status: 'good' | 'needs-improvement' | 'poor';
  trend: 'up' | 'down' | 'stable';
}

interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  category: 'lcp' | 'fid' | 'cls' | 'bundle' | 'cdn' | 'cache';
  implemented: boolean;
}

const PerformanceDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'cwv' | 'bundle' | 'cdn' | 'recommendations'>('overview');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { metrics: cwvMetrics, performanceScore, runOptimizations } = useCoreWebVitals();
  const { optimizationReport, isAnalyzing, analyzeBundlePerformance } = useBundleOptimization();
  const { isEnabled: cdnEnabled, metrics: cdnMetrics, activeProvider } = useCDN();
  const { performanceData } = usePerformanceMonitoring();

  // Auto-refresh data
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Refresh performance data
      runOptimizations();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, runOptimizations]);

  // Calculate overall performance score
  const calculateOverallScore = useCallback(() => {
    const scores = [];
    
    if (performanceScore > 0) scores.push(performanceScore);
    if (optimizationReport) scores.push(optimizationReport.overallScore);
    if (cdnEnabled && cdnMetrics.size > 0) {
      const cdnScore = Array.from(cdnMetrics.values())
        .reduce((sum, metric) => sum + metric.successRate, 0) / cdnMetrics.size;
      scores.push(cdnScore);
    }

    return scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  }, [performanceScore, optimizationReport, cdnEnabled, cdnMetrics]);

  // Generate performance metrics array
  const getPerformanceMetrics = useCallback((): PerformanceMetric[] => {
    const metrics: PerformanceMetric[] = [];

    if (cwvMetrics.lcp) {
      metrics.push({
        name: 'LCP',
        value: cwvMetrics.lcp.value,
        threshold: 2500,
        unit: 'ms',
        status: cwvMetrics.lcp.value <= 2500 ? 'good' : cwvMetrics.lcp.value <= 4000 ? 'needs-improvement' : 'poor',
        trend: 'stable',
      });
    }

    if (cwvMetrics.fid) {
      metrics.push({
        name: 'FID',
        value: cwvMetrics.fid.value,
        threshold: 100,
        unit: 'ms',
        status: cwvMetrics.fid.value <= 100 ? 'good' : cwvMetrics.fid.value <= 300 ? 'needs-improvement' : 'poor',
        trend: 'stable',
      });
    }

    if (cwvMetrics.cls) {
      metrics.push({
        name: 'CLS',
        value: cwvMetrics.cls.value,
        threshold: 0.1,
        unit: '',
        status: cwvMetrics.cls.value <= 0.1 ? 'good' : cwvMetrics.cls.value <= 0.25 ? 'needs-improvement' : 'poor',
        trend: 'stable',
      });
    }

    if (cwvMetrics.ttfb) {
      metrics.push({
        name: 'TTFB',
        value: cwvMetrics.ttfb.value,
        threshold: 800,
        unit: 'ms',
        status: cwvMetrics.ttfb.value <= 800 ? 'good' : cwvMetrics.ttfb.value <= 1800 ? 'needs-improvement' : 'poor',
        trend: 'stable',
      });
    }

    return metrics;
  }, [cwvMetrics]);

  // Generate optimization recommendations
  const getRecommendations = useCallback((): OptimizationRecommendation[] => {
    const recommendations: OptimizationRecommendation[] = [];

    // Core Web Vitals recommendations
    if (cwvMetrics.lcp && cwvMetrics.lcp.value > 2500) {
      recommendations.push({
        id: 'lcp-optimization',
        title: 'Optimize Largest Contentful Paint',
        description: 'Improve LCP by optimizing images, preloading critical resources, and reducing server response time.',
        impact: 'high',
        effort: 'medium',
        category: 'lcp',
        implemented: false,
      });
    }

    if (cwvMetrics.fid && cwvMetrics.fid.value > 100) {
      recommendations.push({
        id: 'fid-optimization',
        title: 'Reduce First Input Delay',
        description: 'Improve FID by code splitting, deferring non-critical JavaScript, and using web workers.',
        impact: 'high',
        effort: 'high',
        category: 'fid',
        implemented: false,
      });
    }

    if (cwvMetrics.cls && cwvMetrics.cls.value > 0.1) {
      recommendations.push({
        id: 'cls-optimization',
        title: 'Minimize Cumulative Layout Shift',
        description: 'Reduce CLS by setting image dimensions, reserving space for ads, and using font-display: swap.',
        impact: 'high',
        effort: 'low',
        category: 'cls',
        implemented: false,
      });
    }

    // Bundle optimization recommendations
    if (optimizationReport) {
      optimizationReport.rules.forEach(rule => {
        if (!rule.validation.passed) {
          recommendations.push({
            id: `bundle-${rule.name}`,
            title: rule.description,
            description: rule.result.recommendations.join(' '),
            impact: rule.priority === 'high' ? 'high' : rule.priority === 'medium' ? 'medium' : 'low',
            effort: 'medium',
            category: 'bundle',
            implemented: false,
          });
        }
      });
    }

    // CDN recommendations
    if (!cdnEnabled) {
      recommendations.push({
        id: 'cdn-setup',
        title: 'Enable CDN',
        description: 'Set up a CDN to improve global performance and reduce server load.',
        impact: 'high',
        effort: 'medium',
        category: 'cdn',
        implemented: false,
      });
    }

    return recommendations;
  }, [cwvMetrics, optimizationReport, cdnEnabled]);

  const formatValue = (value: number, unit: string): string => {
    if (unit === 'ms') {
      return `${Math.round(value)}ms`;
    }
    if (unit === '') {
      return value.toFixed(3);
    }
    return `${value}${unit}`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'needs-improvement': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBackground = (status: string): string => {
    switch (status) {
      case 'good': return 'bg-green-100';
      case 'needs-improvement': return 'bg-yellow-100';
      case 'poor': return 'bg-red-100';
      default: return 'bg-gray-100';
    }
  };

  const TabButton: React.FC<{ tab: string; label: string; active: boolean; onClick: () => void }> = ({
    tab,
    label,
    active,
    onClick,
  }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 border border-blue-200'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  const MetricCard: React.FC<{ metric: PerformanceMetric }> = ({ metric }) => (
    <Card className={`p-4 ${getStatusBackground(metric.status)}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">{metric.name}</h3>
          <p className={`text-2xl font-bold ${getStatusColor(metric.status)}`}>
            {formatValue(metric.value, metric.unit)}
          </p>
          <p className="text-xs text-gray-500">
            Threshold: {formatValue(metric.threshold, metric.unit)}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusBackground(metric.status)} ${getStatusColor(metric.status)}`}>
            {metric.status.replace('-', ' ')}
          </span>
          <span className="text-xs text-gray-400 mt-1">
            {metric.trend === 'up' ? '↗' : metric.trend === 'down' ? '↘' : '→'}
          </span>
        </div>
      </div>
    </Card>
  );

  const RecommendationCard: React.FC<{ recommendation: OptimizationRecommendation }> = ({ recommendation }) => (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-medium text-gray-900">{recommendation.title}</h3>
            <span className={`text-xs px-2 py-1 rounded ${
              recommendation.impact === 'high' ? 'bg-red-100 text-red-700' :
              recommendation.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {recommendation.impact} impact
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              recommendation.effort === 'high' ? 'bg-red-100 text-red-700' :
              recommendation.effort === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {recommendation.effort} effort
            </span>
          </div>
          <p className="text-sm text-gray-600">{recommendation.description}</p>
        </div>
        <Button
          size="sm"
          variant={recommendation.implemented ? 'outline' : 'primary'}
          disabled={recommendation.implemented}
          onClick={() => {
            // Implement optimization
            if (recommendation.category === 'lcp' || recommendation.category === 'fid' || recommendation.category === 'cls') {
              runOptimizations();
            }
          }}
        >
          {recommendation.implemented ? 'Implemented' : 'Optimize'}
        </Button>
      </div>
    </Card>
  );

  const overallScore = calculateOverallScore();
  const metrics = getPerformanceMetrics();
  const recommendations = getRecommendations();

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-600">Monitor and optimize your application's performance</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button
            variant={autoRefresh ? 'primary' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto Refresh On' : 'Auto Refresh Off'}
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Overall Performance Score</h2>
            <p className="text-gray-600">Based on Core Web Vitals, bundle optimization, and CDN performance</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className={`text-3xl font-bold ${
                overallScore >= 90 ? 'text-green-600' :
                overallScore >= 75 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {overallScore}
              </div>
              <div className="text-sm text-gray-500">out of 100</div>
            </div>
            <Progress
              value={overallScore}
              className="w-32"
              color={overallScore >= 90 ? 'green' : overallScore >= 75 ? 'yellow' : 'red'}
            />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <TabButton
          tab="overview"
          label="Overview"
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        />
        <TabButton
          tab="cwv"
          label="Core Web Vitals"
          active={activeTab === 'cwv'}
          onClick={() => setActiveTab('cwv')}
        />
        <TabButton
          tab="bundle"
          label="Bundle Analysis"
          active={activeTab === 'bundle'}
          onClick={() => setActiveTab('bundle')}
        />
        <TabButton
          tab="cdn"
          label="CDN Performance"
          active={activeTab === 'cdn'}
          onClick={() => setActiveTab('cdn')}
        />
        <TabButton
          tab="recommendations"
          label="Recommendations"
          active={activeTab === 'recommendations'}
          onClick={() => setActiveTab('recommendations')}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Performance Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.name} metric={metric} />
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button onClick={runOptimizations} className="w-full">
                Run Core Web Vitals Optimization
              </Button>
              <Button
                onClick={() => analyzeBundlePerformance({})}
                disabled={isAnalyzing}
                className="w-full"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Bundle'}
              </Button>
              <Button variant="outline" className="w-full">
                Clear Performance Cache
              </Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'cwv' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Core Web Vitals</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {metrics.map((metric) => (
                <Card key={metric.name} className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{metric.name}</h3>
                  <div className={`text-3xl font-bold mb-2 ${getStatusColor(metric.status)}`}>
                    {formatValue(metric.value, metric.unit)}
                  </div>
                  <Progress
                    value={Math.min(100, (metric.threshold / metric.value) * 100)}
                    className="mb-2"
                    color={metric.status === 'good' ? 'green' : metric.status === 'needs-improvement' ? 'yellow' : 'red'}
                  />
                  <p className="text-sm text-gray-600">
                    Threshold: {formatValue(metric.threshold, metric.unit)}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'bundle' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bundle Analysis</h2>
            {optimizationReport ? (
              <div className="space-y-4">
                <Card className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Bundle Statistics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {Math.round(optimizationReport.analysis.totalSize / 1024)}KB
                      </div>
                      <div className="text-sm text-gray-500">Total Size</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {Math.round(optimizationReport.analysis.gzippedSize / 1024)}KB
                      </div>
                      <div className="text-sm text-gray-500">Gzipped Size</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {optimizationReport.analysis.chunks.length}
                      </div>
                      <div className="text-sm text-gray-500">Chunks</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {optimizationReport.overallScore}
                      </div>
                      <div className="text-sm text-gray-500">Optimization Score</div>
                    </div>
                  </div>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {optimizationReport.rules.map((rule) => (
                    <Card key={rule.name} className="p-4">
                      <h4 className="font-medium text-gray-900 mb-2">{rule.description}</h4>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          rule.validation.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {rule.validation.passed ? 'Passed' : 'Failed'}
                        </span>
                        <span className="text-xs text-gray-500">Score: {rule.validation.score}</span>
                      </div>
                      {rule.validation.issues.length > 0 && (
                        <ul className="text-sm text-gray-600 list-disc list-inside">
                          {rule.validation.issues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="p-6 text-center">
                <p className="text-gray-600 mb-4">No bundle analysis data available</p>
                <Button onClick={() => analyzeBundlePerformance({})}>
                  Run Bundle Analysis
                </Button>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'cdn' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">CDN Performance</h2>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">CDN Status</h3>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  cdnEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {cdnEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {cdnEnabled && activeProvider && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Active Provider</div>
                    <div className="text-lg font-medium text-gray-900">{activeProvider}</div>
                  </div>
                  {cdnMetrics.size > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {Array.from(cdnMetrics.entries()).map(([provider, metric]) => (
                        <div key={provider} className="border border-gray-200 rounded-lg p-4">
                          <h4 className="font-medium text-gray-900 mb-2">{provider}</h4>
                          <div className="space-y-2">
                            <div>
                              <div className="text-sm text-gray-500">Success Rate</div>
                              <div className="text-lg font-medium text-gray-900">
                                {metric.successRate.toFixed(1)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Avg Latency</div>
                              <div className="text-lg font-medium text-gray-900">
                                {Math.round(metric.averageLatency)}ms
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!cdnEnabled && (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">CDN is not configured or enabled</p>
                  <Button>Configure CDN</Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Optimization Recommendations</h2>
            {recommendations.length > 0 ? (
              <div className="space-y-4">
                {recommendations.map((recommendation) => (
                  <RecommendationCard key={recommendation.id} recommendation={recommendation} />
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <div className="text-green-600 text-4xl mb-4">✓</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">All Optimizations Complete</h3>
                <p className="text-gray-600">Your application is performing well with no immediate optimization needs.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;