#!/bin/bash

# Fly.io Secrets Management Script for Learning Assistant
# This script sets up all necessary environment variables and secrets for production deployment

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Application configuration
APP_NAME="learning-assistant-lively-rain-3457"
DB_NAME="learning-assistant-db"

echo -e "${BLUE}🚀 Setting up Fly.io secrets for Learning Assistant${NC}"
echo -e "${BLUE}App: ${APP_NAME}${NC}"

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local value
    
    read -p "$prompt [$default]: " value
    echo "${value:-$default}"
}

# Function to prompt for secret input
prompt_secret() {
    local prompt="$1"
    local value
    
    echo -n "$prompt: "
    read -s value
    echo
    echo "$value"
}

# Function to generate random secret
generate_secret() {
    local length="${1:-32}"
    openssl rand -hex "$length"
}

echo -e "\n${YELLOW}📋 Configuring application secrets...${NC}"

# Database configuration (if not using Fly Postgres attach)
echo -e "\n${BLUE}Database Configuration:${NC}"
echo "If you used 'fly postgres attach', DATABASE_URL is already set."
echo "Otherwise, provide your database connection details:"

DB_HOST=$(prompt_with_default "Database host" "learning-assistant-db.internal")
DB_PORT=$(prompt_with_default "Database port" "5432")
DB_NAME_VALUE=$(prompt_with_default "Database name" "learning_assistant")
DB_USER=$(prompt_with_default "Database user" "postgres")
DB_PASSWORD=$(prompt_secret "Database password")

# Authentication secrets
echo -e "\n${BLUE}Authentication Configuration:${NC}"
NEXTAUTH_SECRET=$(prompt_with_default "NextAuth secret (leave empty to generate)" "")
if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(generate_secret 32)
    echo -e "${GREEN}Generated NextAuth secret${NC}"
fi

NEXTAUTH_URL=$(prompt_with_default "NextAuth URL" "https://${APP_NAME}.fly.dev")

# Application secrets
echo -e "\n${BLUE}Application Configuration:${NC}"
APP_SECRET=$(prompt_with_default "Application secret key (leave empty to generate)" "")
if [ -z "$APP_SECRET" ]; then
    APP_SECRET=$(generate_secret 32)
    echo -e "${GREEN}Generated application secret${NC}"
fi

JWT_SECRET=$(prompt_with_default "JWT secret (leave empty to generate)" "")
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(generate_secret 32)
    echo -e "${GREEN}Generated JWT secret${NC}"
fi

# Optional: External service configurations
echo -e "\n${BLUE}External Services (Optional):${NC}"
echo "Leave empty if not using these services:"

OPENAI_API_KEY=$(prompt_secret "OpenAI API key (optional)")
SENDGRID_API_KEY=$(prompt_secret "SendGrid API key (optional)")
STRIPE_SECRET_KEY=$(prompt_secret "Stripe secret key (optional)")
STRIPE_WEBHOOK_SECRET=$(prompt_secret "Stripe webhook secret (optional)")

# Redis configuration (if using external Redis)
echo -e "\n${BLUE}Redis Configuration (Optional):${NC}"
REDIS_URL=$(prompt_with_default "Redis URL (optional)" "")

# Monitoring and logging
echo -e "\n${BLUE}Monitoring Configuration:${NC}"
LOG_LEVEL=$(prompt_with_default "Log level" "info")
SENTRY_DSN=$(prompt_with_default "Sentry DSN (optional)" "")

echo -e "\n${YELLOW}🔐 Setting secrets in Fly.io...${NC}"

# Core application secrets
echo -e "${GREEN}Setting core application secrets...${NC}"
fly secrets set \
    APP_SECRET="$APP_SECRET" \
    JWT_SECRET="$JWT_SECRET" \
    NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    NEXTAUTH_URL="$NEXTAUTH_URL" \
    --app "$APP_NAME"

# Database secrets (only if not using Fly Postgres attach)
if [ -n "$DB_PASSWORD" ]; then
    echo -e "${GREEN}Setting database secrets...${NC}"
    
    # Construct database URLs
    DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME_VALUE}?sslmode=require"
    
    fly secrets set \
        DATABASE_URL="$DATABASE_URL" \
        DB_HOST="$DB_HOST" \
        DB_PORT="$DB_PORT" \
        DB_NAME="$DB_NAME_VALUE" \
        DB_USER="$DB_USER" \
        DB_PASSWORD="$DB_PASSWORD" \
        --app "$APP_NAME"
fi

# External services (only if provided)
if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "${GREEN}Setting OpenAI API key...${NC}"
    fly secrets set OPENAI_API_KEY="$OPENAI_API_KEY" --app "$APP_NAME"
fi

if [ -n "$SENDGRID_API_KEY" ]; then
    echo -e "${GREEN}Setting SendGrid API key...${NC}"
    fly secrets set SENDGRID_API_KEY="$SENDGRID_API_KEY" --app "$APP_NAME"
fi

if [ -n "$STRIPE_SECRET_KEY" ]; then
    echo -e "${GREEN}Setting Stripe secrets...${NC}"
    fly secrets set \
        STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
        STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
        --app "$APP_NAME"
fi

if [ -n "$REDIS_URL" ]; then
    echo -e "${GREEN}Setting Redis URL...${NC}"
    fly secrets set REDIS_URL="$REDIS_URL" --app "$APP_NAME"
fi

# Monitoring and logging
if [ -n "$SENTRY_DSN" ]; then
    echo -e "${GREEN}Setting Sentry DSN...${NC}"
    fly secrets set SENTRY_DSN="$SENTRY_DSN" --app "$APP_NAME"
fi

echo -e "${GREEN}Setting monitoring configuration...${NC}"
fly secrets set LOG_LEVEL="$LOG_LEVEL" --app "$APP_NAME"

echo -e "\n${GREEN}✅ All secrets have been set successfully!${NC}"

echo -e "\n${YELLOW}📋 Next steps:${NC}"
echo "1. Verify secrets: fly secrets list --app $APP_NAME"
echo "2. Deploy application: fly deploy --app $APP_NAME"
echo "3. Check application status: fly status --app $APP_NAME"
echo "4. View logs: fly logs --app $APP_NAME"

echo -e "\n${BLUE}🔍 Verifying secrets...${NC}"
fly secrets list --app "$APP_NAME"

echo -e "\n${GREEN}🎉 Setup complete!${NC}"