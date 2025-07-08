/**
 * Embeddable Monitoring Widgets
 * 
 * Reusable components for displaying monitoring data across different stakeholder views.
 * Supports real-time updates, responsive design, and customizable themes.
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { dashboardAPI, DashboardMetric, DashboardTarget } from '@/lib/dashboard-api';
import { logger } from '@/lib/logger';

// Base widget types
export type WidgetType = 
  | 'stat' 
  | 'timeseries' 
  | 'gauge' 
  | 'table' 
  | 'alert-status' 
  | 'trend-indicator'
  | 'heatmap'
  | 'progress-bar';

export type WidgetSize = 'small' | 'medium' | 'large' | 'extra-large';
export type WidgetTheme = 'light' | 'dark' | 'auto';
export type StakeholderRole = 'executive' | 'technical' | 'business' | 'security' | 'learning';

// Widget configuration interfaces
export interface BaseWidgetConfig {
  id: string;
  title: string;
  type: WidgetType;
  size: WidgetSize;
  theme?: WidgetTheme;
  refreshInterval?: number; // seconds
  stakeholderRole?: StakeholderRole;
  showTitle?: boolean;
  showTimestamp?: boolean;
  className?: string;
}

export interface MetricWidgetConfig extends BaseWidgetConfig {
  type: 'stat' | 'gauge' | 'progress-bar';
  query: string;
  unit?: string;
  thresholds?: {
    low: number;
    medium: number;
    high: number;
  };
  colors?: {
    low: string;
    medium: string;
    high: string;
  };
  target?: number;
  format?: 'number' | 'percentage' | 'currency' | 'time' | 'bytes';
}

export interface TimeseriesWidgetConfig extends BaseWidgetConfig {
  type: 'timeseries';
  queries: Array<{
    query: string;
    label: string;
    color?: string;
  }>;
  timeRange?: string; // e.g., '1h', '24h', '7d'
  yAxisLabel?: string;
  showLegend?: boolean;
  fillArea?: boolean;
}

export interface TableWidgetConfig extends BaseWidgetConfig {
  type: 'table';
  query: string;
  columns?: Array<{
    key: string;
    label: string;
    format?: 'number' | 'percentage' | 'currency' | 'time' | 'text';
  }>;
  sortBy?: string;
  maxRows?: number;
}

export interface AlertStatusWidgetConfig extends BaseWidgetConfig {
  type: 'alert-status';
  severityFilters?: string[];
  maxAlerts?: number;
  showResolved?: boolean;
}

export interface TrendIndicatorConfig extends BaseWidgetConfig {
  type: 'trend-indicator';
  query: string;
  comparisonPeriod?: string; // e.g., '24h', '7d'
  showPercentage?: boolean;
}

export type WidgetConfig = 
  | MetricWidgetConfig 
  | TimeseriesWidgetConfig 
  | TableWidgetConfig 
  | AlertStatusWidgetConfig
  | TrendIndicatorConfig;

// Widget data interfaces
export interface WidgetData {
  value?: number;
  values?: DashboardMetric[];
  timestamp: number;
  status: 'loading' | 'success' | 'error';
  error?: string;
}

// Stakeholder-specific widget presets
export const STAKEHOLDER_WIDGETS: Record<StakeholderRole, WidgetConfig[]> = {
  executive: [
    {
      id: 'revenue-overview',
      title: 'Revenue Overview',
      type: 'stat',
      size: 'medium',
      query: 'learning_assistant_revenue_total',
      format: 'currency',
      stakeholderRole: 'executive',
    },
    {
      id: 'user-growth',
      title: 'User Growth',
      type: 'trend-indicator',
      size: 'medium',
      query: 'learning_assistant_users_total',
      comparisonPeriod: '7d',
      showPercentage: true,
      stakeholderRole: 'executive',
    },
    {
      id: 'system-health',
      title: 'System Health',
      type: 'gauge',
      size: 'medium',
      query: 'up{job="learning-assistant"}',
      format: 'percentage',
      stakeholderRole: 'executive',
    },
  ],
  technical: [
    {
      id: 'response-time',
      title: 'Response Time P95',
      type: 'stat',
      size: 'medium',
      query: 'histogram_quantile(0.95, rate(learning_assistant_http_request_duration_seconds_bucket[5m]))',
      unit: 'ms',
      thresholds: { low: 100, medium: 500, high: 1000 },
      stakeholderRole: 'technical',
    },
    {
      id: 'error-rate',
      title: 'Error Rate',
      type: 'timeseries',
      size: 'large',
      queries: [
        {
          query: 'rate(learning_assistant_http_requests_total{status=~"5.."}[5m]) / rate(learning_assistant_http_requests_total[5m]) * 100',
          label: 'Error Rate %',
          color: '#ff6b6b',
        },
      ],
      timeRange: '1h',
      stakeholderRole: 'technical',
    },
    {
      id: 'active-alerts',
      title: 'Active Alerts',
      type: 'alert-status',
      size: 'medium',
      maxAlerts: 10,
      stakeholderRole: 'technical',
    },
  ],
  business: [
    {
      id: 'conversion-rate',
      title: 'Conversion Rate',
      type: 'stat',
      size: 'medium',
      query: 'learning_assistant_conversion_rate',
      format: 'percentage',
      thresholds: { low: 5, medium: 10, high: 20 },
      stakeholderRole: 'business',
    },
    {
      id: 'user-engagement',
      title: 'User Engagement',
      type: 'progress-bar',
      size: 'medium',
      query: 'learning_assistant_user_engagement_score',
      target: 100,
      stakeholderRole: 'business',
    },
    {
      id: 'feature-adoption',
      title: 'Feature Adoption',
      type: 'table',
      size: 'large',
      query: 'learning_assistant_feature_usage',
      columns: [
        { key: 'feature', label: 'Feature', format: 'text' },
        { key: 'usage', label: 'Usage', format: 'number' },
        { key: 'adoption', label: 'Adoption %', format: 'percentage' },
      ],
      stakeholderRole: 'business',
    },
  ],
  security: [
    {
      id: 'threat-level',
      title: 'Threat Level',
      type: 'gauge',
      size: 'medium',
      query: 'learning_assistant_threat_score',
      thresholds: { low: 3, medium: 7, high: 9 },
      colors: { low: '#4ade80', medium: '#fbbf24', high: '#ef4444' },
      stakeholderRole: 'security',
    },
    {
      id: 'failed-logins',
      title: 'Failed Login Attempts',
      type: 'timeseries',
      size: 'large',
      queries: [
        {
          query: 'rate(learning_assistant_failed_login_attempts_total[5m]) * 300',
          label: 'Failed Logins (5m)',
          color: '#ef4444',
        },
      ],
      timeRange: '24h',
      stakeholderRole: 'security',
    },
    {
      id: 'security-events',
      title: 'Recent Security Events',
      type: 'table',
      size: 'large',
      query: 'learning_assistant_security_events',
      maxRows: 20,
      stakeholderRole: 'security',
    },
  ],
  learning: [
    {
      id: 'learning-effectiveness',
      title: 'Learning Effectiveness',
      type: 'stat',
      size: 'medium',
      query: 'learning_assistant_learning_effectiveness_score',
      format: 'percentage',
      thresholds: { low: 60, medium: 75, high: 90 },
      stakeholderRole: 'learning',
    },
    {
      id: 'student-progress',
      title: 'Student Progress',
      type: 'timeseries',
      size: 'large',
      queries: [
        {
          query: 'learning_assistant_progress_score',
          label: 'Progress Score',
          color: '#3b82f6',
        },
        {
          query: 'learning_assistant_mastery_rate',
          label: 'Mastery Rate',
          color: '#10b981',
        },
      ],
      timeRange: '7d',
      stakeholderRole: 'learning',
    },
    {
      id: 'completion-rates',
      title: 'Course Completion Rates',
      type: 'table',
      size: 'large',
      query: 'learning_assistant_course_completion',
      columns: [
        { key: 'course', label: 'Course', format: 'text' },
        { key: 'enrolled', label: 'Enrolled', format: 'number' },
        { key: 'completed', label: 'Completed', format: 'number' },
        { key: 'rate', label: 'Rate', format: 'percentage' },
      ],
      stakeholderRole: 'learning',
    },
  ],
};

// Main monitoring widget component
export const MonitoringWidget: React.FC<{
  config: WidgetConfig;
  className?: string;
}> = ({ config, className = '' }) => {
  const [data, setData] = useState<WidgetData>({
    timestamp: Date.now(),
    status: 'loading',
  });

  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // Fetch data from dashboard API
  const fetchData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, status: 'loading' }));

      let result: WidgetData;

      switch (config.type) {
        case 'stat':
        case 'gauge':
        case 'progress-bar':
          result = await fetchMetricData(config as MetricWidgetConfig);
          break;
        case 'timeseries':
          result = await fetchTimeseriesData(config as TimeseriesWidgetConfig);
          break;
        case 'table':
          result = await fetchTableData(config as TableWidgetConfig);
          break;
        case 'alert-status':
          result = await fetchAlertData(config as AlertStatusWidgetConfig);
          break;
        case 'trend-indicator':
          result = await fetchTrendData(config as TrendIndicatorConfig);
          break;
        default:
          throw new Error(`Unsupported widget type: ${config.type}`);
      }

      setData(result);
    } catch (error) {
      logger.error('Widget data fetch failed:', { widgetId: config.id, error });
      setData({
        timestamp: Date.now(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [config]);

  // Set up auto-refresh
  useEffect(() => {
    fetchData();

    const interval = (config.refreshInterval || 30) * 1000;
    const timer = setInterval(fetchData, interval);
    setRefreshTimer(timer);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [fetchData, config.refreshInterval]);

  // Widget size classes
  const sizeClasses = {
    small: 'w-64 h-32',
    medium: 'w-80 h-48',
    large: 'w-96 h-64',
    'extra-large': 'w-full h-80',
  };

  // Theme classes
  const themeClasses = {
    light: 'bg-white border-gray-200 text-gray-900',
    dark: 'bg-gray-800 border-gray-700 text-white',
    auto: 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white',
  };

  const theme = config.theme || 'auto';
  const widgetClasses = `
    ${sizeClasses[config.size]}
    ${themeClasses[theme]}
    border rounded-lg shadow-sm p-4 relative
    ${className}
  `;

  return (
    <div className={widgetClasses}>
      {config.showTitle !== false && (
        <div className="mb-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {config.title}
          </h3>
          {config.showTimestamp && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Updated: {new Date(data.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      <div className="flex-1">
        {data.status === 'loading' && <LoadingSpinner />}
        {data.status === 'error' && <ErrorDisplay error={data.error} />}
        {data.status === 'success' && (
          <WidgetContent config={config} data={data} />
        )}
      </div>

      {/* Refresh indicator */}
      {data.status === 'loading' && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
};

