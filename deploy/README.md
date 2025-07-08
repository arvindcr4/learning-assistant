# Learning Assistant Deployment Guide

This guide covers deployment of the Learning Assistant application to various platforms with proper environment configuration and security best practices.

## 🚀 Quick Start

1. **Generate Secrets**: `node scripts/generate-secrets.js generate`
2. **Validate Config**: `node scripts/validate-deployment.js`
3. **Choose Platform**: Follow platform-specific instructions below

## 🔐 Security Configuration

### Required Secrets for Production

Generate secure secrets using the provided script:

```bash
node scripts/generate-secrets.js generate --save production.env
```

Required secrets:
- `BETTER_AUTH_SECRET` - Authentication system secret (32+ chars)
- `JWT_SECRET` - JWT token signing secret (32+ chars)
- `JWT_REFRESH_SECRET` - JWT refresh token secret (32+ chars)
- `CSRF_SECRET` - CSRF protection secret (32+ chars)

### Optional Third-Party Services

- `RESEND_API_KEY` - Email delivery service
- `TAMBO_API_KEY` - AI audio generation
- `LINGO_DEV_API_KEY` - Localization service
- `FIRECRAWL_API_KEY` - Web scraping service
- `SENTRY_DSN` - Error monitoring

## 🌐 Platform Deployment

### Railway

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Create Project**:
   ```bash
   railway new learning-assistant
   cd learning-assistant
   railway link
   ```

3. **Set Environment Variables**:
   ```bash
   # Load from generated secrets file
   railway variables set --file deploy/secrets/production.env
   
   # Or set individually
   railway variables set BETTER_AUTH_SECRET="your-secret-here"
   railway variables set JWT_SECRET="your-secret-here"
   railway variables set DATABASE_URL="your-database-url"
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

### Fly.io

1. **Install Fly CLI**:
   ```bash
   # macOS
   brew install flyctl
   
   # Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login and Create App**:
   ```bash
   fly auth login
   fly launch --name learning-assistant
   ```

3. **Set Secrets**:
   ```bash
   # Generate and set secrets
   fly secrets set BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
   fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
   fly secrets set JWT_REFRESH_SECRET="$(openssl rand -hex 32)"
   fly secrets set CSRF_SECRET="$(openssl rand -hex 32)"
   
   # Set database URL
   fly secrets set DATABASE_URL="your-database-url"
   
   # Set third-party service keys
   fly secrets set RESEND_API_KEY="your-resend-key"
   fly secrets set TAMBO_API_KEY="your-tambo-key"
   ```

4. **Deploy**:
   ```bash
   fly deploy
   ```

### Vercel

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Link Project**:
   ```bash
   vercel link
   ```

3. **Set Environment Variables**:
   ```bash
   # Add secrets through CLI
   vercel env add BETTER_AUTH_SECRET
   vercel env add JWT_SECRET
   vercel env add DATABASE_URL
   
   # Or use the web dashboard
   vercel --prod
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### Docker

1. **Build Image**:
   ```bash
   docker build -t learning-assistant .
   ```

2. **Run with Environment File**:
   ```bash
   docker run -d \
     --name learning-assistant \
     --env-file deploy/secrets/production.env \
     -p 3000:3000 \
     learning-assistant
   ```

3. **Docker Compose**:
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       env_file:
         - deploy/secrets/production.env
       environment:
         - NODE_ENV=production
   ```

## 🗄️ Database Setup

### PostgreSQL (Recommended)

1. **Create Database**:
   ```sql
   CREATE DATABASE learning_assistant;
   CREATE USER learning_user WITH ENCRYPTED PASSWORD 'your-password';
   GRANT ALL PRIVILEGES ON DATABASE learning_assistant TO learning_user;
   ```

2. **Set Database URL**:
   ```bash
   DATABASE_URL="postgresql://learning_user:your-password@localhost:5432/learning_assistant"
   ```

### SQLite (Development Only)

```bash
DATABASE_URL="sqlite:./app.db"
```

## 🔧 Environment Configuration

### Development

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your development settings.

### Production

Use the generated production environment file:
```bash
node scripts/generate-secrets.js generate --save production.env
```

### Staging

Create a staging environment:
```bash
cp deploy/config/staging.env.example deploy/config/staging.env
```

## 🛡️ Security Best Practices

### Secret Management

1. **Never commit secrets to version control**
2. **Use different secrets for different environments**
3. **Rotate secrets regularly (every 90 days)**
4. **Use platform-specific secret management**
5. **Audit secret access and usage**

### Environment Validation

Run validation before deployment:
```bash
node scripts/validate-deployment.js
```

### Network Security

1. **Enable HTTPS only**
2. **Configure CORS properly**
3. **Use secure headers**
4. **Implement rate limiting**
5. **Enable CSP (Content Security Policy)**

## 📊 Monitoring and Logging

### Sentry Error Monitoring

1. **Create Sentry Project**
2. **Set Environment Variables**:
   ```bash
   SENTRY_DSN="https://your-dsn@sentry.io/project-id"
   NEXT_PUBLIC_SENTRY_DSN="https://your-dsn@sentry.io/project-id"
   SENTRY_ORG="your-org"
   SENTRY_PROJECT="learning-assistant"
   ```

### Performance Monitoring

Enable performance monitoring:
```bash
PERF_MONITORING_ENABLED=true
CORE_WEB_VITALS_ENABLED=true
PERF_SAMPLE_RATE=0.1
```

## 🔄 CI/CD Pipeline

### GitHub Actions

Example workflow:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Validate deployment
        run: node scripts/validate-deployment.js
        env:
          NODE_ENV: production
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET }}
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## 🚨 Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**:
   - Check file permissions
   - Verify file encoding (UTF-8)
   - Ensure no trailing spaces

2. **Database Connection Issues**:
   - Verify DATABASE_URL format
   - Check network connectivity
   - Validate credentials

3. **Secret Generation Issues**:
   - Ensure Node.js crypto module is available
   - Check platform-specific requirements
   - Use fallback generation if needed

### Debug Commands

```bash
# Check environment variables
node scripts/validate-deployment.js env

# Check secrets
node scripts/validate-deployment.js secrets

# Check database
node scripts/validate-deployment.js database

# Full validation
node scripts/validate-deployment.js all
```

## 📞 Support

For deployment issues:
1. Check this documentation
2. Run validation scripts
3. Review platform-specific logs
4. Check environment variable configuration
5. Verify secret generation and storage

## 🔄 Updates and Maintenance

### Regular Tasks

1. **Monthly**: Review and rotate secrets
2. **Weekly**: Check monitoring dashboards
3. **Daily**: Review error logs
4. **After deployment**: Validate all services

### Version Updates

1. **Test in staging environment**
2. **Run validation scripts**
3. **Update environment variables if needed**
4. **Deploy with rollback plan**

---

## 📋 Deployment Checklist

- [ ] Secrets generated and stored securely
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Deployment files validated
- [ ] Network configuration verified
- [ ] Monitoring configured
- [ ] Security headers enabled
- [ ] HTTPS enforced
- [ ] Performance monitoring active
- [ ] Error tracking configured
- [ ] Backup strategy in place
- [ ] Rollback plan prepared