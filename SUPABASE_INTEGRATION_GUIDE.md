# Supabase Integration Guide - Personal Learning Assistant

## Overview

This guide provides comprehensive instructions for setting up and configuring Supabase as the backend for the Personal Learning Assistant application. The integration includes database management, authentication, real-time features, and file storage.

## 🏗️ Architecture Overview

### Components Integrated
- **Database**: PostgreSQL with adaptive schema for learning data
- **Authentication**: Better Auth + Supabase Auth integration
- **Real-time**: WebSocket subscriptions for live updates
- **Storage**: File uploads for avatars, learning materials, and user content
- **Row Level Security (RLS)**: Data protection and user isolation

### File Structure
```
src/lib/
├── supabase.ts                 # Main Supabase client configuration
├── supabase-service.ts         # Database service layer (CRUD operations)
├── supabase-auth-bridge.ts     # Better Auth + Supabase integration
├── supabase-realtime.ts        # Real-time subscription management
├── supabase-storage.ts         # File storage service
└── __tests__/
    └── supabase-integration.test.ts # Integration tests

supabase/
├── migrations/
    ├── 00001_initial_schema.sql    # Database schema
    ├── 00002_rls_policies.sql      # Row Level Security policies
    └── 00003_seed_data.sql         # Initial seed data
```

## 📋 Prerequisites

