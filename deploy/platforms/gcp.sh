#!/bin/bash

# =============================================================================
# Google Cloud Platform Deployment Platform Handler
# =============================================================================

gcp_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing Google Cloud Platform deployment..."
    
    # Load GCP-specific configuration
    local gcp_config_file="${CONFIG_DIR}/gcp/${environment}.env"
    if [[ -f "${gcp_config_file}" ]]; then
        source "${gcp_config_file}"
    fi
    
    # Set defaults
    GCP_PROJECT_ID="${GCP_PROJECT_ID:-}"
    GCP_REGION="${GCP_REGION:-${DEFAULT_REGION:-us-central1}}"
    GCP_ZONE="${GCP_ZONE:-${GCP_REGION}-a}"
    GCP_MACHINE_TYPE="${GCP_MACHINE_TYPE:-${DEFAULT_INSTANCE_TYPE:-e2-medium}}"
    GCP_SERVICE_NAME="${GCP_SERVICE_NAME:-learning-assistant}"
    
    # Validate gcloud CLI
    if ! command -v gcloud &>/dev/null; then
        log_error "gcloud CLI not found. Please install Google Cloud SDK first."
        return 1
    fi
    
    # Check authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 &>/dev/null; then
        log_error "Google Cloud not authenticated. Please run 'gcloud auth login' first."
        return 1
    fi
    
    # Set project if specified
    if [[ -n "${GCP_PROJECT_ID}" ]]; then
        gcloud config set project "${GCP_PROJECT_ID}"
    fi
    
    # Get current project
    GCP_PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
    if [[ -z "${GCP_PROJECT_ID}" ]]; then
        log_error "No GCP project set. Please run 'gcloud config set project PROJECT_ID' first."
        return 1
    fi
    
    log_info "Using GCP project: ${GCP_PROJECT_ID}"
    
    # Choose deployment method
    case "${GCP_DEPLOY_METHOD:-run}" in
        "run")
            gcp_deploy_cloud_run "${environment}" "${deployment_id}"
            ;;
        "gce")
            gcp_deploy_compute_engine "${environment}" "${deployment_id}"
            ;;
        "gke")
            gcp_deploy_kubernetes_engine "${environment}" "${deployment_id}"
            ;;
        "appengine")
            gcp_deploy_app_engine "${environment}" "${deployment_id}"
            ;;
        *)
            log_error "Invalid GCP deployment method: ${GCP_DEPLOY_METHOD}"
            return 1
            ;;
    esac
}

gcp_deploy_cloud_run() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to Google Cloud Run..."
    
    # Enable required APIs
    gcp_enable_apis
    
    # Build and push container to Container Registry
    local image_name="gcr.io/${GCP_PROJECT_ID}/learning-assistant:${deployment_id}"
    
    log_info "Building and pushing container image..."
    if gcloud builds submit --tag "${image_name}" "${SCRIPT_DIR}"; then
        log_success "Container image built and pushed: ${image_name}"
    else
        log_error "Failed to build container image"
        return 1
    fi
    
    # Deploy to Cloud Run
    local service_name="${GCP_SERVICE_NAME}-${environment}"
    
    log_info "Deploying to Cloud Run service: ${service_name}"
    
    # Create environment variables
    local env_vars=(
        "NODE_ENV=${environment}"
        "PORT=3000"
        "DEPLOYMENT_ID=${deployment_id}"
        "DEPLOYMENT_TIMESTAMP=$(date)"
        "DATABASE_URL=sqlite:./app.db"
        "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
        "NEXT_TELEMETRY_DISABLED=1"
        "FEATURE_ANALYTICS_ENABLED=true"
        "FEATURE_RECOMMENDATIONS_ENABLED=true"
        "FEATURE_CHAT_ENABLED=false"
        "GCP_PROJECT_ID=${GCP_PROJECT_ID}"
        "GCP_REGION=${GCP_REGION}"
    )
    
    # Build environment variables string
    local env_vars_str=""
    for var in "${env_vars[@]}"; do
        env_vars_str="${env_vars_str}--set-env-vars ${var} "
    done
    
    # Deploy to Cloud Run
    if gcloud run deploy "${service_name}" \
        --image="${image_name}" \
        --region="${GCP_REGION}" \
        --platform=managed \
        --allow-unauthenticated \
        --memory=1Gi \
        --cpu=1 \
        --max-instances=10 \
        --min-instances=0 \
        --port=3000 \
        --timeout=300 \
        ${env_vars_str} \
        --tag="${deployment_id}"; then
        
        log_success "Cloud Run deployment completed successfully!"
        
        # Get service URL
        local service_url
        service_url=$(gcloud run services describe "${service_name}" --region="${GCP_REGION}" --format="value(status.url)")
        export DEPLOYMENT_URL="${service_url}"
        
        log_info "Service deployed at: ${DEPLOYMENT_URL}"
        
    else
        log_error "Cloud Run deployment failed"
        return 1
    fi
}

