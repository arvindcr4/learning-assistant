#!/bin/bash

# Fly.io Volume Management Script for Learning Assistant
# This script sets up persistent volumes for logs, cache, and data storage

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

# Volume configurations
VOLUMES=(
    "learning_assistant_data:10:data"
    "learning_assistant_logs:5:logs"
    "learning_assistant_cache:3:cache"
    "learning_assistant_uploads:10:uploads"
)

echo -e "${BLUE}💾 Setting up persistent volumes for Learning Assistant${NC}"
echo -e "${BLUE}App: ${APP_NAME}${NC}"

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

# Function to create volume
create_volume() {
    local volume_name="$1"
    local volume_size="$2"
    local region="$3"
    local description="$4"
    
    echo -e "${GREEN}Creating volume: $volume_name (${volume_size}GB) in $region${NC}"
    
    if fly volumes create "$volume_name" \
        --region "$region" \
        --size "$volume_size" \
        --app "$APP_NAME" \
        --yes; then
        echo -e "${GREEN}✅ Volume $volume_name created successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to create volume $volume_name${NC}"
        return 1
    fi
}

# Get current regions
echo -e "\n${YELLOW}📋 Checking current app regions...${NC}"
current_regions=$(fly regions list --app "$APP_NAME" | grep -v "Region" | grep -v "^$" | awk '{print $1}')
echo -e "${GREEN}Current regions: $current_regions${NC}"

# Check existing volumes
echo -e "\n${YELLOW}📋 Checking existing volumes...${NC}"
existing_volumes=$(fly volumes list --app "$APP_NAME" 2>/dev/null || echo "")
if [ -n "$existing_volumes" ]; then
    echo -e "${GREEN}Existing volumes:${NC}"
    echo "$existing_volumes"
else
    echo -e "${YELLOW}No existing volumes found${NC}"
fi

# Create volumes for each region
echo -e "\n${BLUE}📦 Volume Creation:${NC}"
for region in $current_regions; do
    echo -e "\n${BLUE}Creating volumes for region: $region${NC}"
    
    for volume_config in "${VOLUMES[@]}"; do
        IFS=':' read -r volume_name volume_size volume_type <<< "$volume_config"
        
        # Check if volume already exists
        if echo "$existing_volumes" | grep -q "$volume_name.*$region"; then
            echo -e "${YELLOW}Volume $volume_name already exists in $region, skipping${NC}"
            continue
        fi
        
        # Create volume with region suffix for multi-region deployments
        if [ "$region" = "$PRIMARY_REGION" ]; then
            full_volume_name="$volume_name"
        else
            full_volume_name="${volume_name}_${region}"
        fi
        
        create_volume "$full_volume_name" "$volume_size" "$region" "$volume_type"
        
        # Small delay to avoid rate limiting
        sleep 2
    done
done

# Update fly.toml with volume mounts
echo -e "\n${BLUE}📝 Updating fly.toml with volume mounts...${NC}"

# Create volume mounts configuration
cat > /tmp/volume-mounts.toml << 'EOF'
# Persistent volume mounts for Learning Assistant
[[mounts]]
  source = "learning_assistant_data"
  destination = "/app/data"
  processes = ["app"]

[[mounts]]
  source = "learning_assistant_logs"
  destination = "/app/logs"
  processes = ["app"]

[[mounts]]
  source = "learning_assistant_cache"
  destination = "/app/cache"
  processes = ["app"]

[[mounts]]
  source = "learning_assistant_uploads"
  destination = "/app/uploads"
  processes = ["app"]
EOF

echo -e "${GREEN}Volume mounts configuration created at /tmp/volume-mounts.toml${NC}"
echo -e "${YELLOW}Add these mounts to your fly.toml file:${NC}"
cat /tmp/volume-mounts.toml

# Update Dockerfile to handle volumes
echo -e "\n${BLUE}🐳 Updating Dockerfile for volume support...${NC}"

# Check if Dockerfile needs volume directory creation
if ! grep -q "mkdir -p /app/data" "$PWD/Dockerfile"; then
    echo -e "${YELLOW}Consider updating your Dockerfile to create volume directories:${NC}"
    cat << 'EOF'
# Add to Dockerfile (in the runner stage):
RUN mkdir -p /app/data /app/logs /app/cache /app/uploads && \
    chown -R nextjs:nodejs /app/data /app/logs /app/cache /app/uploads && \
    chmod -R 755 /app/data /app/logs /app/cache /app/uploads
EOF
fi

# Create volume initialization script
echo -e "\n${BLUE}🔧 Creating volume initialization script...${NC}"
cat > /tmp/init-volumes.sh << 'EOF'
#!/bin/bash

# Volume initialization script for Learning Assistant
# This script ensures proper permissions and structure for mounted volumes

set -e

VOLUME_DIRS=(
    "/app/data"
    "/app/logs"
    "/app/cache"
    "/app/uploads"
)

echo "Initializing volume directories..."

for dir in "${VOLUME_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "Creating directory: $dir"
        mkdir -p "$dir"
    fi
    
    # Set proper permissions
    chown -R nextjs:nodejs "$dir"
    chmod -R 755 "$dir"
    
    # Create subdirectories as needed
    case "$dir" in
        "/app/data")
            mkdir -p "$dir/session" "$dir/temp" "$dir/exports"
            ;;
        "/app/logs")
            mkdir -p "$dir/app" "$dir/access" "$dir/error"
            ;;
        "/app/cache")
            mkdir -p "$dir/api" "$dir/static" "$dir/user"
            ;;
        "/app/uploads")
            mkdir -p "$dir/images" "$dir/documents" "$dir/temp"
            ;;
    esac
