#!/bin/bash

set -e

echo "🚀 Automated Linode deployment for learning-assistant..."

# Check if token is provided
if [ -z "$LINODE_CLI_TOKEN" ]; then
    echo "❌ LINODE_CLI_TOKEN environment variable is required"
    echo ""
    echo "To get a token:"
    echo "1. Go to https://cloud.linode.com/profile/tokens"
    echo "2. Create a new Personal Access Token with full permissions"
    echo "3. Export it: export LINODE_CLI_TOKEN=your_token_here"
    echo "4. Run this script again"
    exit 1
fi

# Configure Linode CLI with token
echo "🔧 Configuring Linode CLI..."
echo "$LINODE_CLI_TOKEN" | linode-cli configure --token

# Configuration
APP_NAME="learning-assistant"
REGION="us-east"  # Change as needed
INSTANCE_TYPE="g6-nanode-1"  # 1GB RAM, 1 CPU
IMAGE="linode/ubuntu22.04"
ROOT_PASS=$(openssl rand -base64 32)

echo "📋 Deployment Configuration:"
echo "  App Name: $APP_NAME"
echo "  Region: $REGION"
echo "  Instance Type: $INSTANCE_TYPE"
echo "  Image: $IMAGE"

# Create Linode instance
echo "🖥️  Creating Linode instance..."
INSTANCE_OUTPUT=$(linode-cli linodes create \
  --label "$APP_NAME-$(date +%Y%m%d-%H%M%S)" \
  --region $REGION \
  --type $INSTANCE_TYPE \
  --image $IMAGE \
  --root_pass "$ROOT_PASS" \
  --json)

INSTANCE_ID=$(echo "$INSTANCE_OUTPUT" | jq -r '.[0].id')
echo "✅ Instance created with ID: $INSTANCE_ID"

# Wait for instance to boot
echo "⏳ Waiting for instance to boot..."
while true; do
  STATUS=$(linode-cli linodes view $INSTANCE_ID --json | jq -r '.[0].status')
  if [ "$STATUS" = "running" ]; then
    break
  fi
  echo "   Status: $STATUS - waiting..."
  sleep 10
done

# Get instance IP
INSTANCE_IP=$(linode-cli linodes view $INSTANCE_ID --json | jq -r '.[0].ipv4[0]')
echo "✅ Instance is running at IP: $INSTANCE_IP"

# Prepare deployment files
echo "📦 Preparing deployment files..."

# Create deployment package
tar -czf learning-assistant-deploy.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=coverage \
  --exclude=__tests__ \
  --exclude=.husky \
  --exclude=*.log \
  --exclude=*.tar.gz \
  .

# Create server setup script
cat > server-setup-auto.sh << 'EOF'
#!/bin/bash
set -e

echo "🔧 Setting up server..."

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install nginx
apt-get install -y nginx

# Create app directory
mkdir -p /var/www/learning-assistant
cd /var/www/learning-assistant

# Extract application
tar -xzf /tmp/learning-assistant-deploy.tar.gz

# Remove husky prepare script
npm pkg delete scripts.prepare

# Install dependencies
npm ci --production

# Create environment file
cat > .env.production << 'PRODENV'
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1
PRODENV

# Build application
npm run build

# Create PM2 config
cat > ecosystem.config.js << 'PM2CONFIG'
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
      PORT: 3000,
      NEXT_TELEMETRY_DISABLED: 1
    }
  }]
}
PM2CONFIG

# Start app
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Configure nginx
cat > /etc/nginx/sites-available/learning-assistant << 'NGINXCONF'
server {
    listen 80;
    server_name _;
    client_max_body_size 10M;

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
NGINXCONF

# Enable site
ln -sf /etc/nginx/sites-available/learning-assistant /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Basic firewall
ufw allow ssh
ufw allow http
ufw allow https
echo "y" | ufw enable

echo "✅ Setup complete!"
EOF

# Wait a bit more for SSH to be ready
echo "⏳ Waiting for SSH to be ready..."
sleep 30

# Upload files
echo "📤 Uploading files to server..."
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  learning-assistant-deploy.tar.gz root@$INSTANCE_IP:/tmp/
scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  server-setup-auto.sh root@$INSTANCE_IP:/tmp/

# Run setup on server
echo "🔧 Running setup on server..."
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  root@$INSTANCE_IP 'chmod +x /tmp/server-setup-auto.sh && /tmp/server-setup-auto.sh'

# Cleanup local files
rm -f learning-assistant-deploy.tar.gz server-setup-auto.sh

echo ""
echo "🎉 Deployment complete!"
echo "📊 Instance Details:"
echo "   ID: $INSTANCE_ID"
echo "   IP: $INSTANCE_IP"
echo "   Root Password: $ROOT_PASS"
echo ""
echo "🌐 Your application is available at: http://$INSTANCE_IP"
echo ""
echo "🔧 To manage your deployment:"
echo "   SSH: ssh root@$INSTANCE_IP"
echo "   PM2 status: pm2 status"
echo "   PM2 logs: pm2 logs learning-assistant"
echo ""
echo "💰 Remember to monitor your Linode usage and costs!"