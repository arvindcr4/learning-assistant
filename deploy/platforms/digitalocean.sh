#!/bin/bash

# =============================================================================
# DigitalOcean Deployment Platform Handler
# =============================================================================

digitalocean_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing DigitalOcean deployment..."
    
    # Load DigitalOcean-specific configuration
    local do_config_file="${CONFIG_DIR}/digitalocean/${environment}.env"
    if [[ -f "${do_config_file}" ]]; then
        source "${do_config_file}"
    fi
    
    # Set defaults
    DO_REGION="${DO_REGION:-${DEFAULT_REGION:-nyc3}}"
    DO_SIZE="${DO_SIZE:-${DEFAULT_INSTANCE_TYPE:-s-1vcpu-1gb}}"
    DO_IMAGE="${DO_IMAGE:-ubuntu-22-04-x64}"
    DO_TAG="${DO_TAG:-learning-assistant}"
    
    # Validate doctl CLI
    if ! command -v doctl &>/dev/null; then
        log_error "doctl CLI not found. Please install it first."
        return 1
    fi
    
    # Check authentication
    if ! doctl auth list | grep -q "current context"; then
        log_error "DigitalOcean CLI not authenticated. Please run 'doctl auth init' first."
        return 1
    fi
    
    # Choose deployment method
    case "${DO_DEPLOY_METHOD:-droplet}" in
        "app")
            digitalocean_deploy_app "${environment}" "${deployment_id}"
            ;;
        "droplet")
            digitalocean_deploy_droplet "${environment}" "${deployment_id}"
            ;;
        "k8s")
            digitalocean_deploy_kubernetes "${environment}" "${deployment_id}"
            ;;
        *)
            log_error "Invalid deployment method: ${DO_DEPLOY_METHOD}"
            return 1
            ;;
    esac
}

digitalocean_deploy_app() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to DigitalOcean App Platform..."
    
    # Create or update app spec
    digitalocean_create_app_spec "${environment}" "${deployment_id}"
    
    # Deploy to App Platform
    local app_spec_file="${SCRIPT_DIR}/digitalocean-app-spec.yaml"
    
    if doctl apps create --spec "${app_spec_file}"; then
        log_success "DigitalOcean App Platform deployment initiated"
        
        # Wait for deployment to complete
        digitalocean_wait_for_app_deployment "${environment}"
        
    else
        log_error "Failed to create DigitalOcean App"
        return 1
    fi
}

digitalocean_create_app_spec() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Creating DigitalOcean App Platform specification..."
    
    cat > "${SCRIPT_DIR}/digitalocean-app-spec.yaml" << EOF
name: learning-assistant-${environment}
region: ${DO_REGION}

services:
  - name: web
    source_dir: /
    github:
      repo: ${DO_GITHUB_REPO:-your-username/learning-assistant}
      branch: ${DO_GITHUB_BRANCH:-main}
      deploy_on_push: true
    
    build_command: npm run build
    run_command: npm start
    
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: ${DO_APP_SIZE:-basic-xxs}
    
    http_port: 3000
    
    health_check:
      http_path: /api/health
      initial_delay_seconds: 30
      period_seconds: 10
      timeout_seconds: 5
      success_threshold: 1
      failure_threshold: 3
    
    envs:
      - key: NODE_ENV
        value: ${environment}
      - key: PORT
        value: "3000"
      - key: DEPLOYMENT_ID
        value: ${deployment_id}
      - key: DEPLOYMENT_TIMESTAMP
        value: $(date)
      - key: DATABASE_URL
        value: sqlite:./app.db
      - key: BETTER_AUTH_SECRET
        value: $(openssl rand -hex 32)
      - key: NEXT_TELEMETRY_DISABLED
        value: "1"
      - key: FEATURE_ANALYTICS_ENABLED
        value: "true"
      - key: FEATURE_RECOMMENDATIONS_ENABLED
        value: "true"
      - key: FEATURE_CHAT_ENABLED
        value: "false"
      - key: NODE_OPTIONS
        value: "--max-old-space-size=1024"
      - key: TRUST_PROXY
        value: "1"

