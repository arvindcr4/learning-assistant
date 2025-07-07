#!/bin/bash

# =============================================================================
# Common Utility Functions for Deployment Orchestrator
# =============================================================================

# =============================================================================
# Environment Configuration Management
# =============================================================================

# Generate a comprehensive environment configuration
generate_environment_config() {
    local platform="$1"
    local environment="$2"
    local output_file="$3"
    
    local timestamp=$(date)
    local deployment_id="${platform}_${environment}_$(date +%s)"
    
    cat > "${output_file}" << EOF
# Learning Assistant - ${platform} ${environment} Configuration
# Generated: ${timestamp}
# Deployment ID: ${deployment_id}

# =============================================================================
# Application Settings
# =============================================================================
APP_NAME=learning-assistant
APP_VERSION=1.0.0
NODE_ENV=${environment}
PORT=3000
DEPLOYMENT_ID=${deployment_id}
DEPLOYMENT_TIMESTAMP=${timestamp}
DEPLOYED_BY=${USER:-unknown}

# =============================================================================
# Database Configuration
# =============================================================================
DATABASE_URL=sqlite:./app.db
DATABASE_SSL=false
DATABASE_MAX_CONNECTIONS=20
DATABASE_CONNECTION_TIMEOUT=30000

# =============================================================================
# Security Configuration
# =============================================================================
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
SECURE_COOKIES=true
TRUST_PROXY=1

# =============================================================================
# Feature Flags
# =============================================================================
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false
FEATURE_VOICE_ENABLED=false
FEATURE_OFFLINE_MODE=false
FEATURE_DEBUG_MODE=false

# =============================================================================
# Performance Settings
# =============================================================================
NODE_OPTIONS=--max-old-space-size=1024
NEXT_TELEMETRY_DISABLED=1
CACHE_TTL=3600
CACHE_MAX_SIZE=100
ENABLE_COMPRESSION=true

# =============================================================================
# Logging Configuration
# =============================================================================
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_CONSOLE_ENABLED=true
LOG_MAX_FILES=7
LOG_MAX_SIZE=10m

# =============================================================================
# Rate Limiting
# =============================================================================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=false

# =============================================================================
# Monitoring and Health Checks
# =============================================================================
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PATH=/api/health
METRICS_ENABLED=true
METRICS_PORT=3001
APM_ENABLED=false

# =============================================================================
# Platform-specific Settings
# =============================================================================
PLATFORM=${platform}
ENVIRONMENT=${environment}

EOF

    # Add platform-specific configurations
    case "${platform}" in
        "aws")
            cat >> "${output_file}" << 'EOF'
# AWS-specific settings
AWS_REGION=us-east-1
AWS_INSTANCE_TYPE=t3.medium
AWS_DEPLOY_METHOD=ec2
AWS_AMI_ID=ami-0453ec754f44f9a4a
AWS_KEY_NAME=learning-assistant-key
AWS_SECURITY_GROUP=learning-assistant-sg

EOF
            ;;
        "gcp")
            cat >> "${output_file}" << 'EOF'
# GCP-specific settings
GCP_PROJECT_ID=
GCP_REGION=us-central1
GCP_ZONE=us-central1-a
GCP_MACHINE_TYPE=e2-medium
GCP_DEPLOY_METHOD=run
GCP_SERVICE_NAME=learning-assistant

EOF
            ;;
        "azure")
            cat >> "${output_file}" << 'EOF'
# Azure-specific settings
AZURE_RESOURCE_GROUP=learning-assistant-rg
AZURE_LOCATION=eastus
AZURE_DEPLOY_METHOD=webapp
AZURE_APP_SERVICE_PLAN=learning-assistant-plan
AZURE_WEBAPP_NAME=
AZURE_VM_SIZE=Standard_B2s

EOF
            ;;
        "fly")
            cat >> "${output_file}" << 'EOF'
# Fly.io-specific settings
FLY_REGION=bom
FLY_MEMORY=1gb
FLY_CPU_KIND=shared
FLY_CPUS=1
FLY_MIN_INSTANCES=0
FLY_MAX_INSTANCES=2
FLY_VOLUME_SIZE=1
FLY_CUSTOM_VARS=

EOF
            ;;
        "railway")
            cat >> "${output_file}" << 'EOF'
# Railway-specific settings
RAILWAY_CUSTOM_VARS=

EOF
            ;;
        "render")
            cat >> "${output_file}" << 'EOF'
# Render-specific settings
RENDER_PLAN=starter
RENDER_REGION=oregon
RENDER_BRANCH=main
RENDER_REDIS_PLAN=starter
RENDER_DB_PLAN=starter
RENDER_ALERT_EMAIL=
RENDER_SLACK_WEBHOOK=

