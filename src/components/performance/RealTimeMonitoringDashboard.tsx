'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';
import PerformanceBudgetMonitor from './PerformanceBudgetMonitor';
import ServiceWorkerManager from './ServiceWorkerManager';

export interface RealTimeMetrics {
  coreWebVitals: CoreWebVitals;
  resourceTiming: ResourceTiming[];
  userTiming: UserTiming[];
  navigationTiming: NavigationTiming;
  memoryInfo: MemoryInfo;
  networkInfo: NetworkInfo;
  performanceScore: number;
  timestamp: number;
}

export interface CoreWebVitals {
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  tti: number | null; // Time to Interactive
  tbt: number | null; // Total Blocking Time
}

export interface ResourceTiming {
  name: string;
  duration: number;
  size: number;
  type: string;
  cacheHit: boolean;
  compressionRatio: number;
  startTime: number;
  responseStart: number;
  responseEnd: number;
}

export interface UserTiming {
  name: string;
  duration: number;
  startTime: number;
  entryType: string;
}

export interface NavigationTiming {
  domContentLoaded: number;
  loadComplete: number;
  redirectTime: number;
  dnsTime: number;
  connectTime: number;
  tlsTime: number;
  requestTime: number;
  responseTime: number;
  domParseTime: number;
  resourceLoadTime: number;
}

export interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
  usagePercentage: number;
  gcInfo: GCInfo;
}

export interface GCInfo {
  collections: number;
  duration: number;
  reclaimedMemory: number;
  frequency: number;
}

export interface NetworkInfo {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
  resolved: boolean;
}

interface RealTimeMonitoringDashboardProps {
  refreshInterval?: number;
  alertThresholds?: Partial<CoreWebVitals>;
  onAlert?: (alert: PerformanceAlert) => void;
  enableRUM?: boolean;
  enableHeatmaps?: boolean;
}

