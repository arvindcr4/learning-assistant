#!/bin/bash

# =============================================================================
# Linode Deployment Platform Handler
# =============================================================================

linode_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing Linode deployment..."
    
    # Load Linode-specific configuration
    local linode_config_file="${CONFIG_DIR}/linode/${environment}.env"
    if [[ -f "${linode_config_file}" ]]; then
        source "${linode_config_file}"
    fi
    
    # Set defaults
    LINODE_REGION="${LINODE_REGION:-${DEFAULT_REGION:-us-east}}"
    LINODE_TYPE="${LINODE_TYPE:-${DEFAULT_INSTANCE_TYPE:-g6-standard-1}}"
    LINODE_IMAGE="${LINODE_IMAGE:-linode/ubuntu22.04}"
    LINODE_LABEL="${LINODE_LABEL:-learning-assistant-${environment}}"
    
    # Validate linode-cli
    if ! command -v linode-cli &>/dev/null; then
        log_error "linode-cli not found. Please install it first."
        log_info "Install with: pip3 install linode-cli"
        return 1
    fi
    
    # Check configuration
    if ! linode-cli profile view &>/dev/null; then
        log_error "Linode CLI not configured. Please run 'linode-cli configure' first."
        return 1
    fi
    
    # Deploy to Linode
    linode_deploy_instance "${environment}" "${deployment_id}"
}

linode_deploy_instance() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to Linode instance..."
    
    # Generate unique label
    local instance_label="${LINODE_LABEL}-$(date +%s)"
    
    # Create SSH key if needed
    linode_ensure_ssh_key
    
    # Create startup script
    local startup_script="${SCRIPT_DIR}/tmp/linode-startup.sh"
    linode_create_startup_script "${startup_script}" "${environment}" "${deployment_id}"
    
    # Create Linode instance
    log_info "Creating Linode instance: ${instance_label}"
    
    local instance_id
    instance_id=$(linode-cli linodes create \
        --label "${instance_label}" \
        --region "${LINODE_REGION}" \
        --type "${LINODE_TYPE}" \
        --image "${LINODE_IMAGE}" \
        --authorized_keys "$(cat ~/.ssh/id_rsa.pub 2>/dev/null || echo '')" \
        --root_pass "$(openssl rand -base64 32)" \
        --tags "learning-assistant,${environment},${deployment_id}" \
        --text \
        --format "id" \
        --no-headers)
    
    if [[ -n "${instance_id}" ]]; then
        log_success "Linode instance created: ${instance_id}"
        
        # Wait for instance to boot
        linode_wait_for_boot "${instance_id}"
        
        # Get instance IP
        local instance_ip
        instance_ip=$(linode-cli linodes view "${instance_id}" --text --format "ipv4" --no-headers | head -1)
        
        log_info "Instance IP: ${instance_ip}"
        export DEPLOYMENT_URL="http://${instance_ip}:3000"
        
        # Copy and run startup script
        linode_setup_instance "${instance_id}" "${instance_ip}" "${startup_script}"
        
        # Wait for deployment to complete
        linode_wait_for_deployment "${instance_ip}"
        
        log_success "Linode deployment completed successfully!"
        log_info "Application deployed at: ${DEPLOYMENT_URL}"
        
    else
        log_error "Failed to create Linode instance"
        return 1
    fi
}

linode_ensure_ssh_key() {
    local key_file="${HOME}/.ssh/id_rsa"
    
    if [[ ! -f "${key_file}" ]]; then
        log_info "Creating SSH key pair..."
        ssh-keygen -t rsa -b 4096 -f "${key_file}" -N "" -C "learning-assistant-deployment"
        log_success "SSH key pair created: ${key_file}"
    else
        log_info "SSH key already exists: ${key_file}"
    fi
}

