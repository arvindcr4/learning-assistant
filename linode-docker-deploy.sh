#!/bin/bash

# Alternative Linode deployment using Docker
set -e

echo "🚀 Alternative Linode deployment for learning-assistant using Docker..."

# Configuration
APP_NAME="learning-assistant"
DOCKER_IMAGE="$APP_NAME:latest"

echo "📋 Building Docker image locally..."

# Create optimized Dockerfile for production
cat > Dockerfile.linode << 'DOCKERFILE'
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy environment file if it exists
RUN if [ -f .env.local ]; then cp .env.local .env.production; fi

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
DOCKERFILE

# Build Docker image
echo "🏗️  Building Docker image..."
docker build -f Dockerfile.linode -t $DOCKER_IMAGE .

# Save Docker image to tar file
echo "📦 Exporting Docker image..."
docker save $DOCKER_IMAGE | gzip > $APP_NAME-docker.tar.gz

echo "✅ Docker image created and exported!"
echo ""
echo "📋 Manual deployment steps:"
echo "1. Create a Linode instance:"
echo "   - Go to https://cloud.linode.com"
echo "   - Create > Linode"
echo "   - Choose Ubuntu 22.04 LTS"
echo "   - Select g6-nanode-1 (1GB) or larger"
echo "   - Choose a region"
echo "   - Set root password"
echo ""
echo "2. Upload and deploy the Docker image:"
echo "   scp $APP_NAME-docker.tar.gz root@YOUR_SERVER_IP:/tmp/"
echo ""
echo "3. SSH to your server and run:"
cat << 'SETUP_SCRIPT'
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   
   # Load and run the application
   cd /tmp
   gunzip learning-assistant-docker.tar.gz
   docker load < learning-assistant-docker.tar
   
   # Run the application
   docker run -d \
     --name learning-assistant \
     --restart unless-stopped \
     -p 80:3000 \
     learning-assistant:latest
SETUP_SCRIPT
echo ""
echo "🌐 Your app will be available at http://YOUR_SERVER_IP"
echo ""
echo "🔧 To update the application:"
echo "   docker stop learning-assistant"
echo "   docker rm learning-assistant"
echo "   # Upload new image and repeat docker load/run steps"

# Cleanup
rm -f Dockerfile.linode

echo ""
echo "📦 Docker image ready: $APP_NAME-docker.tar.gz"