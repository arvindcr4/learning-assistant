#!/bin/bash

# Render.com Startup Script for Learning Assistant
# This script handles application startup, database initialization, and health checks

set -e  # Exit on any error

echo "=== Learning Assistant Startup Script ==="
echo "Starting application on Render.com..."
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "=========================================="

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

# Function to check if a service is available
check_service() {
    local service_name=$1
    local host=$2
    local port=$3
    local timeout=${4:-30}
    
    print_status "Checking $service_name connection..."
    
    local count=0
    while [ $count -lt $timeout ]; do
        if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$host/$port" 2>/dev/null; then
            print_status "$service_name is available at $host:$port"
            return 0
        fi
        count=$((count + 1))
        sleep 1
    done
    
    print_error "$service_name is not available at $host:$port after $timeout seconds"
    return 1
}

# Function to wait for database
wait_for_database() {
    if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
        print_status "Waiting for PostgreSQL database..."
        
        # Try to connect using pg_isready if available
        if command -v pg_isready >/dev/null 2>&1; then
            local count=0
            while [ $count -lt 60 ]; do
                if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
                    print_status "PostgreSQL database is ready"
                    return 0
                fi
                count=$((count + 1))
                sleep 1
            done
            print_error "PostgreSQL database not ready after 60 seconds"
            return 1
        else
            # Fallback to generic TCP check
            check_service "PostgreSQL" "$DB_HOST" "$DB_PORT" 60
        fi
    else
        print_warning "Database connection not configured"
        return 0
    fi
}

# Function to wait for Redis
wait_for_redis() {
    if [ -n "$REDIS_HOST" ] && [ -n "$REDIS_PORT" ]; then
        print_status "Waiting for Redis cache..."
        check_service "Redis" "$REDIS_HOST" "$REDIS_PORT" 30
    else
        print_warning "Redis connection not configured"
        return 0
    fi
}

# Function to run database migrations
run_migrations() {
    if [ "$NODE_ENV" = "production" ] && [ -n "$DB_HOST" ]; then
        print_status "Running database migrations..."
        
        if [ -f "scripts/migrate.js" ]; then
            if node scripts/migrate.js; then
                print_status "Database migrations completed successfully"
            else
                print_warning "Database migrations failed or were already up to date"
            fi
        else
            print_warning "No migration script found"
        fi
    fi
}

# Function to run database seeding
run_seeding() {
    if [ "$NODE_ENV" = "production" ] && [ -n "$DB_HOST" ] && [ "$RUN_SEEDING" = "true" ]; then
        print_status "Running database seeding..."
        
        if [ -f "scripts/seed.js" ]; then
            if node scripts/seed.js; then
                print_status "Database seeding completed successfully"
            else
                print_warning "Database seeding failed or was already done"
            fi
        else
            print_warning "No seeding script found"
        fi
    fi
}

# Function to validate environment
validate_environment() {
    print_status "Validating environment configuration..."
    
    # Check required environment variables
    required_vars=("NODE_ENV" "PORT")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    # Check database configuration if database is enabled
    if [ -n "$DB_HOST" ]; then
        db_vars=("DB_HOST" "DB_PORT" "DB_NAME" "DB_USER" "DB_PASSWORD")
        for var in "${db_vars[@]}"; do
            if [ -z "${!var}" ]; then
                print_error "Database is configured but $var is not set"
                exit 1
            fi
        done
    fi
    
    print_status "Environment validation passed"
}

# Function to create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    directories=("tmp" "logs" "uploads" ".next/cache")
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
}

# Function to set up logging
setup_logging() {
    print_status "Setting up logging..."
    
    # Create log directory if it doesn't exist
    mkdir -p logs
    
    # Set up log rotation if logrotate is available
    if command -v logrotate >/dev/null 2>&1; then
        cat > logs/logrotate.conf << EOF
logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 nextjs nodejs
}
EOF
    fi
}

# Function to perform health check
perform_health_check() {
    print_status "Performing startup health check..."
    
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        print_status "Health check attempt $attempt/$max_attempts"
        
        if curl -f -s "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
            print_status "Health check passed"
            return 0
        fi
        
        sleep 5
        attempt=$((attempt + 1))
    done
    
    print_error "Health check failed after $max_attempts attempts"
    return 1
}

# Function to start the application
start_application() {
    print_status "Starting Next.js application..."
    
    # Set default values
    export NODE_ENV=${NODE_ENV:-production}
    export PORT=${PORT:-3000}
    export HOSTNAME=${HOSTNAME:-0.0.0.0}
    
    # Start the application
    exec npm start
}

# Main startup sequence
main() {
    print_status "=== Starting Learning Assistant ==="
    
    # Validate environment
    validate_environment
    
    # Create necessary directories
    create_directories
    
    # Set up logging
    setup_logging
    
    # Wait for external services
    wait_for_database
    wait_for_redis
    
    # Run database operations
    run_migrations
    run_seeding
    
    # Print startup information
    print_status "Application Configuration:"
    echo "  Environment: $NODE_ENV"
    echo "  Port: $PORT"
    echo "  Hostname: $HOSTNAME"
    echo "  Database: ${DB_HOST:-not configured}"
    echo "  Redis: ${REDIS_HOST:-not configured}"
    echo "  Features:"
    echo "    - Analytics: ${FEATURE_ANALYTICS_ENABLED:-false}"
    echo "    - Chat: ${FEATURE_CHAT_ENABLED:-false}"
    echo "    - Recommendations: ${FEATURE_RECOMMENDATIONS_ENABLED:-false}"
    
    # Start the application
    start_application
}

# Handle termination signals
trap 'print_status "Received termination signal, shutting down gracefully..."; exit 0' TERM INT

# Run main function
main "$@"