// Widget content renderer
const WidgetContent: React.FC<{
  config: WidgetConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  switch (config.type) {
    case 'stat':
      return <StatWidget config={config as MetricWidgetConfig} data={data} />;
    case 'gauge':
      return <GaugeWidget config={config as MetricWidgetConfig} data={data} />;
    case 'progress-bar':
      return <ProgressBarWidget config={config as MetricWidgetConfig} data={data} />;
    case 'timeseries':
      return <TimeseriesWidget config={config as TimeseriesWidgetConfig} data={data} />;
    case 'table':
      return <TableWidget config={config as TableWidgetConfig} data={data} />;
    case 'alert-status':
      return <AlertStatusWidget config={config as AlertStatusWidgetConfig} data={data} />;
    case 'trend-indicator':
      return <TrendIndicatorWidget config={config as TrendIndicatorConfig} data={data} />;
    default:
      return <div>Unsupported widget type</div>;
  }
};

// Individual widget components
const StatWidget: React.FC<{
  config: MetricWidgetConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  const value = data.value || 0;
  const formattedValue = formatValue(value, config.format || 'number');
  const color = getThresholdColor(value, config.thresholds, config.colors);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className={`text-3xl font-bold ${color}`}>
        {formattedValue}
      </div>
      {config.unit && (
        <div className="text-sm text-gray-500 mt-1">{config.unit}</div>
      )}
    </div>
  );
};

