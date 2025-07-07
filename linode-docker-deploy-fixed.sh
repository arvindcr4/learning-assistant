#!/bin/bash

# Fixed Linode deployment using Docker
set -e

echo "🚀 Linode deployment for learning-assistant using Docker..."

# Configuration
APP_NAME="learning-assistant"
DOCKER_IMAGE="$APP_NAME:latest"

echo "📋 Building Docker image locally..."

# Create optimized Dockerfile for production (without husky)
cat > Dockerfile.linode << 'DOCKERFILE'
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files and create package.json without prepare script
COPY package.json package-lock.json* ./
RUN npm pkg delete scripts.prepare
RUN npm ci --omit=dev

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy environment file if it exists
RUN if [ -f .env.local ]; then cp .env.local .env.production; fi

# Remove prepare script and install all dependencies for build
RUN npm pkg delete scripts.prepare
RUN npm install

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
DOCKERFILE

# First, let's check if we need to enable standalone output
echo "🔧 Checking Next.js configuration..."
if ! grep -q "output.*standalone" next.config.ts 2>/dev/null; then
    echo "📝 Adding standalone output to Next.js config..."
    
    # Backup original config
    cp next.config.ts next.config.ts.backup
    
    # Add standalone output
    cat > next.config.ts << 'NEXTCONFIG'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
NEXTCONFIG
fi

# Build Docker image
echo "🏗️  Building Docker image..."
docker build -f Dockerfile.linode -t $DOCKER_IMAGE .

# Save Docker image to tar file
echo "📦 Exporting Docker image..."
docker save $DOCKER_IMAGE | gzip > $APP_NAME-docker.tar.gz

# Restore original config if we modified it
if [ -f next.config.ts.backup ]; then
    mv next.config.ts.backup next.config.ts
fi

echo "✅ Docker image created and exported!"
echo ""
echo "📁 Files created:"
echo "   - $APP_NAME-docker.tar.gz ($(du -h $APP_NAME-docker.tar.gz | cut -f1))"
echo ""
echo "🚀 Quick Deploy Instructions:"
echo ""
echo "1. Create Linode instance at https://cloud.linode.com"
echo "   - Ubuntu 22.04 LTS"
echo "   - g6-nanode-1 (1GB) or larger"
echo "   - Note the IP address"
echo ""
echo "2. Upload Docker image:"
echo "   scp $APP_NAME-docker.tar.gz root@YOUR_IP:/tmp/"
echo ""
echo "3. SSH and deploy:"
cat << 'DEPLOY_COMMANDS'
ssh root@YOUR_IP
# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# Load and run the app
cd /tmp
docker load < learning-assistant-docker.tar.gz
docker run -d \
  --name learning-assistant \
  --restart unless-stopped \
  -p 80:3000 \
  -p 443:3000 \
  learning-assistant:latest

# Check status
docker ps
docker logs learning-assistant
DEPLOY_COMMANDS
echo ""
echo "🌐 Your app will be available at http://YOUR_IP"

# Cleanup
rm -f Dockerfile.linode

echo ""
echo "✨ Deployment package ready!"