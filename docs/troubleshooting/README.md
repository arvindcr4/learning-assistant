# Learning Assistant Troubleshooting Guide

## Overview

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the Learning Assistant application. Whether you're experiencing installation problems, deployment issues, or runtime errors, this guide provides step-by-step solutions.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation & Setup Issues](#installation--setup-issues)
3. [Authentication Problems](#authentication-problems)
4. [Database Connection Issues](#database-connection-issues)
5. [API & Network Issues](#api--network-issues)
6. [Performance Problems](#performance-problems)
7. [AI/Chat Integration Issues](#aichat-integration-issues)
8. [Deployment Issues](#deployment-issues)
9. [Browser & Client Issues](#browser--client-issues)
10. [Frequently Asked Questions](#frequently-asked-questions)

## Quick Diagnostics

### System Health Check

Before diving into specific issues, run these quick checks:

```bash
# Check application health
curl http://localhost:3000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-07T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "cache": "healthy",
    "ai_service": "healthy"
  }
}
```

### Environment Verification

```bash
# Check environment variables
npm run check-env

# Verify Node.js version
node --version  # Should be 18+ or 20+

# Check npm version
npm --version   # Should be 8+

# Verify dependencies
npm list --depth=0
```

### Log Analysis

```bash
# View application logs
npm run logs

# View database logs
docker logs learning-assistant-postgres

# View Redis logs
docker logs learning-assistant-redis
```

## Installation & Setup Issues

### Issue: `npm install` Fails

**Symptoms:**
- Package installation errors
- Dependency conflicts
- Permission denied errors

**Solutions:**

1. **Clear npm cache:**
   ```bash
   npm cache clean --force
   rm -rf node_modules
   rm package-lock.json
   npm install --legacy-peer-deps
   ```

2. **Fix permission issues (macOS/Linux):**
   ```bash
   # Change npm permissions
   sudo chown -R $(whoami) ~/.npm
   sudo chown -R $(whoami) /usr/local/lib/node_modules
   ```

3. **Use correct Node.js version:**
   ```bash
   # Install and use Node.js 20.x
   nvm install 20
   nvm use 20
   npm install
   ```

4. **Alternative: Use yarn:**
   ```bash
   npm install -g yarn
   yarn install
   ```

### Issue: Database Migration Fails

**Symptoms:**
- Migration errors during setup
- "Database not found" errors
- Connection timeouts

**Solutions:**

1. **Ensure database is running:**
   ```bash
   # Start Docker services
   docker-compose -f docker-compose.dev.yml up -d
   
   # Check database status
   docker ps | grep postgres
   ```

2. **Verify database connection:**
   ```bash
   # Test connection
   psql "postgresql://postgres:password@localhost:5432/learning_assistant"
   ```

3. **Reset database:**
   ```bash
   npm run db:reset
   npm run db:migrate
   npm run db:seed
   ```

4. **Check database permissions:**
   ```sql
   -- Connect to PostgreSQL as superuser
   \l -- List databases
   \du -- List users and permissions
   
   -- Grant permissions if needed
   GRANT ALL PRIVILEGES ON DATABASE learning_assistant TO postgres;
   ```

### Issue: Environment Variables Not Loading

**Symptoms:**
- "Missing environment variable" errors
- Configuration not applied
- Default values used instead of custom settings

**Solutions:**

1. **Verify .env file location:**
   ```bash
   # Ensure .env.local exists in project root
   ls -la .env*
   
   # Copy from example if missing
   cp .env.example .env.local
   ```

2. **Check .env file format:**
   ```bash
   # Verify no spaces around = and quotes around values with spaces
   DATABASE_URL="postgresql://user:pass@localhost:5432/db"
   OPENAI_API_KEY=sk-your-key-here
   ```

3. **Restart development server:**
   ```bash
   # Stop and restart to reload environment
   npm run dev
   ```

4. **Debug environment loading:**
   ```typescript
   // Add to your page/component for debugging
   console.log('Environment check:', {
     NODE_ENV: process.env.NODE_ENV,
     DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING',
     OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING'
   });
   ```

## Authentication Problems

### Issue: Login Not Working

**Symptoms:**
- "Invalid credentials" errors
- Authentication redirects fail
- Session not persisting

**Solutions:**

1. **Verify Better Auth configuration:**
   ```typescript
   // Check src/lib/auth.ts
   export const auth = betterAuth({
     database: pool,
     emailAndPassword: {
       enabled: true,
     },
     session: {
       expiresIn: 60 * 60 * 24 * 7, // 7 days
     },
     secret: process.env.BETTER_AUTH_SECRET,
     baseURL: process.env.BETTER_AUTH_URL,
   });
   ```

2. **Check environment variables:**
   ```bash
   # Required for Better Auth
   BETTER_AUTH_SECRET="your-random-secret-key"
   BETTER_AUTH_URL="http://localhost:3000"
   ```

3. **Clear browser storage:**
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   // Clear cookies for localhost
   ```

4. **Test API endpoints:**
   ```bash
   # Test sign-in endpoint
   curl -X POST http://localhost:3000/api/auth/sign-in \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

### Issue: OAuth Login Fails

**Symptoms:**
- OAuth redirect errors
- "Configuration error" messages
- Third-party login buttons not working

**Solutions:**

1. **Verify OAuth provider setup:**
   ```bash
   # Google OAuth
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   
   # GitHub OAuth
   GITHUB_CLIENT_ID="your-github-client-id"
   GITHUB_CLIENT_SECRET="your-github-client-secret"
   ```

2. **Check callback URLs:**
   ```
   # In OAuth provider settings
   Callback URL: http://localhost:3000/api/auth/callback/google
   ```

3. **Test OAuth configuration:**
   ```bash
   # Navigate to OAuth login URL
   open http://localhost:3000/api/auth/oauth/google
   ```

### Issue: Session Expires Too Quickly

**Symptoms:**
- Frequent login prompts
- Session lost on page refresh
- "Session expired" messages

**Solutions:**

1. **Adjust session configuration:**
   ```typescript
   // In auth configuration
   session: {
     expiresIn: 60 * 60 * 24 * 30, // 30 days
     updateAge: 60 * 60 * 24, // Update every day
   }
   ```

2. **Check cookie settings:**
   ```typescript
   // Ensure secure cookie settings
   cookies: {
     sessionToken: {
       name: "session",
       options: {
         httpOnly: true,
         sameSite: "lax",
         path: "/",
         secure: process.env.NODE_ENV === "production",
       },
     },
   }
   ```

## Database Connection Issues

### Issue: "Database Connection Failed"

**Symptoms:**
- Unable to connect to database
- Connection timeout errors
- Pool connection errors

**Solutions:**

1. **Verify database is running:**
   ```bash
   # Check Docker containers
   docker ps | grep postgres
   
   # Start if not running
   docker-compose -f docker-compose.dev.yml up -d postgres
   ```

2. **Test direct connection:**
   ```bash
   # Test with psql
   psql "postgresql://postgres:password@localhost:5432/learning_assistant"
   
   # Test with Node.js
   node -e "
   const { Pool } = require('pg');
   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   pool.query('SELECT NOW()', (err, res) => {
     console.log(err ? err : res.rows[0]);
     pool.end();
   });
   "
   ```

3. **Check connection string format:**
   ```bash
   # Correct format
   DATABASE_URL="postgresql://username:password@hostname:port/database_name"
   
   # Example
   DATABASE_URL="postgresql://postgres:password@localhost:5432/learning_assistant"
   ```

4. **Verify network connectivity:**
   ```bash
   # Test port accessibility
   telnet localhost 5432
   
   # Check if port is in use
   lsof -i :5432
   ```

### Issue: Migration Errors

**Symptoms:**
- "Migration failed" errors
- SQL syntax errors during migration
- Schema out of sync

**Solutions:**

1. **Check migration files:**
   ```bash
   # List migration files
   ls -la src/lib/database/migrations/sql/
   
   # Verify SQL syntax
   cat src/lib/database/migrations/sql/20250106000001_initial_schema.sql
   ```

2. **Run migrations manually:**
   ```bash
   # Reset and re-run migrations
   npm run db:reset
   npm run db:migrate
   
   # Check migration status
   npm run db:status
   ```

3. **Fix schema conflicts:**
   ```sql
   -- Connect to database and check tables
   \dt
   
   -- Drop and recreate if needed
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

### Issue: Query Performance Problems

**Symptoms:**
- Slow database queries
- Application timeouts
- High CPU usage

**Solutions:**

1. **Enable query logging:**
   ```sql
   -- Enable slow query logging
   ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s
   SELECT pg_reload_conf();
   ```

2. **Analyze query performance:**
   ```sql
   -- Check running queries
   SELECT * FROM pg_stat_activity WHERE state = 'active';
   
   -- Analyze specific query
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
   ```

3. **Add missing indexes:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_users_email ON users(email);
   CREATE INDEX idx_sessions_user_id ON learning_sessions(user_id);
   CREATE INDEX idx_progress_user_id ON user_progress(user_id);
   ```

## API & Network Issues

### Issue: API Requests Failing

**Symptoms:**
- 500 Internal Server Error
- Network connection errors
- CORS errors

**Solutions:**

1. **Check API health:**
   ```bash
   # Test health endpoint
   curl http://localhost:3000/api/health
   
   # Test specific endpoint
   curl -X GET http://localhost:3000/api/learning/profile \
     -H "Cookie: session=your-session-id"
   ```

2. **Verify CORS configuration:**
   ```typescript
   // Check next.config.js
   module.exports = {
     async headers() {
       return [
         {
           source: '/api/:path*',
           headers: [
             { key: 'Access-Control-Allow-Origin', value: '*' },
             { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
           ],
         },
       ];
     },
   };
   ```

3. **Check middleware configuration:**
   ```typescript
   // Verify middleware.ts
   export function middleware(request: NextRequest) {
     // Ensure proper middleware chain
   }
   ```

### Issue: CSRF Token Errors

**Symptoms:**
- "Invalid CSRF token" errors
- POST requests failing
- 403 Forbidden errors

**Solutions:**

1. **Verify CSRF implementation:**
   ```typescript
   // Check CSRF token generation
   const csrfResponse = await fetch('/api/csrf');
   const { token } = await csrfResponse.json();
   
   // Include in requests
   const response = await fetch('/api/learning/profile', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'X-CSRF-Token': token
     },
     body: JSON.stringify(data)
   });
   ```

2. **Debug CSRF token:**
   ```typescript
   // Log CSRF token for debugging
   console.log('CSRF Token:', token);
   console.log('Request headers:', headers);
   ```

### Issue: Rate Limiting Errors

**Symptoms:**
- "Too Many Requests" (429) errors
- Temporary API blocks
- Slow response times

**Solutions:**

1. **Check rate limit headers:**
   ```bash
   # Check rate limit status
   curl -I http://localhost:3000/api/learning/profile
   # Look for X-RateLimit-* headers
   ```

2. **Implement retry logic:**
   ```typescript
   async function apiRequestWithRetry(url: string, options: RequestInit, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       const response = await fetch(url, options);
       
       if (response.status !== 429) {
         return response;
       }
       
       const retryAfter = response.headers.get('Retry-After');
       const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
       
       await new Promise(resolve => setTimeout(resolve, delay));
     }
     
     throw new Error('Max retries exceeded');
   }
   ```

## Performance Problems

### Issue: Slow Application Loading

**Symptoms:**
- Long initial load times
- Slow page transitions
- High memory usage

**Solutions:**

1. **Analyze bundle size:**
   ```bash
   # Generate bundle analysis
   npm run analyze
   
   # Check for large dependencies
   npx webpack-bundle-analyzer .next/static/chunks/*.js
   ```

2. **Optimize images and assets:**
   ```typescript
   // Use Next.js Image component
   import Image from 'next/image';
   
   <Image
     src="/large-image.jpg"
     alt="Description"
     width={800}
     height={600}
     priority={false} // Only for above-fold images
   />
   ```

3. **Implement code splitting:**
   ```typescript
   // Lazy load components
   import dynamic from 'next/dynamic';
   
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <div>Loading...</div>,
   });
   ```

4. **Enable caching:**
   ```typescript
   // Add caching headers
   export async function GET() {
     return new Response(data, {
       headers: {
         'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
       },
     });
   }
   ```

### Issue: High Memory Usage

**Symptoms:**
- Application crashes
- Out of memory errors
- Slow garbage collection

**Solutions:**

1. **Monitor memory usage:**
   ```typescript
   // Add memory monitoring
   setInterval(() => {
     const used = process.memoryUsage();
     console.log('Memory usage:', {
       heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
       heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB',
       external: Math.round(used.external / 1024 / 1024) + ' MB'
     });
   }, 30000);
   ```

2. **Fix memory leaks:**
   ```typescript
   // Properly cleanup event listeners
   useEffect(() => {
     const handler = () => { /* handle event */ };
     window.addEventListener('resize', handler);
     
     return () => {
       window.removeEventListener('resize', handler);
     };
   }, []);
   
   // Cancel API requests
   useEffect(() => {
     const controller = new AbortController();
     
     fetch('/api/data', { signal: controller.signal })
       .then(response => response.json())
       .then(data => setData(data));
     
     return () => controller.abort();
   }, []);
   ```

3. **Optimize database connections:**
   ```typescript
   // Use connection pooling
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20, // Maximum pool size
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

## AI/Chat Integration Issues

### Issue: OpenAI API Errors

**Symptoms:**
- "API key invalid" errors
- Rate limit exceeded
- Model not found errors

**Solutions:**

1. **Verify API key:**
   ```bash
   # Test API key
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

2. **Check rate limits:**
   ```typescript
   // Implement retry with exponential backoff
   async function callOpenAI(prompt: string, retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         const response = await openai.chat.completions.create({
           model: "gpt-3.5-turbo",
           messages: [{ role: "user", content: prompt }],
         });
         return response;
       } catch (error) {
         if (error.status === 429 && i < retries - 1) {
           await new Promise(resolve => 
             setTimeout(resolve, Math.pow(2, i) * 1000)
           );
           continue;
         }
         throw error;
       }
     }
   }
   ```

3. **Handle model errors:**
   ```typescript
   // Fallback to different models
   const models = ['gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'];
   
   for (const model of models) {
     try {
       const response = await openai.chat.completions.create({
         model,
         messages: [{ role: "user", content: prompt }],
       });
       return response;
     } catch (error) {
       if (error.status === 404) continue; // Try next model
       throw error;
     }
   }
   ```

### Issue: Chat Messages Not Saving

**Symptoms:**
- Messages disappear on refresh
- Chat history not persisting
- Database insertion errors

**Solutions:**

1. **Check database schema:**
   ```sql
   -- Verify chat tables exist
   \d chat_sessions
   \d chat_messages
   
   -- Check for foreign key constraints
   SELECT * FROM information_schema.table_constraints 
   WHERE table_name IN ('chat_sessions', 'chat_messages');
   ```

2. **Debug message saving:**
   ```typescript
   // Add logging to chat service
   export async function saveChatMessage(message: ChatMessage) {
     try {
       console.log('Saving message:', message);
       const result = await pool.query(
         'INSERT INTO chat_messages (session_id, content, role) VALUES ($1, $2, $3) RETURNING *',
         [message.sessionId, message.content, message.role]
       );
       console.log('Message saved:', result.rows[0]);
       return result.rows[0];
     } catch (error) {
       console.error('Error saving message:', error);
       throw error;
     }
   }
   ```

3. **Verify session management:**
   ```typescript
   // Ensure chat session exists before saving messages
   const session = await getChatSession(sessionId);
   if (!session) {
     throw new Error('Chat session not found');
   }
   ```

## Deployment Issues

### Issue: Build Failures

**Symptoms:**
- TypeScript compilation errors
- Missing dependencies
- Build timeouts

**Solutions:**

1. **Fix TypeScript errors:**
   ```bash
   # Run type check
   npm run type-check
   
   # Fix strict mode issues
   npx tsc --noEmit --strict
   ```

2. **Update dependencies:**
   ```bash
   # Update all dependencies
   npm update
   
   # Check for security vulnerabilities
   npm audit fix
   ```

3. **Optimize build process:**
   ```typescript
   // next.config.js optimizations
   module.exports = {
     experimental: {
       optimizeCss: true,
       optimizeServerReact: true,
     },
     compiler: {
       removeConsole: process.env.NODE_ENV === 'production',
     },
   };
   ```

### Issue: Environment Variables in Production

**Symptoms:**
- Configuration not loading
- Default values used in production
- Secrets not accessible

**Solutions:**

1. **Verify platform-specific configuration:**
   ```bash
   # Fly.io
   fly secrets list
   fly secrets set OPENAI_API_KEY=sk-...
   
   # Render
   # Set via dashboard or CLI
   
   # Railway
   railway variables set OPENAI_API_KEY=sk-...
   ```

2. **Check environment variable naming:**
   ```bash
   # Ensure no conflicting variable names
   # Check platform documentation for reserved names
   ```

3. **Test environment in production:**
   ```typescript
   // Add debug endpoint (remove after testing)
   export async function GET() {
     return new Response(JSON.stringify({
       nodeEnv: process.env.NODE_ENV,
       hasDbUrl: !!process.env.DATABASE_URL,
       hasApiKey: !!process.env.OPENAI_API_KEY,
     }));
   }
   ```

### Issue: Database Connection in Production

**Symptoms:**
- Cannot connect to production database
- SSL connection errors
- Connection pool exhaustion

**Solutions:**

1. **Verify SSL configuration:**
   ```typescript
   // For production databases
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production' ? {
       rejectUnauthorized: false
     } : false
   });
   ```

2. **Check connection limits:**
   ```sql
   -- Check current connections
   SELECT count(*) FROM pg_stat_activity;
   
   -- Check connection limit
   SHOW max_connections;
   ```

3. **Configure connection pooling:**
   ```typescript
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 10, // Limit concurrent connections
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

## Browser & Client Issues

### Issue: JavaScript Errors in Browser

**Symptoms:**
- Console errors
- Broken functionality
- White screen of death

**Solutions:**

1. **Check browser console:**
   ```javascript
   // Open browser dev tools (F12)
   // Look for errors in Console tab
   // Check Network tab for failed requests
   ```

2. **Verify browser compatibility:**
   ```typescript
   // Check if modern features are supported
   if (!window.fetch) {
     console.error('Fetch API not supported');
   }
   
   if (!window.Promise) {
     console.error('Promises not supported');
   }
   ```

3. **Clear browser cache:**
   ```bash
   # Hard refresh
   Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
   
   # Clear all browser data
   # Browser Settings > Privacy > Clear browsing data
   ```

### Issue: Responsive Design Problems

**Symptoms:**
- Layout breaks on mobile
- Text too small
- Touch targets too small

**Solutions:**

1. **Check viewport meta tag:**
   ```html
   <!-- Ensure in layout.tsx -->
   <meta name="viewport" content="width=device-width, initial-scale=1" />
   ```

2. **Test responsive breakpoints:**
   ```css
   /* Verify Tailwind breakpoints */
   .container {
     @apply w-full px-4;
     @apply sm:max-w-sm sm:px-6;
     @apply md:max-w-md md:px-8;
     @apply lg:max-w-lg lg:px-10;
   }
   ```

3. **Use browser dev tools:**
   ```
   1. Open dev tools (F12)
   2. Click device toggle (mobile icon)
   3. Test different screen sizes
   4. Check touch target sizes (minimum 44px)
   ```

### Issue: Accessibility Problems

**Symptoms:**
- Screen reader not working
- Keyboard navigation broken
- Low contrast warnings

**Solutions:**

1. **Run accessibility audit:**
   ```bash
   # Install axe-core for testing
   npm install --save-dev @axe-core/react
   
   # Run lighthouse accessibility audit
   npm run lighthouse
   ```

2. **Fix common issues:**
   ```tsx
   // Add proper ARIA labels
   <button aria-label="Close dialog">×</button>
   
   // Ensure form labels
   <label htmlFor="email">Email</label>
   <input id="email" type="email" />
   
   // Add focus indicators
   .focus:focus {
     @apply ring-2 ring-blue-500 ring-offset-2;
   }
   ```

3. **Test with keyboard navigation:**
   ```
   1. Tab through all interactive elements
   2. Ensure proper focus order
   3. Test Escape key for modals
   4. Test Enter/Space for buttons
   ```

## Frequently Asked Questions

### Q: How do I reset my development environment?

**A:** Complete reset process:
```bash
# Stop all services
docker-compose down -v

# Clean npm
rm -rf node_modules package-lock.json
npm cache clean --force

# Reinstall dependencies
npm install --legacy-peer-deps

# Reset database
npm run db:reset
npm run db:migrate
npm run db:seed

# Restart services
docker-compose -f docker-compose.dev.yml up -d
npm run dev
```

### Q: Why is my application slow?

**A:** Common performance issues:
1. **Bundle size**: Run `npm run analyze` to check
2. **Database queries**: Enable query logging
3. **Memory leaks**: Monitor memory usage
4. **Network requests**: Minimize API calls
5. **Images**: Use Next.js Image component

### Q: How do I debug authentication issues?

**A:** Authentication debugging steps:
1. Check environment variables (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
2. Verify database tables exist
3. Test API endpoints directly
4. Clear browser storage
5. Check server logs

### Q: What should I do if the build fails in production?

**A:** Build failure troubleshooting:
1. Run `npm run build` locally first
2. Fix all TypeScript errors
3. Update dependencies
4. Check platform-specific requirements
5. Verify environment variables

### Q: How do I monitor application health?

**A:** Health monitoring setup:
1. Use `/api/health` endpoint
2. Set up monitoring alerts
3. Monitor database connections
4. Track error rates
5. Monitor response times

### Q: Why aren't my environment variables working?

**A:** Environment variable checklist:
1. Correct file name (`.env.local` for Next.js)
2. No spaces around `=`
3. Quotes for values with spaces
4. Restart development server
5. Check platform-specific configuration

### Q: How do I handle CORS errors?

**A:** CORS configuration:
1. Add proper headers in `next.config.js`
2. Configure middleware correctly
3. Use correct origins in production
4. Test with browser dev tools

### Q: What's the best way to report bugs?

**A:** Bug reporting best practices:
1. Include error messages
2. Provide steps to reproduce
3. Include browser/OS information
4. Add relevant logs
5. Use GitHub issues template

## Getting Help

### Support Channels

1. **Documentation**: Start with relevant guides
2. **GitHub Issues**: For bugs and feature requests
3. **Discussions**: For questions and community help
4. **Discord**: Real-time community support
5. **Email**: For sensitive issues

### Before Asking for Help

1. **Search existing issues**: Check if already reported
2. **Try troubleshooting**: Follow relevant sections
3. **Gather information**: Error messages, logs, steps
4. **Create minimal reproduction**: Isolate the issue
5. **Check dependencies**: Ensure all up to date

### Information to Include

When seeking help, always include:
- Operating system and version
- Node.js and npm versions
- Browser (if client-side issue)
- Error messages and stack traces
- Steps to reproduce
- Expected vs actual behavior
- Environment (development/production)

---

*Last Updated: 2025-01-07*
*Version: 1.0.0*