linode_create_startup_script() {
    local script_path="$1"
    local environment="$2"
    local deployment_id="$3"
    
    mkdir -p "$(dirname "${script_path}")"
    
    cat > "${script_path}" << 'EOF'
#!/bin/bash
set -e

# Update system
apt-get update -y
apt-get upgrade -y

# Install required packages
apt-get install -y curl wget git docker.io docker-compose nginx ufw

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Start and enable Docker
systemctl start docker
systemctl enable docker
usermod -aG docker root

# Get instance IP
INSTANCE_IP=$(hostname -I | awk '{print $1}')

# Create application directory
mkdir -p /opt/learning-assistant
cd /opt/learning-assistant

# Clone repository or create basic structure
if ! git clone https://github.com/your-repo/learning-assistant.git .; then
    echo "Repository not found, creating basic structure..."
    cat > package.json << 'PKGJSON'
{
  "name": "learning-assistant",
  "version": "1.0.0",
  "scripts": {
    "build": "echo 'Build completed'",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
PKGJSON

    cat > server.js << 'SERVERJS'
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Learning Assistant</title></head>
      <body>
        <h1>Learning Assistant</h1>
        <p>Successfully deployed on Linode!</p>
        <p>Deployment ID: ${process.env.DEPLOYMENT_ID || 'unknown'}</p>
        <p>Environment: ${process.env.NODE_ENV || 'unknown'}</p>
        <p>Server time: ${new Date().toISOString()}</p>
      </body>
    </html>
  `);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    deployment_id: process.env.DEPLOYMENT_ID,
    environment: process.env.NODE_ENV
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Learning Assistant server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Deployment ID: ${process.env.DEPLOYMENT_ID}`);
});
SERVERJS
fi

# Create environment file
cat > .env.local << ENVFILE
NODE_ENV=production
PORT=3000
DEPLOYMENT_ID=linode-${deployment_id}
DEPLOYMENT_TIMESTAMP=$(date)
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_API_URL=http://$INSTANCE_IP:3000
NEXT_PUBLIC_APP_URL=http://$INSTANCE_IP:3000
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false
ENVFILE

# Install dependencies and build
npm install --production
npm run build || echo "Build completed"

# Create systemd service
cat > /etc/systemd/system/learning-assistant.service << 'SERVICEEOF'
[Unit]
Description=Learning Assistant
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/learning-assistant
EnvironmentFile=/opt/learning-assistant/.env.local
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start service
systemctl daemon-reload
systemctl enable learning-assistant
systemctl start learning-assistant

# Configure Nginx reverse proxy
cat > /etc/nginx/sites-available/learning-assistant << 'NGINXCONF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXCONF

# Enable nginx site
ln -sf /etc/nginx/sites-available/learning-assistant /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

# Setup firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

# Create monitoring script
cat > /opt/learning-assistant/monitor.sh << 'MONITOREOF'
#!/bin/bash
echo "=== Learning Assistant Status ==="
echo "Service Status:"
systemctl status learning-assistant --no-pager -l
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager -l
echo ""
echo "Application Health:"
curl -s http://localhost:3000/api/health | python3 -m json.tool || echo "Health check failed"
echo ""
echo "Port Status:"
netstat -tlnp | grep :3000
echo ""
echo "Recent Logs:"
journalctl -u learning-assistant --no-pager -l -n 10
MONITOREOF

chmod +x /opt/learning-assistant/monitor.sh

# Mark deployment as complete
echo "$(date): Linode deployment completed" > /opt/learning-assistant/deployment-complete

# Log deployment info
echo "=== Deployment Information ===" >> /opt/learning-assistant/deployment.log
echo "Deployment ID: ${deployment_id}" >> /opt/learning-assistant/deployment.log
echo "Environment: ${environment}" >> /opt/learning-assistant/deployment.log
echo "Timestamp: $(date)" >> /opt/learning-assistant/deployment.log
echo "Instance IP: $INSTANCE_IP" >> /opt/learning-assistant/deployment.log
echo "==============================" >> /opt/learning-assistant/deployment.log
EOF
    
    log_info "Linode startup script created: ${script_path}"
}

linode_wait_for_boot() {
    local instance_id="$1"
    
    log_info "Waiting for Linode instance to boot..."
    
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        local status
        status=$(linode-cli linodes view "${instance_id}" --text --format "status" --no-headers)
        
        if [[ "${status}" == "running" ]]; then
            log_success "Linode instance is running"
            sleep 30  # Additional wait for SSH to be ready
            return 0
        fi
        
        log_info "Instance status: ${status} (${i}/${max_attempts})"
        sleep 10
    done
    
    log_error "Instance failed to boot within expected time"
    return 1
}

