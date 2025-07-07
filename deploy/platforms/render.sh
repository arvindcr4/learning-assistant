#!/bin/bash

# =============================================================================
# Render Deployment Platform Handler
# =============================================================================

render_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing Render deployment..."
    
    # Load Render-specific configuration
    local render_config_file="${CONFIG_DIR}/render/${environment}.env"
    if [[ -f "${render_config_file}" ]]; then
        source "${render_config_file}"
    fi
    
    # Render deployments are typically done through Git integration
    # This script focuses on configuration management and validation
    
    render_validate_config "${environment}"
    render_update_config "${environment}" "${deployment_id}"
    render_deploy_via_git "${environment}" "${deployment_id}"
}

render_validate_config() {
    local environment="$1"
    
    log_info "Validating Render configuration..."
    
    # Check if render.yaml exists
    if [[ ! -f "${SCRIPT_DIR}/render.yaml" ]]; then
        log_info "render.yaml not found, creating one..."
        render_create_config "${environment}"
    fi
    
    # Validate render.yaml syntax
    if command -v yq &>/dev/null; then
        if ! yq eval '.' "${SCRIPT_DIR}/render.yaml" &>/dev/null; then
            log_error "Invalid YAML syntax in render.yaml"
            return 1
        fi
    else
        log_warning "yq not found, skipping YAML validation"
    fi
    
    log_success "Render configuration validated"
}

