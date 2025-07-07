# Render Deployment Guide

## Quick Web Deployment (5-8 minutes)

### Step 1: Create Render Account & Service

1. **Go to Render**: https://render.com
2. **Sign up/Login** with GitHub
3. **Create New Web Service**
4. **Connect GitHub Repository**: `arvindcr4/learning-assistant`

### Step 2: Configure Service

**Basic Settings:**

- **Name**: `learning-assistant`
- **Region**: `Oregon` (or closest to you)
- **Branch**: `main`
- **Runtime**: `Docker`
- **Dockerfile Path**: `./Dockerfile`
- **Docker Context**: `.`

**Build Settings:**

- **Build Command**: (Leave empty - Docker handles this)
- **Start Command**: (Leave empty - Docker handles this)

### Step 3: Environment Variables

Add these in Render dashboard:

```
NODE_ENV=production
PORT=3000
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=render-secure-secret-$(date +%s)
NEXT_PUBLIC_API_URL=https://learning-assistant.onrender.com
NEXT_PUBLIC_APP_URL=https://learning-assistant.onrender.com
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false
```

### Step 4: Deploy

1. **Click "Create Web Service"**
2. **Wait for build** (3-5 minutes)
3. **Get your URL**: `https://learning-assistant.onrender.com`

## Alternative: Render CLI (if available)

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy using render.yaml
render deploy
```

## Expected Deployment Time

- **Service Creation**: 1-2 minutes
- **Docker Build**: 3-5 minutes
- **Deployment**: 1-2 minutes
- **Total**: 5-8 minutes

## Post-Deployment

### Test Your App

```bash
curl https://learning-assistant.onrender.com/api/health
```

### Setup ngrok (Optional)

```bash
# Create tunnel to Render
ngrok http https://learning-assistant.onrender.com --host-header=rewrite
```

### Monitor Logs

- View logs in Render dashboard
- Or use CLI: `render logs learning-assistant`

## Features Enabled

- ✅ Next.js 15 with optimized build
- ✅ SQLite database (file-based)
- ✅ Learning analytics
- ✅ Recommendations
- ❌ Chat (disabled for faster deployment)
- ✅ Health checks
- ✅ Security headers

## URLs After Deployment

- **Main App**: `https://learning-assistant.onrender.com`
- **Health Check**: `https://learning-assistant.onrender.com/api/health`
- **Admin**: Render dashboard
- **Optional ngrok**: `https://xxxxx.ngrok.io`

The app should be live in 5-8 minutes! 🚀
