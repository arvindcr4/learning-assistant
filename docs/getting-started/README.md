# Getting Started with Learning Assistant

## Welcome!

Welcome to Learning Assistant - your personalized AI-powered learning companion that adapts to your unique learning style and pace. This guide will help you get up and running quickly, whether you're a developer setting up the application or an end user looking to start your learning journey.

## Table of Contents

1. [Quick Start Options](#quick-start-options)
2. [For End Users](#for-end-users)
3. [For Developers](#for-developers)
4. [System Requirements](#system-requirements)
5. [Installation Methods](#installation-methods)
6. [First-Time Setup](#first-time-setup)
7. [Configuration](#configuration)
8. [Verification](#verification)
9. [Next Steps](#next-steps)

## Quick Start Options

### 🚀 I Just Want to Use the App
**→ Go to [For End Users](#for-end-users)**
Perfect if you want to start learning immediately on a hosted instance.

### 💻 I Want to Run It Locally
**→ Go to [Local Development Setup](#local-development-setup)**
Ideal for development, testing, or running your own instance.

### ☁️ I Want to Deploy My Own Instance
**→ Go to [Deployment Options](#deployment-options)**
Best for production use or sharing with others.

---

## For End Users

### Account Creation

1. **Visit the Application**
   - Go to your Learning Assistant instance URL
   - Click "Get Started" or "Sign Up"

2. **Create Your Account**
   ```
   📧 Email: your-email@example.com
   🔐 Password: Create a strong password
   👤 Name: Your full name
   ```

3. **Verify Your Email**
   - Check your email inbox
   - Click the verification link
   - Return to the application

### Initial Profile Setup

4. **Take the Learning Style Assessment**
   - Complete the VARK questionnaire (5-10 minutes)
   - Answer honestly for best personalization
   - Don't worry - you can retake it anytime

5. **Set Your Learning Goals**
   ```
   🎯 Primary Goal: What do you want to achieve?
   📚 Subjects: Select areas of interest
   ⏱️ Time Commitment: How much time per day?
   📈 Difficulty: Beginner, Intermediate, or Advanced
   ```

6. **Configure Preferences**
   ```
   🔔 Notifications: Email and push preferences
   🌙 Theme: Light, dark, or system
   🌍 Language: Select your preferred language
   ```

### Start Learning

7. **Explore Learning Paths**
   - Browse recommended paths on your dashboard
   - Filter by subject, difficulty, or duration
   - Preview path content before enrolling

8. **Begin Your First Session**
   - Click "Start Learning" on any enrolled path
   - Follow the adaptive content presentation
   - Use the AI chat assistant for help

9. **Track Your Progress**
   - Check your dashboard regularly
   - Review analytics and insights
   - Adjust goals and preferences as needed

---

## For Developers

### Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Installation |
|-------------|---------|-------------|
| **Node.js** | 18.x or 20.x | [Download](https://nodejs.org/) |
| **npm** | 8.x+ | Included with Node.js |
| **Git** | Latest | [Download](https://git-scm.com/) |
| **Docker** | Latest | [Download](https://docker.com/) |

**Verify Installation:**
```bash
node --version  # Should show v18.x.x or v20.x.x
npm --version   # Should show 8.x.x+
git --version   # Should show git version
docker --version # Should show Docker version
```

### Local Development Setup

#### Method 1: Automated Setup (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/learning-assistant.git
cd learning-assistant

# 2. Run the automated setup script
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh

# 3. Start the development server
npm run dev
```

The automated script will:
- Install dependencies
- Set up environment variables
- Start Docker services
- Run database migrations
- Seed sample data

#### Method 2: Manual Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/learning-assistant.git
cd learning-assistant

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 4. Start Docker services
docker-compose -f docker-compose.dev.yml up -d

# 5. Run database setup
npm run db:migrate
npm run db:seed

# 6. Start the development server
npm run dev
```

### Environment Configuration

#### Required Environment Variables

Create `.env.local` file with these essential variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/learning_assistant"
REDIS_URL="redis://localhost:6379"

# Authentication
BETTER_AUTH_SECRET="your-very-long-random-secret-key-here"
BETTER_AUTH_URL="http://localhost:3000"

# AI Integration (Optional but recommended)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# Application
NODE_ENV="development"
PORT=3000
```

#### Optional Configurations

```bash
# Email Configuration (for notifications)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"

# OAuth Providers (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Analytics (optional)
ANALYTICS_ENABLED="true"
LOGGING_LEVEL="info"
```

### Development Workflow

#### Starting Development

```bash
# Start all services
npm run dev

# In separate terminals, you can also run:
npm run db:studio    # Database GUI
npm run test:watch   # Continuous testing
npm run type-check   # TypeScript checking
```

#### Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `npm run dev` | Start development server | Main development command |
| `npm run build` | Build for production | Test production build |
| `npm run start` | Start production server | Run production locally |
| `npm test` | Run all tests | Quality assurance |
| `npm run lint` | Check code quality | Code standards |
| `npm run type-check` | TypeScript validation | Type safety |

#### Database Management

```bash
# Migration commands
npm run db:migrate    # Apply pending migrations
npm run db:rollback   # Rollback last migration
npm run db:reset      # Reset entire database
npm run db:seed       # Add sample data
npm run db:status     # Check migration status

# Database tools
npm run db:studio     # Open database GUI
npm run db:backup     # Create database backup
npm run db:restore    # Restore from backup
```

### Verification Steps

#### 1. Application Health Check

```bash
# Test the health endpoint
curl http://localhost:3000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-07T12:00:00Z",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "ai_service": "healthy"
  }
}
```

#### 2. Database Connection

```bash
# Test database connection
npm run db:status

# Should show all migrations as "up"
```

#### 3. UI Functionality

1. Open http://localhost:3000
2. Register a new account
3. Complete the learning style assessment
4. Start a learning session
5. Test the AI chat assistant

#### 4. API Testing

```bash
# Test authentication endpoint
curl -X POST http://localhost:3000/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test learning profile endpoint
curl http://localhost:3000/api/learning/profile \
  -H "Cookie: session=your-session-id"
```

---

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **RAM** | 4 GB |
| **Storage** | 2 GB free space |
| **CPU** | 2 cores |
| **OS** | Windows 10+, macOS 10.15+, Ubuntu 18.04+ |
| **Browser** | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ |

### Recommended Requirements

| Component | Recommendation |
|-----------|----------------|
| **RAM** | 8 GB+ |
| **Storage** | 10 GB+ SSD |
| **CPU** | 4 cores+ |
| **Network** | Stable internet for AI features |

### Production Requirements

| Component | Requirement |
|-----------|-------------|
| **RAM** | 16 GB+ |
| **Storage** | 50 GB+ SSD |
| **CPU** | 8 cores+ |
| **Database** | PostgreSQL 14+ |
| **Cache** | Redis 6+ |

---

## Installation Methods

### Method 1: Docker Compose (Easiest)

Perfect for development and testing:

```bash
# Clone and start
git clone https://github.com/your-repo/learning-assistant.git
cd learning-assistant
docker-compose up -d

# Access at http://localhost:3000
```

**Pros:**
- ✅ Isolated environment
- ✅ No local dependencies needed
- ✅ Easy cleanup

**Cons:**
- ❌ Slower development workflow
- ❌ Requires Docker knowledge

### Method 2: Local Development

Best for active development:

```bash
# Full setup as shown above
npm install --legacy-peer-deps
docker-compose -f docker-compose.dev.yml up -d
npm run db:migrate
npm run dev
```

**Pros:**
- ✅ Fast hot reloading
- ✅ Direct file access
- ✅ Familiar Node.js workflow

**Cons:**
- ❌ Requires Node.js setup
- ❌ More setup steps

### Method 3: Cloud Development

Using GitHub Codespaces or Gitpod:

```bash
# Automatic setup in cloud IDE
# Pre-configured environment
# Access via web browser
```

**Pros:**
- ✅ No local setup required
- ✅ Consistent environment
- ✅ Powerful cloud resources

**Cons:**
- ❌ Requires internet
- ❌ Monthly usage limits

---

## First-Time Setup

### For New Users

1. **Account Registration**
   ```
   → Visit the application URL
   → Click "Sign Up"
   → Enter email and password
   → Verify email address
   ```

2. **Learning Style Assessment**
   ```
   → Take the VARK questionnaire
   → Answer 16 quick questions
   → Review your learning style results
   → Understand how content will be adapted
   ```

3. **Goal Setting**
   ```
   → Define learning objectives
   → Select subject areas
   → Set time commitments
   → Choose difficulty levels
   ```

4. **Preferences Configuration**
   ```
   → Notification settings
   → Interface language
   → Theme preferences
   → Privacy settings
   ```

### For Developers

1. **Environment Setup**
   ```bash
   # Verify system requirements
   node --version && npm --version && docker --version
   
   # Clone and setup
   git clone <repo-url>
   cd learning-assistant
   ./scripts/dev-setup.sh
   ```

2. **Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env.local
   
   # Edit configuration
   nano .env.local  # or your preferred editor
   
   # Required: Database URL
   # Optional: OpenAI API key, OAuth credentials
   ```

3. **Database Initialization**
   ```bash
   # Start database
   docker-compose -f docker-compose.dev.yml up -d postgres redis
   
   # Run migrations
   npm run db:migrate
   
   # Seed sample data
   npm run db:seed
   ```

4. **Verification**
   ```bash
   # Start development server
   npm run dev
   
   # Test in browser
   open http://localhost:3000
   
   # Run test suite
   npm test
   ```

---

## Configuration

### Basic Configuration

#### Database Setup
```bash
# PostgreSQL with Docker
docker run --name learning-postgres \
  -e POSTGRES_DB=learning_assistant \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Update .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/learning_assistant"
```

#### Redis Setup
```bash
# Redis with Docker
docker run --name learning-redis \
  -p 6379:6379 \
  -d redis:7-alpine

# Update .env.local
REDIS_URL="redis://localhost:6379"
```

### Advanced Configuration

#### AI Integration
```bash
# OpenAI Configuration
OPENAI_API_KEY="sk-your-api-key"
OPENAI_MODEL="gpt-3.5-turbo"
OPENAI_MAX_TOKENS=2000

# Alternative AI providers
ANTHROPIC_API_KEY="your-anthropic-key"
HUGGINGFACE_API_KEY="your-hf-key"
```

#### OAuth Setup
```bash
# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

#### Email Configuration
```bash
# SMTP Configuration
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="Learning Assistant <noreply@yourapp.com>"
```

### Performance Tuning

#### Database Optimization
```sql
-- Connection pooling settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
```

#### Application Optimization
```typescript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizeServerReact: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    domains: ['your-cdn-domain.com'],
  },
};
```

---

## Deployment Options

### Quick Deployment (5 minutes)

#### Option 1: Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly secrets set OPENAI_API_KEY=sk-...
fly deploy
```

#### Option 2: Render
```bash
# Connect GitHub repository
# Set environment variables in dashboard
# Deploy automatically
```

#### Option 3: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway login
railway init
railway up
```

### Production Deployment

For production use, see our comprehensive [Deployment Guides](../deployment/README.md):

- **[Fly.io](../deployment/fly-io.md)** - Serverless with auto-scaling
- **[Render](../deployment/render.md)** - Easy Docker deployment
- **[AWS](../deployment/aws.md)** - Enterprise-grade deployment
- **[DigitalOcean](../deployment/digitalocean.md)** - Cost-effective VPS

---

## Verification

### Quick Health Check

Run this comprehensive verification script:

```bash
#!/bin/bash
echo "🔍 Learning Assistant Health Check"
echo "================================="

# 1. Check application response
echo "1. Testing application health..."
curl -s http://localhost:3000/api/health | jq '.'

# 2. Check database connection
echo "2. Testing database connection..."
npm run db:status

# 3. Check Redis connection
echo "3. Testing Redis connection..."
redis-cli ping

# 4. Test authentication
echo "4. Testing authentication endpoint..."
curl -s -X POST http://localhost:3000/api/csrf | jq '.'

# 5. Check environment variables
echo "5. Checking environment configuration..."
node -e "
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Database:', process.env.DATABASE_URL ? '✅ SET' : '❌ MISSING');
console.log('Auth Secret:', process.env.BETTER_AUTH_SECRET ? '✅ SET' : '❌ MISSING');
console.log('OpenAI Key:', process.env.OPENAI_API_KEY ? '✅ SET' : '❌ MISSING');
"

echo "✅ Health check complete!"
```

### Manual Testing Checklist

- [ ] Application loads at http://localhost:3000
- [ ] User registration works
- [ ] Email verification functions (if configured)
- [ ] Login/logout works correctly
- [ ] Learning style assessment can be completed
- [ ] Chat assistant responds (if OpenAI configured)
- [ ] Progress tracking updates
- [ ] Database queries execute successfully
- [ ] No console errors in browser

### Automated Testing

```bash
# Run the full test suite
npm test

# Run specific test types
npm run test:unit           # Unit tests
npm run test:integration    # API tests
npm run test:e2e           # End-to-end tests
npm run test:accessibility # A11y tests

# Generate coverage report
npm run test:coverage
```

---

## Next Steps

### For End Users

1. **Complete Your Profile**
   - Finish the learning style assessment
   - Set specific learning goals
   - Configure notification preferences

2. **Start Learning**
   - Browse available learning paths
   - Enroll in your first course
   - Begin your learning journey

3. **Explore Features**
   - Try the AI chat assistant
   - Check your progress analytics
   - Customize your dashboard

4. **Get Help**
   - Join the community forums
   - Read the [User Guide](../user-guide/README.md)
   - Contact support if needed

### For Developers

1. **Development Setup**
   - Set up your IDE with recommended extensions
   - Configure git hooks for code quality
   - Join the developer Discord

2. **Learn the Codebase**
   - Read the [Architecture Guide](../../ARCHITECTURE.md)
   - Understand the database schema
   - Review the API documentation

3. **Start Contributing**
   - Pick up a "good first issue"
   - Submit your first pull request
   - Help improve documentation

4. **Advanced Topics**
   - Set up monitoring and logging
   - Implement custom integrations
   - Optimize performance

### For Administrators

1. **Production Setup**
   - Choose deployment platform
   - Configure monitoring
   - Set up backup procedures

2. **Security**
   - Review [Security Best Practices](../deployment/security-best-practices.md)
   - Configure SSL certificates
   - Set up access controls

3. **Monitoring**
   - Set up application monitoring
   - Configure alerting
   - Monitor performance metrics

4. **Maintenance**
   - Plan regular updates
   - Monitor resource usage
   - Review security logs

---

## Support & Resources

### Quick Help

- **Stuck?** Check the [Troubleshooting Guide](../troubleshooting/README.md)
- **API Questions?** See the [API Documentation](../api/README.md)
- **Deployment Issues?** Review [Deployment Guides](../deployment/README.md)

### Community

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and community help
- **Discord**: Real-time chat with developers and users
- **Reddit**: Share experiences and tips

### Professional Support

- **Email Support**: support@learningassistant.com
- **Priority Support**: Available for enterprise customers
- **Consulting**: Custom implementations and integrations

---

**🎉 Congratulations!** You're now ready to start your journey with Learning Assistant. Whether you're learning something new or building something amazing, we're here to help every step of the way.

*Need more help? Check out our comprehensive [documentation](../README.md) or reach out to the community.*

---

*Last Updated: 2025-01-07*
*Version: 1.0.0*