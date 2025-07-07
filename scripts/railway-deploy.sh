#!/bin/bash

# ==============================================================================
# Railway Deployment Script for Learning Assistant
# ==============================================================================
# This script handles the complete deployment process for Railway platform
# including pre-deployment checks, database setup, and post-deployment verification

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${MAGENTA}[DEBUG]${NC} $1"
    fi
}

# Configuration
PROJECT_NAME="learning-assistant"
SERVICE_NAME="web"
DOCKER_FILE="Dockerfile.railway"
RAILWAY_CONFIG="railway.json"
REQUIRED_VARS=("DATABASE_URL" "NEXTAUTH_SECRET" "BETTER_AUTH_SECRET")
OPTIONAL_VARS=("OPENAI_API_KEY" "ANTHROPIC_API_KEY" "SENTRY_DSN")

# Check if Railway CLI is installed
check_railway_cli() {
    log_info "Checking Railway CLI..."
    
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI is not installed"
        log_info "Install it with: npm install -g @railway/cli"
        log_info "Or visit: https://railway.app/cli"
        exit 1
    fi
    
    local version=$(railway --version 2>/dev/null || echo "unknown")
    log_success "Railway CLI found: $version"
}

# Check Railway authentication
check_railway_auth() {
    log_info "Checking Railway authentication..."
    
    if ! railway whoami &> /dev/null; then
        log_error "Not authenticated with Railway"
        log_info "Run: railway login"
        exit 1
    fi
    
    local user=$(railway whoami 2>/dev/null || echo "unknown")
    log_success "Authenticated as: $user"
}

# Check required files
check_required_files() {
    log_info "Checking required files..."
    
    local files=("$DOCKER_FILE" "$RAILWAY_CONFIG" "package.json" "next.config.ts")
    
    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Required file not found: $file"
            exit 1
        fi
        log_debug "Found: $file"
    done
    
    log_success "All required files found"
}

# Validate environment variables
validate_env_vars() {
    log_info "Validating environment variables..."
    
    local missing_vars=()
    
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        log_info "Set these variables in Railway dashboard or .env file"
        exit 1
    fi
    
    log_success "Required environment variables validated"
    
    # Check optional variables
    for var in "${OPTIONAL_VARS[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_warn "Optional variable not set: $var"
        else
            log_debug "Optional variable set: $var"
        fi
    done
}

# Check Docker availability
check_docker() {
    log_info "Checking Docker availability..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        log_info "Install Docker from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        log_info "Please start Docker daemon"
        exit 1
    fi
    
    local version=$(docker --version 2>/dev/null || echo "unknown")
    log_success "Docker available: $version"
}

# Build Docker image locally (for testing)
build_docker_image() {
    log_info "Building Docker image for testing..."
    
    local image_name="$PROJECT_NAME:latest"
    
    if docker build -f "$DOCKER_FILE" -t "$image_name" . ; then
        log_success "Docker image built successfully: $image_name"
        
        # Test the image
        log_info "Testing Docker image..."
        if docker run --rm "$image_name" --version &> /dev/null; then
            log_success "Docker image test passed"
        else
            log_warn "Docker image test failed (may be normal for web app)"
        fi
    else
        log_error "Docker image build failed"
        exit 1
    fi
}

# Run database setup
setup_database() {
    log_info "Setting up database..."
    
    local db_setup_script="scripts/railway-db-setup.js"
    
    if [[ -f "$db_setup_script" ]]; then
        if node "$db_setup_script" setup; then
            log_success "Database setup completed"
        else
            log_error "Database setup failed"
            exit 1
        fi
    else
        log_warn "Database setup script not found: $db_setup_script"
    fi
}

# Deploy to Railway
deploy_to_railway() {
    log_info "Deploying to Railway..."
    
    # Set build command if not already set
    if ! railway variables get BUILD_COMMAND &> /dev/null; then
        log_info "Setting build command..."
        railway variables set BUILD_COMMAND="npm run build"
    fi
    
    # Set start command if not already set
    if ! railway variables get START_COMMAND &> /dev/null; then
        log_info "Setting start command..."
        railway variables set START_COMMAND="npm start"
    fi
    
    # Deploy using Railway CLI
    if railway up --detach; then
        log_success "Deployment initiated successfully"
    else
        log_error "Deployment failed"
        exit 1
    fi
}

