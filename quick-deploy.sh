#!/bin/bash

# Quick Deploy Script for Learning Assistant
# This will run the app locally and expose it publicly using ngrok

set -e

echo "🚀 Quick Deploy: Learning Assistant"
echo "======================================"

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "📦 Installing ngrok..."
    if command -v brew &> /dev/null; then
        brew install ngrok/ngrok/ngrok
    else
        echo "❌ Please install ngrok manually: https://ngrok.com/download"
        exit 1
    fi
fi

# Create production environment
echo "🔧 Setting up production environment..."
cat > .env.local << 'EOF'
NODE_ENV=production
BETTER_AUTH_SECRET="quick-deploy-demo-secret-key-$(date +%s)"
DATABASE_URL="sqlite:./demo_app.db"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Demo feature flags
FEATURE_CHAT_ENABLED="false"
FEATURE_VOICE_ENABLED="false"
FEATURE_ANALYTICS_ENABLED="true"
FEATURE_RECOMMENDATIONS_ENABLED="true"
EOF

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Start the app in background
echo "🚀 Starting Learning Assistant..."
npm start &
APP_PID=$!

# Wait for app to start
echo "⏳ Waiting for app to start..."
sleep 10

# Check if app is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ App is running locally on http://localhost:3000"
    
    # Start ngrok to expose publicly
    echo "🌐 Exposing app publicly with ngrok..."
    ngrok http 3000 &
    NGROK_PID=$!
    
    # Wait a moment for ngrok to start
    sleep 5
    
    # Get public URL
    PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | grep https | cut -d'"' -f4)
    
    if [ ! -z "$PUBLIC_URL" ]; then
        echo ""
        echo "🎉 SUCCESS! Learning Assistant is now publicly accessible:"
        echo "🔗 Public URL: $PUBLIC_URL"
        echo ""
        echo "📝 Features available:"
        echo "   • Personalized learning profiles"
        echo "   • VARK learning style assessment"
        echo "   • Interactive quizzes"
        echo "   • Analytics dashboard"
        echo "   • Multi-language support"
        echo ""
        echo "⚠️  Note: This is a demo deployment with SQLite database"
        echo "💡 Press Ctrl+C to stop the services"
        echo ""
        
        # Keep services running
        wait
    else
        echo "❌ Failed to get ngrok public URL"
        echo "🔍 Check ngrok dashboard at: http://localhost:4040"
    fi
else
    echo "❌ Failed to start the application"
    kill $APP_PID 2>/dev/null || true
    exit 1
fi

# Cleanup on exit
trap 'kill $APP_PID $NGROK_PID 2>/dev/null || true' EXIT