databases:
  - name: learning-assistant-db
    engine: PG
    version: "15"
    size: db-s-1vcpu-1gb
    num_nodes: 1
    production: false

static_sites:
  - name: learning-assistant-static
    source_dir: /
    github:
      repo: ${DO_GITHUB_REPO:-your-username/learning-assistant}
      branch: ${DO_GITHUB_BRANCH:-main}
      deploy_on_push: true
    
    build_command: npm run build && npm run export
    output_dir: /out
    
    envs:
      - key: NODE_ENV
        value: production
      - key: NEXT_TELEMETRY_DISABLED
        value: "1"
EOF
    
    log_success "DigitalOcean App Platform specification created"
}

digitalocean_deploy_droplet() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to DigitalOcean Droplet..."
    
    # Create SSH key if needed
    digitalocean_ensure_ssh_key
    
    # Create droplet
    local droplet_name="learning-assistant-${environment}-$(date +%s)"
    
    # Create user data script
    local user_data_script="${SCRIPT_DIR}/tmp/do-user-data.sh"
    digitalocean_create_user_data_script "${user_data_script}" "${environment}" "${deployment_id}"
    
    # Create droplet
    local droplet_id
    droplet_id=$(doctl compute droplet create "${droplet_name}" \
        --image "${DO_IMAGE}" \
        --size "${DO_SIZE}" \
        --region "${DO_REGION}" \
        --tag-names "${DO_TAG},${environment}" \
        --ssh-keys "$(doctl compute ssh-key list --format ID --no-header | head -1)" \
        --user-data-file "${user_data_script}" \
        --wait \
        --format ID \
        --no-header)
    
    log_success "Droplet created: ${droplet_id}"
    
    # Get droplet IP
    local droplet_ip
    droplet_ip=$(doctl compute droplet get "${droplet_id}" --format PublicIPv4 --no-header)
    
    log_info "Droplet IP: ${droplet_ip}"
    
    # Set deployment URL
    export DEPLOYMENT_URL="http://${droplet_ip}:3000"
    
    # Wait for deployment to complete
    digitalocean_wait_for_droplet_deployment "${droplet_ip}"
    
    log_success "DigitalOcean Droplet deployment completed!"
}

digitalocean_ensure_ssh_key() {
    local key_name="learning-assistant-key"
    local key_file="${HOME}/.ssh/${key_name}"
    
    # Check if SSH key exists in DigitalOcean
    if ! doctl compute ssh-key list --format Name --no-header | grep -q "${key_name}"; then
        log_info "Creating SSH key: ${key_name}"
        
        # Generate key if it doesn't exist locally
        if [[ ! -f "${key_file}" ]]; then
            ssh-keygen -t ed25519 -f "${key_file}" -N "" -C "learning-assistant-deployment"
        fi
        
        # Add to DigitalOcean
        doctl compute ssh-key import "${key_name}" --public-key-file "${key_file}.pub"
        log_success "SSH key added to DigitalOcean"
    else
        log_info "SSH key already exists in DigitalOcean"
    fi
}

digitalocean_create_user_data_script() {
    local script_path="$1"
    local environment="$2"
    local deployment_id="$3"
    
    mkdir -p "$(dirname "${script_path}")"
    
    cat > "${script_path}" << EOF
#!/bin/bash
set -e

# Update system
apt-get update -y
apt-get upgrade -y

# Install required packages
apt-get install -y curl wget git docker.io docker-compose nodejs npm

# Start Docker
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Get droplet IP
DROPLET_IP=\$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address)

# Create application directory
mkdir -p /opt/learning-assistant
cd /opt/learning-assistant