render_create_config() {
    local environment="$1"
    
    log_info "Creating render.yaml configuration..."
    
    cat > "${SCRIPT_DIR}/render.yaml" << EOF
# Render configuration for Learning Assistant
# Generated on $(date)

services:
  # Main Web Service
  - type: web
    name: learning-assistant-${environment}
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    plan: ${RENDER_PLAN:-starter}
    region: ${RENDER_REGION:-oregon}
    branch: ${RENDER_BRANCH:-main}
    
    # Auto-deploy settings
    autoDeploy: true
    
    # Build settings
    buildCommand: "npm run build"
    
    # Health check
    healthCheckPath: /api/health
    
    # Environment Variables
    envVars:
      - key: NODE_ENV
        value: ${environment}
      - key: PORT
        value: '3000'
      - key: NEXT_TELEMETRY_DISABLED
        value: '1'
      - key: DATABASE_URL
        value: sqlite:./app.db
      - key: BETTER_AUTH_SECRET
        generateValue: true
      - key: NEXT_PUBLIC_API_URL
        value: https://learning-assistant-${environment}.onrender.com
      - key: NEXT_PUBLIC_APP_URL
        value: https://learning-assistant-${environment}.onrender.com
      
      # Feature flags
      - key: FEATURE_ANALYTICS_ENABLED
        value: 'true'
      - key: FEATURE_RECOMMENDATIONS_ENABLED
        value: 'true'
      - key: FEATURE_CHAT_ENABLED
        value: 'false'
      
      # Performance settings
      - key: NODE_OPTIONS
        value: '--max-old-space-size=1024'
      
      # Security settings
      - key: SECURE_COOKIES
        value: 'true'
      - key: TRUST_PROXY
        value: '1'
      
      # Logging
      - key: LOG_LEVEL
        value: 'info'
      
      # Cache settings
      - key: CACHE_TTL
        value: '3600'
      
      # Rate Limiting
      - key: RATE_LIMIT_ENABLED
        value: 'true'
      - key: RATE_LIMIT_WINDOW
        value: '900000'  # 15 minutes
      - key: RATE_LIMIT_MAX_REQUESTS
        value: '100'

  # Redis Cache Service
  - type: redis
    name: learning-assistant-${environment}-redis
    plan: ${RENDER_REDIS_PLAN:-starter}
    region: ${RENDER_REGION:-oregon}
    
    # Redis Configuration
    maxmemoryPolicy: allkeys-lru
    
    # Persistence
    persistence: true

  # Static Site Service (for assets/CDN)
  - type: static
    name: learning-assistant-${environment}-static
    buildCommand: "npm run build && npm run export"
    staticPublishPath: ./out
    
    # Custom Headers for Static Assets
    headers:
      - path: "/*"
        name: "Cache-Control"
        value: "public, max-age=86400"
      - path: "/*.css"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/*.js"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/*.png"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/*.jpg"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/*.svg"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/*.ico"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/api/*"
        name: "Cache-Control"
        value: "no-cache, no-store, must-revalidate"
      - path: "/admin/*"
        name: "Cache-Control"
        value: "no-cache, no-store, must-revalidate"
      - path: "/auth/*"
        name: "Cache-Control"
        value: "no-cache, no-store, must-revalidate"
      - path: "/_next/static/*"
        name: "Cache-Control"
        value: "public, max-age=31536000, immutable"
      - path: "/manifest.json"
        name: "Cache-Control"
        value: "public, max-age=0, must-revalidate"
    
    # Environment Variables for Static Build
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_TELEMETRY_DISABLED
        value: '1'

# PostgreSQL Database Service
databases:
  - name: learning-assistant-${environment}-db
    databaseName: learning_assistant
    user: learning_assistant_user
    plan: ${RENDER_DB_PLAN:-starter}
    region: ${RENDER_REGION:-oregon}
    
    # Database Configuration
    postgresqlVersion: '15'
    
    # Connection Settings
    maxConnections: 20
    
    # Backup Configuration
    backupSchedule: "0 2 * * *"  # Daily at 2 AM
    backupRetentionDays: 7
EOF
    
    log_success "render.yaml configuration created"
}

render_update_config() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Updating render.yaml configuration..."
    
    # Add deployment-specific environment variables
    if command -v yq &>/dev/null; then
        # Add deployment tracking variables
        yq eval ".services[0].envVars += [
            {\"key\": \"DEPLOYMENT_ID\", \"value\": \"${deployment_id}\"},
            {\"key\": \"DEPLOYMENT_TIMESTAMP\", \"value\": \"$(date)\"},
            {\"key\": \"DEPLOYED_BY\", \"value\": \"${USER:-unknown}\"}
        ]" -i "${SCRIPT_DIR}/render.yaml"
        
        log_success "render.yaml configuration updated"
    else
        log_warning "yq not found, skipping automatic configuration update"
    fi
}

render_deploy_via_git() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying via Git integration..."
    
    # Check if we're in a Git repository
    if ! git rev-parse --is-inside-work-tree &>/dev/null; then
        log_error "Not in a Git repository. Render requires Git integration."
        return 1
    fi
    
    # Check if we have uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_warning "You have uncommitted changes. Render will deploy the committed version."
        echo -e "${YELLOW}Do you want to commit and push your changes? [y/N]${NC}"
        read -r commit_changes
        
        if [[ "${commit_changes}" =~ ^[Yy]$ ]]; then
            render_commit_and_push "${deployment_id}"
        fi
    fi
    
    # Get current branch
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    
    # Check if we're on the correct deployment branch
    local deploy_branch="${RENDER_BRANCH:-main}"
    if [[ "${current_branch}" != "${deploy_branch}" ]]; then
        log_warning "Current branch (${current_branch}) differs from deploy branch (${deploy_branch})"
        echo -e "${YELLOW}Do you want to switch to ${deploy_branch}? [y/N]${NC}"
        read -r switch_branch
        
        if [[ "${switch_branch}" =~ ^[Yy]$ ]]; then
            git checkout "${deploy_branch}"
        fi
    fi
    
    # Push to trigger deployment
    log_info "Pushing to trigger Render deployment..."
    if git push origin "${deploy_branch}"; then
        log_success "Code pushed to ${deploy_branch} branch"
        render_wait_for_deployment "${environment}"
    else
        log_error "Failed to push code"
        return 1
    fi
}

render_commit_and_push() {
    local deployment_id="$1"
    
    log_info "Committing and pushing changes..."
    
    # Add all changes
    git add .
    
    # Create commit message
    local commit_message="Deploy ${deployment_id}

- Updated render.yaml configuration
- Deployment timestamp: $(date)
- Environment: ${environment}"
    
    # Commit changes
    if git commit -m "${commit_message}"; then
        log_success "Changes committed"
    else
        log_error "Failed to commit changes"
        return 1
    fi
    
    # Push changes
    if git push; then
        log_success "Changes pushed to repository"
    else
        log_error "Failed to push changes"
        return 1
    fi
}

render_wait_for_deployment() {
    local environment="$1"
    
    log_info "Waiting for Render deployment to complete..."
    log_info "You can monitor the deployment progress at: https://dashboard.render.com"
    
    # Since we can't directly monitor Render deployments via CLI,
    # we'll wait and then check the health endpoint
    local service_url="https://learning-assistant-${environment}.onrender.com"
    
    # Wait for the service to be available
    local max_wait=600  # 10 minutes
    local wait_interval=30
    local waited=0
    
    while [[ ${waited} -lt ${max_wait} ]]; do
        log_info "Checking deployment status... (${waited}/${max_wait}s)"
        
        if curl -f -s "${service_url}/api/health" > /dev/null; then
            log_success "Deployment completed successfully!"
            export DEPLOYMENT_URL="${service_url}"
            return 0
        fi
        
        sleep ${wait_interval}
        waited=$((waited + wait_interval))
    done
    
    log_warning "Deployment check timed out. The service might still be starting up."
    log_info "Please check the Render dashboard for deployment status."
    export DEPLOYMENT_URL="${service_url}"
}

render_setup_custom_domain() {
    local environment="$1"
    local domain="$2"
    
    log_info "Setting up custom domain: ${domain}"
    log_info "Please configure the following DNS records:"
    
    echo -e "${CYAN}DNS Configuration:${NC}"
    echo "  Type: CNAME"
    echo "  Name: ${domain}"
    echo "  Value: learning-assistant-${environment}.onrender.com"
    echo ""
    echo -e "${YELLOW}After DNS configuration, add the custom domain in Render dashboard:${NC}"
    echo "  1. Go to your service settings"
    echo "  2. Click 'Custom Domains'"
    echo "  3. Add '${domain}'"
    echo "  4. Verify domain ownership"
}

render_setup_environment_variables() {
    local environment="$1"
    
    log_info "Environment variables are configured in render.yaml"
    log_info "To add more variables, edit render.yaml and redeploy"
    
    # Show current environment variables
    if command -v yq &>/dev/null; then
        echo -e "\n${CYAN}Current environment variables:${NC}"
        yq eval '.services[0].envVars[] | .key + "=" + .value' "${SCRIPT_DIR}/render.yaml"
    fi
}

render_show_deployment_info() {
    local environment="$1"
    
    log_info "Render Deployment Information:"
    
    local service_url="https://learning-assistant-${environment}.onrender.com"
    
    echo -e "\n${GREEN}Service URL: ${service_url}${NC}"
    echo -e "${CYAN}Dashboard: https://dashboard.render.com${NC}"
    
    echo -e "\n${YELLOW}Configuration:${NC}"
    echo "  Service: learning-assistant-${environment}"
    echo "  Region: ${RENDER_REGION:-oregon}"
    echo "  Plan: ${RENDER_PLAN:-starter}"
    echo "  Branch: ${RENDER_BRANCH:-main}"
    
    echo -e "\n${YELLOW}Useful commands:${NC}"
    echo "  Monitor logs: Check Render dashboard"
    echo "  Scale service: Use Render dashboard"
    echo "  Update config: Edit render.yaml and push"
    echo "  Manual deploy: Push to ${RENDER_BRANCH:-main} branch"
}

render_setup_monitoring() {
    local environment="$1"
    
    log_info "Setting up monitoring for Render deployment..."
    
    # Create monitoring configuration
    cat > "${SCRIPT_DIR}/render-monitoring.json" << EOF
{
    "service": "learning-assistant-${environment}",
    "healthCheck": {
        "path": "/api/health",
        "interval": "1m",
        "timeout": "10s"
    },
    "alerts": {
        "downtime": true,
        "highCpu": true,
        "highMemory": true,
        "responseTime": true
    },
    "notifications": {
        "email": "${RENDER_ALERT_EMAIL:-}",
        "slack": "${RENDER_SLACK_WEBHOOK:-}"
    }
}
EOF
    
    log_success "Monitoring configuration created"
    log_info "Please configure alerts in the Render dashboard"
}