import { NextRequest, NextResponse } from 'next/server';
import { apm } from '@/lib/apm';
import { costMonitoring } from '@/lib/monitoring/cost-monitoring';

export async function GET(request: NextRequest) {
  const traceId = apm.startTrace('cost_analytics');
  
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '24h';
    const provider = url.searchParams.get('provider');
    const service = url.searchParams.get('service');
    
    // Get cost summary
    const costSummary = costMonitoring.getCostSummary();
    
    // Get optimization recommendations
    const recommendations = costMonitoring.getOptimizationRecommendations();
    
    // Mock detailed cost data based on timeRange
    const generateDetailedCosts = (range: string) => {
      const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720;
      const points = Math.min(hours, 24); // Max 24 data points
      const interval = hours / points;
      
      return Array.from({ length: points }, (_, i) => {
        const timestamp = new Date(Date.now() - (hours - i * interval) * 60 * 60 * 1000);
        return {
          timestamp: timestamp.toISOString(),
          total: 8.5 + Math.random() * 3,
          compute: 4.2 + Math.random() * 1.5,
          database: 2.1 + Math.random() * 0.8,
          storage: 1.0 + Math.random() * 0.3,
          network: 0.8 + Math.random() * 0.2,
          monitoring: 0.4 + Math.random() * 0.1,
        };
      });
    };
    
    const costData = {
      timestamp: new Date().toISOString(),
      timeRange,
      
      // Current costs
      current: costSummary,
      
      // Historical data
      historical: generateDetailedCosts(timeRange),
      
      // Cost breakdown by provider
      byProvider: {
        aws: {
          total: 156.80,
          services: {
            ec2: 89.50,
            rds: 34.20,
            s3: 18.40,
            lambda: 8.70,
            cloudwatch: 6.00,
          },
        },
        azure: {
          total: 78.20,
          services: {
            vm: 45.60,
            sql: 20.10,
            storage: 8.30,
            functions: 4.20,
          },
        },
        gcp: {
          total: 52.50,
          services: {
            compute: 30.20,
            cloudsql: 15.80,
            storage: 4.50,
            functions: 2.00,
          },
        },
        digitalocean: {
          total: 89.40,
          services: {
            droplets: 65.20,
            database: 18.40,
            volumes: 3.80,
            spaces: 2.00,
          },
        },
      },
      
      // Cost trends
      trends: {
        dailyGrowth: 2.5, // percentage
        weeklyGrowth: 8.3,
        monthlyGrowth: 15.7,
        efficiency: {
          costPerUser: 0.23,
          costPerSession: 0.12,
          costPerRequest: 0.001,
        },
      },
      
      // Optimization opportunities
      optimization: {
        recommendations,
        potentialSavings: recommendations.reduce((sum, rec) => sum + (rec.estimatedSavings || 0), 0),
        rightsizing: {
          overprovisioned: 3,
          underutilized: 2,
          savings: 45.30,
        },
        reservedInstances: {
          eligible: 5,
          currentCoverage: 0.15,
          potentialSavings: 78.50,
        },
        scheduledOperations: {
          eligible: 8,
          potentialSavings: 25.60,
        },
      },
      
      // Forecasting
      forecast: {
        nextWeek: 678.90,
        nextMonth: 2845.60,
        confidence: 0.87,
        factors: [
          'Seasonal usage patterns',
          'Recent scaling events',
          'Planned feature releases',
        ],
      },
      
      // Cost allocation
      allocation: {
        byEnvironment: {
          production: 67.5,
          staging: 18.2,
          development: 14.3,
        },
        byTeam: {
          backend: 45.6,
          frontend: 23.4,
          ml: 18.7,
          ops: 12.3,
        },
        byFeature: {
          'learning-engine': 34.5,
          'user-management': 23.1,
          'analytics': 18.9,
          'content-delivery': 15.6,
          'monitoring': 7.9,
        },
      },
      
      // Cost anomalies
      anomalies: [
        {
          id: 'anomaly-001',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          service: 'ec2',
          provider: 'aws',
          severity: 'medium',
          description: 'Unexpected 25% increase in compute costs',
          impact: 15.60,
          status: 'investigating',
        },
        {
          id: 'anomaly-002',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          service: 'storage',
          provider: 'gcp',
          severity: 'low',
          description: 'Data transfer costs higher than usual',
          impact: 3.20,
          status: 'resolved',
        },
      ],
      
      // Budget status
      budgets: costSummary.budgets,
      
      // Alerts
      alerts: costSummary.alerts,
    };
    
    // Type-safe provider data access
    interface CostDataWithDetails {
      providerDetails?: any;
      serviceDetails?: any;
      [key: string]: any;
    }
    
    const costDataWithDetails: CostDataWithDetails = { ...costData };
    
    // Filter by provider if specified
    if (provider && provider in costData.byProvider) {
      costDataWithDetails.providerDetails = costData.byProvider[provider as keyof typeof costData.byProvider];
    }
    
    // Filter by service if specified
    if (service && provider && provider in costData.byProvider) {
      const providerData = costData.byProvider[provider as keyof typeof costData.byProvider];
      if (providerData && typeof providerData === 'object' && 'services' in providerData) {
        const services = providerData.services as { [key: string]: number };
        if (service in services) {
          costDataWithDetails.serviceDetails = {
            cost: services[service],
            provider,
            service,
          };
        }
      }
    }
    
    apm.endTrace(traceId, { 
      timeRange, 
      provider, 
      service,
      totalCost: costData.current.daily.total,
      success: true 
    });
    
    return NextResponse.json(costDataWithDetails, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    
  } catch (error) {
    apm.endTrace(traceId, { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    console.error('Cost analytics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve cost analytics data',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const traceId = apm.startTrace('cost_tracking');
  
  try {
    const body = await request.json();
    const { provider, service, cost, resourceId, region } = body;
    
    if (!provider || !service || cost === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, service, cost' },
        { status: 400 }
      );
    }
    
    // Track the cost
    const costMetric = {
      provider,
      service,
      region: region || 'unknown',
      resourceId: resourceId || 'unknown',
      cost: parseFloat(cost),
      currency: 'USD',
      billingPeriod: 'daily',
      timestamp: new Date().toISOString(),
    };
    
    costMonitoring.trackCost(costMetric);
    
    apm.endTrace(traceId, { 
      provider, 
      service, 
      cost: costMetric.cost,
      success: true 
    });
    
    return NextResponse.json(
      { 
        message: 'Cost tracked successfully',
        metric: costMetric,
      },
      { status: 201 }
    );
    
  } catch (error) {
    apm.endTrace(traceId, { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    
    console.error('Cost tracking error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to track cost',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}