done

echo "Volume initialization complete"
EOF

chmod +x /tmp/init-volumes.sh
echo -e "${GREEN}Volume initialization script created at /tmp/init-volumes.sh${NC}"

# Volume backup strategy
echo -e "\n${BLUE}💾 Volume Backup Strategy:${NC}"
cat > /tmp/volume-backup.sh << 'EOF'
#!/bin/bash

# Volume backup script for Learning Assistant
# This script creates backups of persistent volumes

set -e

APP_NAME="learning-assistant-lively-rain-3457"
BACKUP_DIR="/tmp/volume-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Creating volume backups..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Get list of volumes
volumes=$(fly volumes list --app "$APP_NAME" | grep -v "ID" | awk '{print $2}')

for volume in $volumes; do
    echo "Backing up volume: $volume"
    
    # Create backup using fly ssh
    fly ssh console --app "$APP_NAME" --command "tar -czf - /app/data /app/logs /app/uploads 2>/dev/null" > "$BACKUP_DIR/${volume}_${TIMESTAMP}.tar.gz"
    
    if [ $? -eq 0 ]; then
        echo "✅ Backup created: $BACKUP_DIR/${volume}_${TIMESTAMP}.tar.gz"
    else
        echo "❌ Backup failed for volume: $volume"
    fi
done

echo "Backup process complete"
EOF

chmod +x /tmp/volume-backup.sh
echo -e "${GREEN}Volume backup script created at /tmp/volume-backup.sh${NC}"

# Volume monitoring
echo -e "\n${BLUE}📊 Volume Monitoring:${NC}"
cat > /tmp/volume-monitor.sh << 'EOF'
#!/bin/bash

# Volume monitoring script for Learning Assistant
# This script monitors volume usage and alerts on high usage

set -e

APP_NAME="learning-assistant-lively-rain-3457"
THRESHOLD=80  # Alert when volume is 80% full

echo "Monitoring volume usage..."

# Function to check volume usage
check_volume_usage() {
    local volume_path="$1"
    local volume_name="$2"
    
    # Get volume usage via SSH
    usage=$(fly ssh console --app "$APP_NAME" --command "df -h $volume_path | tail -1 | awk '{print \$5}' | sed 's/%//'")
    
    if [ -n "$usage" ] && [ "$usage" -gt "$THRESHOLD" ]; then
        echo "⚠️  WARNING: Volume $volume_name is ${usage}% full"
        return 1
    else
        echo "✅ Volume $volume_name usage: ${usage}%"
        return 0
    fi
}

# Check all mounted volumes
volumes_to_check=(
    "/app/data:Data"
    "/app/logs:Logs"
    "/app/cache:Cache"
    "/app/uploads:Uploads"
)

all_good=true
for volume_info in "${volumes_to_check[@]}"; do
    IFS=':' read -r path name <<< "$volume_info"
    if ! check_volume_usage "$path" "$name"; then
        all_good=false
    fi
done

if [ "$all_good" = true ]; then
    echo "All volumes are within acceptable usage limits"
    exit 0
else
    echo "Some volumes are approaching capacity limits"
    exit 1
fi
EOF

chmod +x /tmp/volume-monitor.sh
echo -e "${GREEN}Volume monitoring script created at /tmp/volume-monitor.sh${NC}"

# List current volumes
echo -e "\n${YELLOW}📋 Current Volume Status:${NC}"
fly volumes list --app "$APP_NAME"

# Volume management commands
echo -e "\n${BLUE}🔧 Volume Management Commands:${NC}"
cat << EOF
# List all volumes
fly volumes list --app $APP_NAME

# Show volume details
fly volumes show <volume-id> --app $APP_NAME

# Extend volume size
fly volumes extend <volume-id> --size 20 --app $APP_NAME

# Create snapshot
fly volumes snapshot create <volume-id> --app $APP_NAME

# Delete volume (careful!)
fly volumes delete <volume-id> --app $APP_NAME

# Attach to machine to inspect volumes
fly ssh console --app $APP_NAME

# Check volume usage
fly ssh console --app $APP_NAME --command "df -h"
EOF

# Cleanup recommendations
echo -e "\n${YELLOW}🧹 Volume Cleanup Recommendations:${NC}"
cat << EOF
1. Set up log rotation to prevent log volume from filling up
2. Implement cache cleanup policies for the cache volume
3. Set up automated backups for the data volume
4. Monitor volume usage regularly
5. Clean up temporary files in uploads volume
6. Consider implementing data archiving for old data
EOF

echo -e "\n${GREEN}📋 Next Steps:${NC}"
echo "1. Add volume mounts to your fly.toml file"
echo "2. Update your Dockerfile to initialize volume directories"
echo "3. Deploy the application: fly deploy --app $APP_NAME"
echo "4. Verify volume mounts: fly ssh console --app $APP_NAME --command 'df -h'"
echo "5. Set up monitoring and backup schedules"
echo "6. Test volume persistence by restarting the application"

echo -e "\n${GREEN}🎉 Volume setup complete!${NC}"
echo -e "${YELLOW}Remember to test volume persistence and set up regular backups.${NC}"