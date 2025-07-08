import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/metrics';
import { apm } from '@/lib/apm';
import { healthCheck } from '@/lib/monitoring';

export async function GET(request: NextRequest) {
  const traceId = apm.startTrace('metrics_endpoint');
  
  try {
    // Check if metrics are requested in Prometheus format
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    
    if (format === 'prometheus') {
      // Return Prometheus metrics
      const metrics = register.metrics();
      
      apm.endTrace(traceId, { format: 'prometheus', success: true });
      
      return new NextResponse(metrics, {
        status: 200,
        headers: {
          'Content-Type': register.contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    // Return JSON metrics for dashboard
    const performanceMetrics = apm.getMetrics();
    const healthData = await healthCheck();
    
    const metricsData = {
      timestamp: new Date().toISOString(),
      performance: performanceMetrics,
      health: healthData,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV,
      },
    };
    
    apm.endTrace(traceId, { format: 'json', success: true });
    
    return NextResponse.json(metricsData, {
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
    
    console.error('Metrics endpoint error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve metrics',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}