#!/bin/bash
set -e

echo "🚀 AWS EC2 Deployment Script for Learning Assistant"

# Configuration
INSTANCE_TYPE="t3.medium"
REGION="us-east-1"
AMI_ID="ami-0453ec754f44f9a4a"  # Amazon Linux 2023 AMI
KEY_NAME="learning-assistant-key"
SECURITY_GROUP="learning-assistant-sg"
TAG_NAME="learning-assistant-app"

# Generate unique suffix
SUFFIX=$(date +%s)
INSTANCE_NAME="learning-assistant-${SUFFIX}"

echo "📋 Creating deployment with name: ${INSTANCE_NAME}"

# Create key pair if it doesn't exist
if ! aws ec2 describe-key-pairs --key-names ${KEY_NAME} --region ${REGION} >/dev/null 2>&1; then
    echo "🔑 Creating key pair: ${KEY_NAME}"
    aws ec2 create-key-pair --key-name ${KEY_NAME} --region ${REGION} --query 'KeyMaterial' --output text > ~/.ssh/${KEY_NAME}.pem
    chmod 600 ~/.ssh/${KEY_NAME}.pem
    echo "Key pair saved to ~/.ssh/${KEY_NAME}.pem"
else
    echo "✅ Key pair ${KEY_NAME} already exists"
fi

# Create security group if it doesn't exist
if ! aws ec2 describe-security-groups --group-names ${SECURITY_GROUP} --region ${REGION} >/dev/null 2>&1; then
    echo "🔒 Creating security group: ${SECURITY_GROUP}"
    aws ec2 create-security-group --group-name ${SECURITY_GROUP} --description "Learning Assistant Security Group" --region ${REGION}
    
    # Allow SSH (port 22)
    aws ec2 authorize-security-group-ingress --group-name ${SECURITY_GROUP} --protocol tcp --port 22 --cidr 0.0.0.0/0 --region ${REGION}
    
    # Allow HTTP (port 80)
    aws ec2 authorize-security-group-ingress --group-name ${SECURITY_GROUP} --protocol tcp --port 80 --cidr 0.0.0.0/0 --region ${REGION}
    
    # Allow HTTPS (port 443)
    aws ec2 authorize-security-group-ingress --group-name ${SECURITY_GROUP} --protocol tcp --port 443 --cidr 0.0.0.0/0 --region ${REGION}
    
    # Allow custom port 3000 (Next.js)
    aws ec2 authorize-security-group-ingress --group-name ${SECURITY_GROUP} --protocol tcp --port 3000 --cidr 0.0.0.0/0 --region ${REGION}
    
    # Allow ngrok port 4040
    aws ec2 authorize-security-group-ingress --group-name ${SECURITY_GROUP} --protocol tcp --port 4040 --cidr 0.0.0.0/0 --region ${REGION}
    
    echo "✅ Security group ${SECURITY_GROUP} created and configured"
else
    echo "✅ Security group ${SECURITY_GROUP} already exists"
fi

# Create User Data script for automated setup
cat > /tmp/user-data.sh << 'EOF'
#!/bin/bash
yum update -y
yum install -y docker git curl

# Start Docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install ngrok
cd /tmp
wget https://bin.equinox.io/c/bAUGIqa9gxr/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
mv ngrok /usr/local/bin/

# Get instance IP
INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Clone the repository (you'll need to update this with your actual repo)
cd /home/ec2-user
git clone https://github.com/your-username/learning-assistant.git || {
    echo "Repository not found, creating app structure..."
    mkdir -p learning-assistant
    cd learning-assistant
    
    # Create basic Next.js app structure
    cat > package.json << 'EOFPKG'
{
  "name": "learning-assistant",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.3.5",
    "react": "18.0.0",
    "react-dom": "18.0.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18"
  }
}
EOFPKG

    # Create simple Next.js app
    mkdir -p app
    cat > app/page.tsx << 'EOFPAGE'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold">Learning Assistant</h1>
        <p className="mt-4 text-lg">Deployed successfully on AWS EC2!</p>
      </div>
    </main>
  )
}
EOFPAGE

    # Create next.config.js
    cat > next.config.js << 'EOFCONFIG'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    appDir: true,
  },
}
module.exports = nextConfig
EOFCONFIG
}

chown -R ec2-user:ec2-user /home/ec2-user/learning-assistant