export const RealTimeMonitoringDashboard: React.FC<RealTimeMonitoringDashboardProps> = ({
  refreshInterval = 5000,
  alertThresholds = {
    fcp: 2000,
    lcp: 4000,
    fid: 100,
    cls: 0.1,
    ttfb: 800
  },
  onAlert,
  enableRUM = true,
  enableHeatmaps = false
}) => {
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [performanceAlerts, setPerformanceAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [historicalData, setHistoricalData] = useState<RealTimeMetrics[]>([]);
  
  const { getMetrics } = usePerformanceMonitoring();

  /**
   * Collect comprehensive real-time metrics
   */
  const collectRealTimeMetrics = useCallback(async (): Promise<RealTimeMetrics> => {
    const timestamp = Date.now();
    
    // Core Web Vitals
    const coreWebVitals = await collectCoreWebVitals();
    
    // Resource Timing
    const resourceTiming = collectResourceTiming();
    
    // User Timing
    const userTiming = collectUserTiming();
    
    // Navigation Timing
    const navigationTiming = collectNavigationTiming();
    
    // Memory Information
    const memoryInfo = collectMemoryInfo();
    
    // Network Information
    const networkInfo = collectNetworkInfo();
    
    // Calculate overall performance score
    const performanceScore = calculatePerformanceScore(coreWebVitals);

    return {
      coreWebVitals,
      resourceTiming,
      userTiming,
      navigationTiming,
      memoryInfo,
      networkInfo,
      performanceScore,
      timestamp
    };
  }, []);

  /**
   * Collect Core Web Vitals using modern APIs
   */
  const collectCoreWebVitals = useCallback(async (): Promise<CoreWebVitals> => {
    const vitals: CoreWebVitals = {
      fcp: null,
      lcp: null,
      fid: null,
      cls: null,
      ttfb: null,
      tti: null,
      tbt: null
    };

    if ('PerformanceObserver' in window) {
      try {
        // Collect paint metrics
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          vitals.fcp = fcpEntry.startTime;
        }

        // Collect LCP using PerformanceObserver
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            vitals.lcp = entries[entries.length - 1].startTime;
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // Collect CLS using PerformanceObserver
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          vitals.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // Collect FID using PerformanceObserver
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            vitals.fid = entry.processingStart - entry.startTime;
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // Calculate TTFB from navigation timing
        const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navTiming) {
          vitals.ttfb = navTiming.responseStart - navTiming.fetchStart;
        }

        // Estimate TTI (simplified calculation)
        vitals.tti = estimateTimeToInteractive();

        // Estimate TBT (simplified calculation)
        vitals.tbt = estimateTotalBlockingTime();

      } catch (error) {
        console.warn('Error collecting Core Web Vitals:', error);
      }
    }

    return vitals;
  }, []);

  /**
   * Collect resource timing data
   */
  const collectResourceTiming = useCallback(): ResourceTiming[] => {
    const resources: ResourceTiming[] = [];
    
    if ('performance' in window && 'getEntriesByType' in performance) {
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      for (const entry of resourceEntries) {
        const resource: ResourceTiming = {
          name: entry.name,
          duration: entry.duration,
          size: (entry as any).transferSize || 0,
          type: determineResourceType(entry.name),
          cacheHit: (entry as any).transferSize === 0 && entry.duration > 0,
          compressionRatio: calculateCompressionRatio(entry as any),
          startTime: entry.startTime,
          responseStart: entry.responseStart,
          responseEnd: entry.responseEnd
        };
        resources.push(resource);
      }
    }
    
    return resources.slice(-50); // Keep last 50 resources
  }, []);

  /**
   * Collect user timing data
   */
  const collectUserTiming = useCallback(): UserTiming[] => {
    const userTimings: UserTiming[] = [];
    
    if ('performance' in window && 'getEntriesByType' in performance) {
      const measureEntries = performance.getEntriesByType('measure');
      const markEntries = performance.getEntriesByType('mark');
      
      [...measureEntries, ...markEntries].forEach(entry => {
        userTimings.push({
          name: entry.name,
          duration: entry.duration || 0,
          startTime: entry.startTime,
          entryType: entry.entryType
        });
      });
    }
    
    return userTimings.slice(-20); // Keep last 20 user timings
  }, []);

  /**
   * Collect navigation timing data
   */
  const collectNavigationTiming = useCallback(): NavigationTiming => {
    const defaultTiming: NavigationTiming = {
      domContentLoaded: 0,
      loadComplete: 0,
      redirectTime: 0,
      dnsTime: 0,
      connectTime: 0,
      tlsTime: 0,
      requestTime: 0,
      responseTime: 0,
      domParseTime: 0,
      resourceLoadTime: 0
    };

    if ('performance' in window && 'getEntriesByType' in performance) {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      if (navTiming) {
        return {
          domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart,
          loadComplete: navTiming.loadEventEnd - navTiming.loadEventStart,
          redirectTime: navTiming.redirectEnd - navTiming.redirectStart,
          dnsTime: navTiming.domainLookupEnd - navTiming.domainLookupStart,
          connectTime: navTiming.connectEnd - navTiming.connectStart,
          tlsTime: navTiming.connectEnd - navTiming.secureConnectionStart,
          requestTime: navTiming.responseStart - navTiming.requestStart,
          responseTime: navTiming.responseEnd - navTiming.responseStart,
          domParseTime: navTiming.domComplete - navTiming.domLoading,
          resourceLoadTime: navTiming.loadEventEnd - navTiming.domContentLoadedEventEnd
        };
      }
    }
    
    return defaultTiming;
  }, []);

  /**
   * Collect memory information
   */
  const collectMemoryInfo = useCallback(): MemoryInfo => {
    const defaultMemory: MemoryInfo = {
      used: 0,
      total: 0,
      limit: 0,
      usagePercentage: 0,
      gcInfo: {
        collections: 0,
        duration: 0,
        reclaimedMemory: 0,
        frequency: 0
      }
    };

    if ('performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory;
      
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
        gcInfo: estimateGCInfo(memory)
      };
    }
    
    return defaultMemory;
  }, []);

  /**
   * Collect network information
   */
  const collectNetworkInfo = useCallback(): NetworkInfo => {
    const defaultNetwork: NetworkInfo = {
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
      quality: 'good'
    };

    if ('navigator' in window && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const networkInfo: NetworkInfo = {
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
        quality: determineNetworkQuality(connection)
      };
      
      return networkInfo;
    }
    
    return defaultNetwork;
  }, []);

  /**
   * Calculate overall performance score
   */
  const calculatePerformanceScore = useCallback((vitals: CoreWebVitals): number => {
    let score = 100;
    
    // Deduct points based on Core Web Vitals
    if (vitals.fcp && vitals.fcp > 2000) score -= 15;
    if (vitals.lcp && vitals.lcp > 4000) score -= 20;
    if (vitals.fid && vitals.fid > 100) score -= 15;
    if (vitals.cls && vitals.cls > 0.1) score -= 15;
    if (vitals.ttfb && vitals.ttfb > 800) score -= 10;
    if (vitals.tti && vitals.tti > 5000) score -= 10;
    if (vitals.tbt && vitals.tbt > 300) score -= 15;
    
    return Math.max(0, score);
  }, []);

  /**
   * Check for performance alerts
   */
  const checkForAlerts = useCallback((metrics: RealTimeMetrics) => {
    const newAlerts: PerformanceAlert[] = [];
    
    Object.entries(alertThresholds).forEach(([metric, threshold]) => {
      const value = metrics.coreWebVitals[metric as keyof CoreWebVitals];
      
      if (value && threshold && value > threshold) {
        const alert: PerformanceAlert = {
          id: `${metric}_${Date.now()}`,
          type: value > threshold * 1.5 ? 'critical' : 'warning',
          metric,
          value,
          threshold,
          message: `${metric.toUpperCase()} exceeded threshold: ${value.toFixed(2)}ms > ${threshold}ms`,
          timestamp: Date.now(),
          resolved: false
        };
        
        newAlerts.push(alert);
        
        if (onAlert) {
          onAlert(alert);
        }
      }
    });
    
    setPerformanceAlerts(prev => [...prev, ...newAlerts]);
  }, [alertThresholds, onAlert]);

  /**
   * Start real-time monitoring
   */
  const startMonitoring = useCallback(async () => {
    if (isMonitoring) return;
    
    setIsMonitoring(true);
    
    const collectAndUpdate = async () => {
      try {
        const metrics = await collectRealTimeMetrics();
        setRealTimeMetrics(metrics);
        
        // Add to historical data
        setHistoricalData(prev => {
          const updated = [...prev, metrics];
          return updated.slice(-100); // Keep last 100 entries
        });
        
        // Check for alerts
        checkForAlerts(metrics);
        
      } catch (error) {
        console.error('Error collecting real-time metrics:', error);
      }
    };
    
    // Initial collection
    await collectAndUpdate();
    
    // Set up interval
    const interval = setInterval(collectAndUpdate, refreshInterval);
    
    return () => {
      clearInterval(interval);
      setIsMonitoring(false);
    };
  }, [isMonitoring, refreshInterval, collectRealTimeMetrics, checkForAlerts]);

  /**
   * Stop monitoring
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
  }, []);

  /**
   * Resolve alert
   */
  const resolveAlert = useCallback((alertId: string) => {
    setPerformanceAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true } : alert
      )
    );
  }, []);

  // Start monitoring on mount
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);

  // Helper functions
  const determineResourceType = (url: string): string => {
    if (url.match(/\.(js|jsx|ts|tsx)(\?|$)/)) return 'script';
    if (url.match(/\.(css|scss|sass)(\?|$)/)) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)(\?|$)/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)(\?|$)/)) return 'font';
    if (url.includes('/api/')) return 'xhr';
    return 'other';
  };

  const calculateCompressionRatio = (entry: any): number => {
    if (entry.encodedBodySize && entry.decodedBodySize) {
      return (entry.encodedBodySize / entry.decodedBodySize);
    }
    return 1;
  };

  const estimateTimeToInteractive = (): number => {
    // Simplified TTI estimation
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navTiming) {
      return navTiming.domContentLoadedEventEnd + 1000; // Estimate
    }
    return 0;
  };

  const estimateTotalBlockingTime = (): number => {
    // Simplified TBT estimation
    const longTasks = performance.getEntriesByType('longtask');
    return longTasks.reduce((total, task) => total + Math.max(0, task.duration - 50), 0);
  };

  const estimateGCInfo = (memory: any): GCInfo => {
    // Simplified GC info estimation
    return {
      collections: 0,
      duration: 0,
      reclaimedMemory: 0,
      frequency: 0
    };
  };

  const determineNetworkQuality = (connection: any): 'excellent' | 'good' | 'fair' | 'poor' => {
    const effectiveType = connection.effectiveType;
    const rtt = connection.rtt;
    
    if (effectiveType === '4g' && rtt < 100) return 'excellent';
    if (effectiveType === '4g' || (effectiveType === '3g' && rtt < 200)) return 'good';
    if (effectiveType === '3g' || effectiveType === '2g') return 'fair';
    return 'poor';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="real-time-monitoring-dashboard p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Real-Time Performance Monitoring</h1>
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              isMonitoring ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-gray-500'}`}></div>
              <span className="text-sm font-medium">
                {isMonitoring ? 'Monitoring Active' : 'Monitoring Stopped'}
              </span>
            </div>
            <button
              onClick={isMonitoring ? stopMonitoring : startMonitoring}
              className={`px-4 py-2 rounded-md font-medium ${
                isMonitoring 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>
          </div>
        </div>

        {/* Performance Score */}
        {realTimeMetrics && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Performance Score</h2>
              <div className={`text-3xl font-bold ${
                realTimeMetrics.performanceScore >= 90 ? 'text-green-600' :
                realTimeMetrics.performanceScore >= 70 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {realTimeMetrics.performanceScore.toFixed(0)}
              </div>
            </div>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    realTimeMetrics.performanceScore >= 90 ? 'bg-green-500' :
                    realTimeMetrics.performanceScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${realTimeMetrics.performanceScore}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Core Web Vitals */}
        {realTimeMetrics && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Core Web Vitals</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {Object.entries(realTimeMetrics.coreWebVitals).map(([key, value]) => (
                <div key={key} className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {value ? formatDuration(value) : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600 uppercase tracking-wide">
                    {key}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Alerts */}
        {performanceAlerts.filter(alert => !alert.resolved).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Performance Alerts</h2>
            <div className="space-y-3">
              {performanceAlerts
                .filter(alert => !alert.resolved)
                .slice(-5)
                .map(alert => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-md border-l-4 ${
                      alert.type === 'critical' ? 'bg-red-50 border-red-400' :
                      alert.type === 'error' ? 'bg-orange-50 border-orange-400' :
                      'bg-yellow-50 border-yellow-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${
                          alert.type === 'critical' ? 'text-red-800' :
                          alert.type === 'error' ? 'text-orange-800' :
                          'text-yellow-800'
                        }`}>
                          {alert.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="text-xs bg-white px-2 py-1 rounded border hover:bg-gray-50"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Performance Budget Monitor */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <PerformanceBudgetMonitor
            budgets={{
              firstContentfulPaint: alertThresholds.fcp || 2000,
              largestContentfulPaint: alertThresholds.lcp || 4000,
              firstInputDelay: alertThresholds.fid || 100,
              cumulativeLayoutShift: alertThresholds.cls || 0.1,
              timeToInteractive: 5000,
              totalBlockingTime: 300,
              speedIndex: 4000,
              memoryUsage: 50 * 1024 * 1024,
              bundleSize: 250 * 1024,
              renderTime: 16
            }}
            onBudgetExceeded={(budget) => {
              console.warn('Budget exceeded:', budget);
            }}
          />
        </div>

        {/* Service Worker Manager */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <ServiceWorkerManager
            onUpdateAvailable={() => {
              console.log('Service worker update available');
            }}
            onOfflineReady={() => {
              console.log('App ready for offline use');
            }}
          />
        </div>

        {/* Network & Memory Info */}
        {realTimeMetrics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Network Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Connection Type:</span>
                  <span className="font-medium">{realTimeMetrics.networkInfo.effectiveType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Downlink:</span>
                  <span className="font-medium">{realTimeMetrics.networkInfo.downlink} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">RTT:</span>
                  <span className="font-medium">{realTimeMetrics.networkInfo.rtt}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quality:</span>
                  <span className={`font-medium ${
                    realTimeMetrics.networkInfo.quality === 'excellent' ? 'text-green-600' :
                    realTimeMetrics.networkInfo.quality === 'good' ? 'text-blue-600' :
                    realTimeMetrics.networkInfo.quality === 'fair' ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {realTimeMetrics.networkInfo.quality}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Memory Usage</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Used:</span>
                  <span className="font-medium">{formatBytes(realTimeMetrics.memoryInfo.used)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-medium">{formatBytes(realTimeMetrics.memoryInfo.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Limit:</span>
                  <span className="font-medium">{formatBytes(realTimeMetrics.memoryInfo.limit)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Usage:</span>
                  <span className="font-medium">{realTimeMetrics.memoryInfo.usagePercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      realTimeMetrics.memoryInfo.usagePercentage > 80 ? 'bg-red-500' :
                      realTimeMetrics.memoryInfo.usagePercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(realTimeMetrics.memoryInfo.usagePercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealTimeMonitoringDashboard;