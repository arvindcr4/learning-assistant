#!/bin/bash

# Fly.io Multi-Region Deployment Script for Learning Assistant
# This script sets up multi-region deployment with scaling and load balancing

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Application configuration
APP_NAME="learning-assistant-lively-rain-3457"
PRIMARY_REGION="bom"  # Mumbai (primary region)

# Available regions for deployment
REGIONS=(
    "bom"  # Mumbai, India (primary)
    "sin"  # Singapore
    "nrt"  # Tokyo, Japan
    "syd"  # Sydney, Australia
    "fra"  # Frankfurt, Germany
    "lhr"  # London, UK
    "iad"  # Ashburn, VA, USA
    "sea"  # Seattle, WA, USA
    "lax"  # Los Angeles, CA, USA
    "gru"  # São Paulo, Brazil
)

echo -e "${BLUE}🌍 Setting up multi-region deployment for Learning Assistant${NC}"
echo -e "${BLUE}App: ${APP_NAME}${NC}"
echo -e "${BLUE}Primary Region: ${PRIMARY_REGION}${NC}"

# Function to prompt for yes/no
prompt_yes_no() {
    local prompt="$1"
    local default="$2"
    local response
    
    while true; do
        read -p "$prompt [y/N]: " response
        response=${response:-$default}
        case $response in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Function to select regions
select_regions() {
    echo -e "\n${BLUE}Available regions:${NC}"
    for i in "${!REGIONS[@]}"; do
        echo "$((i+1)). ${REGIONS[$i]}"
    done
    
    echo -e "\n${YELLOW}Select additional regions (comma-separated numbers, e.g., 2,3,4):${NC}"
    read -p "Regions: " selection
    
    local selected_regions=()
    IFS=',' read -ra ADDR <<< "$selection"
    for i in "${ADDR[@]}"; do
        index=$((i-1))
        if [[ $index -ge 0 && $index -lt ${#REGIONS[@]} ]]; then
            if [[ "${REGIONS[$index]}" != "$PRIMARY_REGION" ]]; then
                selected_regions+=("${REGIONS[$index]}")
            fi
        fi
    done
    
    echo "${selected_regions[@]}"
}

# Check current app status
echo -e "\n${YELLOW}📋 Checking current app status...${NC}"
fly status --app "$APP_NAME"

# Configure regions
echo -e "\n${BLUE}🗺️  Regional Configuration:${NC}"
if prompt_yes_no "Do you want to add additional regions?"; then
    additional_regions=($(select_regions))
    
    if [ ${#additional_regions[@]} -gt 0 ]; then
        echo -e "${GREEN}Selected additional regions: ${additional_regions[*]}${NC}"
        
        # Add regions to the app
        for region in "${additional_regions[@]}"; do
            echo -e "${GREEN}Adding region: $region${NC}"
            fly regions add "$region" --app "$APP_NAME"
        done
    else
        echo -e "${YELLOW}No additional regions selected${NC}"
    fi
else
    echo -e "${YELLOW}Keeping single region deployment${NC}"
fi

# Configure scaling
echo -e "\n${BLUE}📊 Scaling Configuration:${NC}"

# Get current regions
current_regions=$(fly regions list --app "$APP_NAME" | grep -v "Region" | grep -v "^$" | awk '{print $1}')
echo -e "${GREEN}Current regions: $current_regions${NC}"

# Configure scaling for each region
for region in $current_regions; do
    echo -e "\n${BLUE}Configuring scaling for region: $region${NC}"
    
    if [ "$region" = "$PRIMARY_REGION" ]; then
        # Primary region gets higher baseline
        min_machines=1
        max_machines=5
    else
        # Secondary regions start with 0, scale up as needed
        min_machines=0
        max_machines=3
    fi
    
    echo -e "${GREEN}Setting up scaling for $region (min: $min_machines, max: $max_machines)${NC}"
    
    # Scale machines in the region
    fly scale count "$min_machines" --region "$region" --app "$APP_NAME"
done

# Configure auto-scaling
echo -e "\n${BLUE}🔄 Auto-scaling Configuration:${NC}"
if prompt_yes_no "Do you want to enable auto-scaling?"; then
    echo -e "${GREEN}Enabling auto-scaling...${NC}"
    
    # Set auto-scaling parameters
    fly autoscale set \
        --min-machines-running=1 \
        --max-machines-running=10 \
        --metrics-target-cpu-percent=70 \
        --metrics-target-memory-percent=80 \
        --app "$APP_NAME"
    
    echo -e "${GREEN}Auto-scaling enabled with CPU target: 70%, Memory target: 80%${NC}"
fi

# Configure load balancing
echo -e "\n${BLUE}⚖️  Load Balancing Configuration:${NC}"
cat > /tmp/fly-lb-config.toml << EOF
# Load balancing configuration for multi-region deployment
[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]
  
  # Connection handling with better distribution
  concurrency = { type = "connections", hard_limit = 1000, soft_limit = 800 }
  
  # Regional preferences
  [http_service.options]
    # Prefer local region for better latency
    prefer_local_region = true
    # Enable connection pooling
    connection_pool = true
    # Session affinity for better user experience
    session_affinity = "cookie"

# Enhanced health checks for multi-region
[checks]
  [checks.health]
    grace_period = "30s"
    interval = "10s"
    method = "GET"
    timeout = "8s"
    path = "/api/health"
    protocol = "http"
    
  [checks.regional]
    grace_period = "60s"
    interval = "30s"
    method = "HEAD"
    timeout = "5s"
    path = "/api/health"
    protocol = "http"
    
    # Regional health check headers
    [checks.regional.headers]
      "X-Health-Check" = "regional"
      "X-Region" = "{{ .Region }}"
EOF

echo -e "${GREEN}Load balancing configuration created${NC}"

# Database considerations for multi-region
echo -e "\n${BLUE}🗄️  Database Multi-Region Setup:${NC}"
if prompt_yes_no "Do you want to set up database read replicas?"; then
    echo -e "${YELLOW}Setting up read replicas...${NC}"
    
    # List current regions for replica selection
    echo -e "${GREEN}Current app regions:${NC}"
    fly regions list --app "$APP_NAME"
    
    echo -e "\n${YELLOW}To create read replicas, run the following commands:${NC}"
    for region in $current_regions; do
        if [ "$region" != "$PRIMARY_REGION" ]; then
            echo -e "${BLUE}# Create read replica in $region${NC}"
            echo "fly postgres create --name learning-assistant-db-$region --region $region --fork-from learning-assistant-db"
            echo "fly postgres attach --app $APP_NAME learning-assistant-db-$region"
        fi
    done
    
    echo -e "\n${YELLOW}After creating replicas, configure read/write splitting:${NC}"
    echo "fly secrets set DATABASE_READ_REGIONS=\"$current_regions\" --app $APP_NAME"
fi

# Performance monitoring setup
echo -e "\n${BLUE}📈 Performance Monitoring:${NC}"
if prompt_yes_no "Do you want to enable enhanced monitoring?"; then
    echo -e "${GREEN}Enabling enhanced monitoring...${NC}"
    
    # Set monitoring configuration
    fly secrets set \
        ENABLE_METRICS=true \
        METRICS_PORT=9091 \
        ENABLE_REGIONAL_METRICS=true \
        ENABLE_PERFORMANCE_MONITORING=true \
        --app "$APP_NAME"
    
    echo -e "${GREEN}Enhanced monitoring enabled${NC}"
fi

# Regional preferences
echo -e "\n${BLUE}🌐 Regional Preferences:${NC}"
echo "Setting regional preferences for optimal performance..."

# Create regional routing configuration
cat > /tmp/regional-routing.json << EOF
{
  "regions": {
    "bom": {
      "primary": true,
      "database": "primary",
      "cache": "local",
      "storage": "regional"
    },
    "sin": {
      "primary": false,
      "database": "replica",
      "cache": "local",
      "storage": "regional"
    },
    "nrt": {
      "primary": false,
      "database": "replica",
      "cache": "local",
      "storage": "regional"
    }
  },
  "routing": {
    "strategy": "latency",
    "fallback": "bom",
    "health_check_interval": "30s"
  }
}
EOF

echo -e "${GREEN}Regional routing configuration created${NC}"

# Deployment verification
echo -e "\n${BLUE}🔍 Deployment Verification:${NC}"
echo "Verifying multi-region deployment..."

# Check current status
fly status --app "$APP_NAME"

# List active regions
echo -e "\n${GREEN}Active regions:${NC}"
fly regions list --app "$APP_NAME"

# Check machine distribution
echo -e "\n${GREEN}Machine distribution:${NC}"
fly machines list --app "$APP_NAME"

# Performance testing recommendations
echo -e "\n${YELLOW}📋 Next Steps:${NC}"
echo "1. Test deployment: fly deploy --app $APP_NAME"
echo "2. Verify health checks: fly checks list --app $APP_NAME"
echo "3. Monitor performance: fly logs --app $APP_NAME"
echo "4. Test regional routing: curl -H 'Fly-Request-Id: test' https://$APP_NAME.fly.dev/api/health"
echo "5. Set up monitoring dashboards"
echo "6. Configure alerts for regional failures"

echo -e "\n${BLUE}🔧 Maintenance Commands:${NC}"
echo "# Scale up in specific region:"
echo "fly scale count 2 --region sin --app $APP_NAME"
echo ""
echo "# Scale down in specific region:"
echo "fly scale count 0 --region sin --app $APP_NAME"
echo ""
echo "# Remove region:"
echo "fly regions remove sin --app $APP_NAME"
echo ""
echo "# Update auto-scaling:"
echo "fly autoscale set --min-machines-running=2 --max-machines-running=8 --app $APP_NAME"

echo -e "\n${GREEN}🎉 Multi-region deployment configuration complete!${NC}"
echo -e "${YELLOW}Don't forget to test the deployment and monitor regional performance.${NC}"