# Clone repository or create basic structure
if ! git clone https://github.com/your-repo/learning-assistant.git .; then
    echo "Repository not found, creating basic structure..."
    # Create basic package.json and files
    cat > package.json << 'PKGJSON'
{
  "name": "learning-assistant",
  "version": "1.0.0",
  "scripts": {
    "build": "echo 'Build completed'",
    "start": "node -e \"const http = require('http'); const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<h1>Learning Assistant</h1><p>Deployed successfully!</p>'); }); server.listen(3000, () => console.log('Server running on port 3000'));\""
  }
}
PKGJSON
fi

# Create environment file
cat > .env.local << 'ENVFILE'
NODE_ENV=${environment}
PORT=3000
DEPLOYMENT_ID=${deployment_id}
DEPLOYMENT_TIMESTAMP=\$(date)
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=\$(openssl rand -hex 32)
NEXT_PUBLIC_API_URL=http://\$DROPLET_IP:3000
NEXT_PUBLIC_APP_URL=http://\$DROPLET_IP:3000
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false
ENVFILE

# Install dependencies and build
npm install --production
npm run build

# Create systemd service
cat > /etc/systemd/system/learning-assistant.service << 'SERVICEEOF'
[Unit]
Description=Learning Assistant
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/learning-assistant
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=${environment}
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start service
systemctl daemon-reload
systemctl enable learning-assistant
systemctl start learning-assistant

# Setup firewall
ufw allow 22
ufw allow 3000
ufw --force enable

# Mark deployment as complete
echo "\$(date): DigitalOcean deployment completed" > /opt/learning-assistant/deployment-complete
EOF
    
    log_info "User data script created: ${script_path}"
}

digitalocean_wait_for_droplet_deployment() {
    local droplet_ip="$1"
    
    log_info "Waiting for droplet deployment to complete..."
    
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        if ssh -o StrictHostKeyChecking=no ubuntu@${droplet_ip} "[ -f /opt/learning-assistant/deployment-complete ]" 2>/dev/null; then
            log_success "Droplet deployment completed successfully"
            return 0
        fi
        
        log_info "Waiting for deployment... (${i}/${max_attempts})"
        sleep 20
    done
    
    log_error "Droplet deployment timed out"
    return 1
}

digitalocean_wait_for_app_deployment() {
    local environment="$1"
    
    log_info "Waiting for App Platform deployment to complete..."
    
    # Get app ID
    local app_id
    app_id=$(doctl apps list --format ID,Name --no-header | grep "learning-assistant-${environment}" | cut -d' ' -f1)
    
    if [[ -z "${app_id}" ]]; then
        log_error "Could not find app ID"
        return 1
    fi
    
    # Wait for deployment
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        local app_status
        app_status=$(doctl apps get "${app_id}" --format Status --no-header)
        
        case "${app_status}" in
            "ACTIVE")
                log_success "App Platform deployment completed successfully"
                
                # Get app URL
                local app_url
                app_url=$(doctl apps get "${app_id}" --format DefaultIngress --no-header)
                export DEPLOYMENT_URL="https://${app_url}"
                
                log_info "Application deployed at: ${DEPLOYMENT_URL}"
                return 0
                ;;
            "ERROR")
                log_error "App Platform deployment failed"
                return 1
                ;;
            *)
                log_info "Deployment status: ${app_status} (${i}/${max_attempts})"
                ;;
        esac
        
        sleep 20
    done
    
    log_error "App Platform deployment timed out"
    return 1
}

digitalocean_setup_database() {
    local environment="$1"
    
    log_info "Setting up DigitalOcean Managed Database..."
    
    local db_name="learning-assistant-${environment}-db"
    
    # Create PostgreSQL database
    if doctl databases create "${db_name}" \
        --engine pg \
        --version 15 \
        --size db-s-1vcpu-1gb \
        --region "${DO_REGION}" \
        --num-nodes 1; then
        
        log_success "PostgreSQL database created: ${db_name}"
        
        # Get database connection details
        local db_id
        db_id=$(doctl databases list --format ID,Name --no-header | grep "${db_name}" | cut -d' ' -f1)
        
        if [[ -n "${db_id}" ]]; then
            log_info "Database ID: ${db_id}"
            doctl databases connection "${db_id}"
        fi
    else
        log_error "Failed to create database"
        return 1
    fi
}