const GaugeWidget: React.FC<{
  config: MetricWidgetConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  const value = data.value || 0;
  const max = config.thresholds?.high || 100;
  const percentage = Math.min((value / max) * 100, 100);
  const color = getThresholdColor(value, config.thresholds, config.colors);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-gray-200 dark:text-gray-700"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            className={color}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${percentage}, 100`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold">
            {formatValue(value, config.format || 'number')}
          </span>
        </div>
      </div>
    </div>
  );
};

const ProgressBarWidget: React.FC<{
  config: MetricWidgetConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  const value = data.value || 0;
  const target = config.target || 100;
  const percentage = Math.min((value / target) * 100, 100);
  const color = getThresholdColor(value, config.thresholds, config.colors);

  return (
    <div className="flex flex-col justify-center h-full space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">
          {formatValue(value, config.format || 'number')}
        </span>
        <span className="text-sm text-gray-500">
          {formatValue(target, config.format || 'number')}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-center text-sm text-gray-500">
        {percentage.toFixed(1)}% of target
      </div>
    </div>
  );
};

const TimeseriesWidget: React.FC<{
  config: TimeseriesWidgetConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  // This would integrate with a charting library like Chart.js or Recharts
  // For now, showing a simplified representation
  const values = data.values || [];
  const hasData = values.length > 0;

  return (
    <div className="h-full flex items-center justify-center">
      {hasData ? (
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {values.length} data points
          </div>
          <div className="text-sm text-gray-500 mt-1">
            Chart visualization would go here
          </div>
        </div>
      ) : (
        <div className="text-gray-500">No data available</div>
      )}
    </div>
  );
};

