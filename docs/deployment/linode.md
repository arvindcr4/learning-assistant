# Linode Deployment Guide

## Overview

Linode provides cost-effective VPS hosting with excellent performance and straightforward pricing. This guide covers multiple deployment approaches from simple VPS deployment to managed Kubernetes.

## Prerequisites

### Required
- Linode account ([sign up](https://login.linode.com/signup))
- SSH key pair
- Git repository
- Basic Linux knowledge

### Optional
- Linode CLI
- Docker knowledge
- Kubernetes knowledge (for LKE)

## Deployment Options

### 1. Linode VPS (Recommended)
- Cost-effective virtual servers
- Full root access
- Predictable pricing
- Multiple datacenter locations

### 2. Linode Kubernetes Engine (LKE)
- Managed Kubernetes
- Auto-scaling
- Load balancing
- Enterprise features

### 3. Docker on VPS
- Containerized deployment
- Easy scaling
- Consistent environments
- Simple management

## Option 1: VPS Deployment (10-15 minutes)

### 1. Create Linode Instance
```bash
# Using Linode CLI (optional)
linode-cli linodes create \
  --type g6-standard-2 \
  --region us-east \
  --image linode/ubuntu22.04 \
  --label learning-assistant \
  --root_pass your-secure-password \
  --authorized_keys "ssh-rsa YOUR_SSH_KEY"

# Or use the web interface:
# 1. Go to https://cloud.linode.com/linodes
# 2. Click "Create Linode"
# 3. Choose Ubuntu 22.04 LTS
# 4. Select Shared CPU -> Nanode 1GB or Linode 2GB
# 5. Choose region (closest to your users)
# 6. Add SSH key
# 7. Create Linode
```

### 2. Initial Server Setup
```bash
# SSH to your Linode
ssh root@your-linode-ip

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser learning
usermod -aG sudo learning
usermod -aG docker learning

# Install essential packages
apt install -y curl wget git htop ufw fail2ban

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 3. Security Configuration
```bash
# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable

# Configure fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Disable root SSH login (optional but recommended)
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### 4. Deploy Application
```bash
# Switch to non-root user
su - learning

# Clone repository
git clone https://github.com/your-username/learning-assistant.git
cd learning-assistant

# Set environment variables
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=your-secure-secret
NEXT_PUBLIC_API_URL=http://your-linode-ip:3000
NEXT_PUBLIC_APP_URL=http://your-linode-ip:3000
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true
EOF

# Install dependencies and build
npm install
npm run build

# Start application with PM2
npm install -g pm2
pm2 start npm --name "learning-assistant" -- start
pm2 startup
pm2 save
```

## Option 2: Docker Deployment (15-20 minutes)

### 1. Prepare Docker Environment
```bash
# SSH to your Linode
ssh root@your-linode-ip

# Follow initial setup from Option 1 (steps 1-3)

# Create application directory
mkdir -p /app
cd /app

# Clone repository
git clone https://github.com/your-username/learning-assistant.git .
```

### 2. Configure Environment
```bash
# Create environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1

# Database
DATABASE_URL=postgresql://learning_user:secure_password@postgres:5432/learning_assistant_db
POSTGRES_PASSWORD=secure_password

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=redis_secure_password

# Authentication
BETTER_AUTH_SECRET=your-very-secure-secret-key

# API URLs
NEXT_PUBLIC_API_URL=http://your-linode-ip
NEXT_PUBLIC_APP_URL=http://your-linode-ip

# Features
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true

# Monitoring
LOG_LEVEL=info
GRAFANA_PASSWORD=grafana_admin_password
EOF
```

### 3. Deploy with Docker Compose
```bash
# Deploy full stack
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app
```

### 4. Set Up Nginx (Optional)
```bash
# Install Nginx
apt install nginx -y

# Configure Nginx
cat > /etc/nginx/sites-available/learning-assistant << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
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
EOF

# Enable site
ln -s /etc/nginx/sites-available/learning-assistant /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

## Option 3: Linode Kubernetes Engine (LKE) (20-30 minutes)

### 1. Create LKE Cluster
```bash
# Using Linode CLI
linode-cli lke cluster-create \
  --label learning-assistant-cluster \
  --region us-east \
  --k8s_version 1.28 \
  --node_pools.type g6-standard-2 \
  --node_pools.count 3

# Or use the web interface:
# 1. Go to https://cloud.linode.com/kubernetes
# 2. Click "Create Cluster"
# 3. Choose region and Kubernetes version
# 4. Add node pool (Shared CPU 2GB recommended)
# 5. Set node count (3 for HA)
# 6. Create cluster
```

### 2. Configure kubectl
```bash
# Download kubeconfig
linode-cli lke kubeconfig-view 12345 --text --no-headers | base64 -d > ~/.kube/config

# Or download from Linode Cloud Manager

# Test connection
kubectl get nodes
```

### 3. Kubernetes Manifests
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: learning-assistant
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: learning-assistant
  namespace: learning-assistant
spec:
  replicas: 3
  selector:
    matchLabels:
      app: learning-assistant
  template:
    metadata:
      labels:
        app: learning-assistant
    spec:
      containers:
      - name: app
        image: your-registry/learning-assistant:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: BETTER_AUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: auth-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: learning-assistant-service
  namespace: learning-assistant
  annotations:
    service.beta.kubernetes.io/linode-loadbalancer-throttle: "4"
spec:
  selector:
    app: learning-assistant
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 4. Deploy to LKE
```bash
# Create secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url="postgresql://user:pass@host:5432/database" \
  --from-literal=auth-secret="your-secure-secret" \
  -n learning-assistant

# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n learning-assistant
kubectl get services -n learning-assistant

# Get LoadBalancer IP
kubectl get service learning-assistant-service -n learning-assistant
```

## Database Setup

### 1. Linode Managed Database
```bash
# Create PostgreSQL database
linode-cli databases postgresql-create \
  --label learning-assistant-db \
  --region us-east \
  --type g6-nanode-1 \
  --engine postgresql/13.2

# Get connection details
linode-cli databases postgresql-view 12345
```

### 2. Self-hosted PostgreSQL
```bash
# Install PostgreSQL
apt install postgresql postgresql-contrib -y

# Configure PostgreSQL
sudo -u postgres psql << 'EOF'
CREATE DATABASE learning_assistant;
CREATE USER learning_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE learning_assistant TO learning_user;
\q
EOF

# Configure for remote connections (if needed)
echo "listen_addresses = '*'" >> /etc/postgresql/*/main/postgresql.conf
echo "host all all 0.0.0.0/0 md5" >> /etc/postgresql/*/main/pg_hba.conf
systemctl restart postgresql
```

### 3. Redis Setup
```bash
# Install Redis
apt install redis-server -y

# Configure Redis
sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
sed -i 's/# requirepass foobared/requirepass your-redis-password/' /etc/redis/redis.conf
systemctl restart redis-server
```

## Domain & SSL Setup

### 1. Domain Configuration
```bash
# Point your domain to Linode IP
# Add A record: your-domain.com -> your-linode-ip
# Add CNAME record: www.your-domain.com -> your-domain.com
```

### 2. SSL with Let's Encrypt
```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate
certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 3. Update Environment Variables
```bash
# Update .env with domain
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Monitoring & Backup

### 1. System Monitoring
```bash
# Install monitoring tools
apt install htop iotop nethogs -y

# Install Netdata (optional)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### 2. Application Monitoring
```bash
# PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# View monitoring
pm2 monit
```

### 3. Backup Setup
```bash
# Create backup script
cat > /home/learning/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/learning/backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h localhost -U learning_user learning_assistant > $BACKUP_DIR/db_backup_$DATE.sql

# Backup application files
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /app

# Remove old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /home/learning/backup.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/learning/backup.sh
```

## Scaling & Load Balancing

### 1. Horizontal Scaling
```bash
# Create additional Linodes
# Use Linode NodeBalancer for load balancing

# Create NodeBalancer
linode-cli nodebalancers create \
  --region us-east \
  --label learning-assistant-lb

# Configure backend nodes
linode-cli nodebalancers config-create 12345 \
  --port 80 \
  --protocol http \
  --algorithm roundrobin \
  --check http_body \
  --check_path /api/health
```

### 2. Vertical Scaling
```bash
# Resize Linode
linode-cli linodes resize 12345 --type g6-standard-4

# Update Docker Compose resources
# Update Kubernetes resource limits
```

## Cost Optimization

### Estimated Monthly Costs
- **Nanode 1GB**: $5/month
- **Linode 2GB**: $12/month
- **Linode 4GB**: $24/month
- **Managed Database**: $15/month
- **NodeBalancer**: $10/month
- **Block Storage**: $0.10/GB/month

### Cost-Saving Tips
1. **Right-sizing**: Start with smaller instances
2. **Reserved Instances**: Long-term commitments
3. **Block Storage**: Use for database storage
4. **Regional Selection**: Choose closest region
5. **Monitoring**: Track resource usage

## Security Best Practices

### 1. Server Hardening
```bash
# Disable unused services
systemctl disable bluetooth
systemctl disable cups

# Configure SSH
# Edit /etc/ssh/sshd_config:
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes

# Install security updates automatically
apt install unattended-upgrades -y
dpkg-reconfigure -plow unattended-upgrades
```

### 2. Application Security
```bash
# Use strong secrets
BETTER_AUTH_SECRET=$(openssl rand -base64 32)

# Enable HTTPS only
# Configure security headers in Nginx
```

### 3. Database Security
```bash
# Use strong passwords
# Enable SSL connections
# Restrict access by IP
```

## Automated Deployment Script

### 1. Complete Deployment Script
```bash
#!/bin/bash
# deploy-linode.sh

set -e

# Configuration
LINODE_IP="your-linode-ip"
DOMAIN="your-domain.com"
DB_PASSWORD=$(openssl rand -base64 16)
AUTH_SECRET=$(openssl rand -base64 32)

echo "Deploying Learning Assistant to Linode..."

# SSH and setup server
ssh root@$LINODE_IP << 'EOF'
# Update system
apt update && apt upgrade -y

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw --force enable

# Clone and deploy
git clone https://github.com/your-username/learning-assistant.git /app
cd /app

# Set environment variables
cat > .env << EOL
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://learning_user:${DB_PASSWORD}@postgres:5432/learning_assistant_db
POSTGRES_PASSWORD=${DB_PASSWORD}
BETTER_AUTH_SECRET=${AUTH_SECRET}
NEXT_PUBLIC_API_URL=https://${DOMAIN}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=true
EOL

# Deploy with Docker Compose
docker-compose up -d
EOF

echo "Deployment completed! Your app will be available at: https://$DOMAIN"
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start
```bash
# Check logs
pm2 logs learning-assistant
# Or for Docker
docker-compose logs app

# Check port availability
netstat -tlnp | grep :3000

# Check environment variables
env | grep NODE_ENV
```

#### 2. Database Connection Issues
```bash
# Test PostgreSQL connection
psql -h localhost -U learning_user learning_assistant

# Check PostgreSQL status
systemctl status postgresql

# Check connection string
echo $DATABASE_URL
```

#### 3. SSL Certificate Issues
```bash
# Check certificate status
certbot certificates

# Renew certificate
certbot renew --dry-run

# Check Nginx configuration
nginx -t
```

### Performance Issues
```bash
# Check system resources
htop
free -h
df -h

# Check application performance
pm2 monit

# Check database performance
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

## Support Resources

### Official Documentation
- [Linode Documentation](https://www.linode.com/docs/)
- [Linode Community](https://www.linode.com/community/)
- [Linode Support](https://www.linode.com/support/)

### Useful Commands
```bash
# Linode CLI
linode-cli linodes list
linode-cli domains list
linode-cli nodebalancers list

# System monitoring
htop
iotop
nethogs
journalctl -f
```

## Next Steps

1. **Deploy**: Choose VPS or Docker deployment
2. **Database**: Set up PostgreSQL (managed or self-hosted)
3. **Domain & SSL**: Configure domain and SSL certificate
4. **Monitoring**: Set up monitoring and alerting
5. **Backup**: Configure automated backups
6. **Scale**: Add load balancing as needed

---

**Tip**: Start with a simple VPS deployment for cost-effectiveness, then scale to multiple servers with load balancing as your application grows. Linode's predictable pricing makes it easy to budget for your infrastructure costs.