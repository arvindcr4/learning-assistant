#!/bin/bash

# ==============================================================================
# Railway Build Script for Learning Assistant
# ==============================================================================
# This script handles the build process for Railway deployments
# including dependency installation, build optimization, and asset preparation

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
NODE_VERSION="20"
BUILD_TIMEOUT=600  # 10 minutes
MEMORY_LIMIT="2048"  # 2GB

# Check Node.js version
check_node_version() {
    log_info "Checking Node.js version..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    local current_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    local required_version="$NODE_VERSION"
    
    if [[ "$current_version" -lt "$required_version" ]]; then
        log_error "Node.js version $current_version is too old. Required: $required_version+"
        exit 1
    fi
    
    log_success "Node.js version: $(node --version)"
}

# Check npm version
check_npm_version() {
    log_info "Checking npm version..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    log_success "npm version: $(npm --version)"
}

# Set build environment
set_build_environment() {
    log_info "Setting build environment..."
    
    # Railway-specific environment variables
    export NODE_ENV="production"
    export NEXT_TELEMETRY_DISABLED="1"
    export SKIP_ENV_VALIDATION="1"
    export CI="true"
    
    # Memory optimization
    export NODE_OPTIONS="--max-old-space-size=$MEMORY_LIMIT"
    
    # Build optimization
    export NEXT_BUILD_STANDALONE="true"
    export NEXT_BUILD_EXPERIMENTAL_OPTIMIZE="true"
    
    log_success "Build environment configured"
}

# Clean previous builds
clean_build() {
    log_info "Cleaning previous builds..."
    
    # Remove build artifacts
    rm -rf .next
    rm -rf out
    rm -rf dist
    rm -rf build
    
    # Clean npm cache
    npm cache clean --force
    
    log_success "Build cleaned"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Configure npm for production
    npm config set fund false
    npm config set audit false
    npm config set progress false
    npm config set loglevel error
    
    # Install dependencies
    if npm ci --only=production --ignore-scripts; then
        log_success "Production dependencies installed"
    else
        log_error "Failed to install production dependencies"
        exit 1
    fi
    
    # Install dev dependencies for build
    if npm ci --only=dev --ignore-scripts; then
        log_success "Development dependencies installed"
    else
        log_error "Failed to install development dependencies"
        exit 1
    fi
}

# Build application
build_application() {
    log_info "Building application..."
    
    # Set build timeout
    timeout $BUILD_TIMEOUT npm run build
    
    if [[ $? -eq 0 ]]; then
        log_success "Application built successfully"
    else
        log_error "Application build failed"
        exit 1
    fi
}

# Optimize build
optimize_build() {
    log_info "Optimizing build..."
    
    # Remove source maps in production
    if [[ "${NODE_ENV:-}" == "production" ]]; then
        find .next -name "*.map" -delete
        log_debug "Source maps removed"
    fi
    
    # Compress static assets
    if command -v gzip &> /dev/null; then
        find .next/static -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" \) -exec gzip -9 -k {} \;
        log_debug "Static assets compressed"
    fi
    
    # Remove unnecessary files
    find .next -name "*.tsbuildinfo" -delete
    find .next -name "*.test.js" -delete
    find .next -name "*.spec.js" -delete
    
    log_success "Build optimized"
}

# Validate build
validate_build() {
    log_info "Validating build..."
    
    # Check if build directory exists
    if [[ ! -d ".next" ]]; then
        log_error "Build directory .next not found"
        exit 1
    fi
    
    # Check if standalone build exists
    if [[ ! -f ".next/standalone/server.js" ]]; then
        log_error "Standalone build not found"
        exit 1
    fi
    
    # Check if static assets exist
    if [[ ! -d ".next/static" ]]; then
        log_error "Static assets not found"
        exit 1
    fi
    
    log_success "Build validation passed"
}

# Generate build report
generate_build_report() {
    log_info "Generating build report..."
    
    # Build size
    local build_size=$(du -sh .next 2>/dev/null | cut -f1)
    log_info "Build size: $build_size"
    
    # Static assets size
    local static_size=$(du -sh .next/static 2>/dev/null | cut -f1)
    log_info "Static assets size: $static_size"
    
    # Number of pages
    local pages_count=$(find .next/server/pages -name "*.js" 2>/dev/null | wc -l)
    log_info "Pages built: $pages_count"
    
    # Number of API routes
    local api_count=$(find .next/server/pages/api -name "*.js" 2>/dev/null | wc -l)
    log_info "API routes built: $api_count"
    
    # Build time
    if [[ -n "${BUILD_START_TIME:-}" ]]; then
        local build_time=$(($(date +%s) - BUILD_START_TIME))
        log_info "Build time: ${build_time}s"
    fi
    
    log_success "Build report generated"
}

# Railway-specific optimizations
railway_optimizations() {
    log_info "Applying Railway-specific optimizations..."
    
    # Create Railway-specific files
    cat > .next/railway.json << EOF
{
  "version": "1.0.0",
  "build": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)"
  },
  "runtime": {
    "type": "standalone",
    "entrypoint": "server.js"
  }
}
EOF
    
    # Create health check file
    cat > .next/health.json << EOF
{
  "status": "healthy",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "version": "$(node -p "require('./package.json').version")"
}
EOF
    
    log_success "Railway optimizations applied"
}

# Main build function
main_build() {
    log_info "Starting Railway build process..."
    
    # Record build start time
    BUILD_START_TIME=$(date +%s)
    
    # Pre-build checks
    check_node_version
    check_npm_version
    
    # Set environment
    set_build_environment
    
    # Clean previous builds
    clean_build
    
    # Install dependencies
    install_dependencies
    
    # Build application
    build_application
    
    # Optimize build
    optimize_build
    
    # Validate build
    validate_build
    
    # Apply Railway optimizations
    railway_optimizations
    
    # Generate build report
    generate_build_report
    
    log_success "Build process completed successfully!"
}

# Error handling
handle_error() {
    log_error "Build failed at step: $1"
    log_error "Error details: $2"
    
    # Show build logs if available
    if [[ -f ".next/build.log" ]]; then
        log_info "Build logs:"
        tail -50 .next/build.log
    fi
    
    exit 1
}

# Trap errors
trap 'handle_error "${BASH_COMMAND}" "$?"' ERR

# CLI interface
case "${1:-build}" in
    "build")
        main_build
        ;;
    "clean")
        clean_build
        ;;
    "install")
        install_dependencies
        ;;
    "validate")
        validate_build
        ;;
    "report")
        generate_build_report
        ;;
    "optimize")
        optimize_build
        ;;
    "test")
        check_node_version
        check_npm_version
        log_success "All checks passed"
        ;;
    "help"|"-h"|"--help")
        echo "Railway Build Script for Learning Assistant"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  build     - Full build process (default)"
        echo "  clean     - Clean previous builds"
        echo "  install   - Install dependencies only"
        echo "  validate  - Validate build output"
        echo "  report    - Generate build report"
        echo "  optimize  - Optimize build output"
        echo "  test      - Run pre-build checks"
        echo "  help      - Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  DEBUG=true               - Enable debug output"
        echo "  NODE_ENV=production      - Build environment"
        echo "  MEMORY_LIMIT=2048        - Memory limit in MB"
        echo "  BUILD_TIMEOUT=600        - Build timeout in seconds"
        echo "  SKIP_OPTIMIZATION=true   - Skip build optimization"
        ;;
    *)
        log_error "Unknown command: $1"
        log_info "Run '$0 help' for usage information"
        exit 1
        ;;
esac