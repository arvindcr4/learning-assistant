import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export async function GET(request: NextRequest) {
  try {
    // Path to the OpenAPI specification file
    const specPath = path.join(process.cwd(), 'docs', 'api', 'openapi.yml');
    
    // Check if the file exists
    if (!fs.existsSync(specPath)) {
      return NextResponse.json(
        { error: 'OpenAPI specification not found' },
        { status: 404 }
      );
    }
    
    // Read the YAML file
    const yamlContent = fs.readFileSync(specPath, 'utf8');
    
    // Parse YAML to JSON
    const openApiSpec = yaml.load(yamlContent) as any;
    
    // Update servers based on the current request
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}/api`;
    
    // Update server information dynamically
    openApiSpec.servers = [
      {
        url: baseUrl,
        description: `Current environment (${process.env.NODE_ENV || 'development'})`
      },
      ...(openApiSpec.servers || [])
    ];
    
    // Add additional metadata
    openApiSpec.info = {
      ...openApiSpec.info,
      'x-environment': process.env.NODE_ENV || 'development',
      'x-build-time': new Date().toISOString(),
      'x-version': process.env.npm_package_version || '1.0.0'
    };
    
    // Create response with proper headers
    const response = NextResponse.json(openApiSpec);
    
    // Set CORS headers for broader compatibility
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    
    // Set caching headers
    response.headers.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    response.headers.set('ETag', `"${Date.now()}"`);
    
    return response;
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to load API specification',
        message: error instanceof Error ? error.message : 'Unknown error'
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