#!/bin/bash

# Render.com Build Script for Learning Assistant
# This script handles the build process and setup for Render deployment

set -e  # Exit on any error

echo "=== Render Build Script Started ==="
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: $NODE_ENV"
echo "Build context: $(pwd)"
echo "====================================="

# Function to print colored output
print_status() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

print_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

print_warning() {
    echo -e "\033[33m[WARNING]\033[0m $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verify required tools
print_status "Checking required tools..."
for tool in node npm; do
    if ! command_exists $tool; then
        print_error "$tool is not installed or not in PATH"
        exit 1
    fi
done

# Set environment variables for build
export NODE_ENV=${NODE_ENV:-production}
export NEXT_TELEMETRY_DISABLED=1
export SKIP_ENV_VALIDATION=1

print_status "Environment variables set for build"

# Clean previous build artifacts
print_status "Cleaning previous build artifacts..."
rm -rf .next
rm -rf out
rm -rf node_modules/.cache
rm -rf .cache

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p .next/cache
mkdir -p tmp
mkdir -p logs
mkdir -p uploads

# Install dependencies
print_status "Installing dependencies..."
if [ "$NODE_ENV" = "production" ]; then
    # Production build - install only production dependencies
    npm ci --omit=dev --ignore-scripts --prefer-offline --no-audit --no-fund
else
    # Development build - install all dependencies
    npm ci --ignore-scripts --prefer-offline --no-audit --no-fund
fi

# Verify critical dependencies
print_status "Verifying critical dependencies..."
critical_deps=("next" "react" "react-dom" "pg" "better-auth")
for dep in "${critical_deps[@]}"; do
    if ! npm list $dep --depth=0 >/dev/null 2>&1; then
        print_error "Critical dependency $dep is not installed"
        exit 1
    fi
done

# Build the application
print_status "Building Next.js application..."
npm run build

# Verify build output
print_status "Verifying build output..."
if [ ! -d ".next" ]; then
    print_error "Build failed - .next directory not found"
    exit 1
fi

if [ ! -f ".next/BUILD_ID" ]; then
    print_error "Build failed - BUILD_ID not found"
    exit 1
fi

# Check build size
build_size=$(du -sh .next 2>/dev/null | cut -f1)
print_status "Build size: $build_size"

# Create build manifest
print_status "Creating build manifest..."
cat > build-manifest.json << EOF
{
  "buildId": "$(cat .next/BUILD_ID)",
  "buildTime": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)",
  "environment": "$NODE_ENV",
  "buildSize": "$build_size",
  "platform": "render",
  "commit": "${RENDER_GIT_COMMIT:-unknown}",
  "branch": "${RENDER_GIT_BRANCH:-unknown}"
}
EOF

# Database preparation
if [ "$NODE_ENV" = "production" ]; then
    print_status "Preparing database migration scripts..."
    
    # Ensure migration scripts are executable
    if [ -d "scripts" ]; then
        chmod +x scripts/*.js 2>/dev/null || true
    fi
    
    # Ensure database setup script is available
    if [ -f "dbsetup.js" ]; then
        chmod +x dbsetup.js
    fi
fi

# Security check
print_status "Running security checks..."
if [ -f "package-lock.json" ]; then
    # Check for known vulnerabilities (if npm audit is available)
    if command_exists npm && npm audit --version >/dev/null 2>&1; then
        print_status "Running npm audit..."
        npm audit --audit-level=moderate --production || print_warning "npm audit found issues"
    fi
fi

# Performance optimization
print_status "Optimizing build for performance..."

# Pre-compress static assets if gzip is available
if command_exists gzip; then
    print_status "Pre-compressing static assets..."
    find .next/static -name "*.js" -o -name "*.css" -o -name "*.html" | while read file; do
        gzip -c "$file" > "$file.gz"
    done
fi

# Create health check validation
print_status "Creating health check validation..."
cat > validate-health.js << 'EOF'
const http = require('http');

const port = process.env.PORT || 3000;
const timeout = 10000;

const req = http.request({
    hostname: 'localhost',
    port: port,
    path: '/api/health',
    method: 'GET',
    timeout: timeout
}, (res) => {
    if (res.statusCode === 200) {
        console.log('Health check passed');
        process.exit(0);
    } else {
        console.error(`Health check failed with status: ${res.statusCode}`);
        process.exit(1);
    }
});

req.on('error', (err) => {
    console.error('Health check error:', err.message);
    process.exit(1);
});

req.on('timeout', () => {
    console.error('Health check timeout');
    req.destroy();
    process.exit(1);
});

req.end();
EOF

# Set proper permissions
chmod +x validate-health.js

# Create cleanup script
print_status "Creating cleanup script..."
cat > cleanup.sh << 'EOF'
#!/bin/bash
# Cleanup script for Render deployment

echo "Running cleanup..."

# Remove development dependencies if in production
if [ "$NODE_ENV" = "production" ]; then
    echo "Removing development dependencies..."
    npm prune --production
fi

# Clean npm cache
npm cache clean --force

# Remove unnecessary files
rm -rf node_modules/.cache
rm -rf .cache
rm -rf coverage
rm -rf __tests__
rm -rf .github
rm -rf docs

echo "Cleanup complete"
EOF

chmod +x cleanup.sh

# Run cleanup if in production
if [ "$NODE_ENV" = "production" ]; then
    print_status "Running production cleanup..."
    ./cleanup.sh
fi

# Final verification
print_status "Final build verification..."
if [ ! -f ".next/BUILD_ID" ]; then
    print_error "Final verification failed - build appears incomplete"
    exit 1
fi

# Print build summary
print_status "Build Summary:"
echo "  Build ID: $(cat .next/BUILD_ID)"
echo "  Build Time: $(date)"
echo "  Node Version: $(node --version)"
echo "  Build Size: $build_size"
echo "  Environment: $NODE_ENV"
echo "  Platform: Render"

print_status "Build completed successfully!"
print_status "Next.js application is ready for deployment on Render.com"

echo "====================================="
echo "=== Render Build Script Completed ==="
echo "====================================="