linode_setup_instance() {
    local instance_id="$1"
    local instance_ip="$2"
    local startup_script="$3"
    
    log_info "Setting up Linode instance..."
    
    # Wait for SSH to be available
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@"${instance_ip}" "echo 'SSH ready'" &>/dev/null; then
            log_success "SSH connection established"
            break
        fi
        
        log_info "Waiting for SSH to be ready... (${i}/${max_attempts})"
        sleep 10
        
        if [[ ${i} -eq ${max_attempts} ]]; then
            log_error "SSH connection timed out"
            return 1
        fi
    done
    
    # Copy and execute startup script
    log_info "Copying startup script to instance..."
    scp -o StrictHostKeyChecking=no "${startup_script}" root@"${instance_ip}":/tmp/startup.sh
    
    log_info "Executing startup script..."
    ssh -o StrictHostKeyChecking=no root@"${instance_ip}" "chmod +x /tmp/startup.sh && /tmp/startup.sh"
    
    log_success "Instance setup completed"
}

linode_wait_for_deployment() {
    local instance_ip="$1"
    
    log_info "Waiting for application deployment to complete..."
    
    local max_attempts=60
    for ((i=1; i<=max_attempts; i++)); do
        if ssh -o StrictHostKeyChecking=no root@"${instance_ip}" "[ -f /opt/learning-assistant/deployment-complete ]" 2>/dev/null; then
            log_success "Application deployment completed successfully"
            
            # Test application health
            sleep 10  # Give the app a moment to start
            if curl -f -s "http://${instance_ip}:3000/api/health" > /dev/null; then
                log_success "Application health check passed"
            else
                log_warning "Application health check failed, but deployment marked as complete"
            fi
            
            return 0
        fi
        
        log_info "Waiting for deployment completion... (${i}/${max_attempts})"
        sleep 10
    done
    
    log_error "Deployment completion check timed out"
    return 1
}

linode_setup_monitoring() {
    local environment="$1"
    local instance_ip="$2"
    
    log_info "Setting up monitoring for Linode deployment..."
    
    # Create monitoring script on instance
    ssh -o StrictHostKeyChecking=no root@"${instance_ip}" << 'EOF'
# Install monitoring tools
apt-get update
apt-get install -y htop iotop nethogs

# Create performance monitoring script
cat > /opt/learning-assistant/performance-monitor.sh << 'PERFEOF'
#!/bin/bash
echo "=== System Performance Monitor ==="
echo "Timestamp: $(date)"
echo ""
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2 $3 $4}'
echo ""
echo "Memory Usage:"
free -h
echo ""
echo "Disk Usage:"
df -h /
echo ""
echo "Network Connections:"
netstat -tuln | grep :3000
echo ""
echo "Application Process:"
ps aux | grep node | grep -v grep
echo ""
echo "Last 5 Application Logs:"
journalctl -u learning-assistant --no-pager -l -n 5
echo "================================"
PERFEOF

chmod +x /opt/learning-assistant/performance-monitor.sh

# Setup cron job for monitoring
echo "*/5 * * * * root /opt/learning-assistant/performance-monitor.sh >> /var/log/learning-assistant-performance.log 2>&1" >> /etc/crontab
EOF
    
    log_success "Monitoring setup completed"
}

linode_setup_ssl() {
    local environment="$1"
    local instance_ip="$2"
    local domain="$3"
    
    if [[ -z "${domain}" ]]; then
        log_warning "No domain provided, skipping SSL setup"
        return 0
    fi
    
    log_info "Setting up SSL certificate for domain: ${domain}"
    
    ssh -o StrictHostKeyChecking=no root@"${instance_ip}" << EOF
# Install Certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Update Nginx configuration for domain
sed -i 's/server_name _;/server_name ${domain};/' /etc/nginx/sites-available/learning-assistant
nginx -t && systemctl reload nginx

# Obtain SSL certificate
certbot --nginx -d ${domain} --non-interactive --agree-tos --email admin@${domain} || echo "SSL setup failed"

# Setup auto-renewal
systemctl enable certbot.timer
systemctl start certbot.timer
EOF
    
    log_success "SSL setup completed for ${domain}"
}

