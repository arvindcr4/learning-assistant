#!/bin/bash

# Docker Compose Production Deployment Script for Learning Assistant
# This script automates the deployment using Docker Compose for production environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_ROOT}/.env.prod"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] [COMMAND]

Deploy Learning Assistant application using Docker Compose

COMMANDS:
    deploy      Deploy the application (default)
    start       Start existing containers
    stop        Stop all containers
    restart     Restart all containers
    status      Show container status
    logs        Show container logs
    update      Update and restart containers
    backup      Create backup of data
    restore     Restore from backup
    scale       Scale application containers
    health      Check application health

OPTIONS:
    -e, --env-file       Environment file [default: .env.prod]
    -f, --compose-file   Docker compose file [default: docker-compose.prod.yml]
    -d, --detach         Run in detached mode
    -r, --replicas       Number of app replicas for scaling [default: 3]
    --no-build          Don't build images before deploying
    --force-recreate    Force recreate containers
    -h, --help          Show this help message

EXAMPLES:
    $0                           # Deploy application
    $0 start                     # Start containers
    $0 stop                      # Stop containers
    $0 logs app-1                # Show logs for app-1
    $0 scale --replicas 5        # Scale to 5 app instances
    $0 backup                    # Create backup
    $0 health                    # Check health

EOF
}

# Parse command line arguments
COMMAND="deploy"
ENV_FILE_OPTION=""
COMPOSE_FILE_OPTION=""
DETACH=false
REPLICAS=3
NO_BUILD=false
FORCE_RECREATE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|start|stop|restart|status|logs|update|backup|restore|scale|health)
            COMMAND="$1"
            shift
            ;;
        -e|--env-file)
            ENV_FILE_OPTION="$2"
            shift 2
            ;;
        -f|--compose-file)
            COMPOSE_FILE_OPTION="$2"
            shift 2
            ;;
        -d|--detach)
            DETACH=true
            shift
            ;;
        -r|--replicas)
            REPLICAS="$2"
            shift 2
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --force-recreate)
            FORCE_RECREATE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            if [[ "$COMMAND" == "logs" && -z "${SERVICE:-}" ]]; then
                SERVICE="$1"
                shift
            else
                log_error "Unknown option: $1"
                show_help
                exit 1
            fi
            ;;
    esac
done

# Override defaults if specified
if [[ -n "$ENV_FILE_OPTION" ]]; then
    ENV_FILE="$ENV_FILE_OPTION"
fi

if [[ -n "$COMPOSE_FILE_OPTION" ]]; then
    COMPOSE_FILE="$COMPOSE_FILE_OPTION"
fi

# Check dependencies
check_dependencies() {
    local missing_tools=()
    
    for tool in docker docker-compose; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Please install Docker and Docker Compose"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_info "Docker and Docker Compose are available"
}

# Check if files exist
check_files() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warning "Environment file not found: $ENV_FILE"
        log_info "Creating template environment file..."
        create_env_template
    fi
}

# Create environment template
create_env_template() {
    cat > "$ENV_FILE" << EOF
# Learning Assistant Production Environment Variables

# Database
POSTGRES_PASSWORD=your_secure_postgres_password
DATABASE_URL=postgresql://learning_user:your_secure_postgres_password@postgres:5432/learning_assistant_db

# Redis
REDIS_PASSWORD=your_secure_redis_password

# JWT and Authentication
JWT_SECRET=your_jwt_secret_key_here
NEXTAUTH_SECRET=your_nextauth_secret_here

# External Service API Keys
OPENAI_API_KEY=your_openai_api_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
RESEND_API_KEY=your_resend_api_key
TAMBO_API_KEY=your_tambo_api_key

# Grafana
GRAFANA_PASSWORD=your_grafana_admin_password

# Application Settings
LOG_LEVEL=info
NODE_ENV=production

# Build Information
BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BUILD_VERSION=1.0.0
BUILD_REVISION=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Backup Configuration
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=7
S3_BACKUP_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
EOF
    
    log_warning "Please edit $ENV_FILE with your actual configuration values"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    local dirs=(
        "/opt/learning-assistant/data/postgres"
        "/opt/learning-assistant/data/redis"
        "/opt/learning-assistant/data/prometheus"
        "/opt/learning-assistant/data/grafana"
        "/opt/learning-assistant/data/traefik"
        "/opt/learning-assistant/data/uploads"
        "/opt/learning-assistant/backups"
        "/opt/learning-assistant/logs/app"
        "/opt/learning-assistant/logs/postgres"
        "/opt/learning-assistant/logs/redis"
        "/opt/learning-assistant/logs/fluentd"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            sudo mkdir -p "$dir"
            sudo chown -R $USER:$USER "$dir"
            log_info "Created directory: $dir"
        fi
    done
}

# Build Docker images
build_images() {
    if [[ "$NO_BUILD" == "true" ]]; then
        log_info "Skipping image build as requested"
        return
    fi
    
    log_info "Building Docker images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --parallel
    log_success "Images built successfully"
}

# Deploy application
deploy() {
    log_info "Deploying Learning Assistant application..."
    
    create_directories
    build_images
    
    local compose_args=(
        "-f" "$COMPOSE_FILE"
        "--env-file" "$ENV_FILE"
    )
    
    if [[ "$DETACH" == "true" ]]; then
        compose_args+=("-d")
    fi
    
    if [[ "$FORCE_RECREATE" == "true" ]]; then
        compose_args+=("--force-recreate")
    fi
    
    docker-compose "${compose_args[@]}" up "${compose_args[@]:2}"
    
    log_success "Application deployed successfully"
}

# Start containers
start() {
    log_info "Starting containers..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start
    log_success "Containers started"
}

# Stop containers
stop() {
    log_info "Stopping containers..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop
    log_success "Containers stopped"
}

# Restart containers
restart() {
    log_info "Restarting containers..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
    log_success "Containers restarted"
}

# Show status
status() {
    log_info "Container status:"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    
    echo
    log_info "Resource usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
}

# Show logs
logs() {
    local service="${SERVICE:-}"
    
    if [[ -n "$service" ]]; then
        log_info "Showing logs for service: $service"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f "$service"
    else
        log_info "Showing logs for all services:"
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
    fi
}

# Update and restart
update() {
    log_info "Updating application..."
    
    # Pull latest images
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    
    # Rebuild if needed
    build_images
    
    # Restart with new images
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --force-recreate
    
    log_success "Application updated"
}

# Create backup
backup() {
    log_info "Creating backup..."
    
    local backup_dir="/opt/learning-assistant/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup database
    log_info "Backing up database..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        pg_dump -U learning_user -d learning_assistant_db > "$backup_dir/database.sql"
    
    # Backup Redis data
    log_info "Backing up Redis data..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T redis \
        redis-cli --rdb - > "$backup_dir/redis.rdb"
    
    # Backup uploads
    log_info "Backing up uploads..."
    tar -czf "$backup_dir/uploads.tar.gz" -C /opt/learning-assistant/data uploads/
    
    # Create backup manifest
    cat > "$backup_dir/manifest.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "1.0.0",
    "files": [
        "database.sql",
        "redis.rdb",
        "uploads.tar.gz"
    ]
}
EOF
    
    log_success "Backup created at: $backup_dir"
}

