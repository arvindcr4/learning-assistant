#!/bin/bash

# =============================================================================
# Railway Deployment Platform Handler
# =============================================================================

railway_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing Railway deployment..."
    
    # Load Railway-specific configuration
    local railway_config_file="${CONFIG_DIR}/railway/${environment}.env"
    if [[ -f "${railway_config_file}" ]]; then
        source "${railway_config_file}"
    fi
    
    # Validate Railway CLI
    if ! command -v railway &>/dev/null; then
        log_error "Railway CLI not found. Please install it first."
        log_info "Install with: npm install -g @railway/cli"
        return 1
    fi
    
    # Check authentication
    if ! railway whoami &>/dev/null; then
        log_error "Not authenticated with Railway. Please run 'railway login' first."
        return 1
    fi
    
    # Deploy to Railway
    railway_deploy_app "${environment}" "${deployment_id}"
}

railway_deploy_app() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying application to Railway..."
    
    # Initialize Railway project if needed
    railway_init_project "${environment}"
    
    # Set environment variables
    railway_set_environment_variables "${environment}" "${deployment_id}"
    
    # Deploy the application
    log_info "Starting Railway deployment..."
    
    if railway up --detach; then
        log_success "Railway deployment initiated successfully!"
        
        # Wait for deployment to complete
        railway_wait_for_deployment "${environment}"
        
        # Get deployment URL
        local app_url
        app_url=$(railway domain 2>/dev/null || echo "")
        
        if [[ -n "${app_url}" ]]; then
            export DEPLOYMENT_URL="https://${app_url}"
            log_info "Application deployed at: ${DEPLOYMENT_URL}"
        else
            log_warning "Could not retrieve deployment URL"
        fi
        
        # Show deployment status
        railway status
        
    else
        log_error "Railway deployment failed"
        return 1
    fi
}

railway_init_project() {
    local environment="$1"
    
    # Check if railway.json exists
    if [[ ! -f "${SCRIPT_DIR}/railway.json" ]]; then
        log_info "Initializing Railway project..."
        
        # Create railway.json
        cat > "${SCRIPT_DIR}/railway.json" << EOF
{
  "name": "learning-assistant-${environment}",
  "deploy": {
    "buildCommand": "npm run build",
    "startCommand": "npm start"
  },
  "variables": {
    "NODE_ENV": "${environment}",
    "PORT": "3000"
  }
}
EOF
        
        log_success "Railway project configuration created"
    fi
    
    # Initialize Railway project
    if [[ ! -f "${SCRIPT_DIR}/.railway" ]]; then
        log_info "Creating Railway project..."
        railway init --name "learning-assistant-${environment}"
    fi
}

railway_set_environment_variables() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Setting Railway environment variables..."
    
    # Define environment variables
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
        "NODE_OPTIONS=--max-old-space-size=1024"
        "TRUST_PROXY=1"
        "LOG_LEVEL=info"
    )
    
    # Set each environment variable
    for var in "${env_vars[@]}"; do
        local key="${var%%=*}"
        local value="${var#*=}"
        
        if railway variables set "${key}=${value}"; then
            log_debug "Set environment variable: ${key}"
        else
            log_warning "Failed to set environment variable: ${key}"
        fi
    done
    
    # Set custom environment variables if defined
    if [[ -n "${RAILWAY_CUSTOM_VARS:-}" ]]; then
        IFS=',' read -ra CUSTOM_VARS <<< "${RAILWAY_CUSTOM_VARS}"
        for var in "${CUSTOM_VARS[@]}"; do
            if [[ "${var}" == *"="* ]]; then
                railway variables set "${var}"
                log_debug "Set custom environment variable: ${var%%=*}"
            fi
        done
    fi
    
    log_success "Environment variables configured"
}

railway_wait_for_deployment() {
    local environment="$1"
    
    log_info "Waiting for Railway deployment to complete..."
    
    local max_wait=300  # 5 minutes
    local wait_interval=10
    local waited=0
    
    while [[ ${waited} -lt ${max_wait} ]]; do
        local status
        status=$(railway status --json 2>/dev/null | jq -r '.deployments[0].status' 2>/dev/null || echo "unknown")
        
        case "${status}" in
            "SUCCESS")
                log_success "Deployment completed successfully!"
                return 0
                ;;
            "FAILED")
                log_error "Deployment failed!"
                railway logs --tail 20
                return 1
                ;;
            "BUILDING"|"DEPLOYING")
                log_info "Deployment in progress... (${waited}/${max_wait}s)"
                ;;
            *)
                log_info "Deployment status: ${status} (${waited}/${max_wait}s)"
                ;;
        esac
        
        sleep ${wait_interval}
        waited=$((waited + wait_interval))
    done
    
    log_warning "Deployment status check timed out"
    log_info "Please check Railway dashboard for deployment status"
    return 0
}

railway_setup_database() {
    local environment="$1"
    
    log_info "Setting up Railway database..."
    
    # Add PostgreSQL database
    if railway add postgresql; then
        log_success "PostgreSQL database added to Railway project"
        
        # Update environment variables with database connection
        local db_url
        db_url=$(railway variables get DATABASE_URL 2>/dev/null || echo "")
        
        if [[ -n "${db_url}" ]]; then
            log_info "Database URL configured automatically"
        else
            log_warning "Database URL not found. Please check Railway dashboard."
        fi
    else
        log_warning "Failed to add PostgreSQL database"
    fi
}

