import { NextRequest, NextResponse } from 'next/server';

// Sentry tunnel to bypass ad blockers
// This endpoint forwards Sentry events to the Sentry ingest API
// to avoid being blocked by ad blockers or privacy extensions

const SENTRY_HOST = 'sentry.io';
const SENTRY_PROJECT_IDS = new Set([
  // Add your Sentry project IDs here
  process.env.SENTRY_PROJECT_ID,
].filter(Boolean));

export async function POST(request: NextRequest) {
  try {
    // Parse the envelope
    const envelope = await request.text();
    
    if (!envelope) {
      return new NextResponse('No envelope provided', { status: 400 });
    }

    // Extract the first line (header) to get project ID
    const lines = envelope.split('\n');
    if (lines.length < 2) {
      return new NextResponse('Invalid envelope format', { status: 400 });
    }

    let header;
    try {
      header = JSON.parse(lines[0]);
    } catch (error) {
      return new NextResponse('Invalid envelope header', { status: 400 });
    }

    // Validate project ID
    const projectId = header.dsn?.match(/\/(\d+)$/)?.[1];
    if (!projectId || (SENTRY_PROJECT_IDS.size > 0 && !SENTRY_PROJECT_IDS.has(projectId))) {
      return new NextResponse('Invalid project ID', { status: 400 });
    }

    // Forward to Sentry
    const sentryUrl = `https://${SENTRY_HOST}/api/${projectId}/envelope/`;
    
    const response = await fetch(sentryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'User-Agent': request.headers.get('User-Agent') || 'SentryTunnel/1.0',
        'X-Forwarded-For': request.headers.get('X-Forwarded-For') || 
                           request.headers.get('X-Real-IP') || 
                           'unknown',
      },
      body: envelope,
    });

    // Return response with appropriate status
    if (response.ok) {
      return new NextResponse(null, { status: 200 });
    } else {
      console.error(`Sentry tunnel error: ${response.status} ${response.statusText}`);
      return new NextResponse('Sentry tunnel error', { status: response.status });
    }
  } catch (error) {
    console.error('Sentry tunnel error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Health check for the tunnel
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'sentry-tunnel',
    timestamp: new Date().toISOString(),
  });
}