const TableWidget: React.FC<{
  config: TableWidgetConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  const values = data.values || [];
  const maxRows = config.maxRows || 10;
  const displayValues = values.slice(0, maxRows);

  return (
    <div className="h-full overflow-auto">
      {displayValues.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {config.columns?.map(col => (
                <th key={col.key} className="text-left py-1 px-2 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayValues.map((row, index) => (
              <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                {config.columns?.map(col => (
                  <td key={col.key} className="py-1 px-2">
                    {formatValue(
                      (row.labels as any)?.[col.key] || row.value,
                      col.format || 'text'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          No data available
        </div>
      )}
    </div>
  );
};

const AlertStatusWidget: React.FC<{
  config: AlertStatusWidgetConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  // This would fetch actual alert data
  const mockAlerts = [
    { name: 'High Error Rate', severity: 'critical', status: 'firing' },
    { name: 'Memory Usage', severity: 'warning', status: 'pending' },
  ];

  return (
    <div className="h-full overflow-auto space-y-2">
      {mockAlerts.map((alert, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700"
        >
          <div>
            <div className="font-medium text-sm">{alert.name}</div>
            <div className="text-xs text-gray-500">{alert.severity}</div>
          </div>
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${
              alert.status === 'firing'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            }`}
          >
            {alert.status}
          </div>
        </div>
      ))}
    </div>
  );
};

const TrendIndicatorWidget: React.FC<{
  config: TrendIndicatorConfig;
  data: WidgetData;
}> = ({ config, data }) => {
  const value = data.value || 0;
  const trend = Math.random() > 0.5 ? 'up' : 'down'; // Mock trend
  const percentage = (Math.random() * 20).toFixed(1); // Mock percentage

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="text-2xl font-bold">
          {formatValue(value, config.format || 'number')}
        </div>
        <div className={`flex items-center justify-center mt-2 ${
          trend === 'up' ? 'text-green-600' : 'text-red-600'
        }`}>
          <span className="text-lg">
            {trend === 'up' ? '↗' : '↘'}
          </span>
          <span className="ml-1 text-sm">
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
};

// Utility components
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

const ErrorDisplay: React.FC<{ error?: string }> = ({ error }) => (
  <div className="flex items-center justify-center h-full text-red-600">
    <div className="text-center">
      <div className="text-lg">⚠️</div>
      <div className="text-sm mt-1">
        {error || 'Error loading data'}
      </div>
    </div>
  </div>
);

// Data fetching functions
async function fetchMetricData(config: MetricWidgetConfig): Promise<WidgetData> {
  const metrics = await dashboardAPI.query(config.query);
  const value = metrics[0]?.value || 0;
  
  return {
    value,
    timestamp: Date.now(),
    status: 'success',
  };
}

async function fetchTimeseriesData(config: TimeseriesWidgetConfig): Promise<WidgetData> {
  const values: DashboardMetric[] = [];
  
  for (const queryConfig of config.queries) {
    const metrics = await dashboardAPI.queryRange(
      queryConfig.query,
      Date.now() - 3600000, // 1 hour ago
      Date.now(),
      '1m'
    );
    values.push(...metrics);
  }
  
  return {
    values,
    timestamp: Date.now(),
    status: 'success',
  };
}

async function fetchTableData(config: TableWidgetConfig): Promise<WidgetData> {
  const metrics = await dashboardAPI.query(config.query);
  
  return {
    values: metrics,
    timestamp: Date.now(),
    status: 'success',
  };
}

async function fetchAlertData(config: AlertStatusWidgetConfig): Promise<WidgetData> {
  const alerts = await dashboardAPI.getAlertRules();
  
  return {
    values: alerts as any,
    timestamp: Date.now(),
    status: 'success',
  };
}

async function fetchTrendData(config: TrendIndicatorConfig): Promise<WidgetData> {
  const metrics = await dashboardAPI.query(config.query);
  const value = metrics[0]?.value || 0;
  
  return {
    value,
    timestamp: Date.now(),
    status: 'success',
  };
}

// Utility functions
function formatValue(value: any, format: string): string {
  if (value === null || value === undefined) return 'N/A';
  
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return String(value);
  
  switch (format) {
    case 'percentage':
      return `${num.toFixed(1)}%`;
    case 'currency':
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(num);
    case 'time':
      return `${num.toFixed(1)}s`;
    case 'bytes':
      return formatBytes(num);
    case 'number':
      return num.toLocaleString();
    default:
      return String(value);
  }
}

function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function getThresholdColor(
  value: number,
  thresholds?: { low: number; medium: number; high: number },
  colors?: { low: string; medium: string; high: string }
): string {
  if (!thresholds) return 'text-blue-600';
  
  const defaultColors = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-red-600',
  };
  
  const colorMap = colors || defaultColors;
  
  if (value >= thresholds.high) return colorMap.high;
  if (value >= thresholds.medium) return colorMap.medium;
  return colorMap.low;
}

// Widget dashboard component for displaying multiple widgets
export const WidgetDashboard: React.FC<{
  role: StakeholderRole;
  customWidgets?: WidgetConfig[];
  className?: string;
}> = ({ role, customWidgets, className = '' }) => {
  const widgets = customWidgets || STAKEHOLDER_WIDGETS[role] || [];

  return (
    <div className={`grid gap-4 ${className}`} style={{
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    }}>
      {widgets.map(widget => (
        <MonitoringWidget key={widget.id} config={widget} />
      ))}
    </div>
  );
};

export default MonitoringWidget;