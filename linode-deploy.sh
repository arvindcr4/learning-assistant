#!/bin/bash

# Linode deployment script for learning-assistant
set -e

echo "🚀 Starting Linode deployment for learning-assistant..."

# Configuration
APP_NAME="learning-assistant"
REGION="us-east"  # Change as needed
INSTANCE_TYPE="g6-nanode-1"  # 1GB RAM, 1 CPU - adjust as needed
IMAGE="linode/ubuntu22.04"
ROOT_PASS=$(openssl rand -base64 32)

echo "📋 Deployment Configuration:"
echo "  App Name: $APP_NAME"
echo "  Region: $REGION"
echo "  Instance Type: $INSTANCE_TYPE"
echo "  Image: $IMAGE"

# Create a new Linode instance
echo "🖥️  Creating Linode instance..."
INSTANCE_ID=$(linode-cli linodes create \
  --label "$APP_NAME-$(date +%Y%m%d-%H%M%S)" \
  --region $REGION \
  --type $INSTANCE_TYPE \
  --image $IMAGE \
  --root_pass "$ROOT_PASS" \
  --json | jq -r '.[0].id')

echo "✅ Instance created with ID: $INSTANCE_ID"

# Wait for the instance to be running
echo "⏳ Waiting for instance to boot..."
while true; do
  STATUS=$(linode-cli linodes view $INSTANCE_ID --json | jq -r '.[0].status')
  if [ "$STATUS" = "running" ]; then
    break
  fi
  echo "   Status: $STATUS - waiting..."
  sleep 10
done

# Get the instance IP
INSTANCE_IP=$(linode-cli linodes view $INSTANCE_ID --json | jq -r '.[0].ipv4[0]')
echo "✅ Instance is running at IP: $INSTANCE_IP"

# Create deployment script for the server
cat > deploy-to-server.sh << 'EOF'
#!/bin/bash
set -e

echo "🔧 Setting up server environment..."

# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install PostgreSQL
apt-get install -y postgresql postgresql-contrib

# Install nginx
apt-get install -y nginx

# Create app directory
mkdir -p /var/www/learning-assistant
cd /var/www/learning-assistant

echo "✅ Server environment setup complete"
EOF

echo "📤 Uploading deployment script..."
scp -o StrictHostKeyChecking=no deploy-to-server.sh root@$INSTANCE_IP:/tmp/
ssh -o StrictHostKeyChecking=no root@$INSTANCE_IP 'chmod +x /tmp/deploy-to-server.sh && /tmp/deploy-to-server.sh'

# Build the application locally
echo "🏗️  Building application..."
npm run build

# Create archive of the application
echo "📦 Creating application archive..."
tar -czf app.tar.gz \
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

# Upload and deploy the application
echo "📤 Uploading application..."
scp -o StrictHostKeyChecking=no app.tar.gz root@$INSTANCE_IP:/var/www/learning-assistant/

# Setup the application on the server
ssh -o StrictHostKeyChecking=no root@$INSTANCE_IP << 'REMOTE_SCRIPT'
cd /var/www/learning-assistant
tar -xzf app.tar.gz
rm app.tar.gz

# Install dependencies
npm ci --production

# Build the application
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'PM2_CONFIG'
module.exports = {
  apps: [{
    name: 'learning-assistant',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/learning-assistant',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
PM2_CONFIG

# Start the application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure nginx
cat > /etc/nginx/sites-available/learning-assistant << 'NGINX_CONFIG'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX_CONFIG

# Enable the site
ln -sf /etc/nginx/sites-available/learning-assistant /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "✅ Application deployed and running!"
REMOTE_SCRIPT

# Cleanup
rm -f deploy-to-server.sh app.tar.gz

echo ""
echo "🎉 Deployment complete!"
echo "📊 Instance Details:"
echo "   ID: $INSTANCE_ID"
echo "   IP: $INSTANCE_IP"
echo "   Root Password: $ROOT_PASS"
echo ""
echo "🌐 Your application should be available at: http://$INSTANCE_IP"
echo ""
echo "🔧 To manage your deployment:"
echo "   SSH: ssh root@$INSTANCE_IP"
echo "   PM2 status: pm2 status"
echo "   PM2 logs: pm2 logs learning-assistant"
echo "   PM2 restart: pm2 restart learning-assistant"
echo ""
echo "💡 Next steps:"
echo "   1. Set up a domain name pointing to $INSTANCE_IP"
echo "   2. Configure SSL with Let's Encrypt"
echo "   3. Set up database and environment variables"
echo "   4. Configure backups"