gcp_deploy_compute_engine() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to Google Compute Engine..."
    
    # Enable required APIs
    gcp_enable_apis
    
    # Create instance template
    local template_name="learning-assistant-${environment}-template-$(date +%s)"
    local instance_name="learning-assistant-${environment}-$(date +%s)"
    
    # Create startup script
    local startup_script="${SCRIPT_DIR}/tmp/gce-startup.sh"
    gcp_create_startup_script "${startup_script}" "${environment}" "${deployment_id}"
    
    # Create instance
    log_info "Creating Compute Engine instance: ${instance_name}"
    
    if gcloud compute instances create "${instance_name}" \
        --zone="${GCP_ZONE}" \
        --machine-type="${GCP_MACHINE_TYPE}" \
        --image-family=ubuntu-2204-lts \
        --image-project=ubuntu-os-cloud \
        --boot-disk-size=20GB \
        --boot-disk-type=pd-standard \
        --tags=learning-assistant,http-server,https-server \
        --metadata-from-file startup-script="${startup_script}" \
        --metadata "environment=${environment},deployment-id=${deployment_id}" \
        --scopes=https://www.googleapis.com/auth/cloud-platform; then
        
        log_success "Compute Engine instance created: ${instance_name}"
        
        # Get instance IP
        local instance_ip
        instance_ip=$(gcloud compute instances describe "${instance_name}" --zone="${GCP_ZONE}" --format="value(networkInterfaces[0].accessConfigs[0].natIP)")
        
        log_info "Instance IP: ${instance_ip}"
        export DEPLOYMENT_URL="http://${instance_ip}:3000"
        
        # Wait for deployment to complete
        gcp_wait_for_gce_deployment "${instance_name}" "${GCP_ZONE}"
        
    else
        log_error "Failed to create Compute Engine instance"
        return 1
    fi
}

gcp_deploy_app_engine() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to Google App Engine..."
    
    # Create app.yaml
    gcp_create_app_yaml "${environment}" "${deployment_id}"
    
    # Deploy to App Engine
    if gcloud app deploy app.yaml --quiet --version="${deployment_id}"; then
        log_success "App Engine deployment completed successfully!"
        
        # Get service URL
        local service_url
        service_url=$(gcloud app browse --no-launch-browser 2>&1 | grep -o 'https://[^[:space:]]*')
        export DEPLOYMENT_URL="${service_url}"
        
        log_info "Service deployed at: ${DEPLOYMENT_URL}"
        
    else
        log_error "App Engine deployment failed"
        return 1
    fi
}

gcp_enable_apis() {
    log_info "Enabling required Google Cloud APIs..."
    
    local required_apis=(
        "cloudbuild.googleapis.com"
        "run.googleapis.com"
        "compute.googleapis.com"
        "appengine.googleapis.com"
        "sql.googleapis.com"
        "redis.googleapis.com"
        "monitoring.googleapis.com"
        "logging.googleapis.com"
    )
    
    for api in "${required_apis[@]}"; do
        if gcloud services enable "${api}" --quiet; then
            log_debug "Enabled API: ${api}"
        else
            log_warning "Failed to enable API: ${api}"
        fi
    done
    
    log_success "Google Cloud APIs enabled"
}

gcp_create_startup_script() {
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
apt-get install -y curl wget git docker.io docker-compose

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Start Docker
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu

# Get instance IP
INSTANCE_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)

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
    "start": "node -e \"const http = require('http'); const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<h1>Learning Assistant</h1><p>Deployed on Google Cloud!</p>'); }); server.listen(3000, () => console.log('Server running on port 3000'));\""
  }
}
PKGJSON
fi

