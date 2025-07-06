# Personal Learning Assistant - Database Layer

This document describes the complete database architecture and implementation for the Personal Learning Assistant system.

## 🏗️ Architecture Overview

The database layer is built on PostgreSQL and designed for:
- **Adaptive Learning**: Dynamic content delivery based on learning styles
- **Performance Analytics**: Comprehensive tracking of user progress and engagement
- **Scalability**: Connection pooling and optimized queries
- **Maintainability**: Structured migrations and seeding system

## 📊 Database Schema

### Core Tables

#### User Management
- **users**: Core user accounts and profiles
- **user_preferences**: Learning preferences and settings
- **learning_profiles**: VARK learning style profiles
- **learning_styles**: Individual style scores and confidence levels
- **style_assessments**: Assessment results for learning style detection
- **behavioral_indicators**: Behavioral data for style adaptation

#### Adaptive Pace Management
- **pace_profiles**: Current and optimal learning pace for each user
- **pace_adjustments**: History of pace changes and effectiveness

#### Learning Sessions
- **learning_sessions**: Individual learning session records
- **adaptive_changes**: Real-time adaptations during sessions

#### Content Management
- **adaptive_content**: Core learning content with metadata
- **content_variants**: Style-specific versions of content
- **media_content**: Associated media files (videos, audio, images)

#### Assessment System
- **adaptive_assessments**: Assessment definitions and settings
- **adaptive_questions**: Individual questions with difficulty levels
- **question_options**: Multiple choice options and feedback
- **assessment_attempts**: User assessment attempts and scores
- **question_responses**: Individual question responses and analytics

#### Analytics & Recommendations
- **learning_analytics**: Comprehensive learning analytics snapshots
- **style_effectiveness**: Learning style performance metrics
- **content_engagement**: Content interaction and engagement metrics
- **performance_trends**: Performance trend analysis
- **recommendations**: Personalized learning recommendations
- **learning_predictions**: ML-based performance predictions

#### System Configuration
- **system_config**: System-wide configuration settings
- **schema_migrations**: Migration tracking and versioning

## 🛠️ Setup and Installation

### 1. Prerequisites
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Or using Docker
docker run --name postgres-learning -e POSTGRES_PASSWORD=mypassword -p 5432:5432 -d postgres
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit database settings
DB_HOST=localhost
DB_PORT=5432
DB_NAME=learning_assistant
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
```bash
# Create database
createdb learning_assistant

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

## 🚀 Database Commands

### Migration Management
```bash
# Run all pending migrations
npm run db:migrate

# Check migration status
npm run db:migrate status

# Rollback to specific version
npm run db:migrate rollback 20250106000001

# Reset database (⚠️ destroys all data)
npm run db:migrate reset
```

### Data Seeding
```bash
# Seed all sample data
npm run db:seed

# Seed specific data types
npm run db:seed users
npm run db:seed content
npm run db:seed assessments
npm run db:seed sessions
npm run db:seed recommendations

# Clear all seed data
npm run db:seed clear
```

### Database Status and Health
```bash
# Full database status report
npm run db:status

# Migration status only
npm run db:status migrations

# Health check only
npm run db:status health
```

### Quick Reset (Development)
```bash
# Complete reset with fresh data
npm run db:reset

# Reset schema only (no seed data)
npm run db:reset migrations-only
```

## 💻 Usage Examples

### Basic Database Operations
```typescript
import { query, transaction, DatabaseUtils } from '@/lib/database';

// Simple query
const users = await query('SELECT * FROM users LIMIT 10');

// Transaction
await transaction(async (client) => {
  await client.query('INSERT INTO users (email, name) VALUES ($1, $2)', ['test@example.com', 'Test User']);
  await client.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [userId]);
});

// Using utility functions
const userId = await DatabaseUtils.createUser({
  email: 'alice@example.com',
  name: 'Alice Johnson'
});
```

### Learning Style Management
```typescript
// Update learning style assessment
await DatabaseUtils.updateLearningStyleAssessment(userId, {
  visualScore: 0.8,
  auditoryScore: 0.6,
  readingScore: 0.7,
  kinestheticScore: 0.5,
  confidence: 0.85,
  assessmentType: 'hybrid'
});

// Record behavioral indicator
await DatabaseUtils.recordBehavioralIndicator(userId, {
  action: 'video_watched',
  contentType: 'visual',
  engagementLevel: 85,
  completionRate: 95,
  timeSpent: 45
});
```

### Content and Sessions
```typescript
// Get adaptive content for user
const content = await DatabaseUtils.getAdaptiveContent(userId, {
  learningStyle: 'visual',
  difficulty: 5,
  limit: 10
});