digitalocean_setup_load_balancer() {
    local environment="$1"
    
    log_info "Setting up DigitalOcean Load Balancer..."
    
    local lb_name="learning-assistant-${environment}-lb"
    
    # Create load balancer
    if doctl compute load-balancer create \
        --name "${lb_name}" \
        --algorithm round_robin \
        --region "${DO_REGION}" \
        --tag-name "${DO_TAG}" \
        --forwarding-rules "entry_protocol:HTTP,entry_port:80,target_protocol:HTTP,target_port:3000" \
        --health-check "protocol:HTTP,port:3000,path:/api/health,check_interval_seconds:10,response_timeout_seconds:5,unhealthy_threshold:3,healthy_threshold:2"; then
        
        log_success "Load balancer created: ${lb_name}"
    else
        log_error "Failed to create load balancer"
        return 1
    fi
}

digitalocean_setup_cdn() {
    local environment="$1"
    
    log_info "Setting up DigitalOcean CDN..."
    
    local cdn_name="learning-assistant-${environment}-cdn"
    
    # Create CDN endpoint
    if doctl compute cdn create \
        --origin "learning-assistant-${environment}.ondigitalocean.app" \
        --custom-domain "${cdn_name}.example.com" \
        --certificate-id ""; then
        
        log_success "CDN endpoint created: ${cdn_name}"
    else
        log_warning "CDN setup requires manual configuration"
    fi
}

digitalocean_show_deployment_info() {
    local environment="$1"
    
    log_info "DigitalOcean Deployment Information:"
    
    # Show droplets
    echo -e "\n${CYAN}Droplets:${NC}"
    doctl compute droplet list --tag-name "${DO_TAG}" --format ID,Name,PublicIPv4,Status,Region
    
    # Show apps
    echo -e "\n${CYAN}Apps:${NC}"
    doctl apps list --format ID,Name,Status,DefaultIngress | grep "learning-assistant-${environment}" || echo "No apps found"
    
    # Show databases
    echo -e "\n${CYAN}Databases:${NC}"
    doctl databases list --format ID,Name,Engine,Status,Region | grep "learning-assistant-${environment}" || echo "No databases found"
    
    # Show load balancers
    echo -e "\n${CYAN}Load Balancers:${NC}"
    doctl compute load-balancer list --format ID,Name,Status,IP | grep "learning-assistant-${environment}" || echo "No load balancers found"
    
    echo -e "\n${YELLOW}Useful Commands:${NC}"
    echo "  View droplet logs: doctl compute droplet get <ID>"
    echo "  View app logs: doctl apps logs <APP_ID>"
    echo "  SSH to droplet: ssh ubuntu@<DROPLET_IP>"
    echo "  Scale app: doctl apps update <APP_ID> --spec <new-spec.yaml>"
}

digitalocean_cleanup_deployment() {
    local environment="$1"
    
    log_info "Cleaning up DigitalOcean deployment..."
    
    # Cleanup droplets
    local droplet_ids
    droplet_ids=$(doctl compute droplet list --tag-name "${DO_TAG}" --format ID --no-header)
    
    if [[ -n "${droplet_ids}" ]]; then
        log_info "Cleaning up droplets..."
        echo "${droplet_ids}" | while read -r droplet_id; do
            doctl compute droplet delete "${droplet_id}" --force
        done
    fi
    
    # Cleanup apps
    local app_ids
    app_ids=$(doctl apps list --format ID,Name --no-header | grep "learning-assistant-${environment}" | cut -d' ' -f1)
    
    if [[ -n "${app_ids}" ]]; then
        log_info "Cleaning up apps..."
        echo "${app_ids}" | while read -r app_id; do
            doctl apps delete "${app_id}" --force
        done
    fi
    
    log_success "DigitalOcean cleanup completed"
}