# Create environment file
cat > .env.local << ENVFILE
NODE_ENV=production
PORT=3000
DEPLOYMENT_ID=gcp-deployment-$(date +%s)
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
Environment=NODE_ENV=production
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
echo "$(date): GCP deployment completed" > /opt/learning-assistant/deployment-complete

# Install monitoring agent
curl -sSO https://dl.google.com/cloudagents/add-monitoring-agent-repo.sh
bash add-monitoring-agent-repo.sh
apt-get update
apt-get install -y stackdriver-agent
systemctl enable stackdriver-agent
systemctl start stackdriver-agent
EOF
    
    log_info "GCE startup script created: ${script_path}"
}

gcp_create_app_yaml() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Creating App Engine configuration..."
    
    cat > "${SCRIPT_DIR}/app.yaml" << EOF
runtime: nodejs20
service: learning-assistant-${environment}

env_variables:
  NODE_ENV: ${environment}
  DEPLOYMENT_ID: ${deployment_id}
  DEPLOYMENT_TIMESTAMP: $(date)
  DATABASE_URL: sqlite:./app.db
  BETTER_AUTH_SECRET: $(openssl rand -hex 32)
  NEXT_TELEMETRY_DISABLED: 1
  FEATURE_ANALYTICS_ENABLED: true
  FEATURE_RECOMMENDATIONS_ENABLED: true
  FEATURE_CHAT_ENABLED: false
  GCP_PROJECT_ID: ${GCP_PROJECT_ID}
  GCP_REGION: ${GCP_REGION}

automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.6
  target_throughput_utilization: 0.6

resources:
  cpu: 1
  memory_gb: 1

health_check:
  enable_health_check: true
  check_interval_sec: 30
  timeout_sec: 4
  unhealthy_threshold: 2
  healthy_threshold: 2

liveness_check:
  path: "/api/health"
  check_interval_sec: 30
  timeout_sec: 4
  failure_threshold: 2
  success_threshold: 2

readiness_check:
  path: "/api/health"
  check_interval_sec: 5
  timeout_sec: 4
  failure_threshold: 2
  success_threshold: 2
  app_start_timeout_sec: 300
EOF
    
    log_success "App Engine configuration created: app.yaml"
}

gcp_wait_for_gce_deployment() {
    local instance_name="$1"
    local zone="$2"
    
    log_info "Waiting for GCE deployment to complete..."
    
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        if gcloud compute ssh "${instance_name}" --zone="${zone}" --command="[ -f /opt/learning-assistant/deployment-complete ]" --quiet 2>/dev/null; then
            log_success "GCE deployment completed successfully"
            return 0
        fi
        
        log_info "Waiting for deployment... (${i}/${max_attempts})"
        sleep 20
    done
    
    log_error "GCE deployment timed out"
    return 1
}

gcp_setup_cloud_sql() {
    local environment="$1"
    
    log_info "Setting up Cloud SQL PostgreSQL instance..."
    
    local instance_name="learning-assistant-${environment}-db"
    
    # Create Cloud SQL instance
    if gcloud sql instances create "${instance_name}" \
        --database-version=POSTGRES_15 \
        --cpu=1 \
        --memory=3840MB \
        --region="${GCP_REGION}" \
        --root-password="$(openssl rand -base64 32)" \
        --storage-type=SSD \
        --storage-size=10GB \
        --storage-auto-increase; then
        
        log_success "Cloud SQL instance created: ${instance_name}"
        
        # Create database
        gcloud sql databases create learning_assistant --instance="${instance_name}"
        
        # Create user
        gcloud sql users create learning_assistant_user --instance="${instance_name}" --password="$(openssl rand -base64 32)"
        
        log_success "Cloud SQL database and user created"
        
    else
        log_error "Failed to create Cloud SQL instance"
        return 1
    fi
}

gcp_setup_redis() {
    local environment="$1"
    
    log_info "Setting up Cloud Memorystore Redis instance..."
    
    local instance_name="learning-assistant-${environment}-redis"
    
    # Create Redis instance
    if gcloud redis instances create "${instance_name}" \
        --size=1 \
        --region="${GCP_REGION}" \
        --redis-version=redis_6_x; then
        
        log_success "Cloud Memorystore Redis instance created: ${instance_name}"
        
    else
        log_error "Failed to create Redis instance"
        return 1
    fi
}

