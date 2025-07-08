/**
 * Dashboard API Integration Layer
 * 
 * Provides a unified interface for real-time data visualization,
 * dashboard management, and monitoring metrics aggregation.
 */

import { z } from 'zod';
import { config } from './config';
import { logger } from './logger';

// Type definitions for dashboard data
export interface DashboardMetric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  unit?: string;
  metadata?: Record<string, any>;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'stat' | 'timeseries' | 'table' | 'heatmap' | 'gauge' | 'piechart' | 'barchart' | 'geomap';
  gridPos: {
    h: number;
    w: number;
    x: number;
    y: number;
  };
  targets: DashboardTarget[];
  fieldConfig?: any;
  options?: any;
}

export interface DashboardTarget {
  expr: string;
  legendFormat?: string;
  refId: string;
  interval?: string;
  datasource?: string;
}

export interface Dashboard {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  panels: DashboardPanel[];
  variables?: DashboardVariable[];
  time?: {
    from: string;
    to: string;
  };
  refresh?: string;
}

export interface DashboardVariable {
  name: string;
  type: 'query' | 'custom' | 'interval';
  query?: string;
  options?: Array<{ text: string; value: string; selected: boolean }>;
  current?: { text: string; value: string };
  includeAll?: boolean;
  multi?: boolean;
}

// Validation schemas
const MetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  timestamp: z.number(),
  labels: z.record(z.string()).optional(),
  unit: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const DashboardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()),
  panels: z.array(z.any()),
  variables: z.array(z.any()).optional(),
  time: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
  refresh: z.string().optional(),
});

/**
 * Dashboard API Client
 * Handles communication with various monitoring backends
 */
export class DashboardAPI {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly retryAttempts: number;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;

  constructor(options: {
    baseUrl?: string;
    apiKey?: string;
    timeout?: number;
    retryAttempts?: number;
  } = {}) {
    this.baseUrl = options.baseUrl || process.env.DASHBOARD_API_URL || 'http://localhost:9090';
    this.apiKey = options.apiKey || process.env.DASHBOARD_API_KEY;
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.cache = new Map();
  }