EOF
            ;;
        "digitalocean")
            cat >> "${output_file}" << 'EOF'
# DigitalOcean-specific settings
DO_REGION=nyc3
DO_SIZE=s-1vcpu-1gb
DO_IMAGE=ubuntu-22-04-x64
DO_TAG=learning-assistant
DO_DEPLOY_METHOD=droplet
DO_GITHUB_REPO=
DO_GITHUB_BRANCH=main
DO_APP_SIZE=basic-xxs

EOF
            ;;
        "linode")
            cat >> "${output_file}" << 'EOF'
# Linode-specific settings
LINODE_REGION=us-east
LINODE_TYPE=g6-standard-1
LINODE_IMAGE=linode/ubuntu22.04
LINODE_LABEL=learning-assistant

EOF
            ;;
    esac
    
    log_success "Environment configuration generated: ${output_file}"
}

# Validate environment configuration
validate_environment_config() {
    local config_file="$1"
    
    if [[ ! -f "${config_file}" ]]; then
        log_error "Configuration file not found: ${config_file}"
        return 1
    fi
    
    # Source the configuration
    if ! source "${config_file}" &>/dev/null; then
        log_error "Invalid configuration file syntax: ${config_file}"
        return 1
    fi
    
    # Check required variables
    local required_vars=(
        "APP_NAME"
        "NODE_ENV"
        "PORT"
        "PLATFORM"
        "ENVIRONMENT"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("${var}")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required variables in ${config_file}: ${missing_vars[*]}"
        return 1
    fi
    
    # Validate specific values
    if [[ ! "${NODE_ENV}" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid NODE_ENV value: ${NODE_ENV}. Must be one of: development, staging, production"
        return 1
    fi
    
    if [[ ! "${PORT}" =~ ^[0-9]+$ ]] || [[ "${PORT}" -lt 1 ]] || [[ "${PORT}" -gt 65535 ]]; then
        log_error "Invalid PORT value: ${PORT}. Must be a number between 1 and 65535"
        return 1
    fi
    
    log_success "Environment configuration validation passed: ${config_file}"
    return 0
}

# =============================================================================
# Health Check Functions
# =============================================================================

# Perform comprehensive health check
perform_comprehensive_health_check() {
    local url="$1"
    local max_attempts="${2:-30}"
    local wait_time="${3:-10}"
    
    log_info "Performing comprehensive health check on ${url}"
    
    local health_endpoints=(
        "/api/health"
        "/"
        "/api/metrics"
    )
    
    local all_passed=true
    
    for endpoint in "${health_endpoints[@]}"; do
        local endpoint_url="${url}${endpoint}"
        local passed=false
        
        for ((i=1; i<=max_attempts; i++)); do
            local response_code
            response_code=$(curl -s -o /dev/null -w "%{http_code}" "${endpoint_url}" 2>/dev/null || echo "000")
            
            if [[ "${response_code}" =~ ^[23][0-9][0-9]$ ]]; then
                log_success "Health check passed for ${endpoint} (attempt ${i}/${max_attempts})"
                passed=true
                break
            fi
            
            log_debug "Health check failed for ${endpoint} (attempt ${i}/${max_attempts}): HTTP ${response_code}"
            
            if [[ ${i} -lt ${max_attempts} ]]; then
                sleep "${wait_time}"
            fi
        done
        
        if [[ "${passed}" != "true" ]]; then
            log_error "Health check failed for ${endpoint} after ${max_attempts} attempts"
            all_passed=false
        fi
    done
    
    if [[ "${all_passed}" == "true" ]]; then
        log_success "All health checks passed"
        return 0
    else
        log_error "One or more health checks failed"
        return 1
    fi
}

# Monitor application metrics
monitor_application_metrics() {
    local url="$1"
    local duration="${2:-60}"
    
    log_info "Monitoring application metrics for ${duration} seconds..."
    
    local metrics_url="${url}/api/metrics"
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    
    while [[ $(date +%s) -lt ${end_time} ]]; do
        local metrics_response
        metrics_response=$(curl -s "${metrics_url}" 2>/dev/null || echo "{}")
        
        # Extract key metrics
        local memory_usage
        local cpu_usage
        local response_time
        
        # This would require jq or similar JSON parsing tool
        if command -v jq &>/dev/null; then
            memory_usage=$(echo "${metrics_response}" | jq -r '.memory.usage // "unknown"' 2>/dev/null)
            cpu_usage=$(echo "${metrics_response}" | jq -r '.cpu.usage // "unknown"' 2>/dev/null)
            response_time=$(echo "${metrics_response}" | jq -r '.response_time.avg // "unknown"' 2>/dev/null)
            
            log_debug "Metrics - Memory: ${memory_usage}, CPU: ${cpu_usage}, Response Time: ${response_time}"
        fi
        
        sleep 5
    done
    
    log_success "Metrics monitoring completed"
}

# =============================================================================
# Security Functions
# =============================================================================

# Generate secure secrets
generate_secure_secrets() {
    local output_file="$1"
    
    log_info "Generating secure secrets..."
    
    cat > "${output_file}" << EOF
# Secure Secrets - Generated $(date)
# Store these securely and do not commit to version control

BETTER_AUTH_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
DATABASE_PASSWORD=$(openssl rand -base64 32)
ADMIN_API_KEY=$(openssl rand -hex 24)
WEBHOOK_SECRET=$(openssl rand -hex 16)
EOF
    
    chmod 600 "${output_file}"
    log_success "Secure secrets generated: ${output_file}"
}

# Validate SSL/TLS configuration
validate_ssl_configuration() {
    local url="$1"
    
    if [[ ! "${url}" =~ ^https:// ]]; then
        log_warning "URL is not HTTPS: ${url}"
        return 1
    fi
    
    log_info "Validating SSL/TLS configuration for ${url}"
    
    # Extract hostname
    local hostname
    hostname=$(echo "${url}" | sed 's|https://||' | sed 's|/.*||')
    
    # Check SSL certificate
    if command -v openssl &>/dev/null; then
        local ssl_info
        ssl_info=$(echo | openssl s_client -servername "${hostname}" -connect "${hostname}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        
        if [[ -n "${ssl_info}" ]]; then
            log_success "SSL certificate is valid for ${hostname}"
            log_debug "SSL info: ${ssl_info}"
            return 0
        else
            log_error "SSL certificate validation failed for ${hostname}"
            return 1
        fi
    else
        log_warning "OpenSSL not available, skipping SSL validation"
        return 0
    fi
}

# =============================================================================
# Performance Testing Functions
# =============================================================================

# Basic load testing
perform_load_test() {
    local url="$1"
    local duration="${2:-30}"
    local concurrent_users="${3:-10}"
    
    log_info "Performing load test on ${url} for ${duration}s with ${concurrent_users} concurrent users"
    
    if command -v curl &>/dev/null; then
        # Simple load test using curl
        local pids=()
        local start_time=$(date +%s)
        local end_time=$((start_time + duration))
        
        # Start concurrent requests
        for ((i=1; i<=concurrent_users; i++)); do
            (
                while [[ $(date +%s) -lt ${end_time} ]]; do
                    curl -s -o /dev/null "${url}" 2>/dev/null
                    sleep 0.1
                done
            ) &
            pids+=($!)
        done
        
        # Wait for test to complete
        sleep "${duration}"
        
        # Kill background processes
        for pid in "${pids[@]}"; do
            kill "${pid}" 2>/dev/null || true
        done
        
        wait 2>/dev/null || true
        
        log_success "Load test completed"
    else
        log_warning "curl not available, skipping load test"
    fi
}

# =============================================================================
# Backup and Recovery Functions
# =============================================================================

# Create deployment backup
create_deployment_backup() {
    local platform="$1"
    local environment="$2"
    local deployment_id="$3"
    local backup_dir="${4:-${LOG_DIR}/backups}"
    
    log_info "Creating deployment backup..."
    
    mkdir -p "${backup_dir}"
    local backup_file="${backup_dir}/backup_${platform}_${environment}_${deployment_id}.tar.gz"
    
    # Create backup of configuration and logs
    tar -czf "${backup_file}" \
        -C "${SCRIPT_DIR}" \
        deploy/config \
        logs \
        .env* \
        *.yaml \
        *.toml \
        *.json \
        2>/dev/null || true
    
    if [[ -f "${backup_file}" ]]; then
        log_success "Deployment backup created: ${backup_file}"
        echo "${backup_file}"
    else
        log_error "Failed to create deployment backup"
        return 1
    fi
}

# =============================================================================
# Notification Functions
# =============================================================================

# Send deployment notification
send_deployment_notification() {
    local platform="$1"
    local environment="$2"
    local status="$3"
    local deployment_url="${4:-unknown}"
    local notification_method="${5:-log}"
    
    local message="Deployment ${status}: ${platform} ${environment}"
    if [[ "${deployment_url}" != "unknown" ]]; then
        message="${message} - ${deployment_url}"
    fi
    
    case "${notification_method}" in
        "slack")
            send_slack_notification "${message}"
            ;;
        "email")
            send_email_notification "${message}"
            ;;
        "webhook")
            send_webhook_notification "${message}"
            ;;
        *)
            log_info "Notification: ${message}"
            ;;
    esac
}

send_slack_notification() {
    local message="$1"
    local slack_webhook="${SLACK_WEBHOOK_URL:-}"
    
    if [[ -n "${slack_webhook}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"${message}\"}" \
            "${slack_webhook}" &>/dev/null || log_warning "Failed to send Slack notification"
    else
        log_debug "Slack webhook not configured"
    fi
}

send_email_notification() {
    local message="$1"
    local email="${NOTIFICATION_EMAIL:-}"
    
    if [[ -n "${email}" ]] && command -v mail &>/dev/null; then
        echo "${message}" | mail -s "Learning Assistant Deployment" "${email}" || log_warning "Failed to send email notification"
    else
        log_debug "Email notification not configured or mail command not available"
    fi
}

send_webhook_notification() {
    local message="$1"
    local webhook_url="${WEBHOOK_URL:-}"
    
    if [[ -n "${webhook_url}" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"message\":\"${message}\"}" \
            "${webhook_url}" &>/dev/null || log_warning "Failed to send webhook notification"
    else
        log_debug "Webhook URL not configured"
    fi
}

# =============================================================================
# Deployment Status Tracking
# =============================================================================

# Create deployment status entry
create_deployment_status() {
    local platform="$1"
    local environment="$2"
    local deployment_id="$3"
    local status="$4"
    local deployment_url="${5:-}"
    
    local status_file="${LOG_DIR}/deployment_status.json"
    local timestamp=$(date -Iseconds)
    
    # Create status entry
    local status_entry=$(cat << EOF
{
    "deployment_id": "${deployment_id}",
    "platform": "${platform}",
    "environment": "${environment}",
    "status": "${status}",
    "deployment_url": "${deployment_url}",
    "timestamp": "${timestamp}",
    "user": "${USER:-unknown}"
}
EOF
)
    
    # Initialize status file if it doesn't exist
    if [[ ! -f "${status_file}" ]]; then
        echo "[]" > "${status_file}"
    fi
    
    # Add new status entry
    if command -v jq &>/dev/null; then
        local temp_file="${status_file}.tmp"
        jq ". += [${status_entry}]" "${status_file}" > "${temp_file}" && mv "${temp_file}" "${status_file}"
    else
        # Fallback without jq
        local temp_file="${status_file}.tmp"
        sed '$ s/]/,/' "${status_file}" > "${temp_file}"
        echo "${status_entry}" >> "${temp_file}"
        echo "]" >> "${temp_file}"
        mv "${temp_file}" "${status_file}"
    fi
    
    log_debug "Deployment status updated: ${deployment_id} -> ${status}"
}

# Get deployment status
get_deployment_status() {
    local deployment_id="$1"
    local status_file="${LOG_DIR}/deployment_status.json"
    
    if [[ -f "${status_file}" ]] && command -v jq &>/dev/null; then
        jq -r ".[] | select(.deployment_id == \"${deployment_id}\") | .status" "${status_file}" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# List all deployments
list_deployments() {
    local status_file="${LOG_DIR}/deployment_status.json"
    
    if [[ -f "${status_file}" ]] && command -v jq &>/dev/null; then
        echo -e "${CYAN}Recent Deployments:${NC}"
        jq -r '.[] | "\(.timestamp) - \(.platform)/\(.environment) - \(.status) - \(.deployment_id)"' "${status_file}" | tail -10
    else
        log_info "No deployment history available"
    fi
}

# =============================================================================
# Cleanup Functions
# =============================================================================

# Clean up temporary files
cleanup_temp_files() {
    local temp_dir="${SCRIPT_DIR}/tmp"
    
    if [[ -d "${temp_dir}" ]]; then
        log_info "Cleaning up temporary files..."
        rm -rf "${temp_dir}"/*
        log_success "Temporary files cleaned up"
    fi
}

# Rotate log files
rotate_log_files() {
    local max_logs="${1:-10}"
    
    log_info "Rotating log files (keeping last ${max_logs})..."
    
    if [[ -d "${LOG_DIR}" ]]; then
        # Remove old log files
        find "${LOG_DIR}" -name "deploy_*.log" -type f | sort | head -n -"${max_logs}" | xargs rm -f 2>/dev/null || true
        
        # Compress old logs
        find "${LOG_DIR}" -name "deploy_*.log" -type f -mtime +1 | while read -r log_file; do
            if [[ ! "${log_file}" =~ \.gz$ ]]; then
                gzip "${log_file}" 2>/dev/null || true
            fi
        done
        
        log_success "Log rotation completed"
    fi
}