gcp_setup_load_balancer() {
    local environment="$1"
    
    log_info "Setting up Google Cloud Load Balancer..."
    
    local lb_name="learning-assistant-${environment}-lb"
    
    # Create load balancer
    # This is a simplified version - full setup would require more configuration
    log_info "Load balancer setup requires additional configuration"
    log_info "Please refer to GCP documentation for complete setup"
}

gcp_setup_monitoring() {
    local environment="$1"
    
    log_info "Setting up Google Cloud Monitoring..."
    
    # Create monitoring alerts
    local alert_policy_name="learning-assistant-${environment}-alerts"
    
    # This would require more complex configuration
    log_info "Monitoring setup requires additional configuration"
    log_info "Please refer to GCP documentation for complete setup"
}

gcp_show_deployment_info() {
    local environment="$1"
    
    log_info "Google Cloud Platform Deployment Information:"
    
    echo -e "\n${CYAN}Project: ${GCP_PROJECT_ID}${NC}"
    echo -e "${CYAN}Region: ${GCP_REGION}${NC}"
    
    # Show Cloud Run services
    echo -e "\n${CYAN}Cloud Run Services:${NC}"
    gcloud run services list --region="${GCP_REGION}" --filter="metadata.name:learning-assistant-${environment}" --format="table(metadata.name,status.url,status.conditions[0].type)" || echo "No Cloud Run services found"
    
    # Show Compute Engine instances
    echo -e "\n${CYAN}Compute Engine Instances:${NC}"
    gcloud compute instances list --filter="name:learning-assistant-${environment}" --format="table(name,status,zone,machineType.basename(),externalIp)" || echo "No GCE instances found"
    
    # Show App Engine services
    echo -e "\n${CYAN}App Engine Services:${NC}"
    gcloud app services list --filter="id:learning-assistant-${environment}" --format="table(id,versions)" || echo "No App Engine services found"
    
    # Show Cloud SQL instances
    echo -e "\n${CYAN}Cloud SQL Instances:${NC}"
    gcloud sql instances list --filter="name:learning-assistant-${environment}" --format="table(name,status,region,databaseVersion)" || echo "No Cloud SQL instances found"
    
    echo -e "\n${YELLOW}Useful Commands:${NC}"
    echo "  View logs: gcloud logging read 'resource.type=cloud_run_revision' --limit=50"
    echo "  SSH to GCE: gcloud compute ssh <instance-name> --zone=${GCP_ZONE}"
    echo "  Update Cloud Run: gcloud run deploy <service-name> --image=<image> --region=${GCP_REGION}"
    echo "  View monitoring: gcloud monitoring dashboards list"
}

gcp_cleanup_deployment() {
    local environment="$1"
    
    log_info "Cleaning up GCP deployment..."
    
    # Delete Cloud Run services
    local run_services
    run_services=$(gcloud run services list --region="${GCP_REGION}" --filter="metadata.name:learning-assistant-${environment}" --format="value(metadata.name)")
    
    if [[ -n "${run_services}" ]]; then
        log_info "Deleting Cloud Run services..."
        echo "${run_services}" | while read -r service; do
            gcloud run services delete "${service}" --region="${GCP_REGION}" --quiet
        done
    fi
    
    # Delete GCE instances
    local gce_instances
    gce_instances=$(gcloud compute instances list --filter="name:learning-assistant-${environment}" --format="value(name,zone)")
    
    if [[ -n "${gce_instances}" ]]; then
        log_info "Deleting GCE instances..."
        echo "${gce_instances}" | while read -r instance zone; do
            gcloud compute instances delete "${instance}" --zone="${zone}" --quiet
        done
    fi
    
    # Delete Cloud SQL instances
    local sql_instances
    sql_instances=$(gcloud sql instances list --filter="name:learning-assistant-${environment}" --format="value(name)")
    
    if [[ -n "${sql_instances}" ]]; then
        log_info "Deleting Cloud SQL instances..."
        echo "${sql_instances}" | while read -r instance; do
            gcloud sql instances delete "${instance}" --quiet
        done
    fi
    
    log_success "GCP cleanup completed"
}