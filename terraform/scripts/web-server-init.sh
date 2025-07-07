#!/bin/bash

# =============================================================================
# LEARNING ASSISTANT - WEB SERVER INITIALIZATION SCRIPT
# =============================================================================
# This script is executed via cloud-init on Linode instances to set up the
# web server environment with Docker and the Learning Assistant application
# =============================================================================

set -euo pipefail  # Exit on error, undefined variable, or pipe failure

# -----------------------------------------------------------------------------
# SCRIPT CONFIGURATION
# -----------------------------------------------------------------------------

# Template variables (replaced by Terraform)
DOCKER_IMAGE="${docker_image}"
DOCKER_TAG="${docker_tag}"
DATABASE_URL="${database_url}"
APP_ENVIRONMENT="${app_environment}"
APP_ADMIN_PASSWORD="${app_admin_password}"
PROJECT_NAME="${project_name}"

# Script constants
SCRIPT_LOG="/var/log/web-server-init.log"
DOCKER_COMPOSE_FILE="/opt/learning-assistant/docker-compose.yml"
APP_DIR="/opt/learning-assistant"
DATA_DIR="/mnt/app-data"
BACKUP_DIR="/opt/backups"

# -----------------------------------------------------------------------------
# LOGGING SETUP
# -----------------------------------------------------------------------------

# Create log file and redirect output
exec 1> >(tee -a "$SCRIPT_LOG")
exec 2> >(tee -a "$SCRIPT_LOG" >&2)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$SCRIPT_LOG"
}

log "Starting Learning Assistant web server initialization..."

# -----------------------------------------------------------------------------
# SYSTEM UPDATES AND PREREQUISITES
# -----------------------------------------------------------------------------

log "Updating system packages..."
apt-get update -y
apt-get upgrade -y

log "Installing required packages..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    software-properties-common \
    unzip \
    wget \
    git \
    htop \
    vim \
    fail2ban \
    ufw \
    logrotate \
    rsyslog \
    jq \
    tree \
    ncdu \
    iotop \
    nethogs

# -----------------------------------------------------------------------------
# DOCKER INSTALLATION
# -----------------------------------------------------------------------------

log "Installing Docker..."

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker service
systemctl start docker
systemctl enable docker

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install Docker Compose (standalone)
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

log "Docker installation completed"

# -----------------------------------------------------------------------------
# PERSISTENT STORAGE SETUP
# -----------------------------------------------------------------------------

log "Setting up persistent storage..."

# Create mount point for persistent data
mkdir -p "$DATA_DIR"

# Check if volume is attached and format if needed
if lsblk | grep -q "sdc"; then
    log "Persistent volume detected, setting up filesystem..."
    
    # Check if volume is already formatted
    if ! blkid /dev/sdc; then
        log "Formatting persistent volume..."
        mkfs.ext4 /dev/sdc
    fi
    
    # Get UUID of the volume
    VOLUME_UUID=$(blkid -s UUID -o value /dev/sdc)
    
    # Add to fstab for persistent mounting
    echo "UUID=$VOLUME_UUID $DATA_DIR ext4 defaults,nofail 0 2" >> /etc/fstab
    
    # Mount the volume
    mount -a
    
    log "Persistent volume mounted at $DATA_DIR"
else
    log "No persistent volume detected, using local storage"
fi

# Set proper permissions
chown -R ubuntu:ubuntu "$DATA_DIR"
chmod -R 755 "$DATA_DIR"

# -----------------------------------------------------------------------------
# APPLICATION DIRECTORY SETUP
# -----------------------------------------------------------------------------

log "Setting up application directory..."

# Create application directory
mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$DATA_DIR/postgres"
mkdir -p "$DATA_DIR/logs"
mkdir -p "$DATA_DIR/uploads"
mkdir -p "$DATA_DIR/cache"

# Set proper ownership and permissions
chown -R ubuntu:ubuntu "$APP_DIR"
chown -R ubuntu:ubuntu "$BACKUP_DIR"
chown -R ubuntu:ubuntu "$DATA_DIR"

# -----------------------------------------------------------------------------
# DOCKER COMPOSE CONFIGURATION
# -----------------------------------------------------------------------------

log "Creating Docker Compose configuration..."

cat > "$DOCKER_COMPOSE_FILE" << EOF
version: '3.8'

