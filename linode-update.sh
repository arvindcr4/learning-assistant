#!/bin/bash

# Linode update script for learning-assistant
set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <server-ip>"
    echo "Example: $0 192.168.1.100"
    exit 1
fi

SERVER_IP=$1

echo "🔄 Updating learning-assistant on Linode server: $SERVER_IP"

# Build the application locally
echo "🏗️  Building application..."
npm run build

# Create archive of the application
echo "📦 Creating application archive..."
tar -czf app-update.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=coverage \
  --exclude=__tests__ \
  package.json \
  package-lock.json \
  next.config.ts \
  tailwind.config.js \
  tsconfig.json \
  .env.example \
  src/ \
  app/ \
  public/ \
  middleware.ts \
  messages/ \
  i18n/ \
  scripts/

# Upload and deploy the updated application
echo "📤 Uploading updated application..."
scp -o StrictHostKeyChecking=no app-update.tar.gz root@$SERVER_IP:/tmp/

# Deploy the update on the server
ssh -o StrictHostKeyChecking=no root@$SERVER_IP << 'REMOTE_SCRIPT'
cd /var/www/learning-assistant

# Stop the application
pm2 stop learning-assistant

# Backup current version
cp -r /var/www/learning-assistant /var/www/learning-assistant-backup-$(date +%Y%m%d-%H%M%S)

# Extract new version
tar -xzf /tmp/app-update.tar.gz
rm /tmp/app-update.tar.gz

# Install/update dependencies
npm ci --production

# Build the application
npm run build

# Start the application
pm2 start learning-assistant

echo "✅ Application updated and restarted!"
REMOTE_SCRIPT

# Cleanup
rm -f app-update.tar.gz

echo "🎉 Update complete!"
echo "🌐 Your application should be running at: http://$SERVER_IP"