# Wait for deployment to complete
wait_for_deployment() {
    log_info "Waiting for deployment to complete..."
    
    local timeout=300  # 5 minutes
    local interval=10  # 10 seconds
    local elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        if railway status | grep -q "RUNNING\|SUCCESS"; then
            log_success "Deployment completed successfully"
            return 0
        elif railway status | grep -q "FAILED\|ERROR"; then
            log_error "Deployment failed"
            return 1
        fi
        
        log_info "Waiting... ($elapsed/$timeout seconds)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    log_error "Deployment timed out after $timeout seconds"
    return 1
}

# Get deployment URL
get_deployment_url() {
    log_info "Getting deployment URL..."
    
    local url=$(railway domain 2>/dev/null || echo "")
    
    if [[ -n "$url" ]]; then
        log_success "Deployment URL: $url"
        echo "$url"
    else
        log_warn "Could not retrieve deployment URL"
        echo ""
    fi
}

# Test deployment health
test_deployment_health() {
    local url="$1"
    
    if [[ -z "$url" ]]; then
        log_warn "No URL provided for health check"
        return 1
    fi
    
    log_info "Testing deployment health..."
    
    # Wait a bit for the service to start
    sleep 30
    
    local health_endpoint="$url/api/health"
    
    if curl -f -s "$health_endpoint" > /dev/null; then
        log_success "Health check passed: $health_endpoint"
        return 0
    else
        log_error "Health check failed: $health_endpoint"
        return 1
    fi
}

# Show deployment logs
show_deployment_logs() {
    log_info "Showing recent deployment logs..."
    
    railway logs --tail 50 || log_warn "Could not retrieve logs"
}

# Rollback deployment
rollback_deployment() {
    log_info "Rolling back deployment..."
    
    if railway rollback; then
        log_success "Rollback completed"
    else
        log_error "Rollback failed"
    fi
}

# Main deployment function
main_deploy() {
    log_info "Starting Railway deployment for $PROJECT_NAME..."
    
    # Pre-deployment checks
    check_railway_cli
    check_railway_auth
    check_required_files
    
    # Load environment variables from .env file if it exists
    if [[ -f ".env" ]]; then
        log_info "Loading environment variables from .env file..."
        set -a
        source .env
        set +a
    fi
    
    # Validate environment
    validate_env_vars
    
    # Docker checks (optional for Railway)
    if [[ "${SKIP_DOCKER:-false}" != "true" ]]; then
        check_docker
        build_docker_image
    fi
    
    # Database setup
    if [[ "${SKIP_DB_SETUP:-false}" != "true" ]]; then
        setup_database
    fi
    
    # Deploy to Railway
    deploy_to_railway
    
    # Wait for deployment
    if wait_for_deployment; then
        # Get deployment URL
        local url=$(get_deployment_url)
        
        # Test deployment
        if [[ -n "$url" ]]; then
            test_deployment_health "$url"
        fi
        
        log_success "Deployment completed successfully!"
        
        if [[ -n "$url" ]]; then
            log_info "Your application is available at: $url"
        fi
    else
        log_error "Deployment failed"
        show_deployment_logs
        exit 1
    fi
}

# CLI interface
case "${1:-deploy}" in
    "deploy")
        main_deploy
        ;;
    "test")
        check_railway_cli
        check_railway_auth
        check_required_files
        validate_env_vars
        log_success "All checks passed"
        ;;
    "logs")
        show_deployment_logs
        ;;
    "status")
        railway status
        ;;
    "rollback")
        rollback_deployment
        ;;
    "health")
        url=$(get_deployment_url)
        test_deployment_health "$url"
        ;;
    "help"|"-h"|"--help")
        echo "Railway Deployment Script for Learning Assistant"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  deploy    - Full deployment (default)"
        echo "  test      - Run pre-deployment checks"
        echo "  logs      - Show deployment logs"
        echo "  status    - Show deployment status"
        echo "  rollback  - Rollback to previous deployment"
        echo "  health    - Test deployment health"
        echo "  help      - Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  DEBUG=true           - Enable debug output"
        echo "  SKIP_DOCKER=true     - Skip Docker checks"
        echo "  SKIP_DB_SETUP=true   - Skip database setup"
        echo ""
        echo "Required variables:"
        for var in "${REQUIRED_VARS[@]}"; do
            echo "  $var"
        done
        echo ""
        echo "Optional variables:"
        for var in "${OPTIONAL_VARS[@]}"; do
            echo "  $var"
        done
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Run '$0 help' for usage information"
        exit 1
        ;;
esac