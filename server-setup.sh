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
