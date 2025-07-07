#!/bin/bash

# Fly.io Monitoring and Health Checks Setup for Learning Assistant
# This script configures comprehensive monitoring, alerting, and health checks

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Application configuration
APP_NAME="learning-assistant-lively-rain-3457"
PRIMARY_REGION="bom"

echo -e "${BLUE}📊 Setting up monitoring and health checks for Learning Assistant${NC}"
echo -e "${BLUE}App: ${APP_NAME}${NC}"

# Function to prompt for yes/no
prompt_yes_no() {
    local prompt="$1"
    local response
    
    while true; do
        read -p "$prompt [y/N]: " response
        case $response in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local value
    
    read -p "$prompt [$default]: " value
    echo "${value:-$default}"
}

# Enhanced health check API endpoint
echo -e "\n${BLUE}🏥 Enhancing health check endpoint...${NC}"
cat > /tmp/enhanced-health-check.ts << 'EOF'
import { NextResponse } from 'next/server';
import { loggerHealthCheck } from '@/lib/logger';
import { metricsHealthCheck } from '@/lib/metrics';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  region: string;
  machine_id: string;
  checks: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    requests: {
      total: number;
      rate: number;
    };
  };
}

// Enhanced database check with connection pooling
const checkDatabase = async (): Promise<{ status: 'healthy' | 'unhealthy'; message?: string; responseTime: number; details?: any }> => {
  const startTime = Date.now();
  
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1, // Use single connection for health check
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });
    
    const result = await pool.query('SELECT NOW(), version() as db_version');
    const responseTime = Date.now() - startTime;
    
    await pool.end();
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        timestamp: result.rows[0].now,
        version: result.rows[0].db_version.split(' ')[0],
        connectionTime: responseTime
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Database connection failed',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

// System metrics check
const checkSystemMetrics = (): { status: 'healthy' | 'unhealthy'; message?: string; responseTime: number; details: any } => {
  const startTime = Date.now();
  
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const isMemoryHealthy = memoryPercentage < 90;
    
    const details = {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: memoryPercentage,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
    
    return {
      status: isMemoryHealthy ? 'healthy' : 'unhealthy',
      message: isMemoryHealthy ? undefined : `High memory usage: ${memoryPercentage.toFixed(1)}%`,
      responseTime: Date.now() - startTime,
      details
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'System metrics check failed',
      responseTime: Date.now() - startTime,
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
};

// Network connectivity check
const checkNetworkConnectivity = async (): Promise<{ status: 'healthy' | 'unhealthy'; message?: string; responseTime: number; details?: any }> => {
  const startTime = Date.now();
  
  try {
    // Simple network check by resolving DNS
    const dns = require('dns').promises;
    await dns.resolve('fly.io', 'A');
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      details: {
        dnsResolution: 'successful'
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Network connectivity failed',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Run all health checks in parallel
    const [
      databaseCheck,
      systemMetricsCheck,
      networkCheck,
      loggerCheck,
      metricsCheck
    ] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkSystemMetrics()),
      checkNetworkConnectivity(),
      Promise.resolve({
        status: loggerHealthCheck() ? 'healthy' : 'unhealthy',
        responseTime: 1,
        message: loggerHealthCheck() ? undefined : 'Logger not responding'
      } as const),
      Promise.resolve({
        status: metricsHealthCheck() ? 'healthy' : 'unhealthy',
        responseTime: 1,
        message: metricsHealthCheck() ? undefined : 'Metrics not available'
      } as const)
    ]);
    
    const checks = {
      database: databaseCheck,
      system: systemMetricsCheck,
      network: networkCheck,
      logger: loggerCheck,
      metrics: metricsCheck
    };
    
    // Calculate overall status
    const unhealthyChecks = Object.values(checks).filter(check => check.status === 'unhealthy');
    const overallStatus = unhealthyChecks.length === 0 ? 'healthy' : 
                         unhealthyChecks.length < Object.keys(checks).length ? 'degraded' : 'unhealthy';
    
    // Get system metrics for response
    const memoryUsage = process.memoryUsage();
    const metrics = {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      cpu: {
        usage: process.cpuUsage().user + process.cpuUsage().system
      },
      requests: {
        total: 0, // Would need to implement request counter
        rate: 0   // Would need to implement request rate tracking
      }
    };
    
    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      region: process.env.FLY_REGION || 'unknown',
      machine_id: process.env.FLY_MACHINE_ID || 'unknown',
      checks,
      metrics
    };
    
    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(result, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check-Duration': `${Date.now() - startTime}ms`,
        'X-Region': process.env.FLY_REGION || 'unknown',
        'X-Machine-ID': process.env.FLY_MACHINE_ID || 'unknown'
      }
    });
    
  } catch (error) {
    const result: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      region: process.env.FLY_REGION || 'unknown',
      machine_id: process.env.FLY_MACHINE_ID || 'unknown',
      checks: {
        error: {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error during health check',
          responseTime: Date.now() - startTime
        }
      },
      metrics: {
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0 },
        requests: { total: 0, rate: 0 }
      }
    };
    
    return NextResponse.json(result, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check-Duration': `${Date.now() - startTime}ms`,
        'X-Region': process.env.FLY_REGION || 'unknown',
        'X-Machine-ID': process.env.FLY_MACHINE_ID || 'unknown'
      }
    });
  }
}

