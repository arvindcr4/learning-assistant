import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Enable default metrics collection
collectDefaultMetrics({ register });

// Custom metrics for the Learning Assistant

// API Metrics
export const apiRequestsTotal = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Database Metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
});

export const dbConnectionsTotal = new Counter({
  name: 'db_connections_total',
  help: 'Total number of database connections created',
});

// Learning Metrics
export const learningSessionsTotal = new Counter({
  name: 'learning_sessions_total',
  help: 'Total number of learning sessions',
  labelNames: ['user_id', 'content_type'],
});

export const learningSessionDuration = new Histogram({
  name: 'learning_session_duration_minutes',
  help: 'Duration of learning sessions in minutes',
  labelNames: ['content_type', 'learning_style'],
  buckets: [5, 15, 30, 60, 120, 240],
});

export const learningCompletionRate = new Gauge({
  name: 'learning_completion_rate',
  help: 'Learning completion rate percentage',
  labelNames: ['content_type', 'difficulty_level'],
});

export const adaptiveChanges = new Counter({
  name: 'adaptive_changes_total',
  help: 'Total number of adaptive changes made',
  labelNames: ['change_type', 'user_id'],
});

// Assessment Metrics
export const assessmentAttempts = new Counter({
  name: 'assessment_attempts_total',
  help: 'Total number of assessment attempts',
  labelNames: ['assessment_type', 'user_id'],
});

export const assessmentScores = new Histogram({
  name: 'assessment_scores',
  help: 'Assessment scores distribution',
  labelNames: ['assessment_type', 'difficulty_level'],
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
});

// User Engagement Metrics
export const userEngagementScore = new Gauge({
  name: 'user_engagement_score',
  help: 'User engagement score',
  labelNames: ['user_id', 'content_type'],
});

export const userRetentionDays = new Gauge({
  name: 'user_retention_days',
  help: 'User retention in days',
  labelNames: ['user_id'],
});

export const dailyActiveUsers = new Gauge({
  name: 'daily_active_users',
  help: 'Number of daily active users',
});

// Content Metrics
export const contentViews = new Counter({
  name: 'content_views_total',
  help: 'Total number of content views',
  labelNames: ['content_id', 'content_type', 'learning_style'],
});

export const contentEngagementTime = new Histogram({
  name: 'content_engagement_time_seconds',
  help: 'Time spent engaging with content',
  labelNames: ['content_id', 'content_type'],
  buckets: [30, 60, 120, 300, 600, 1200, 3600],
});

// System Performance Metrics
export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
});

export const cpuUsage = new Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage',
});

export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'],
});

// Error Metrics
export const errorRate = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'severity', 'component'],
});

export const httpErrors = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['status_code', 'route'],
});

// Business Metrics
export const learningGoalsCompleted = new Counter({
  name: 'learning_goals_completed_total',
  help: 'Total number of learning goals completed',
  labelNames: ['user_id', 'goal_type'],
});

export const recommendationAcceptance = new Gauge({
  name: 'recommendation_acceptance_rate',
  help: 'Recommendation acceptance rate',
  labelNames: ['recommendation_type'],
});

export const learningPathProgress = new Gauge({
  name: 'learning_path_progress_percent',
  help: 'Learning path progress percentage',
  labelNames: ['user_id', 'path_id'],
});

// Utility functions for metrics
export const metricsUtils = {
  // Record API request
  recordApiRequest: (method: string, route: string, statusCode: number, duration: number) => {
    apiRequestsTotal.inc({ method, route, status_code: statusCode });
    apiRequestDuration.observe({ method, route }, duration);
  },

  // Record database query
  recordDbQuery: (queryType: string, table: string, duration: number) => {
    dbQueryDuration.observe({ query_type: queryType, table }, duration);
  },

  // Record learning session
  recordLearningSession: (userId: string, contentType: string, duration: number, learningStyle: string) => {
    learningSessionsTotal.inc({ user_id: userId, content_type: contentType });
    learningSessionDuration.observe({ content_type: contentType, learning_style: learningStyle }, duration);
  },

  // Record adaptive change
  recordAdaptiveChange: (changeType: string, userId: string) => {
    adaptiveChanges.inc({ change_type: changeType, user_id: userId });
  },

  // Record assessment attempt
  recordAssessmentAttempt: (assessmentType: string, userId: string, score: number, difficulty: string) => {
    assessmentAttempts.inc({ assessment_type: assessmentType, user_id: userId });
    assessmentScores.observe({ assessment_type: assessmentType, difficulty_level: difficulty }, score);
  },

  // Record content view
  recordContentView: (contentId: string, contentType: string, learningStyle: string, engagementTime: number) => {
    contentViews.inc({ content_id: contentId, content_type: contentType, learning_style: learningStyle });
    contentEngagementTime.observe({ content_id: contentId, content_type: contentType }, engagementTime);
  },

  // Record error
  recordError: (errorType: string, severity: string, component: string) => {
    errorRate.inc({ error_type: errorType, severity, component });
  },

  // Record HTTP error
  recordHttpError: (statusCode: number, route: string) => {
    httpErrors.inc({ status_code: statusCode, route });
  },

  // Update system metrics
  updateSystemMetrics: (memoryUsed: number, cpuPercent: number, cacheHitPercent: number) => {
    memoryUsage.set({ type: 'used' }, memoryUsed);
    cpuUsage.set(cpuPercent);
    cacheHitRate.set({ cache_type: 'redis' }, cacheHitPercent);
  },

  // Update user engagement
  updateUserEngagement: (userId: string, contentType: string, engagementScore: number) => {
    userEngagementScore.set({ user_id: userId, content_type: contentType }, engagementScore);
  },

  // Update daily active users
  updateDailyActiveUsers: (count: number) => {
    dailyActiveUsers.set(count);
  },

  // Record learning goal completion
  recordLearningGoalCompletion: (userId: string, goalType: string) => {
    learningGoalsCompleted.inc({ user_id: userId, goal_type: goalType });
  },

  // Update recommendation acceptance rate
  updateRecommendationAcceptance: (recommendationType: string, acceptanceRate: number) => {
    recommendationAcceptance.set({ recommendation_type: recommendationType }, acceptanceRate);
  },

  // Update learning path progress
  updateLearningPathProgress: (userId: string, pathId: string, progressPercent: number) => {
    learningPathProgress.set({ user_id: userId, path_id: pathId }, progressPercent);
  },
};

// Export Prometheus register for metrics endpoint
export { register };

// Health check for metrics
export const metricsHealthCheck = (): boolean => {
  try {
    const metrics = register.metrics();
    return metrics.length > 0;
  } catch (error) {
    console.error('Metrics health check failed:', error);
    return false;
  }
};

// Reset all metrics (useful for testing)
export const resetMetrics = (): void => {
  register.resetMetrics();
};