1. **Supabase Account**: Create an account at [supabase.com](https://supabase.com)
2. **Node.js**: Version 20.x or higher
3. **Database Access**: PostgreSQL database (provided by Supabase)

## 🚀 Setup Instructions

### Step 1: Create Supabase Project

1. Log in to your Supabase dashboard
2. Click "New Project"
3. Choose your organization
4. Set project name: `learning-assistant`
5. Set database password (save this securely)
6. Choose region closest to your users
7. Click "Create new project"

### Step 2: Get Supabase Credentials

1. Navigate to Project Settings > API
2. Copy the following values:
   - Project URL
   - Anon key (public)
   - Service role key (secret - for server-side operations)

### Step 3: Configure Environment Variables

Update your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-service-role-key-here

# Database Configuration
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-change-in-production-use-long-random-string-here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

### Step 4: Run Database Migrations

#### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref your-project-id
```

4. Run migrations:
```bash
supabase db push
```

#### Option B: Manual SQL Execution

1. Go to Supabase Dashboard > SQL Editor
2. Copy and execute each migration file in order:
   - `00001_initial_schema.sql`
   - `00002_rls_policies.sql`
   - `00003_seed_data.sql`

### Step 5: Configure Storage Buckets

1. Navigate to Storage in your Supabase dashboard
2. Create the following buckets:
   - `user-avatars` (Private, 5MB limit)
   - `learning-materials` (Private, 50MB limit)
   - `user-uploads` (Private, 10MB limit)

3. The RLS policies are automatically applied via migration `00002_rls_policies.sql`

### Step 6: Enable Real-time

1. Go to Database > Replication
2. Enable replication for these tables:
   - `learning_sessions`
   - `recommendations`
   - `user_preferences`
   - `learning_profiles`

## 🔧 Configuration Details

### Database Schema

The database includes the following main entities:

- **Users**: Core user profiles with Better Auth integration
- **User Preferences**: Learning goals, topics, difficulty preferences
- **Learning Profiles**: VARK learning style assessments
- **Learning Sessions**: Individual study session tracking
- **Adaptive Content**: Multi-modal learning content
- **Content Variants**: Style-specific content variations
- **Assessments**: Adaptive questioning system
- **Recommendations**: AI-generated learning suggestions

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Content is publicly readable for authenticated users
- Admins can manage content and assessments
- Secure file storage with user-specific access

### Real-time Features

Real-time subscriptions are available for:
- Learning session progress updates
- New recommendations
- User preference changes
- Learning profile updates
- Collaborative learning presence

## 💻 Usage Examples

### Basic Database Operations

```typescript
import { UserService, LearningSessionService } from '@/lib/supabase-service';

// Create user
const user = await UserService.createUser({
  id: 'user-id',
  email: 'user@example.com',
  name: 'John Doe'
});

// Create learning session
const session = await LearningSessionService.createLearningSession({
  user_id: user.id,
  content_id: 'content-123',
  duration: 30,
  items_completed: 5,
  correct_answers: 4,
  total_questions: 5
});
```

### File Upload

```typescript
import { SupabaseStorageService } from '@/lib/supabase-storage';

// Upload user avatar
const result = await SupabaseStorageService.uploadUserAvatar(
  userId,
  avatarFile,
  { onProgress: (progress) => console.log(`${progress}%`) }
);

// Get public URL
const avatarUrl = SupabaseStorageService.getPublicUrl('user-avatars', result.data.path);
```

### Real-time Subscriptions

```typescript
import { realtimeManager } from '@/lib/supabase-realtime';

// Subscribe to learning session updates
const subscription = realtimeManager.subscribeLearningSession(sessionId, {
  onUpdate: (session) => {
    console.log('Session updated:', session);
  },
  onError: (error) => {
    console.error('Subscription error:', error);
  }
});

// Cleanup subscription
realtimeManager.unsubscribe('learning_session_' + sessionId);
```

### Authentication Bridge

```typescript
import { SupabaseAuthBridge } from '@/lib/supabase-auth-bridge';

// Get unified user data
const userData = await SupabaseAuthBridge.getUnifiedUserData();
if (userData) {
  console.log('Better Auth user:', userData.betterAuthUser);
  console.log('Supabase user:', userData.supabaseUser);
  console.log('Preferences:', userData.preferences);
}
```

## 🧪 Testing

Run the integration tests:

```bash
npm test -- --testPathPattern=supabase-integration
```

The test suite covers:
- Database CRUD operations
- Authentication flows
- Real-time subscriptions
- File storage operations
- Error handling
- Performance benchmarks

## 🔒 Security Best Practices

### Environment Variables
- Never commit `.env.local` to version control
- Use different credentials for development/staging/production
- Rotate service role keys regularly

### Database Security
- RLS policies are enforced on all tables
- Service role key is only used for server-side operations
- All client operations use the anon key with RLS

### File Storage
- User-specific folders prevent cross-user access
- File type and size validation on upload
- Signed URLs for temporary access to private files

## 📊 Monitoring and Analytics

### Built-in Monitoring
- Supabase Dashboard provides real-time metrics
- Database performance monitoring
- Storage usage tracking
- Real-time connection monitoring

### Custom Analytics
```typescript
import { AnalyticsService } from '@/lib/supabase-service';

// Get user learning overview
const overview = await AnalyticsService.getUserLearningOverview(userId);

// Get content effectiveness metrics
const effectiveness = await AnalyticsService.getContentEffectiveness();
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Connection Errors
```
Error: Invalid API key
```
**Solution**: Verify your Supabase credentials in `.env.local`

#### 2. RLS Policy Errors
```
Error: Row Level Security policy violation
```
**Solution**: Ensure user is authenticated and RLS policies are properly configured

#### 3. Real-time Connection Issues
```
Error: WebSocket connection failed
```
**Solution**: Check network connectivity and Supabase project status

#### 4. Storage Upload Errors
```
Error: File type not allowed
```
**Solution**: Verify file type against bucket configuration

### Debug Mode

Enable debug logging:
```typescript
// In development
process.env.SUPABASE_DEBUG = 'true';
```

### Health Checks

Test your integration:
```typescript
import { supabase } from '@/lib/supabase';

// Test database connection
const { data, error } = await supabase.from('users').select('count').single();
console.log('Database health:', error ? 'Error' : 'OK');

// Test storage
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Storage buckets:', buckets?.map(b => b.name));
```

## 📈 Performance Optimization

### Database Optimization
- Indexes are created for common query patterns
- Connection pooling is configured
- Query result caching where appropriate

### Real-time Optimization
- Automatic reconnection with exponential backoff
- Channel subscription management
- Memory leak prevention

### Storage Optimization
- File compression for images
- CDN configuration for public assets
- Lazy loading for large files

## 🔄 Migration Guide

### From SQLite to Supabase

1. Export existing SQLite data
2. Transform data to match Supabase schema
3. Run migration scripts
4. Update application configuration
5. Test all functionality

### Schema Updates

When updating the schema:
1. Create new migration file
2. Test in development environment
3. Apply to staging
4. Deploy to production with proper backup

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Better Auth Documentation](https://www.better-auth.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Real-time Documentation](https://supabase.com/docs/guides/realtime)

## 🤝 Contributing

When contributing to the Supabase integration:

1. Follow the established patterns in service files
2. Add appropriate tests for new functionality
3. Update this documentation for any changes
4. Ensure RLS policies are maintained for security
5. Test real-time features thoroughly

## 📄 License

This Supabase integration follows the same license as the main project.

---

For additional support or questions about the Supabase integration, please refer to the project documentation or create an issue in the repository.