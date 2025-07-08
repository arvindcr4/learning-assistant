# Developer Guide

Welcome to the Learning Assistant development environment! This comprehensive guide will help you get started with developing, testing, and deploying the Learning Assistant platform.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Development Environment Setup](#development-environment-setup)
3. [Architecture Overview](#architecture-overview)
4. [API Development](#api-development)
5. [Frontend Development](#frontend-development)
6. [Testing Strategy](#testing-strategy)
7. [Security Guidelines](#security-guidelines)
8. [Deployment Process](#deployment-process)
9. [Troubleshooting](#troubleshooting)
10. [Contributing Guidelines](#contributing-guidelines)

## Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js 20.x+** - [Download](https://nodejs.org/)
- **npm 10.x+** or **yarn 4.x+**
- **Git** - [Download](https://git-scm.com/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/)
- **PostgreSQL 15+** (or use Docker)
- **Redis 7+** (or use Docker)

### 30-Second Setup

```bash
# Clone the repository
git clone <repository-url>
cd learning-assistant

# Run automated setup
./scripts/dev-setup.sh

# Start development server
npm run dev
```

### Manual Setup

If you prefer manual setup or the automated script fails:

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Copy environment configuration
cp .env.example .env.local

# 3. Start database services
docker-compose -f docker-compose.dev.yml up -d

# 4. Run database migrations
npm run db:migrate
npm run db:seed

# 5. Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Development Environment Setup

### Environment Variables

Create a `.env.local` file with the following configuration:

```bash
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Authentication
BETTER_AUTH_SECRET=your-development-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://learning_user:learning_pass@localhost:5432/learning_assistant_dev
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=your-openai-api-key

# Email (Development - using Mailhog)
EMAIL_SERVER_HOST=localhost
EMAIL_SERVER_PORT=1025
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=noreply@localhost

# Monitoring (Optional)
SENTRY_DSN=your-sentry-dsn
MONITORING_ENABLED=true
```

### Development Services

The development environment includes several services:

```yaml
# docker-compose.dev.yml services
services:
  - postgres:5432    # PostgreSQL database
  - redis:6379       # Redis cache
  - mailhog:8025     # Email testing UI
  - adminer:8080     # Database admin UI
```

Start all services:
```bash
docker-compose -f docker-compose.dev.yml up -d
```

### IDE Configuration

#### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.workingDirectories": ["src"],
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/coverage": true
  }
}
```

#### Recommended Extensions

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-jest",
    "ms-playwright.playwright",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-json"
  ]
}
```

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App Router │ React Components │ TypeScript │ Tailwind  │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  Route Handlers │ Middleware │ Authentication │ Rate Limiting   │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                         │
├─────────────────────────────────────────────────────────────────┤
│  Learning Engine │ Style Detection │ Pace Adapter │ Analytics   │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL │ Redis Cache │ File Storage │ Vector Database      │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
learning-assistant/
├── app/                     # Next.js App Router
│   ├── api/                # API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── learning/       # Learning-specific endpoints
│   │   ├── analytics/      # Analytics endpoints
│   │   └── health/         # Health check endpoints
│   ├── docs/               # API documentation
│   ├── dashboard/          # Dashboard pages
│   └── layout.tsx          # Root layout
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # Reusable UI components
│   │   ├── features/      # Feature-specific components
│   │   └── interactive/   # Interactive learning components
│   ├── lib/               # Core libraries and utilities
│   │   ├── database/      # Database configuration
│   │   ├── auth/          # Authentication logic
│   │   ├── learning-engine/ # AI learning algorithms
│   │   └── validation/    # Input validation
│   ├── services/          # External API integrations
│   ├── hooks/             # Custom React hooks
│   ├── contexts/          # React context providers
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── __tests__/             # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── e2e/               # End-to-end tests
│   └── performance/       # Performance tests
├── docs/                  # Documentation
│   ├── api/               # API documentation
│   ├── architecture/      # Architecture docs
│   └── deployment/        # Deployment guides
├── scripts/               # Build and deployment scripts
└── config/                # Configuration files
```

### Key Technologies

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session and application caching
- **Authentication**: Better Auth with JWT
- **Testing**: Jest, Playwright, Testing Library
- **AI**: OpenAI GPT integration
- **Monitoring**: Custom analytics with Sentry integration
- **Deployment**: Docker, multi-platform support

## API Development

### Creating New API Endpoints

1. **Create the route file** in `app/api/[feature]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withSecureAuth, AuthenticatedRequest } from '@/middleware/secure-auth';
import { csrfProtection } from '@/lib/csrf';
import { z } from 'zod';

// Request validation schema
const CreateItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

async function handleGET(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    
    // Your business logic here
    const items = await getItemsForUser(user.id);
    
    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('GET /api/items error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}

async function handlePOST(request: AuthenticatedRequest): Promise<NextResponse> {
  try {
    const user = request.user!;
    
    // Validate CSRF token for state-changing operations
    const csrfToken = csrfProtection.getTokenFromRequest(request);
    if (!csrfToken || !csrfProtection.validateToken(csrfToken, user.sessionId)) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validatedData = CreateItemSchema.parse(body);
    
    // Your business logic here
    const newItem = await createItem(user.id, validatedData);
    
    return NextResponse.json({
      success: true,
      data: newItem,
      message: 'Item created successfully',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('POST /api/items error:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}

// Export with authentication and rate limiting
export const GET = withSecureAuth(handleGET, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 100,
    maxRequestsPerIP: 50,
    windowMs: 60000,
  },
});

export const POST = withSecureAuth(handlePOST, {
  requiredRoles: ['user', 'admin'],
  rateLimits: {
    maxRequestsPerUser: 50,
    maxRequestsPerIP: 25,
    windowMs: 60000,
  },
});
```

2. **Add to OpenAPI specification** in `docs/api/openapi.yml`:

```yaml
/items:
  get:
    tags:
      - Items
    summary: Get user items
    description: Retrieve items for the authenticated user
    operationId: getItems
    security:
      - BearerAuth: []
    responses:
      '200':
        description: Items retrieved successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ItemsResponse'
  post:
    tags:
      - Items
    summary: Create new item
    description: Create a new item for the authenticated user
    operationId: createItem
    security:
      - BearerAuth: []
    parameters:
      - name: X-CSRF-Token
        in: header
        required: true
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateItemRequest'
    responses:
      '201':
        description: Item created successfully
```

### Authentication & Authorization

All API endpoints should use the `withSecureAuth` middleware:

```typescript
export const GET = withSecureAuth(handleGET, {
  requiredRoles: ['user', 'admin'],        // Required user roles
  rateLimits: {                            // Rate limiting configuration
    maxRequestsPerUser: 100,               // Per-user limits
    maxRequestsPerIP: 50,                  // Per-IP limits  
    windowMs: 60000,                       // Time window (1 minute)
  },
  validateInput: true,                     // Enable input validation
  auditLog: true,                          // Enable audit logging
});
```

### Error Handling

Use consistent error responses:

```typescript
// Success response
return NextResponse.json({
  success: true,
  data: result,
  message: 'Operation completed successfully',
});

// Error response
return NextResponse.json({
  error: 'Error type',
  message: 'Human-readable error message',
  details: validationErrors, // Optional
  timestamp: new Date().toISOString(),
  requestId: generateRequestId(),
}, { status: 400 });
```

### Database Operations

Use the database connection pool for optimal performance:

```typescript
import { query } from '@/lib/database';

// Single query
const user = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
import { transaction } from '@/lib/database';

await transaction(async (client) => {
  await client.query('INSERT INTO users ...', [userData]);
  await client.query('INSERT INTO profiles ...', [profileData]);
});
```

## Frontend Development

### Component Development

Create reusable components following our design system:

```typescript
// src/components/ui/Button.tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base classes
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
```

### State Management

Use React Context for global state:

```typescript
// src/contexts/LearningContext.tsx
import React, { createContext, useContext, useReducer, ReactNode } from 'react';

interface LearningState {
  currentSession: LearningSession | null;
  progress: LearningProgress;
  preferences: LearningPreferences;
  isLoading: boolean;
}

type LearningAction = 
  | { type: 'START_SESSION'; payload: LearningSession }
  | { type: 'UPDATE_PROGRESS'; payload: Partial<LearningProgress> }
  | { type: 'SET_LOADING'; payload: boolean };

const LearningContext = createContext<{
  state: LearningState;
  dispatch: React.Dispatch<LearningAction>;
} | null>(null);

function learningReducer(state: LearningState, action: LearningAction): LearningState {
  switch (action.type) {
    case 'START_SESSION':
      return { ...state, currentSession: action.payload, isLoading: false };
    case 'UPDATE_PROGRESS':
      return { ...state, progress: { ...state.progress, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(learningReducer, {
    currentSession: null,
    progress: { completedLessons: 0, totalLessons: 0, averageScore: 0 },
    preferences: { difficulty: 'intermediate', pace: 'normal', subjects: [] },
    isLoading: false,
  });

  return (
    <LearningContext.Provider value={{ state, dispatch }}>
      {children}
    </LearningContext.Provider>
  );
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) {
    throw new Error('useLearning must be used within a LearningProvider');
  }
  return context;
}
```

### Custom Hooks

Create reusable hooks for common functionality:

```typescript
// src/hooks/useApi.ts
import { useState, useEffect } from 'react';
import { ApiResponse } from '@/types';

interface UseApiOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useApi<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  options: UseApiOptions = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiCall();
      
      if (response.success) {
        setData(response.data);
        options.onSuccess?.(response.data);
      } else {
        setError(response.error || 'Unknown error');
        options.onError?.(response.error || 'Unknown error');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error';
      setError(errorMessage);
      options.onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.immediate) {
      execute();
    }
  }, []);

  return { data, loading, error, execute, refetch: execute };
}
```

## Testing Strategy

### Test Structure

Our testing strategy includes multiple layers:

```
Testing Pyramid:
├── Unit Tests (70%)          - Individual functions and components
├── Integration Tests (20%)   - API endpoints and service integration
├── E2E Tests (10%)          - Full user workflows
├── Accessibility Tests      - WCAG compliance
└── Performance Tests        - Load and speed testing
```

### Unit Testing

Use Jest and Testing Library for unit tests:

```typescript
// __tests__/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies correct variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive');
  });
});
```

### Integration Testing

Test API endpoints with real database connections:

```typescript
// __tests__/integration/api/learning/profile.test.ts
import { testApiHandler } from 'next-test-api-route-handler';
import handler from '@/app/api/learning/profile/route';
import { createTestUser, cleanupTestData } from '@/lib/test-utils';

describe('/api/learning/profile', () => {
  let testUser: TestUser;

  beforeEach(async () => {
    testUser = await createTestUser();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('GET returns user profile', async () => {
    await testApiHandler({
      handler,
      url: '/api/learning/profile',
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      test: async ({ fetch }) => {
        const response = await fetch();
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.userId).toBe(testUser.id);
      },
    });
  });
});
```

### E2E Testing

Use Playwright for end-to-end testing:

```typescript
// __tests__/e2e/learning-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Learning Flow', () => {
  test('user can complete a learning session', async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="submit"]');

    // Navigate to learning dashboard
    await page.waitForURL('/dashboard');
    await page.click('[data-testid="start-learning"]');

    // Complete learning session
    await page.waitForSelector('[data-testid="learning-content"]');
    await page.click('[data-testid="next-question"]');
    await page.fill('[data-testid="answer-input"]', 'Test answer');
    await page.click('[data-testid="submit-answer"]');

    // Verify completion
    await expect(page.locator('[data-testid="session-complete"]')).toBeVisible();
    await expect(page.locator('[data-testid="score"]')).toContainText('%');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end tests
npm run test:accessibility # Accessibility tests
npm run test:performance   # Performance tests

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

## Security Guidelines

### Input Validation

Always validate and sanitize inputs:

```typescript
import { z } from 'zod';
import { validateInput } from '@/lib/validation';

const UserSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/),
  email: z.string().email(),
  age: z.number().min(13).max(120),
});

// In your API handler
const validatedData = validateInput(UserSchema, requestBody);
```

### Authentication

Use the secure authentication middleware:

```typescript
import { withSecureAuth } from '@/middleware/secure-auth';

export const GET = withSecureAuth(handler, {
  requiredRoles: ['user'],
  rateLimits: {
    maxRequestsPerUser: 100,
    windowMs: 60000,
  },
});
```

### CSRF Protection

Protect state-changing operations:

```typescript
import { csrfProtection } from '@/lib/csrf';

// Validate CSRF token
const csrfToken = csrfProtection.getTokenFromRequest(request);
if (!csrfToken || !csrfProtection.validateToken(csrfToken, user.sessionId)) {
  return NextResponse.json(
    { error: 'Invalid CSRF token' },
    { status: 403 }
  );
}
```

### Security Headers

Security headers are automatically applied via middleware:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}
```

## Deployment Process

### Environment Setup

1. **Development**
   ```bash
   npm run dev
   ```

2. **Staging**
   ```bash
   npm run build
   npm run start
   ```

3. **Production**
   ```bash
   npm run build:production
   npm run start
   ```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
```

### Platform-Specific Deployment

We provide deployment scripts for multiple platforms:

- **Vercel**: `npm run deploy:vercel`
- **Railway**: `./deploy/platforms/railway.sh`
- **Render**: `./deploy/platforms/render.sh`
- **Fly.io**: `./deploy/platforms/fly.sh`
- **DigitalOcean**: `./deploy/platforms/digitalocean.sh`

### Database Migrations

```bash
# Run migrations
npm run db:migrate

# Check migration status
npm run db:status

# Rollback last migration
npm run db:rollback
```

## Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check connection string
echo $DATABASE_URL

# Test connection
npm run db:status
```

#### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec -it learning-assistant-redis redis-cli ping
```

#### Authentication Issues

```bash
# Verify JWT secret is set
echo $BETTER_AUTH_SECRET

# Check user session
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/auth/me
```

#### Performance Issues

```bash
# Check memory usage
npm run analyze

# Run performance tests
npm run test:performance

# Check for memory leaks
npm run lighthouse
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=learning-assistant:* npm run dev
```

### Health Checks

Monitor system health:

```bash
# Check system health
curl http://localhost:3000/api/health

# Check specific component
curl http://localhost:3000/api/health/database
```

## Contributing Guidelines

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Commit Convention

Use conventional commits:

```
feat: add new learning analytics dashboard
fix: resolve authentication token expiration issue
docs: update API documentation for learning endpoints
test: add integration tests for user profile management
refactor: optimize database query performance
style: update button component styling
chore: update dependencies to latest versions
```

### Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write tests for new functionality
   - Update documentation
   - Follow code style guidelines

3. **Run the full test suite**
   ```bash
   npm run test:all
   npm run lint
   npm run type-check
   ```

4. **Create pull request**
   - Provide clear description
   - Link related issues
   - Add screenshots for UI changes

5. **Code review**
   - Address reviewer feedback
   - Ensure CI/CD checks pass
   - Update branch with latest main

### Development Workflow

```bash
# 1. Pull latest changes
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/new-feature

# 3. Make changes and commit
git add .
git commit -m "feat: implement new feature"

# 4. Push changes
git push origin feature/new-feature

# 5. Create pull request on GitHub
```

## Additional Resources

### Documentation

- [API Reference](http://localhost:3000/docs) - Interactive API documentation
- [Architecture Guide](./ARCHITECTURE.md) - Detailed system architecture
- [Deployment Guide](./deployment/README.md) - Production deployment instructions
- [Security Guide](./SECURITY_IMPLEMENTATION.md) - Security best practices

### Tools and Services

- **Development**: VS Code, Docker, PostgreSQL, Redis
- **Testing**: Jest, Playwright, Testing Library
- **Monitoring**: Sentry, Custom analytics
- **Deployment**: Vercel, Railway, Render, Fly.io
- **CI/CD**: GitHub Actions

### Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/learning-assistant/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/learning-assistant/discussions)
- **Documentation**: [Developer Wiki](https://github.com/your-repo/learning-assistant/wiki)

---

For more detailed information on specific topics, refer to the specialized documentation files in the `docs/` directory.