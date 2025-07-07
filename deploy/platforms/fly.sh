#!/bin/bash

# =============================================================================
# Fly.io Deployment Platform Handler
# =============================================================================

fly_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing Fly.io deployment..."
    
    # Load Fly.io-specific configuration
    local fly_config_file="${CONFIG_DIR}/fly/${environment}.env"
    if [[ -f "${fly_config_file}" ]]; then
        source "${fly_config_file}"
    fi
    
    # Validate flyctl CLI
    if ! command -v flyctl &>/dev/null; then
        log_error "flyctl CLI not found. Please install it first."
        return 1
    fi
    
    # Check if user is authenticated
    if ! flyctl auth whoami &>/dev/null; then
        log_error "Not authenticated with Fly.io. Please run 'flyctl auth login' first."
        return 1
    fi
    
    # Deploy to Fly.io
    fly_deploy_app "${environment}" "${deployment_id}"
}

fly_deploy_app() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying application to Fly.io..."
    
    # Check if fly.toml exists
    if [[ ! -f "${SCRIPT_DIR}/fly.toml" ]]; then
        log_info "fly.toml not found, creating one..."
        fly_create_config "${environment}"
    fi
    
    # Update fly.toml with environment-specific settings
    fly_update_config "${environment}" "${deployment_id}"
    
    # Set environment variables
    fly_set_environment_variables "${environment}"
    
    # Deploy the application
    log_info "Starting Fly.io deployment..."
    
    if flyctl deploy --config "${SCRIPT_DIR}/fly.toml" --strategy rolling; then
        log_success "Fly.io deployment completed successfully!"
        
        # Get deployment URL
        local app_name
        app_name=$(grep "^app" "${SCRIPT_DIR}/fly.toml" | cut -d'"' -f2)
        export DEPLOYMENT_URL="https://${app_name}.fly.dev"
        
        log_info "Application deployed at: ${DEPLOYMENT_URL}"
        
        # Show deployment status
        flyctl status --config "${SCRIPT_DIR}/fly.toml"
        
    else
        log_error "Fly.io deployment failed"
        return 1
    fi
}

fly_create_config() {
    local environment="$1"
    
    # Generate unique app name
    local app_name="learning-assistant-${environment}-$(date +%s)"
    
    log_info "Creating fly.toml configuration..."
    
    cat > "${SCRIPT_DIR}/fly.toml" << EOF
# fly.toml app configuration file generated on $(date)

app = "${app_name}"
primary_region = "${FLY_REGION:-bom}"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

  [http_service.concurrency]
    type = "connections"
    soft_limit = 25
    hard_limit = 1000

[[vm]]
  memory = '${FLY_MEMORY:-1gb}'
  cpu_kind = '${FLY_CPU_KIND:-shared}'
  cpus = ${FLY_CPUS:-1}

[env]
  NODE_ENV = "${environment}"
  PORT = "3000"
  NEXT_TELEMETRY_DISABLED = "1"

[experimental]
  auto_rollback = true
EOF
    
    log_success "fly.toml configuration created for app: ${app_name}"
}

fly_update_config() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Updating fly.toml configuration..."
    
    # Update environment variables in fly.toml
    if grep -q "^\[env\]" "${SCRIPT_DIR}/fly.toml"; then
        # Add deployment-specific environment variables
        sed -i.bak "/^\[env\]/a\\
  DEPLOYMENT_ID = \"${deployment_id}\"\\
  DEPLOYMENT_TIMESTAMP = \"$(date)\"\\
" "${SCRIPT_DIR}/fly.toml"
    fi
    
    log_success "fly.toml configuration updated"
}

fly_set_environment_variables() {
    local environment="$1"
    
    log_info "Setting Fly.io environment variables..."
    
    # Set common environment variables
    local env_vars=(
        "NODE_ENV=${environment}"
        "DATABASE_URL=sqlite:./app.db"
        "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
        "FEATURE_ANALYTICS_ENABLED=true"
        "FEATURE_RECOMMENDATIONS_ENABLED=true"
        "FEATURE_CHAT_ENABLED=false"
    )
    
    # Set environment-specific variables
    for var in "${env_vars[@]}"; do
        local key="${var%%=*}"
        local value="${var#*=}"
        
        if flyctl secrets set "${key}=${value}" --config "${SCRIPT_DIR}/fly.toml"; then
            log_debug "Set environment variable: ${key}"
        else
            log_warning "Failed to set environment variable: ${key}"
        fi
    done
    
    # Set custom environment variables from config
    if [[ -n "${FLY_CUSTOM_VARS:-}" ]]; then
        IFS=',' read -ra CUSTOM_VARS <<< "${FLY_CUSTOM_VARS}"
        for var in "${CUSTOM_VARS[@]}"; do
            if [[ "${var}" == *"="* ]]; then
                flyctl secrets set "${var}" --config "${SCRIPT_DIR}/fly.toml"
                log_debug "Set custom environment variable: ${var%%=*}"
            fi
        done
    fi
    
    log_success "Environment variables configured"
}