# Restore from backup
restore() {
    local backup_dir="$1"
    
    if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
        log_error "Please specify a valid backup directory"
        log_info "Available backups:"
        ls -la /opt/learning-assistant/backups/
        exit 1
    fi
    
    log_warning "This will restore data from: $backup_dir"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring from backup..."
    
    # Stop services
    stop
    
    # Restore database
    if [[ -f "$backup_dir/database.sql" ]]; then
        log_info "Restoring database..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
        sleep 10
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
            psql -U learning_user -d learning_assistant_db < "$backup_dir/database.sql"
    fi
    
    # Restore Redis data
    if [[ -f "$backup_dir/redis.rdb" ]]; then
        log_info "Restoring Redis data..."
        docker cp "$backup_dir/redis.rdb" \
            "$(docker-compose -f "$COMPOSE_FILE" ps -q redis):/data/dump.rdb"
    fi
    
    # Restore uploads
    if [[ -f "$backup_dir/uploads.tar.gz" ]]; then
        log_info "Restoring uploads..."
        tar -xzf "$backup_dir/uploads.tar.gz" -C /opt/learning-assistant/data/
    fi
    
    # Start all services
    start
    
    log_success "Restore completed"
}

# Scale application
scale() {
    log_info "Scaling application to $REPLICAS replicas..."
    
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
        --scale app-1=1 \
        --scale app-2=$((REPLICAS > 1 ? 1 : 0)) \
        --scale app-3=$((REPLICAS > 2 ? 1 : 0))
    
    # If we need more than 3 replicas, we'd need to modify the compose file
    if [[ $REPLICAS -gt 3 ]]; then
        log_warning "Current compose file supports maximum 3 replicas"
        log_info "To scale beyond 3 replicas, please modify the compose file"
    fi
    
    log_success "Scaled to $REPLICAS replicas"
}

# Check application health
health() {
    log_info "Checking application health..."
    
    local services=("app-1" "app-2" "app-3" "postgres" "redis")
    
    for service in "${services[@]}"; do
        local container_id=$(docker-compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null)
        
        if [[ -n "$container_id" ]]; then
            local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "no-health-check")
            local running_status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "unknown")
            
            if [[ "$running_status" == "running" ]]; then
                if [[ "$health_status" == "healthy" || "$health_status" == "no-health-check" ]]; then
                    log_success "$service: $running_status ($health_status)"
                else
                    log_warning "$service: $running_status ($health_status)"
                fi
            else
                log_error "$service: $running_status"
            fi
        else
            log_error "$service: not found"
        fi
    done
    
    echo
    log_info "Application URLs:"
    echo "  Main Application: http://localhost:3001"
    echo "  Load Balancer: http://localhost:80"
    echo "  Grafana: http://localhost:3000"
    echo "  Prometheus: http://localhost:9090"
    echo "  Traefik Dashboard: http://localhost:8080"
}

# Cleanup function
cleanup() {
    # Add cleanup logic if needed
    :
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Main function
main() {
    log_info "Learning Assistant Docker Compose Deployment"
    log_info "Command: $COMMAND"
    log_info "Compose file: $COMPOSE_FILE"
    log_info "Environment file: $ENV_FILE"
    
    check_dependencies
    check_files
    
    case "$COMMAND" in
        deploy)
            deploy
            ;;
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            restart
            ;;
        status)
            status
            ;;
        logs)
            logs
            ;;
        update)
            update
            ;;
        backup)
            backup
            ;;
        restore)
            if [[ $# -eq 0 ]]; then
                log_error "Please specify backup directory for restore"
                exit 1
            fi
            restore "$1"
            ;;
        scale)
            scale
            ;;
        health)
            health
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully"
}

# Run main function
main "$@"