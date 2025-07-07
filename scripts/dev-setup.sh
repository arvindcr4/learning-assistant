#!/bin/bash

# Learning Assistant Development Setup Script
set -e

echo "🚀 Setting up Learning Assistant development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js $(node -v) is installed"
}

# Check if Docker is installed and running
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. You can still run the app locally without Docker."
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        print_warning "Docker is not running. Please start Docker if you want to use containerized services."
        return 1
    fi
    
    print_success "Docker is installed and running"
    return 0
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install --legacy-peer-deps
    print_success "Dependencies installed"
}

# Setup environment file
setup_env() {
    if [ ! -f ".env.local" ]; then
        print_status "Creating .env.local file..."
        cp .env.example .env.local 2>/dev/null || echo "Warning: .env.example not found"
        print_success "Environment file created"
    else
        print_success "Environment file already exists"
    fi
}

# Setup Git hooks
setup_git_hooks() {
    if [ -d ".git" ]; then
        print_status "Setting up Git hooks..."
        npx husky install
        chmod +x .husky/pre-commit
        print_success "Git hooks configured"
    else
        print_warning "Not a git repository. Skipping Git hooks setup."
    fi
}

# Build the application
build_app() {
    print_status "Building the application..."
    npm run build
    print_success "Application built successfully"
}

# Setup database (Docker)
setup_database_docker() {
    if check_docker; then
        print_status "Setting up database with Docker..."
        docker-compose -f docker-compose.dev.yml up -d postgres redis
        
        # Wait for services to be ready
        print_status "Waiting for database to be ready..."
        sleep 10
        
        # Run migrations
        print_status "Running database migrations..."
        npm run db:migrate
        
        print_success "Database setup complete"
    else
        print_warning "Docker not available. Please set up PostgreSQL and Redis manually."
        print_warning "Connection strings:"
        print_warning "  PostgreSQL: postgresql://postgres:password@localhost:5432/learning_assistant_dev"
        print_warning "  Redis: redis://localhost:6379"
    fi
}

# Setup local SQLite (fallback)
setup_database_local() {
    print_status "Setting up local SQLite database..."
    npm run db:migrate
    npm run db:seed
    print_success "Local database setup complete"
}

# Main setup flow
main() {
    echo
    print_status "Learning Assistant Development Setup"
    echo "======================================"
    echo
    
    # Check prerequisites
    check_node
    
    # Install dependencies
    install_dependencies
    
    # Setup environment
    setup_env
    
    # Setup Git hooks
    setup_git_hooks
    
    # Ask user about database preference
    echo
    echo "Database Setup Options:"
    echo "1. Docker (PostgreSQL + Redis) - Recommended"
    echo "2. Local SQLite - Simple setup"
    echo
    read -p "Choose database setup (1 or 2): " db_choice
    
    case $db_choice in
        1)
            setup_database_docker
            ;;
        2)
            setup_database_local
            ;;
        *)
            print_warning "Invalid choice. Setting up local SQLite..."
            setup_database_local
            ;;
    esac
    
    # Build application
    build_app
    
    echo
    print_success "🎉 Development environment setup complete!"
    echo
    echo "Next steps:"
    echo "1. Update .env.local with your API keys (OpenAI, etc.)"
    echo "2. Start the development server: npm run dev"
    echo "3. Open http://localhost:3000 in your browser"
    echo
    
    if check_docker; then
        echo "Docker services:"
        echo "- PostgreSQL: localhost:5432"
        echo "- Redis: localhost:6379"
        echo "- Mailhog UI: http://localhost:8025"
        echo
        echo "To stop Docker services: docker-compose -f docker-compose.dev.yml down"
    fi
    
    echo "Happy coding! 🚀"
}

# Run main function
main