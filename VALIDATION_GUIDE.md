# Comprehensive Input Validation System

This guide explains how to use the comprehensive input validation system implemented across the learning assistant application.

## Overview

The validation system provides multiple layers of security and data integrity:

1. **Schema Validation** - Zod schemas for type-safe validation
2. **Sanitization** - Input cleaning to prevent XSS and injection attacks
3. **Rate Limiting** - Protection against abuse and brute force attacks
4. **Authentication** - Secure user verification
5. **Database Validation** - SQL injection prevention and constraint checking
6. **Error Handling** - Consistent, secure error responses

## Key Components

### 1. Validation Schemas (`/src/lib/validation/schemas.ts`)

Comprehensive Zod schemas for all data types:

```typescript
import { userRegistrationSchema, userLoginSchema } from '@/lib/validation/schemas';

// User registration with strong password requirements
const userData = {
  name: "John Doe",
  email: "john@example.com",
  password: "SecurePass123!",
  confirmPassword: "SecurePass123!",
  termsAccepted: true
};

const result = userRegistrationSchema.safeParse(userData);
```

**Available Schemas:**
- `userRegistrationSchema` - User signup with password strength validation
- `userLoginSchema` - User login credentials
- `learningSessionSchema` - Learning session data with business logic
- `chatMessageSchema` - Chat messages with content limits
- `assessmentSubmissionSchema` - Assessment answers with validation
- `contentSchema` - Learning content with rich text support

### 2. Sanitization (`/src/lib/validation/sanitization.ts`)

Input sanitization to prevent security vulnerabilities:

```typescript
import { sanitizeHtml, sanitizeText, sanitizeEmail } from '@/lib/validation/sanitization';

// HTML content sanitization (prevents XSS)
const safeHtml = sanitizeHtml(userInput, {
  allowedTags: ['p', 'br', 'strong', 'em'],
  maxLength: 5000
});

// Text sanitization
const safeText = sanitizeText(userInput, {
  maxLength: 200,
  allowSpecialChars: false
});

// Email sanitization
const safeEmail = sanitizeEmail(emailInput);
```

### 3. API Route Validation (`/src/middleware/validation.ts`)

Middleware for protecting API routes:

```typescript
import { withValidation } from '@/src/middleware/validation';
import { userRegistrationSchema } from '@/lib/validation/schemas';

export const POST = withValidation({
  bodySchema: userRegistrationSchema,
  rateLimiter: 'auth',
  sanitizeInputs: true,
  checkAbuse: true,
  requireAuth: false,
})(async (request: NextRequest) => {
  // Access validated data
  const userData = (request as any).validatedBody;
  
  // Your business logic here
  return createApiResponse(result);
});
```

### 4. Frontend Form Validation

React Hook Form with Zod integration:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userLoginSchema } from '@/lib/validation/schemas';

const LoginForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(userLoginSchema),
    mode: 'onChange'
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
    </form>
  );
};
```

### 5. Database Validation (`/src/lib/database/validation.ts`)

Secure database operations with parameterized queries:

```typescript
import { SecureDatabase } from '@/lib/database/validation';
import { userTableSchema } from '@/lib/database/validation';

const secureDb = new SecureDatabase(pool, {
  allowedTables: ['users', 'learning_sessions'],
  sanitizeInputs: true,
  logQueries: true
});

// Safe database insertion
const result = await secureDb.insert('users', userData, userTableSchema, userId);
```

### 6. Rate Limiting (`/src/lib/validation/rate-limiting.ts`)

Multiple rate limiters for different use cases:

```typescript
// Pre-configured rate limiters
- apiRateLimiter: 100 requests per 15 minutes
- authRateLimiter: 5 attempts per 15 minutes
- chatRateLimiter: 30 messages per minute
- assessmentRateLimiter: 10 submissions per hour