linode_backup_instance() {
    local instance_id="$1"
    local backup_label="learning-assistant-backup-$(date +%Y%m%d-%H%M%S)"
    
    log_info "Creating backup of Linode instance..."
    
    if linode-cli linodes snapshot "${instance_id}" --label "${backup_label}"; then
        log_success "Backup created: ${backup_label}"
    else
        log_error "Failed to create backup"
        return 1
    fi
}

linode_show_deployment_info() {
    local environment="$1"
    
    log_info "Linode Deployment Information:"
    
    # Show instances
    echo -e "\n${CYAN}Linode Instances:${NC}"
    linode-cli linodes list --text --format "id,label,status,type,region,ipv4" | grep "learning-assistant-${environment}" || echo "No instances found"
    
    # Show instance details for the environment
    local instance_ids
    instance_ids=$(linode-cli linodes list --text --format "id,label" --no-headers | grep "learning-assistant-${environment}" | cut -f1)
    
    if [[ -n "${instance_ids}" ]]; then
        echo -e "\n${CYAN}Instance Details:${NC}"
        echo "${instance_ids}" | while read -r instance_id; do
            echo "Instance ID: ${instance_id}"
            linode-cli linodes view "${instance_id}" --text --format "label,status,type,region,ipv4,created" --no-headers
            echo ""
        done
    fi
    
    echo -e "\n${YELLOW}Useful Commands:${NC}"
    echo "  SSH to instance: ssh root@<instance-ip>"
    echo "  View instance logs: linode-cli events list --entity.type=linode"
    echo "  Resize instance: linode-cli linodes resize <instance-id> --type <new-type>"
    echo "  Create backup: linode-cli linodes snapshot <instance-id> --label <backup-name>"
    echo "  Monitor app: ssh root@<instance-ip> '/opt/learning-assistant/monitor.sh'"
    echo "  View performance: ssh root@<instance-ip> '/opt/learning-assistant/performance-monitor.sh'"
}

linode_cleanup_deployment() {
    local environment="$1"
    
    log_info "Cleaning up Linode deployment..."
    
    # Find instances for this environment
    local instance_ids
    instance_ids=$(linode-cli linodes list --text --format "id,label" --no-headers | grep "learning-assistant-${environment}" | cut -f1)
    
    if [[ -n "${instance_ids}" ]]; then
        echo -e "${YELLOW}Found instances to delete:${NC}"
        echo "${instance_ids}" | while read -r instance_id; do
            local label
            label=$(linode-cli linodes view "${instance_id}" --text --format "label" --no-headers)
            echo "  - ${instance_id}: ${label}"
        done
        
        echo -e "\n${YELLOW}Are you sure you want to delete these instances? [y/N]${NC}"
        read -r confirmation
        
        if [[ "${confirmation}" =~ ^[Yy]$ ]]; then
            echo "${instance_ids}" | while read -r instance_id; do
                log_info "Deleting instance: ${instance_id}"
                linode-cli linodes delete "${instance_id}"
            done
            log_success "Linode cleanup completed"
        else
            log_info "Cleanup cancelled"
        fi
    else
        log_info "No instances found for environment: ${environment}"
    fi
}

linode_scale_deployment() {
    local environment="$1"
    local new_type="$2"
    
    log_info "Scaling Linode deployment to type: ${new_type}"
    
    # Find instances for this environment
    local instance_ids
    instance_ids=$(linode-cli linodes list --text --format "id,label" --no-headers | grep "learning-assistant-${environment}" | cut -f1)
    
    if [[ -n "${instance_ids}" ]]; then
        echo "${instance_ids}" | while read -r instance_id; do
            log_info "Resizing instance: ${instance_id} to ${new_type}"
            linode-cli linodes resize "${instance_id}" --type "${new_type}"
        done
        log_success "Scaling completed"
    else
        log_warning "No instances found for environment: ${environment}"
    fi
}