  /**
   * Execute a Prometheus query
   */
  async query(query: string, time?: number): Promise<DashboardMetric[]> {
    const cacheKey = `query:${query}:${time || 'now'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = new URL('/api/v1/query', this.baseUrl);
      url.searchParams.set('query', query);
      if (time) {
        url.searchParams.set('time', time.toString());
      }

      const response = await this.makeRequest(url.toString());
      const metrics = this.parsePrometheusResponse(response);
      
      // Cache for 30 seconds
      this.setCache(cacheKey, metrics, 30000);
      
      return metrics;
    } catch (error) {
      logger.error('Dashboard API query failed:', { query, error });
      throw new Error(`Failed to execute query: ${error}`);
    }
  }

  /**
   * Execute a Prometheus range query
   */
  async queryRange(
    query: string,
    start: number,
    end: number,
    step: string = '15s'
  ): Promise<DashboardMetric[]> {
    const cacheKey = `range:${query}:${start}:${end}:${step}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = new URL('/api/v1/query_range', this.baseUrl);
      url.searchParams.set('query', query);
      url.searchParams.set('start', start.toString());
      url.searchParams.set('end', end.toString());
      url.searchParams.set('step', step);

      const response = await this.makeRequest(url.toString());
      const metrics = this.parsePrometheusRangeResponse(response);
      
      // Cache for 1 minute
      this.setCache(cacheKey, metrics, 60000);
      
      return metrics;
    } catch (error) {
      logger.error('Dashboard API range query failed:', { query, start, end, step, error });
      throw new Error(`Failed to execute range query: ${error}`);
    }
  }

  /**
   * Get dashboard by ID
   */
  async getDashboard(id: string): Promise<Dashboard> {
    const cacheKey = `dashboard:${id}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = `/api/dashboards/uid/${id}`;
      const response = await this.makeRequest(url);
      const dashboard = this.parseDashboardResponse(response);
      
      // Cache for 5 minutes
      this.setCache(cacheKey, dashboard, 300000);
      
      return dashboard;
    } catch (error) {
      logger.error('Failed to get dashboard:', { id, error });
      throw new Error(`Failed to get dashboard: ${error}`);
    }
  }

  /**
   * List available dashboards
   */
  async listDashboards(tags?: string[]): Promise<Dashboard[]> {
    const cacheKey = `dashboards:${tags?.join(',') || 'all'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const url = new URL('/api/search', this.baseUrl);
      url.searchParams.set('type', 'dash-db');
      if (tags?.length) {
        url.searchParams.set('tag', tags.join(','));
      }

      const response = await this.makeRequest(url.toString());
      const dashboards = response.map((item: any) => this.parseDashboardSummary(item));
      
      // Cache for 2 minutes
      this.setCache(cacheKey, dashboards, 120000);
      
      return dashboards;
    } catch (error) {
      logger.error('Failed to list dashboards:', { tags, error });
      throw new Error(`Failed to list dashboards: ${error}`);
    }
  }

  /**
   * Create or update a dashboard
   */
  async saveDashboard(dashboard: Dashboard): Promise<{ id: string; version: number }> {
    try {
      const validatedDashboard = DashboardSchema.parse(dashboard);
      
      const response = await this.makeRequest('/api/dashboards/db', {
        method: 'POST',
        body: JSON.stringify({
          dashboard: validatedDashboard,
          overwrite: true,
        }),
      });

      // Invalidate cache
      this.cache.delete(`dashboard:${dashboard.id}`);
      this.cache.delete('dashboards:all');

      return {
        id: response.uid,
        version: response.version,
      };
    } catch (error) {
      logger.error('Failed to save dashboard:', { dashboard: dashboard.id, error });
      throw new Error(`Failed to save dashboard: ${error}`);
    }
  }

  /**
   * Delete a dashboard
   */
  async deleteDashboard(id: string): Promise<void> {
    try {
      await this.makeRequest(`/api/dashboards/uid/${id}`, {
        method: 'DELETE',
      });

      // Invalidate cache
      this.cache.delete(`dashboard:${id}`);
      this.cache.delete('dashboards:all');
    } catch (error) {
      logger.error('Failed to delete dashboard:', { id, error });
      throw new Error(`Failed to delete dashboard: ${error}`);
    }
  }

  /**
   * Get real-time metrics for a dashboard panel
   */
  async getPanelData(
    panelId: string,
    targets: DashboardTarget[],
    timeRange: { from: string; to: string },
    variables?: Record<string, string>
  ): Promise<Record<string, DashboardMetric[]>> {
    const results: Record<string, DashboardMetric[]> = {};

    for (const target of targets) {
      try {
        let query = target.expr;
        
        // Replace variables in query
        if (variables) {
          for (const [key, value] of Object.entries(variables)) {
            query = query.replace(new RegExp(`\\$${key}`, 'g'), value);
          }
        }

        const { from, to } = this.parseTimeRange(timeRange);
        
        if (target.interval || timeRange.from.includes('now-')) {
          // Range query for time series data
          results[target.refId] = await this.queryRange(
            query,
            from,
            to,
            target.interval || '15s'
          );
        } else {
          // Instant query for current values
          results[target.refId] = await this.query(query, to);
        }
      } catch (error) {
        logger.error('Failed to get panel data:', { panelId, target: target.refId, error });
        results[target.refId] = [];
      }
    }

    return results;
  }

  /**
   * Get dashboard annotations
   */
  async getAnnotations(
    dashboardId: string,
    from: number,
    to: number,
    tags?: string[]
  ): Promise<Array<{
    id: string;
    time: number;
    timeEnd?: number;
    title: string;
    text: string;
    tags: string[];
  }>> {
    try {
      const url = new URL('/api/annotations', this.baseUrl);
      url.searchParams.set('dashboardId', dashboardId);
      url.searchParams.set('from', from.toString());
      url.searchParams.set('to', to.toString());
      if (tags?.length) {
        url.searchParams.set('tags', tags.join(','));
      }

      const response = await this.makeRequest(url.toString());
      return response;
    } catch (error) {
      logger.error('Failed to get annotations:', { dashboardId, from, to, tags, error });
      return [];
    }
  }

  /**
   * Get alert rules
   */
  async getAlertRules(): Promise<Array<{
    name: string;
    query: string;
    condition: string;
    severity: string;
    state: 'pending' | 'firing' | 'inactive';
    activeAt?: number;
    value?: number;
  }>> {
    try {
      const response = await this.makeRequest('/api/v1/rules');
      return this.parseAlertRulesResponse(response);
    } catch (error) {
      logger.error('Failed to get alert rules:', { error });
      return [];
    }
  }

  /**
   * Health check for the dashboard API
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: any }> {
    try {
      const response = await this.makeRequest('/api/health');
      return { status: 'healthy', details: response };
    } catch (error) {
      logger.error('Dashboard API health check failed:', { error });
      return { status: 'unhealthy', details: { error: error.message } };
    }
  }

  /**
   * Private helper methods
   */
  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      timeout: this.timeout,
    };

    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(fullUrl, requestOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        } else {
          return await response.text();
        }
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Dashboard API request attempt ${attempt} failed:`, { url: fullUrl, error });
        
        if (attempt < this.retryAttempts) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError!;
  }

  private parsePrometheusResponse(response: any): DashboardMetric[] {
    if (response.status !== 'success') {
      throw new Error(`Query failed: ${response.error}`);
    }

    const metrics: DashboardMetric[] = [];
    
    for (const result of response.data.result) {
      metrics.push({
        name: result.metric.__name__ || 'unknown',
        value: parseFloat(result.value[1]),
        timestamp: result.value[0] * 1000,
        labels: result.metric,
      });
    }

    return metrics;
  }

  private parsePrometheusRangeResponse(response: any): DashboardMetric[] {
    if (response.status !== 'success') {
      throw new Error(`Range query failed: ${response.error}`);
    }

    const metrics: DashboardMetric[] = [];
    
    for (const result of response.data.result) {
      for (const value of result.values) {
        metrics.push({
          name: result.metric.__name__ || 'unknown',
          value: parseFloat(value[1]),
          timestamp: value[0] * 1000,
          labels: result.metric,
        });
      }
    }

    return metrics;
  }

  private parseDashboardResponse(response: any): Dashboard {
    return {
      id: response.dashboard.uid,
      title: response.dashboard.title,
      description: response.dashboard.description,
      tags: response.dashboard.tags || [],
      panels: response.dashboard.panels || [],
      variables: response.dashboard.templating?.list || [],
      time: response.dashboard.time,
      refresh: response.dashboard.refresh,
    };
  }

  private parseDashboardSummary(item: any): Dashboard {
    return {
      id: item.uid,
      title: item.title,
      description: item.description,
      tags: item.tags || [],
      panels: [],
    };
  }

  private parseAlertRulesResponse(response: any): Array<{
    name: string;
    query: string;
    condition: string;
    severity: string;
    state: 'pending' | 'firing' | 'inactive';
    activeAt?: number;
    value?: number;
  }> {
    const rules: any[] = [];
    
    if (response.status === 'success') {
      for (const group of response.data.groups) {
        for (const rule of group.rules) {
          if (rule.type === 'alerting') {
            rules.push({
              name: rule.name,
              query: rule.query,
              condition: rule.condition || 'unknown',
              severity: rule.labels?.severity || 'unknown',
              state: rule.state,
              activeAt: rule.activeAt ? new Date(rule.activeAt).getTime() : undefined,
              value: rule.value ? parseFloat(rule.value) : undefined,
            });
          }
        }
      }
    }

    return rules;
  }

  private parseTimeRange(timeRange: { from: string; to: string }): { from: number; to: number } {
    const now = Date.now();
    let from: number;
    let to: number;

    // Parse 'to' time
    if (timeRange.to === 'now') {
      to = Math.floor(now / 1000);
    } else {
      to = Math.floor(new Date(timeRange.to).getTime() / 1000);
    }

    // Parse 'from' time
    if (timeRange.from.startsWith('now-')) {
      const duration = timeRange.from.substring(4);
      const seconds = this.parseDuration(duration);
      from = to - seconds;
    } else {
      from = Math.floor(new Date(timeRange.from).getTime() / 1000);
    }

    return { from, to };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhdwy])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
      y: 31536000,
    };

    return value * (multipliers[unit as keyof typeof multipliers] || 1);
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Clean up expired cache entries periodically
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp >= cached.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const dashboardAPI = new DashboardAPI();

// Dashboard utilities
export class DashboardUtils {
  /**
   * Create a dashboard from template
   */
  static createFromTemplate(
    template: Partial<Dashboard>,
    variables: Record<string, string> = {}
  ): Dashboard {
    const dashboard = { ...template } as Dashboard;
    
    // Replace variables in dashboard JSON
    const dashboardJson = JSON.stringify(dashboard);
    const replacedJson = Object.entries(variables).reduce(
      (json, [key, value]) => json.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value),
      dashboardJson
    );
    
    return JSON.parse(replacedJson);
  }

  /**
   * Validate dashboard structure
   */
  static validate(dashboard: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      DashboardSchema.parse(dashboard);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push(error.message);
      }
      return { valid: false, errors };
    }
  }

  /**
   * Generate dashboard export
   */
  static export(dashboard: Dashboard): string {
    const exportData = {
      dashboard,
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import dashboard from export
   */
  static import(exportData: string): Dashboard {
    try {
      const parsed = JSON.parse(exportData);
      return DashboardSchema.parse(parsed.dashboard || parsed);
    } catch (error) {
      throw new Error(`Failed to import dashboard: ${error}`);
    }
  }
}