services:
  learning-assistant:
    image: $DOCKER_IMAGE:$DOCKER_TAG
    container_name: learning-assistant
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=$APP_ENVIRONMENT
      - NEXT_TELEMETRY_DISABLED=1
      - DATABASE_URL=$DATABASE_URL
      - PORT=3000
      - HOSTNAME=0.0.0.0
    volumes:
      - $DATA_DIR/logs:/app/logs
      - $DATA_DIR/uploads:/app/uploads
      - $DATA_DIR/cache:/app/.next/cache
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Optional: Add a reverse proxy for SSL termination
  # nginx:
  #   image: nginx:alpine
  #   container_name: nginx-proxy
  #   restart: unless-stopped
  #   ports:
  #     - "80:80"
  #     - "443:443"
  #   volumes:
  #     - ./nginx.conf:/etc/nginx/nginx.conf:ro
  #     - ./ssl:/etc/nginx/ssl:ro
  #   depends_on:
  #     - learning-assistant
  #   networks:
  #     - app-network

networks:
  app-network:
    driver: bridge

volumes:
  app-data:
    driver: local
    driver_opts:
      o: bind
      type: none
      device: $DATA_DIR
EOF

log "Docker Compose configuration created"

# -----------------------------------------------------------------------------
# SYSTEMD SERVICE CREATION
# -----------------------------------------------------------------------------

log "Creating systemd service for the application..."

cat > /etc/systemd/system/learning-assistant.service << EOF
[Unit]
Description=Learning Assistant Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
ExecReload=/usr/local/bin/docker-compose restart
TimeoutStartSec=0
Restart=on-failure
RestartSec=10s
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target
EOF

# Enable the service
systemctl daemon-reload
systemctl enable learning-assistant.service

log "Systemd service created and enabled"

# -----------------------------------------------------------------------------
# NGINX CONFIGURATION (Optional)
# -----------------------------------------------------------------------------

log "Creating nginx configuration (if needed)..."

mkdir -p "$APP_DIR/nginx"

cat > "$APP_DIR/nginx/nginx.conf" << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream app {
        server learning-assistant:3000;
    }

    server {
        listen 80;
        server_name _;
        
        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }
        
        location /api/health {
            proxy_pass http://app;
            access_log off;
        }
    }
}
EOF

log "Nginx configuration created"

# -----------------------------------------------------------------------------
# SECURITY HARDENING
# -----------------------------------------------------------------------------

log "Applying security hardening..."

# Configure UFW firewall
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Configure fail2ban
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Create fail2ban configuration for SSH
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
findtime = 600

[nginx-req-limit]
enabled = true
filter = nginx-req-limit
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 3600
findtime = 600
EOF

systemctl restart fail2ban

# Set proper SSH configuration
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

log "Security hardening completed"

# -----------------------------------------------------------------------------
# MONITORING AND LOGGING SETUP
# -----------------------------------------------------------------------------

log "Setting up monitoring and logging..."

# Configure logrotate for application logs
cat > /etc/logrotate.d/learning-assistant << 'EOF'
/opt/learning-assistant/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        /usr/local/bin/docker-compose -f /opt/learning-assistant/docker-compose.yml restart learning-assistant
    endscript
}
EOF

# Create log monitoring script
cat > /usr/local/bin/monitor-app.sh << 'EOF'
#!/bin/bash

# Simple monitoring script for the Learning Assistant application
LOG_FILE="/var/log/app-monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check if application is running
if ! docker ps | grep -q learning-assistant; then
    log "ERROR: Learning Assistant container is not running"
    systemctl restart learning-assistant.service
    log "Attempted to restart Learning Assistant service"
fi

# Check application health
if ! curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    log "ERROR: Application health check failed"
    systemctl restart learning-assistant.service
    log "Attempted to restart Learning Assistant service due to health check failure"
fi

# Check disk usage
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    log "WARNING: Disk usage is ${DISK_USAGE}% - consider cleaning up"
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ "$MEMORY_USAGE" -gt 80 ]; then
    log "WARNING: Memory usage is ${MEMORY_USAGE}% - consider investigating"
fi

log "Monitoring check completed"
EOF

chmod +x /usr/local/bin/monitor-app.sh

# Add monitoring script to cron
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/monitor-app.sh") | crontab -

log "Monitoring and logging setup completed"