// Custom rate limiter
const customLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10,
  message: 'Custom rate limit message'
});
```

### 7. Error Handling (`/src/lib/error-handling/index.ts`)

Consistent error responses with security considerations:

```typescript
import { globalErrorHandler, ValidationError } from '@/lib/error-handling';

try {
  // Your code here
} catch (error) {
  return globalErrorHandler.handleError(error, {
    url: request.url,
    method: request.method,
    headers: request.headers,
    userId: user?.id
  });
}
```

## Implementation Examples

### 1. User Registration API Route

```typescript
// /app/api/auth/register/route.ts
export const POST = withValidation({
  bodySchema: userRegistrationSchema,
  rateLimiter: 'auth',
  sanitizeInputs: true,
  checkAbuse: true,
  requireAuth: false,
})(async (request: NextRequest) => {
  const userData = (request as any).validatedBody;
  
  // Business logic validation
  await validateBusinessRules(userData);
  
  // Check for existing user
  const existingUser = await checkUserExists(userData.email);
  if (existingUser) {
    throw new ConflictError('User already exists');
  }
  
  // Create user with hashed password
  const user = await createUser({
    ...userData,
    password_hash: await hashPassword(userData.password)
  });
  
  return createApiResponse(user, 'User created successfully', 201);
});
```

### 2. Learning Session Creation

```typescript
export const POST = withValidation({
  bodySchema: learningSessionSchema,
  rateLimiter: 'api',
  sanitizeInputs: true,
  requireAuth: true,
})(async (request: NextRequest) => {
  const sessionData = (request as any).validatedBody;
  const user = (request as any).user;
  
  // Validate session duration
  if (sessionData.endTime && sessionData.startTime) {
    const duration = new Date(sessionData.endTime) - new Date(sessionData.startTime);
    if (duration > 24 * 60 * 60 * 1000) { // 24 hours
      throw new ValidationError('Session duration cannot exceed 24 hours');
    }
  }
  
  const session = await createLearningSession({
    ...sessionData,
    userId: user.id
  });
  
  return createApiResponse(session);
});
```

### 3. Frontend Form with Real-time Validation

```typescript
const RegisterForm = () => {
  const { register, handleSubmit, formState: { errors, isValid }, watch } = useForm({
    resolver: zodResolver(userRegistrationSchema),
    mode: 'onChange'
  });

  const password = watch('password');
  
  const onSubmit = async (data) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input 
        {...register('email')} 
        type="email"
        placeholder="Email"
      />
      {errors.email && <span className="error">{errors.email.message}</span>}
      
      <input 
        {...register('password')} 
        type="password"
        placeholder="Password"
      />
      {errors.password && <span className="error">{errors.password.message}</span>}
      
      {/* Password strength indicator */}
      {password && <PasswordStrength password={password} />}
      
      <button type="submit" disabled={!isValid}>
        Register
      </button>
    </form>
  );
};
```

## Security Features

### 1. XSS Prevention
- HTML sanitization with DOMPurify
- Input encoding for special characters
- Content Security Policy headers

### 2. SQL Injection Prevention
- Parameterized queries only
- SQL pattern detection and blocking
- Input sanitization for SQL contexts

### 3. Rate Limiting & Abuse Prevention
- IP-based rate limiting
- User-based rate limiting
- Suspicious activity detection
- Automatic IP blocking

### 4. Authentication Security
- Secure password hashing with bcrypt
- JWT token validation
- Session management
- Password strength requirements

### 5. Data Validation
- Type safety with TypeScript and Zod
- Business rule validation
- Constraint checking
- Input length limits

## Configuration

### Environment Variables

```env
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_SPECIAL=true
SESSION_TIMEOUT=86400000

# Database
DB_QUERY_TIMEOUT=30000
DB_MAX_QUERY_LENGTH=10000