# Create simple Dockerfile if it doesn't exist
if [ ! -f /home/ec2-user/learning-assistant/Dockerfile ]; then
    cat > /home/ec2-user/learning-assistant/Dockerfile << 'EOFDOCKER'
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
EOFDOCKER
fi

# Build and run the application
cd /home/ec2-user/learning-assistant
sudo -u ec2-user docker build -t learning-assistant:latest .
sudo -u ec2-user docker run -d -p 3000:3000 --name learning-assistant \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e BETTER_AUTH_SECRET="aws-$(openssl rand -hex 16)" \
  -e NEXT_PUBLIC_API_URL="http://$INSTANCE_IP:3000" \
  -e NEXT_PUBLIC_APP_URL="http://$INSTANCE_IP:3000" \
  learning-assistant:latest

# Wait for app to start
sleep 30

# Start ngrok tunnel
sudo -u ec2-user ngrok http 3000 --log=stdout --region=us > /var/log/ngrok.log 2>&1 &

# Create status check script
cat > /home/ec2-user/check-status.sh << 'EOFSTATUS'
#!/bin/bash
echo "=== Learning Assistant Status ==="
echo "Docker Container:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Application Health:"
curl -s http://localhost:3000 | grep -o '<title>[^<]*</title>' || echo "App starting..."
echo ""
echo "ngrok Tunnel:"
curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for tunnel in data.get('tunnels', []):
        if tunnel.get('proto') == 'https':
            print(f'Public URL: {tunnel[\"public_url\"]}')
            break
except:
    print('ngrok not ready yet')
" || echo "ngrok starting..."
EOFSTATUS
chmod +x /home/ec2-user/check-status.sh
chown ec2-user:ec2-user /home/ec2-user/check-status.sh

# Setup completion indicator
touch /home/ec2-user/deployment-complete
echo "$(date): Deployment completed successfully" > /home/ec2-user/deployment-status.log
EOF

# Launch EC2 instance
echo "🖥️  Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id ${AMI_ID} \
    --count 1 \
    --instance-type ${INSTANCE_TYPE} \
    --key-name ${KEY_NAME} \
    --security-groups ${SECURITY_GROUP} \
    --user-data file:///tmp/user-data.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${INSTANCE_NAME}}]" \
    --region ${REGION} \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "✅ Instance launched: ${INSTANCE_ID}"
echo "⏳ Waiting for instance to be running..."

# Wait for instance to be running
aws ec2 wait instance-running --instance-ids ${INSTANCE_ID} --region ${REGION}

# Get instance public IP
INSTANCE_IP=$(aws ec2 describe-instances \
    --instance-ids ${INSTANCE_ID} \
    --region ${REGION} \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "🌐 Instance IP: ${INSTANCE_IP}"
echo "⏳ Waiting for deployment to complete (this may take 3-5 minutes)..."

# Wait for deployment completion
echo "🔄 Checking deployment status..."
for i in {1..60}; do
    if ssh -i ~/.ssh/${KEY_NAME}.pem -o StrictHostKeyChecking=no ec2-user@${INSTANCE_IP} "[ -f /home/ec2-user/deployment-complete ]" 2>/dev/null; then
        echo "✅ Deployment completed!"
        break
    fi
    echo "⏳ Still deploying... (${i}/60)"
    sleep 10
done

echo ""
echo "🎉 AWS Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Deployment Details:"
echo "   • Instance ID: ${INSTANCE_ID}"
echo "   • Instance Type: ${INSTANCE_TYPE}"
echo "   • Region: ${REGION}"
echo "   • Public IP: ${INSTANCE_IP}"
echo "   • SSH Key: ~/.ssh/${KEY_NAME}.pem"
echo ""
echo "🌐 Access URLs:"
echo "   • Direct Access: http://${INSTANCE_IP}:3000"
echo "   • SSH Access: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP}"
echo ""
echo "🔧 Useful Commands:"
echo "   • Check Status: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} ./check-status.sh"
echo "   • View Logs: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} 'tail -f /var/log/ngrok.log'"
echo "   • Get ngrok URL: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} 'curl -s http://localhost:4040/api/tunnels'"
echo ""
echo "⚠️  Note: It may take a few more minutes for ngrok to fully initialize."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean up temporary files
rm -f /tmp/user-data.sh

echo "🎯 To get the ngrok public URL, run:"
echo "   ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} ./check-status.sh"