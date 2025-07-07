# DigitalOcean Deployment Guide

## Quick Web Deployment (5-8 minutes)

Since CLI requires GitHub authentication, here's the fastest manual deployment path:

### Step 1: Create App via Web Interface

1. **Go to DigitalOcean Console**: https://cloud.digitalocean.com/apps
2. **Click "Create App"**
3. **Connect GitHub**: 
   - Choose "GitHub"
   - Authorize DigitalOcean to access your GitHub account
   - Select repository: `arvindcr4/learning-assistant`
   - Branch: `main`

### Step 2: Configure Build Settings

- **Source Directory**: `/` (root)
- **Build Command**: `npm run build`
- **Run Command**: `npm start`
- **HTTP Port**: `3000`

### Step 3: Environment Variables

Add these environment variables in the DigitalOcean console:

```
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=do-secure-secret-learning-assistant-2025
PORT=3000
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false
```

### Step 4: Deploy

1. **Review settings** and click "Create Resources"
2. **Wait for deployment** (3-5 minutes)
3. **Get your app URL** (will be like: `https://learning-assistant-xxxxx.ondigitalocean.app`)

## Alternative: Use Existing Droplet

If you have the existing droplet (IP: 138.197.50.3), you can deploy there:

```bash
# SSH to your droplet
ssh -i ~/.ssh/do_learning_assistant root@138.197.50.3

# Pull latest code
cd /app
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Check status
docker-compose ps
```

## ngrok Setup (Optional)

Once your app is deployed, you can create an ngrok tunnel:

```bash
# Install ngrok if not already installed
brew install ngrok/ngrok/ngrok

# Create tunnel to your DO app
ngrok http https://your-app-url.ondigitalocean.app --host-header=rewrite

# Or create tunnel to your droplet
ngrok http http://138.197.50.3:3000
```

## Expected URLs

After deployment you'll have:
- **DigitalOcean App**: `https://learning-assistant-xxxxx.ondigitalocean.app`
- **ngrok Tunnel**: `https://xxxxx.ngrok.io`
- **Droplet Direct**: `http://138.197.50.3:3000`

## Database Setup

The database we created earlier:
- **Name**: `learning-assistant-db-1751892867`
- **Status**: Creating (check with `doctl databases list`)
- **Connection**: Available once status is "online"

## Next Steps

1. **Deploy via web interface** (fastest option)
2. **Wait for deployment** to complete
3. **Test your app** at the provided URL
4. **Optionally add ngrok** for additional tunneling
5. **Connect database** once it's ready

The app should be live in 5-8 minutes using the web interface method!