fly_create_volume() {
    local environment="$1"
    local volume_name="learning_assistant_data"
    local volume_size="${FLY_VOLUME_SIZE:-1}"
    
    log_info "Creating Fly.io volume for persistent data..."
    
    # Check if volume already exists
    if flyctl volumes list --config "${SCRIPT_DIR}/fly.toml" | grep -q "${volume_name}"; then
        log_info "Volume ${volume_name} already exists"
        return 0
    fi
    
    # Create volume
    if flyctl volumes create "${volume_name}" --size "${volume_size}" --config "${SCRIPT_DIR}/fly.toml"; then
        log_success "Volume created: ${volume_name} (${volume_size}GB)"
        
        # Update fly.toml to mount the volume
        fly_add_volume_mount "${volume_name}"
    else
        log_error "Failed to create volume"
        return 1
    fi
}

fly_add_volume_mount() {
    local volume_name="$1"
    
    log_info "Adding volume mount to fly.toml..."
    
    # Add volume mount configuration
    cat >> "${SCRIPT_DIR}/fly.toml" << EOF

[mounts]
  source = "${volume_name}"
  destination = "/app/data"
EOF
    
    log_success "Volume mount added to configuration"
}

fly_scale_app() {
    local environment="$1"
    local min_instances="${FLY_MIN_INSTANCES:-0}"
    local max_instances="${FLY_MAX_INSTANCES:-2}"
    
    log_info "Scaling Fly.io application..."
    
    # Scale application
    if flyctl scale count "${min_instances}" --config "${SCRIPT_DIR}/fly.toml"; then
        log_success "Application scaled to ${min_instances} minimum instances"
    else
        log_warning "Failed to scale application"
    fi
}

fly_setup_monitoring() {
    local environment="$1"
    
    log_info "Setting up Fly.io monitoring..."
    
    # Add health check configuration to fly.toml
    if ! grep -q "^\[checks\]" "${SCRIPT_DIR}/fly.toml"; then
        cat >> "${SCRIPT_DIR}/fly.toml" << EOF

[checks]
  [checks.health]
    grace_period = "30s"
    interval = "15s"
    method = "get"
    path = "/api/health"
    port = 3000
    protocol = "http"
    restart_limit = 3
    timeout = "10s"
EOF
        log_success "Health check configuration added"
    fi
}

fly_deploy_with_database() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying with PostgreSQL database..."
    
    # Create or attach PostgreSQL database
    local db_name="learning-assistant-${environment}-db"
    
    if ! flyctl postgres list | grep -q "${db_name}"; then
        log_info "Creating PostgreSQL database: ${db_name}"
        
        if flyctl postgres create --name "${db_name}" --region "${FLY_REGION:-bom}"; then
            log_success "PostgreSQL database created: ${db_name}"
        else
            log_error "Failed to create PostgreSQL database"
            return 1
        fi
    fi
    
    # Attach database to application
    local app_name
    app_name=$(grep "^app" "${SCRIPT_DIR}/fly.toml" | cut -d'"' -f2)
    
    if flyctl postgres attach "${db_name}" --app "${app_name}"; then
        log_success "Database attached to application"
    else
        log_warning "Failed to attach database"
    fi
}

fly_setup_redis() {
    local environment="$1"
    
    log_info "Setting up Redis cache..."
    
    # Create Redis instance
    local redis_name="learning-assistant-${environment}-redis"
    
    if ! flyctl redis list | grep -q "${redis_name}"; then
        log_info "Creating Redis instance: ${redis_name}"
        
        if flyctl redis create --name "${redis_name}" --region "${FLY_REGION:-bom}"; then
            log_success "Redis instance created: ${redis_name}"
        else
            log_warning "Failed to create Redis instance"
        fi
    fi
}

fly_show_deployment_info() {
    local environment="$1"
    
    log_info "Fly.io Deployment Information:"
    
    # Show application status
    flyctl status --config "${SCRIPT_DIR}/fly.toml"
    
    # Show logs
    echo -e "\n${CYAN}Recent logs:${NC}"
    flyctl logs --config "${SCRIPT_DIR}/fly.toml" --lines 10
    
    # Show deployment URL
    local app_name
    app_name=$(grep "^app" "${SCRIPT_DIR}/fly.toml" | cut -d'"' -f2)
    echo -e "\n${GREEN}Application URL: https://${app_name}.fly.dev${NC}"
    
    # Show useful commands
    echo -e "\n${YELLOW}Useful commands:${NC}"
    echo "  View logs: flyctl logs --config ${SCRIPT_DIR}/fly.toml"
    echo "  SSH into app: flyctl ssh console --config ${SCRIPT_DIR}/fly.toml"
    echo "  Scale app: flyctl scale count 2 --config ${SCRIPT_DIR}/fly.toml"
    echo "  Deploy update: flyctl deploy --config ${SCRIPT_DIR}/fly.toml"
}