railway_setup_redis() {
    local environment="$1"
    
    log_info "Setting up Railway Redis cache..."
    
    # Add Redis database
    if railway add redis; then
        log_success "Redis cache added to Railway project"
        
        # Update environment variables with Redis connection
        local redis_url
        redis_url=$(railway variables get REDIS_URL 2>/dev/null || echo "")
        
        if [[ -n "${redis_url}" ]]; then
            log_info "Redis URL configured automatically"
        else
            log_warning "Redis URL not found. Please check Railway dashboard."
        fi
    else
        log_warning "Failed to add Redis cache"
    fi
}

railway_setup_custom_domain() {
    local environment="$1"
    local domain="$2"
    
    log_info "Setting up custom domain: ${domain}"
    
    if railway domain add "${domain}"; then
        log_success "Custom domain added: ${domain}"
        
        # Show DNS configuration
        echo -e "\n${CYAN}DNS Configuration Required:${NC}"
        echo "  Type: CNAME"
        echo "  Name: ${domain}"
        echo "  Value: <railway-generated-url>"
        echo ""
        echo -e "${YELLOW}Get the exact CNAME value from Railway dashboard${NC}"
    else
        log_error "Failed to add custom domain"
        return 1
    fi
}

railway_scale_service() {
    local environment="$1"
    local replicas="${2:-1}"
    
    log_info "Scaling Railway service to ${replicas} replicas..."
    
    # Railway doesn't have a direct CLI command for scaling
    # This would typically be done through the dashboard
    log_info "Railway scaling is managed through the dashboard"
    log_info "Please visit https://railway.app/dashboard to configure scaling"
}

railway_setup_monitoring() {
    local environment="$1"
    
    log_info "Setting up Railway monitoring..."
    
    # Add monitoring environment variables
    local monitoring_vars=(
        "ENABLE_METRICS=true"
        "METRICS_PORT=3001"
        "HEALTH_CHECK_PATH=/api/health"
        "LOGGING_LEVEL=info"
    )
    
    for var in "${monitoring_vars[@]}"; do
        railway variables set "${var}"
    done
    
    log_success "Monitoring configuration added"
    log_info "Railway provides built-in monitoring in the dashboard"
}

railway_backup_database() {
    local environment="$1"
    
    log_info "Railway database backups are managed automatically"
    log_info "Manual backup options:"
    echo "  1. Use Railway dashboard to create snapshots"
    echo "  2. Export data using railway connect"
    echo "  3. Set up automated backups in dashboard"
}

railway_show_logs() {
    local environment="$1"
    local lines="${2:-50}"
    
    log_info "Showing Railway deployment logs..."
    
    # Show recent logs
    railway logs --tail "${lines}"
}

railway_rollback_deployment() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Rolling back Railway deployment..."
    
    # Railway doesn't have direct CLI rollback
    # This would need to be done through git revert and redeploy
    log_warning "Railway rollback requires git revert and redeploy"
    log_info "Steps to rollback:"
    echo "  1. git revert <commit-hash>"
    echo "  2. git push origin main"
    echo "  3. Railway will automatically redeploy"
}

railway_connect_to_database() {
    local environment="$1"
    
    log_info "Connecting to Railway database..."
    
    # Use Railway's connect command
    if railway connect; then
        log_success "Database connection established"
    else
        log_error "Failed to connect to database"
        return 1
    fi
}

railway_run_migrations() {
    local environment="$1"
    
    log_info "Running database migrations on Railway..."
    
    # Run migrations using Railway's run command
    if railway run "npm run db:migrate"; then
        log_success "Database migrations completed"
    else
        log_error "Database migrations failed"
        return 1
    fi
}

railway_show_deployment_info() {
    local environment="$1"
    
    log_info "Railway Deployment Information:"
    
    # Show service status
    railway status
    
    # Show environment variables
    echo -e "\n${CYAN}Environment Variables:${NC}"
    railway variables list
    
    # Show domains
    echo -e "\n${CYAN}Domains:${NC}"
    railway domain list 2>/dev/null || echo "No custom domains configured"
    
    # Show useful commands
    echo -e "\n${YELLOW}Useful Commands:${NC}"
    echo "  View logs: railway logs"
    echo "  Open dashboard: railway open"
    echo "  Connect to DB: railway connect"
    echo "  Run command: railway run <command>"
    echo "  Deploy again: railway up"
    echo "  Set variables: railway variables set KEY=value"
}

railway_cleanup_deployment() {
    local environment="$1"
    
    log_info "Cleaning up Railway deployment..."
    
    # Railway cleanup is typically done through the dashboard
    log_info "Railway cleanup options:"
    echo "  1. Delete service from dashboard"
    echo "  2. Remove custom domains"
    echo "  3. Delete databases if not needed"
    echo "  4. Clean up environment variables"
    
    log_warning "Please use Railway dashboard for cleanup operations"
}