// Create and complete learning session
const sessionId = await DatabaseUtils.createLearningSession(userId, contentId, 60);
await DatabaseUtils.completeLearningSession(sessionId, {
  itemsCompleted: 8,
  correctAnswers: 7,
  totalQuestions: 10,
  focusTime: 45
});
```

### Analytics and Recommendations
```typescript
// Generate analytics snapshot
const analyticsId = await DatabaseUtils.generateAnalyticsSnapshot(
  userId,
  new Date('2025-01-01'),
  new Date('2025-01-31')
);

// Get personalized recommendations
const recommendations = await DatabaseUtils.getPersonalizedRecommendations(userId, 5);

// Create custom recommendation
await DatabaseUtils.createRecommendation(userId, {
  type: 'content',
  title: 'Try Visual Learning',
  description: 'Based on your performance, visual content might help',
  reasoning: 'Analysis shows 23% better retention with visual materials',
  confidence: 85,
  priority: 'high',
  estimatedImpact: 75
});
```

## 🔧 Configuration

### Connection Pooling
The system uses PostgreSQL connection pooling for optimal performance:

```typescript
// Default pool settings
{
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection timeout
  statement_timeout: 30000,   // Query timeout
  query_timeout: 30000
}
```

### Environment-Specific Settings
```typescript
// Development
{
  logQueries: true,
  enableQueryAnalysis: true,
  cacheTTL: 300,
  retryAttempts: 3
}

// Production
{
  logQueries: false,
  enableQueryAnalysis: false,
  cacheTTL: 1800,
  retryAttempts: 5
}
```

## 📈 Performance Optimization

### Indexes
The schema includes comprehensive indexing:
- **Primary Keys**: UUID-based for all tables
- **Foreign Keys**: Indexed for join performance
- **Composite Indexes**: For common query patterns
- **Partial Indexes**: For filtered queries (active records)
- **GIN Indexes**: For array and JSONB columns

### Query Optimization
- Connection pooling with configurable limits
- Prepared statement caching
- Query timeout protection
- Automatic retry with exponential backoff
- Performance monitoring and logging

### Views and Functions
Pre-built views and functions for common operations:
- `user_learning_overview`: Complete user progress summary
- `content_effectiveness`: Content performance analytics
- `recent_user_activity`: Activity tracking
- `calculate_learning_style_score()`: Dynamic style scoring
- `get_content_recommendations()`: Personalized content suggestions

## 🛡️ Security Features

### Data Protection
- Input validation and sanitization
- SQL injection prevention via parameterized queries
- Connection encryption (SSL/TLS support)
- Database user privilege separation

### Privacy Controls
- Configurable data retention policies
- User data anonymization options
- GDPR compliance features
- Audit logging for sensitive operations

## 🔍 Monitoring and Debugging

### Health Checks
```typescript
// Comprehensive health check
const health = await DatabaseUtils.healthCheck();
console.log('Database healthy:', health.healthy);
console.log('Checks:', health.checks);

// Connection statistics
const stats = getConnectionStats();
console.log('Active connections:', stats.totalConnections);
```

### Logging and Metrics
- Query execution time tracking
- Connection pool monitoring
- Error logging with context
- Performance trend analysis

## 🚨 Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Check PostgreSQL status
brew services list | grep postgresql
# or
docker ps | grep postgres

# Verify connection settings in .env
```

**Migration Failures**
```bash
# Check migration status
npm run db:status migrations

# Reset and retry (⚠️ development only)
npm run db:reset
```

**Performance Issues**
```bash
# Check connection pool stats
npm run db:status

# Enable query logging
export ENABLE_QUERY_LOGGING=true
```

**Data Inconsistencies**
```bash
# Clear and reseed data
npm run db:seed clear
npm run db:seed
```

## 🔄 Backup and Recovery

### Backup
```bash
# Create backup
pg_dump learning_assistant > backup.sql

# Backup with compression
pg_dump learning_assistant | gzip > backup.sql.gz
```

### Restore
```bash
# Restore from backup
psql learning_assistant < backup.sql

# Restore compressed backup
gunzip -c backup.sql.gz | psql learning_assistant
```

## 📚 Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg Driver](https://node-postgres.com/)
- [Database Design Best Practices](https://www.postgresql.org/docs/current/ddl-best-practices.html)
- [Performance Tuning Guide](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

For questions or issues, please refer to the main project documentation or create an issue in the repository.