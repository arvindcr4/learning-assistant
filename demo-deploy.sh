#!/bin/bash

# Quick Demo Deploy Script
# Uses development server for immediate deployment

set -e

echo "🚀 Learning Assistant - Quick Demo Deploy"
echo "=========================================="

# Check for ngrok
if ! command -v ngrok &> /dev/null; then
    echo "Installing ngrok..."
    if command -v brew &> /dev/null; then
        brew install ngrok/ngrok/ngrok
    else
        echo "Please install ngrok: https://ngrok.com/download"
        exit 1
    fi
fi

# Create demo environment
cat > .env.local << 'EOF'
NODE_ENV=development
BETTER_AUTH_SECRET="demo-secret-key-for-testing-only"
DATABASE_URL="sqlite:./demo.db"
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Demo features
FEATURE_CHAT_ENABLED="false"
FEATURE_VOICE_ENABLED="false"
FEATURE_ANALYTICS_ENABLED="true"
FEATURE_RECOMMENDATIONS_ENABLED="true"
EOF

echo "🔧 Environment configured for demo"

# Kill any existing processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start development server in background
echo "🚀 Starting development server..."
npm run dev &
DEV_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 15

# Check if server is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Server running at http://localhost:3000"
    
    # Start ngrok
    echo "🌐 Creating public tunnel..."
    ngrok http 3000 &
    NGROK_PID=$!
    
    sleep 8
    
    # Get public URL
    PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for tunnel in data.get('tunnels', []):
        if tunnel.get('proto') == 'https':
            print(tunnel['public_url'])
            break
except:
    pass
" 2>/dev/null)
    
    if [ ! -z "$PUBLIC_URL" ]; then
        echo ""
        echo "🎉 SUCCESS! Learning Assistant is live:"
        echo "🔗 Public URL: $PUBLIC_URL"
        echo ""
        echo "✨ Available Features:"
        echo "   📝 VARK Learning Style Assessment"
        echo "   🎯 Personalized Learning Profiles"
        echo "   📊 Analytics Dashboard"
        echo "   🎲 Interactive Quizzes"
        echo "   🌍 Multi-language Support"
        echo "   ♿ Accessibility Features"
        echo ""
        echo "💡 This is a live demo - try it out!"
        echo "⚠️  Demo mode: Some features disabled for quick deployment"
        echo "🛑 Press Ctrl+C to stop"
        echo ""
        
        # Keep running until interrupted
        trap 'echo "🛑 Stopping services..."; kill $DEV_PID $NGROK_PID 2>/dev/null || true; exit 0' INT
        
        while true; do
            sleep 10
            # Check if processes are still running
            if ! kill -0 $DEV_PID 2>/dev/null; then
                echo "❌ Development server stopped"
                break
            fi
            if ! kill -0 $NGROK_PID 2>/dev/null; then
                echo "❌ Ngrok tunnel stopped"
                break
            fi
        done
    else
        echo "❌ Could not get public URL from ngrok"
        echo "🔍 Try checking http://localhost:4040 for tunnel status"
    fi
else
    echo "❌ Server failed to start"
    kill $DEV_PID 2>/dev/null || true
    exit 1
fi