// Enhanced HEAD request for load balancer health checks
export async function HEAD(): Promise<NextResponse> {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    const status = memoryUsagePercent > 95 ? 503 : 200;
    
    return new NextResponse(null, { 
      status,
      headers: {
        'X-Memory-Usage': `${memoryUsagePercent.toFixed(1)}%`,
        'X-Region': process.env.FLY_REGION || 'unknown',
        'X-Machine-ID': process.env.FLY_MACHINE_ID || 'unknown',
        'X-Uptime': process.uptime().toString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
EOF

echo -e "${GREEN}Enhanced health check endpoint created at /tmp/enhanced-health-check.ts${NC}"
echo -e "${YELLOW}Replace your existing health check endpoint with this enhanced version${NC}"

# Create monitoring configuration
echo -e "\n${BLUE}📊 Creating monitoring configuration...${NC}"
cat > /tmp/monitoring-config.toml << 'EOF'
# Enhanced monitoring configuration for fly.toml

# Health checks with multiple endpoints
[checks]
  # Primary health check
  [checks.health]
    grace_period = "30s"
    interval = "10s"
    method = "GET"
    timeout = "8s"
    path = "/api/health"
    protocol = "http"
    tls_skip_verify = false
    [checks.health.headers]
      "User-Agent" = "Fly-Health-Check"
      "X-Health-Check-Type" = "primary"
  
  # Quick readiness check
  [checks.readiness]
    grace_period = "15s"
    interval = "5s"
    method = "HEAD"
    timeout = "3s"
    path = "/api/health"
    protocol = "http"
    tls_skip_verify = false
    [checks.readiness.headers]
      "User-Agent" = "Fly-Readiness-Check"
  
  # Database-specific check
  [checks.database]
    grace_period = "60s"
    interval = "30s"
    method = "GET"
    timeout = "10s"
    path = "/api/health/database"
    protocol = "http"
    tls_skip_verify = false
    [checks.database.headers]
      "User-Agent" = "Fly-Database-Check"
      "X-Health-Check-Type" = "database"

# Metrics endpoint
[metrics]
  port = 9091
  path = "/metrics"
  
# Process monitoring
[processes]
  app = "npm start"
  
# Auto-scaling based on metrics
[http_service]
  # Enhanced concurrency settings
  concurrency = { type = "requests", hard_limit = 500, soft_limit = 400 }
  
  # Circuit breaker settings
  [http_service.options]
    circuit_breaker = true
    circuit_breaker_threshold = 10
    circuit_breaker_timeout = "30s"
EOF

echo -e "${GREEN}Monitoring configuration created at /tmp/monitoring-config.toml${NC}"

# Create metrics endpoint
echo -e "\n${BLUE}📈 Creating metrics endpoint...${NC}"
cat > /tmp/metrics-endpoint.ts << 'EOF'
import { NextResponse } from 'next/server';
import { register } from 'prom-client';

// Create metrics endpoint for Prometheus monitoring
export async function GET(): Promise<NextResponse> {
  try {
    const metrics = await register.metrics();
    
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': register.contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Region': process.env.FLY_REGION || 'unknown',
        'X-Machine-ID': process.env.FLY_MACHINE_ID || 'unknown'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    );
  }
}
EOF

echo -e "${GREEN}Metrics endpoint created at /tmp/metrics-endpoint.ts${NC}"

# Create alerting configuration
echo -e "\n${BLUE}🚨 Setting up alerting...${NC}"
if prompt_yes_no "Do you want to set up Slack/Discord webhook for alerts?"; then
    webhook_url=$(prompt_with_default "Webhook URL" "")
    
    if [ -n "$webhook_url" ]; then
        echo -e "${GREEN}Setting webhook URL as secret...${NC}"
        fly secrets set ALERT_WEBHOOK_URL="$webhook_url" --app "$APP_NAME"
        
        # Create alerting script
        cat > /tmp/alerting.ts << 'EOF'
interface AlertPayload {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  region: string;
  machine_id: string;
  app_name: string;
  health_status?: string;
  metrics?: any;
}

export async function sendAlert(payload: AlertPayload) {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('No webhook URL configured, skipping alert');
    return;
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `🚨 ${payload.title}`,
        attachments: [
          {
            color: payload.severity === 'critical' ? 'danger' : 
                   payload.severity === 'high' ? 'warning' : 'good',
            fields: [
              {
                title: 'Message',
                value: payload.message,
                short: false
              },
              {
                title: 'App',
                value: payload.app_name,
                short: true
              },
              {
                title: 'Region',
                value: payload.region,
                short: true
              },
              {
                title: 'Machine ID',
                value: payload.machine_id,
                short: true
              },
              {
                title: 'Timestamp',
                value: payload.timestamp,
                short: true
              }
            ]
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('Alert sent successfully');
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
}

// Health check with alerting
export async function monitorHealthAndAlert() {
  try {
    const response = await fetch('/api/health');
    const healthData = await response.json();
    
    if (healthData.status === 'unhealthy') {
      await sendAlert({
        severity: 'high',
        title: 'Application Health Check Failed',
        message: `Health check failed with status: ${healthData.status}`,
        timestamp: new Date().toISOString(),
        region: process.env.FLY_REGION || 'unknown',
        machine_id: process.env.FLY_MACHINE_ID || 'unknown',
        app_name: process.env.FLY_APP_NAME || 'learning-assistant',
        health_status: healthData.status,
        metrics: healthData.metrics
      });
    }
    
    // Check for high memory usage
    if (healthData.metrics?.memory?.percentage > 85) {
      await sendAlert({
        severity: 'medium',
        title: 'High Memory Usage',
        message: `Memory usage is ${healthData.metrics.memory.percentage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        region: process.env.FLY_REGION || 'unknown',
        machine_id: process.env.FLY_MACHINE_ID || 'unknown',
        app_name: process.env.FLY_APP_NAME || 'learning-assistant',
        metrics: healthData.metrics
      });
    }
    
    // Check for database issues
    if (healthData.checks?.database?.status === 'unhealthy') {
      await sendAlert({
        severity: 'critical',
        title: 'Database Connection Failed',
        message: `Database health check failed: ${healthData.checks.database.message}`,
        timestamp: new Date().toISOString(),
        region: process.env.FLY_REGION || 'unknown',
        machine_id: process.env.FLY_MACHINE_ID || 'unknown',
        app_name: process.env.FLY_APP_NAME || 'learning-assistant',
        health_status: healthData.status
      });
    }
    
  } catch (error) {
    await sendAlert({
      severity: 'high',
      title: 'Monitoring Script Failed',
      message: `Failed to check application health: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString(),
      region: process.env.FLY_REGION || 'unknown',
      machine_id: process.env.FLY_MACHINE_ID || 'unknown',
      app_name: process.env.FLY_APP_NAME || 'learning-assistant'
    });
  }
}
EOF

        echo -e "${GREEN}Alerting configuration created at /tmp/alerting.ts${NC}"
    fi
fi

# Set up monitoring secrets
echo -e "\n${BLUE}🔐 Setting up monitoring secrets...${NC}"
fly secrets set \
    ENABLE_METRICS=true \
    METRICS_PORT=9091 \
    ENABLE_HEALTH_CHECKS=true \
    HEALTH_CHECK_INTERVAL=10 \
    MONITORING_ENABLED=true \
    --app "$APP_NAME"

# Create monitoring dashboard script
echo -e "\n${BLUE}📊 Creating monitoring dashboard...${NC}"
cat > /tmp/monitoring-dashboard.sh << 'EOF'
#!/bin/bash

# Monitoring dashboard script for Learning Assistant
# This script provides a real-time view of application health and metrics

set -e

APP_NAME="learning-assistant-lively-rain-3457"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to get health status
get_health_status() {
    curl -s -f "https://$APP_NAME.fly.dev/api/health" 2>/dev/null || echo '{"status":"unknown"}'
}

# Function to display metrics
display_metrics() {
    clear
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}           Learning Assistant - Monitoring Dashboard           ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo
    
    # App status
    echo -e "${YELLOW}📊 Application Status:${NC}"
    fly status --app "$APP_NAME"
    echo
    
    # Health check
    echo -e "${YELLOW}🏥 Health Status:${NC}"
    health_data=$(get_health_status)
    status=$(echo "$health_data" | jq -r '.status // "unknown"')
    
    case $status in
        "healthy")
            echo -e "${GREEN}✅ Status: HEALTHY${NC}"
            ;;
        "degraded")
            echo -e "${YELLOW}⚠️  Status: DEGRADED${NC}"
            ;;
        "unhealthy")
            echo -e "${RED}❌ Status: UNHEALTHY${NC}"
            ;;
        *)
            echo -e "${RED}❓ Status: UNKNOWN${NC}"
            ;;
    esac
    
    # Detailed health info
    if [ "$status" != "unknown" ]; then
        echo "   Uptime: $(echo "$health_data" | jq -r '.uptime // "unknown"')s"
        echo "   Region: $(echo "$health_data" | jq -r '.region // "unknown"')"
        echo "   Machine: $(echo "$health_data" | jq -r '.machine_id // "unknown"')"
        
        # Memory usage
        memory_percent=$(echo "$health_data" | jq -r '.metrics.memory.percentage // 0')
        if (( $(echo "$memory_percent > 80" | bc -l) )); then
            echo -e "   Memory: ${RED}${memory_percent}%${NC}"
        elif (( $(echo "$memory_percent > 60" | bc -l) )); then
            echo -e "   Memory: ${YELLOW}${memory_percent}%${NC}"
        else
            echo -e "   Memory: ${GREEN}${memory_percent}%${NC}"
        fi
    fi
    echo
    
    # Machines list
    echo -e "${YELLOW}🖥️  Machines:${NC}"
    fly machines list --app "$APP_NAME"
    echo
    
    # Recent logs
    echo -e "${YELLOW}📋 Recent Logs (last 10 lines):${NC}"
    fly logs --app "$APP_NAME" -n 10
    echo
    
    # Volumes
    echo -e "${YELLOW}💾 Volumes:${NC}"
    fly volumes list --app "$APP_NAME"
    echo
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Last updated: $(date)${NC}"
    echo -e "${BLUE}Press Ctrl+C to exit${NC}"
}

# Main monitoring loop
echo -e "${GREEN}Starting monitoring dashboard...${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit${NC}"

while true; do
    display_metrics
    sleep 30
done
EOF

chmod +x /tmp/monitoring-dashboard.sh
echo -e "${GREEN}Monitoring dashboard created at /tmp/monitoring-dashboard.sh${NC}"

# Create uptime monitoring script
echo -e "\n${BLUE}⏰ Creating uptime monitoring...${NC}"
cat > /tmp/uptime-monitor.sh << 'EOF'
#!/bin/bash

# Uptime monitoring script for Learning Assistant
# This script continuously monitors application uptime and logs status

set -e

APP_NAME="learning-assistant-lively-rain-3457"
LOG_FILE="/tmp/uptime-monitor.log"
ALERT_THRESHOLD=3  # Alert after 3 consecutive failures

# Initialize counters
consecutive_failures=0
total_checks=0
successful_checks=0

echo "Starting uptime monitoring for $APP_NAME"
echo "Log file: $LOG_FILE"
echo "Alert threshold: $ALERT_THRESHOLD consecutive failures"

# Function to log with timestamp
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to check application health
check_health() {
    local url="https://$APP_NAME.fly.dev/api/health"
    local response
    local http_code
    
    response=$(curl -s -w "HTTP_CODE:%{http_code}" -f "$url" 2>/dev/null || echo "HTTP_CODE:000")
    http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    
    if [ "$http_code" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Function to send alert
send_alert() {
    local message="$1"
    log_message "ALERT: $message"
    
    # Send webhook alert if configured
    if [ -n "$ALERT_WEBHOOK_URL" ]; then
        curl -X POST "$ALERT_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"🚨 Learning Assistant Alert: $message\"}" \
            2>/dev/null || log_message "Failed to send webhook alert"
    fi
}

# Main monitoring loop
log_message "Uptime monitoring started"

while true; do
    total_checks=$((total_checks + 1))
    
    if check_health; then
        if [ $consecutive_failures -gt 0 ]; then
            log_message "Service recovered after $consecutive_failures consecutive failures"
            consecutive_failures=0
        fi
        
        successful_checks=$((successful_checks + 1))
        
        # Log success every 100 checks
        if [ $((total_checks % 100)) -eq 0 ]; then
            uptime_percentage=$(echo "scale=2; $successful_checks * 100 / $total_checks" | bc)
            log_message "Status: OK (Uptime: ${uptime_percentage}%)"
        fi
    else
        consecutive_failures=$((consecutive_failures + 1))
        log_message "Health check failed (attempt $consecutive_failures)"
        
        if [ $consecutive_failures -eq $ALERT_THRESHOLD ]; then
            send_alert "Service is down after $consecutive_failures consecutive failures"
        fi
    fi
    
    # Wait 30 seconds before next check
    sleep 30
done
EOF

chmod +x /tmp/uptime-monitor.sh
echo -e "${GREEN}Uptime monitoring script created at /tmp/uptime-monitor.sh${NC}"

# Display monitoring setup summary
echo -e "\n${GREEN}📋 Monitoring Setup Summary:${NC}"
echo "1. Enhanced health check endpoint with detailed metrics"
echo "2. Prometheus metrics endpoint for monitoring"
echo "3. Alerting system with webhook notifications"
echo "4. Monitoring dashboard for real-time status"
echo "5. Uptime monitoring with failure tracking"
echo "6. Comprehensive health checks in fly.toml"

echo -e "\n${YELLOW}🔧 Files Created:${NC}"
echo "- /tmp/enhanced-health-check.ts - Enhanced health check endpoint"
echo "- /tmp/monitoring-config.toml - Monitoring configuration for fly.toml"
echo "- /tmp/metrics-endpoint.ts - Prometheus metrics endpoint"
echo "- /tmp/alerting.ts - Alerting system"
echo "- /tmp/monitoring-dashboard.sh - Real-time monitoring dashboard"
echo "- /tmp/uptime-monitor.sh - Uptime monitoring script"

echo -e "\n${BLUE}📊 Next Steps:${NC}"
echo "1. Copy enhanced health check to src/app/api/health/route.ts"
echo "2. Add metrics endpoint to src/app/api/metrics/route.ts"
echo "3. Update fly.toml with monitoring configuration"
echo "4. Deploy application: fly deploy --app $APP_NAME"
echo "5. Test health checks: curl https://$APP_NAME.fly.dev/api/health"
echo "6. Set up monitoring dashboard: ./monitoring-dashboard.sh"
echo "7. Start uptime monitoring: ./uptime-monitor.sh"

echo -e "\n${GREEN}🎉 Monitoring setup complete!${NC}"