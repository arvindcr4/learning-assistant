#!/bin/bash

# Local Development Runner for Learning Assistant
set -e

echo "🎓 Learning Assistant - Local Development"
echo "========================================"

# Setup local development environment
cat > .env.local << 'EOF'
NODE_ENV=development
BETTER_AUTH_SECRET="local-dev-secret-key-for-development"
DATABASE_URL="sqlite:./local_dev.db"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Feature flags for local development
FEATURE_CHAT_ENABLED="true"
FEATURE_VOICE_ENABLED="false"
FEATURE_ANALYTICS_ENABLED="true"
FEATURE_RECOMMENDATIONS_ENABLED="true"

# Development settings
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"
RATE_LIMIT_MAX="1000"
EOF

echo "✅ Local environment configured"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Kill any existing processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

echo ""
echo "🚀 Starting Learning Assistant locally..."
echo "📍 Local URL: http://localhost:3000"
echo ""
echo "✨ Available Features:"
echo "   🏠 Homepage with learning style assessment"
echo "   📊 Analytics dashboard"
echo "   🎯 Personalized learning profiles"
echo "   🎲 Interactive quizzes"
echo "   🌍 Multi-language support"
echo "   ♿ Accessibility features"
echo "   🔧 Development tools enabled"
echo ""
echo "💡 Open http://localhost:3000 in your browser"
echo "🛑 Press Ctrl+C to stop the server"
echo ""

# Start the development server
npm run dev