# -----------------------------------------------------------------------------
# BACKUP SCRIPT SETUP
# -----------------------------------------------------------------------------

log "Setting up backup scripts..."

cat > /usr/local/bin/backup-app.sh << 'EOF'
#!/bin/bash

# Backup script for Learning Assistant application
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/learning-assistant-backup-$DATE.tar.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Backup application data
tar -czf "$BACKUP_FILE" \
    --exclude="*.log" \
    --exclude="node_modules" \
    --exclude=".git" \
    /opt/learning-assistant \
    /mnt/app-data

# Keep only last 7 backups
find "$BACKUP_DIR" -name "learning-assistant-backup-*.tar.gz" -type f -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE"
EOF

chmod +x /usr/local/bin/backup-app.sh

# Add backup script to cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-app.sh") | crontab -

log "Backup script setup completed"

# -----------------------------------------------------------------------------
# DOCKER IMAGE PULL AND APPLICATION START
# -----------------------------------------------------------------------------

log "Pulling Docker image and starting application..."

# Change to application directory
cd "$APP_DIR"

# Pull the Docker image
docker pull "$DOCKER_IMAGE:$DOCKER_TAG"

# Start the application
docker-compose up -d

# Wait for application to start
sleep 30

# Check if application is running
if docker ps | grep -q learning-assistant; then
    log "Learning Assistant application started successfully"
else
    log "ERROR: Failed to start Learning Assistant application"
    docker-compose logs learning-assistant
fi

# -----------------------------------------------------------------------------
# HEALTH CHECK AND VERIFICATION
# -----------------------------------------------------------------------------

log "Performing health checks..."

# Wait for application to be ready
sleep 60

# Check application health
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    log "SUCCESS: Application health check passed"
else
    log "WARNING: Application health check failed - may need more time to start"
    docker-compose logs learning-assistant
fi

# Check Docker service
if systemctl is-active --quiet docker; then
    log "SUCCESS: Docker service is running"
else
    log "ERROR: Docker service is not running"
fi

# Check application service
if systemctl is-enabled --quiet learning-assistant.service; then
    log "SUCCESS: Learning Assistant service is enabled"
else
    log "ERROR: Learning Assistant service is not enabled"
fi

# -----------------------------------------------------------------------------
# FINAL SETUP AND CLEANUP
# -----------------------------------------------------------------------------

log "Performing final setup and cleanup..."

# Set proper permissions
chown -R ubuntu:ubuntu "$APP_DIR"
chown -R ubuntu:ubuntu "$DATA_DIR"
chown -R ubuntu:ubuntu "$BACKUP_DIR"

# Clean up package cache
apt-get autoremove -y
apt-get autoclean

# Update system one more time
apt-get update -y && apt-get upgrade -y

# -----------------------------------------------------------------------------
# INSTALLATION SUMMARY
# -----------------------------------------------------------------------------

log "Installation summary:"
log "- Docker and Docker Compose installed"
log "- Application directory: $APP_DIR"
log "- Data directory: $DATA_DIR"
log "- Backup directory: $BACKUP_DIR"
log "- Docker image: $DOCKER_IMAGE:$DOCKER_TAG"
log "- Application port: 3000"
log "- Health check: http://localhost:3000/api/health"
log "- Systemd service: learning-assistant.service"
log "- Monitoring script: /usr/local/bin/monitor-app.sh"
log "- Backup script: /usr/local/bin/backup-app.sh"
log "- Security: UFW firewall and fail2ban configured"
log "- Logs: $SCRIPT_LOG"

# Create status file
cat > /opt/learning-assistant/installation-status.json << EOF
{
    "installation_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "docker_image": "$DOCKER_IMAGE:$DOCKER_TAG",
    "app_environment": "$APP_ENVIRONMENT",
    "project_name": "$PROJECT_NAME",
    "data_directory": "$DATA_DIR",
    "backup_directory": "$BACKUP_DIR",
    "status": "completed",
    "version": "1.0.0"
}
EOF

log "Learning Assistant web server initialization completed successfully!"

# Send notification (optional - requires additional setup)
# curl -X POST -H 'Content-type: application/json' \
#     --data '{"text":"Learning Assistant server initialized successfully on '$(hostname)'"}' \
#     YOUR_WEBHOOK_URL

exit 0
EOF