# Validation
SANITIZE_INPUTS=true
LOG_VALIDATION_ERRORS=true
INCLUDE_STACK_TRACES=false
```

### Customization

```typescript
// Custom validation middleware
const customValidation = withValidation({
  bodySchema: mySchema,
  rateLimiter: 'custom',
  sanitizeInputs: true,
  customValidation: async (request) => {
    // Your custom validation logic
    return true;
  }
});

// Custom rate limiter
const myRateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 50,
  keyGenerator: (request) => {
    // Custom key generation logic
    return `user:${getUserId(request)}`;
  }
});
```

## Testing

### Unit Tests

```typescript
describe('Validation Schemas', () => {
  it('should validate user registration data', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'SecurePass123!',
      confirmPassword: 'SecurePass123!',
      termsAccepted: true
    };
    
    const result = userRegistrationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
  
  it('should reject weak passwords', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: '123',
      confirmPassword: '123',
      termsAccepted: true
    };
    
    const result = userRegistrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('API Validation', () => {
  it('should register user with valid data', async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validUserData)
    });
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
  
  it('should reject invalid data', async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidUserData)
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Monitoring and Logging

### Security Events

```typescript
// Failed login attempts
console.log('[SECURITY_EVENT]', {
  type: 'failed_login',
  email: sanitizedEmail,
  ip: clientIp,
  timestamp: new Date().toISOString(),
  userAgent: request.headers.get('user-agent')
});

// Rate limit violations
console.log('[RATE_LIMIT_VIOLATION]', {
  ip: clientIp,
  endpoint: request.url,
  attempts: rateLimitInfo.attempts,
  timestamp: new Date().toISOString()
});

// Suspicious activity
console.log('[SUSPICIOUS_ACTIVITY]', {
  type: 'sql_injection_attempt',
  ip: clientIp,
  payload: sanitizedPayload,
  timestamp: new Date().toISOString()
});
```

### Performance Monitoring

```typescript
// Validation performance
const startTime = performance.now();
const result = schema.safeParse(data);
const duration = performance.now() - startTime;

if (duration > 100) { // Log slow validations
  console.warn('[SLOW_VALIDATION]', {
    schema: schema.constructor.name,
    duration,
    dataSize: JSON.stringify(data).length
  });
}
```

## Best Practices

### 1. Always Validate Input
- Validate on both client and server side
- Use the same schemas for consistency
- Never trust client-side validation alone

### 2. Sanitize User Content
- Sanitize before storing in database
- Sanitize before displaying to users
- Use context-appropriate sanitization

### 3. Implement Defense in Depth
- Multiple validation layers
- Rate limiting at different levels
- Authentication and authorization checks

### 4. Log Security Events
- Failed authentication attempts
- Rate limit violations
- Suspicious input patterns
- Validation failures

### 5. Handle Errors Gracefully
- Don't expose sensitive information
- Provide helpful error messages
- Log detailed errors for debugging
- Return consistent error formats

### 6. Regular Security Updates
- Keep validation libraries updated
- Review and update validation rules
- Monitor for new attack patterns
- Test validation effectiveness

## Troubleshooting

### Common Issues

1. **Validation Errors in Development**
   - Check schema definitions
   - Verify data types match expectations
   - Review error messages for specific issues

2. **Rate Limiting Issues**
   - Check if IP is correctly identified
   - Verify rate limit configuration
   - Consider user-based limits for authenticated users

3. **Sanitization Problems**
   - Test with various input types
   - Check if allowed tags/attributes are correct
   - Verify encoding is working properly

4. **Performance Issues**
   - Profile validation performance
   - Consider caching compiled schemas
   - Optimize complex validation rules

### Debug Mode

```typescript
// Enable detailed validation logging
const debugValidation = process.env.NODE_ENV === 'development';

if (debugValidation) {
  console.log('[VALIDATION_DEBUG]', {
    schema: schemaName,
    input: sanitizedInput,
    result: validationResult,
    errors: validationErrors
  });
}
```

This comprehensive validation system provides robust security and data integrity for the learning assistant application while maintaining good user experience and performance.