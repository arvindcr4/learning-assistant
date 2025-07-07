#!/bin/bash
set -e

echo "🚀 DigitalOcean App Platform Deployment"
echo "========================================"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository. Initializing..."
    git init
    git add .
    git commit -m "Initial commit for DigitalOcean deployment"
fi

# Check if we have a GitHub remote
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "❌ No GitHub remote found. You need to push this to GitHub first."
    echo "   1. Create a GitHub repository at https://github.com/new"
    echo "   2. Run: git remote add origin https://github.com/yourusername/learning-assistant.git"
    echo "   3. Run: git push -u origin main"
    exit 1
fi

# Get current git info
REPO_URL=$(git remote get-url origin)
BRANCH=$(git branch --show-current)

echo "📋 Repository: $REPO_URL"
echo "📋 Branch: $BRANCH"

# Create PostgreSQL database
echo "🗄️  Creating PostgreSQL database..."
DB_NAME="learning-assistant-db-$(date +%s)"
doctl databases create $DB_NAME --engine pg --version 15 --size db-s-1vcpu-1gb --region nyc3

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
while true; do
    DB_STATUS=$(doctl databases get $DB_NAME --format Status --no-header)
    if [ "$DB_STATUS" = "online" ]; then
        echo "✅ Database is ready"
        break
    fi
    echo "   Database status: $DB_STATUS"
    sleep 10
done

# Get database connection details
DB_CONNECTION=$(doctl databases connection $DB_NAME --format URI --no-header)
echo "📋 Database connection: $DB_CONNECTION"

# Create app spec file with actual values
cat > app-spec.yaml << EOF
name: learning-assistant
services:
- name: web
  source_dir: /
  github:
    repo: $(echo $REPO_URL | sed 's/https:\/\/github.com\///' | sed 's/\.git//')
    branch: $BRANCH
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  http_port: 3000
  routes:
  - path: /
  envs:
  - key: NODE_ENV
    value: production
  - key: NEXT_TELEMETRY_DISABLED
    value: "1"
  - key: DATABASE_URL
    value: "$DB_CONNECTION"
  - key: BETTER_AUTH_SECRET
    value: "do-secure-secret-$(openssl rand -hex 32)"
  - key: PORT
    value: "3000"
  - key: FEATURE_ANALYTICS_ENABLED
    value: "true"
  - key: FEATURE_RECOMMENDATIONS_ENABLED
    value: "true"
  - key: FEATURE_CHAT_ENABLED
    value: "false"
EOF

# Deploy the app
echo "🚀 Deploying app to DigitalOcean..."
APP_ID=$(doctl apps create app-spec.yaml --format ID --no-header)
echo "📋 App ID: $APP_ID"

# Wait for deployment to complete
echo "⏳ Waiting for deployment to complete..."
while true; do
    DEPLOYMENT_STATUS=$(doctl apps get $APP_ID --format ActiveDeployment.Phase --no-header)
    if [ "$DEPLOYMENT_STATUS" = "ACTIVE" ]; then
        echo "✅ Deployment completed successfully!"
        break
    elif [ "$DEPLOYMENT_STATUS" = "ERROR" ]; then
        echo "❌ Deployment failed!"
        doctl apps get $APP_ID --format ActiveDeployment.Progress.ErrorSteps
        exit 1
    fi
    echo "   Deployment status: $DEPLOYMENT_STATUS"
    sleep 15
done

# Get app URL
APP_URL=$(doctl apps get $APP_ID --format DefaultIngress --no-header)
echo "🌐 App URL: https://$APP_URL"

# Create ngrok script for additional tunneling
cat > setup-ngrok.sh << 'EOF'
#!/bin/bash
echo "Setting up ngrok tunnel to DigitalOcean app..."
if ! command -v ngrok &> /dev/null; then
    echo "Installing ngrok..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install ngrok/ngrok/ngrok
    else
        curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt update && sudo apt install ngrok
    fi
fi

echo "Starting ngrok tunnel..."
ngrok http https://APP_URL_PLACEHOLDER --host-header=rewrite
EOF

# Replace placeholder with actual URL
sed -i '' "s|APP_URL_PLACEHOLDER|$APP_URL|g" setup-ngrok.sh
chmod +x setup-ngrok.sh

echo ""
echo "🎉 DigitalOcean Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Deployment Details:"
echo "   • App ID: $APP_ID"
echo "   • Database: $DB_NAME"
echo "   • App URL: https://$APP_URL"
echo "   • Status: Active"
echo ""
echo "🌐 Access URLs:"
echo "   • Main App: https://$APP_URL"
echo "   • Admin Dashboard: https://cloud.digitalocean.com/apps/$APP_ID"
echo ""
echo "🔧 Management Commands:"
echo "   • View logs: doctl apps logs $APP_ID"
echo "   • View app info: doctl apps get $APP_ID"
echo "   • Scale app: doctl apps update $APP_ID --spec app-spec.yaml"
echo ""
echo "🌐 Optional ngrok setup:"
echo "   • Run: ./setup-ngrok.sh"
echo "   • This will create an additional tunnel for testing"
echo ""
echo "⚠️  Note: Your app might take a few minutes to fully start up."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Clean up
rm -f app-spec.yaml