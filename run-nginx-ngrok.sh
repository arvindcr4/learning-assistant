#!/bin/bash

# Learning Assistant with Nginx + Ngrok Setup
set -e

echo "🎓 Learning Assistant - Nginx + Ngrok Setup"
echo "============================================"

# Check dependencies
check_dependency() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed"
        return 1
    else
        echo "✅ $1 is available"
        return 0
    fi
}

echo "🔍 Checking dependencies..."
DEPS_OK=true

if ! check_dependency "docker"; then
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    DEPS_OK=false
fi

if ! check_dependency "ngrok"; then
    echo "Installing ngrok..."
    if command -v brew &> /dev/null; then
        brew install ngrok/ngrok/ngrok
    else
        echo "Please install ngrok: https://ngrok.com/download"
        DEPS_OK=false
    fi
fi

if [ "$DEPS_OK" = false ]; then
    echo "❌ Missing dependencies. Please install them and try again."
    exit 1
fi

# Stop any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.local.yml down 2>/dev/null || true
docker stop learning-assistant-nginx learning-assistant-app 2>/dev/null || true
docker rm learning-assistant-nginx learning-assistant-app 2>/dev/null || true

# Kill processes on ports we need
echo "🔧 Freeing up ports..."
lsof -ti:80 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
pkill -f ngrok 2>/dev/null || true

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.local.yml up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 15

# Check if app is responding
APP_READY=false
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        APP_READY=true
        break
    fi
    echo "   Waiting for app... ($i/30)"
    sleep 2
done

if [ "$APP_READY" = false ]; then
    echo "❌ App failed to start on port 3000"
    docker-compose -f docker-compose.local.yml logs app
    exit 1
fi

# Check if nginx is responding
NGINX_READY=false
for i in {1..15}; do
    if curl -s http://localhost > /dev/null 2>&1; then
        NGINX_READY=true
        break
    fi
    echo "   Waiting for nginx... ($i/15)"
    sleep 2
done

if [ "$NGINX_READY" = false ]; then
    echo "❌ Nginx failed to start on port 80"
    docker-compose -f docker-compose.local.yml logs nginx
    exit 1
fi

echo "✅ Services are running!"
echo "   📱 App: http://localhost:3000 (direct)"
echo "   🌐 Nginx: http://localhost (reverse proxy)"

# Start ngrok tunnel to nginx
echo "🌍 Starting ngrok tunnel..."
ngrok http 80 &
NGROK_PID=$!

# Wait for ngrok to start
sleep 8

# Get ngrok public URL
PUBLIC_URL=""
for i in {1..10}; do
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
        break
    fi
    echo "   Waiting for ngrok tunnel... ($i/10)"
    sleep 2
done

if [ ! -z "$PUBLIC_URL" ]; then
    echo ""
    echo "🎉 SUCCESS! Learning Assistant is live with Nginx + Ngrok:"
    echo ""
    echo "📍 URLs:"
    echo "   🏠 Local (direct):      http://localhost:3000"
    echo "   🌐 Local (nginx):       http://localhost"
    echo "   🔗 Public (ngrok):      $PUBLIC_URL"
    echo "   🛠️  Ngrok dashboard:     http://localhost:4040"
    echo ""
    echo "✨ Features:"
    echo "   📊 Analytics dashboard"
    echo "   🎯 Learning profiles"
    echo "   🎲 Interactive quizzes"
    echo "   🌍 Multi-language support"
    echo "   ♿ Accessibility features"
    echo "   🚀 Nginx caching & compression"
    echo "   🔒 Security headers"
    echo ""
    echo "🔧 Architecture:"
    echo "   Internet → Ngrok → Nginx → Next.js App"
    echo ""
    echo "💡 Benefits:"
    echo "   • Fast static asset serving via Nginx"
    echo "   • Gzip compression enabled"
    echo "   • Security headers configured"
    echo "   • Public access via ngrok tunnel"
    echo "   • Load balancing ready"
    echo ""
    echo "🛑 Press Ctrl+C to stop all services"
    echo ""

    # Keep services running and show logs
    trap 'echo "🛑 Stopping services..."; kill $NGROK_PID 2>/dev/null || true; docker-compose -f docker-compose.local.yml down; exit 0' INT

    echo "📊 Live logs (Ctrl+C to stop):"
    echo "================================"
    docker-compose -f docker-compose.local.yml logs -f app nginx

else
    echo "❌ Failed to get ngrok public URL"
    echo "🔍 Check ngrok dashboard: http://localhost:4040"
    echo "🌐 Local access still available: http://localhost"
    
    # Keep services running
    trap 'echo "🛑 Stopping services..."; docker-compose -f docker-compose.local.yml down; exit 0' INT
    echo "🛑 Press Ctrl+C to stop services"
    docker-compose -f docker-compose.local.yml logs -f app nginx
fi