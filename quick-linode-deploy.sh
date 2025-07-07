#!/bin/bash

# Quick Linode deployment script
set -e

echo "🚀 Quick Linode deployment for learning-assistant..."

# Create deployment package
echo "📦 Creating deployment package..."

# Create a simple package without Docker complexity
tar -czf learning-assistant-deploy.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.next \
  --exclude=coverage \
  --exclude=__tests__ \
  --exclude=.husky \
  --exclude=*.log \
  --exclude=*.tar.gz \
  --exclude=Dockerfile* \
  .

# Create server setup script
cat > server-setup.sh << 'EOF'
#!/bin/bash
set -e

echo "🔧 Setting up Linode server for learning-assistant..."

# Update system
apt-get update && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 globally
npm install -g pm2

# Install nginx
apt-get install -y nginx

# Create app directory
mkdir -p /var/www/learning-assistant
cd /var/www/learning-assistant

# Extract application
if [ -f /tmp/learning-assistant-deploy.tar.gz ]; then
    tar -xzf /tmp/learning-assistant-deploy.tar.gz
    rm /tmp/learning-assistant-deploy.tar.gz
fi

# Install dependencies (skip husky)
npm pkg delete scripts.prepare
npm ci --production

# Create production environment file
cat > .env.production << 'PRODENV'
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1
PRODENV

# Build the application
npm run build

# Create PM2 ecosystem file
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

# Start application
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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
NGINXCONF

# Enable nginx site
ln -sf /etc/nginx/sites-available/learning-assistant /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Set up firewall
ufw allow ssh
ufw allow http
ufw allow https
echo "y" | ufw enable

echo "✅ Server setup complete!"
echo "🌐 Application should be running at http://$(curl -s ifconfig.me)"
EOF

echo "✅ Deployment package created!"
echo ""
echo "📋 Manual Deployment Instructions:"
echo ""
echo "1. Create a Linode instance:"
echo "   - Go to https://cloud.linode.com"
echo "   - Create > Linode"
echo "   - Ubuntu 22.04 LTS"
echo "   - g6-nanode-1 (1GB) or g6-standard-1 (2GB)"
echo "   - Choose your preferred region"
echo "   - Set a strong root password"
echo ""
echo "2. Upload files to your server:"
echo "   scp learning-assistant-deploy.tar.gz root@YOUR_SERVER_IP:/tmp/"
echo "   scp server-setup.sh root@YOUR_SERVER_IP:/tmp/"
echo ""
echo "3. SSH to server and run setup:"
echo "   ssh root@YOUR_SERVER_IP"
echo "   chmod +x /tmp/server-setup.sh"
echo "   /tmp/server-setup.sh"
echo ""
echo "4. Your app will be available at http://YOUR_SERVER_IP"
echo ""
echo "📁 Files created:"
echo "   - learning-assistant-deploy.tar.gz ($(du -h learning-assistant-deploy.tar.gz | cut -f1))"
echo "   - server-setup.sh"
echo ""
echo "🔧 Server management commands:"
echo "   pm2 status                 # Check app status"
echo "   pm2 logs learning-assistant # View logs"
echo "   pm2 restart learning-assistant # Restart app"
echo "   pm2 stop learning-assistant    # Stop app"
echo ""
echo "🔄 To update your deployment:"
echo "   1. Create new package: tar -czf update.tar.gz --exclude=node_modules ."
echo "   2. Upload: scp update.tar.gz root@YOUR_IP:/tmp/"
echo "   3. SSH and update:"
echo "      cd /var/www/learning-assistant"
echo "      pm2 stop learning-assistant"
echo "      tar -xzf /tmp/update.tar.gz"
echo "      npm ci --production"
echo "      npm run build"
echo "      pm2 start learning-assistant"