# Multi-stage Docker build for Personal Learning Assistant
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache libc6-compat python3 make g++ 

# Copy package files
COPY package*.json ./

# Install dependencies optimized for production
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# Copy source code
COPY . .

# Add environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=true

# Build the application with optimizations
RUN npm run build:production

# Stage 3: Runner  
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Set up proper directory structure and permissions
RUN mkdir -p /app/.next/cache /app/tmp /app/logs /app/uploads \
    && chown -R nextjs:nodejs /app

# Copy runtime dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy application files
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Set environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Expose port
EXPOSE 3000

# Switch to non-root user
USER nextjs

# Enhanced health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f -A "Docker-Health-Check" http://localhost:3000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]