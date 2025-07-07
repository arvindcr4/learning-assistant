// Edge Runtime compatible metrics (without prom-client)
// This provides the same interface but stores metrics in memory for Edge Runtime

interface MetricStore {
  [key: string]: number;
}

const metricsStore: MetricStore = {};

// Helper to generate metric key
const getMetricKey = (name: string, labels: Record<string, any> = {}): string => {
  const labelStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return labelStr ? `${name}{${labelStr}}` : name;
};

// Simple counter implementation
class EdgeCounter {
  constructor(private name: string) {}
  
  inc(labels: Record<string, any> = {}, value: number = 1) {
    const key = getMetricKey(this.name, labels);
    metricsStore[key] = (metricsStore[key] || 0) + value;
  }
}

// Simple gauge implementation
class EdgeGauge {
  constructor(private name: string) {}
  
  set(labels: Record<string, any> = {}, value: number) {
    const key = getMetricKey(this.name, labels);
    metricsStore[key] = value;
  }
  
  inc(labels: Record<string, any> = {}, value: number = 1) {
    const key = getMetricKey(this.name, labels);
    metricsStore[key] = (metricsStore[key] || 0) + value;
  }
  
  dec(labels: Record<string, any> = {}, value: number = 1) {
    const key = getMetricKey(this.name, labels);
    metricsStore[key] = (metricsStore[key] || 0) - value;
  }
}

// Simple histogram implementation
class EdgeHistogram {
  constructor(private name: string) {}
  
  observe(labels: Record<string, any> = {}, value: number) {
    const key = getMetricKey(this.name + '_sum', labels);
    const countKey = getMetricKey(this.name + '_count', labels);
    metricsStore[key] = (metricsStore[key] || 0) + value;
    metricsStore[countKey] = (metricsStore[countKey] || 0) + 1;
  }
}

// Export Edge-compatible metrics
export const apiRequestsTotal = new EdgeCounter('api_requests_total');
export const apiRequestDuration = new EdgeHistogram('api_request_duration_seconds');
export const dbQueryDuration = new EdgeHistogram('db_query_duration_seconds');
export const dbConnectionsActive = new EdgeGauge('db_connections_active');
export const dbConnectionsTotal = new EdgeCounter('db_connections_total');
export const learningSessionsTotal = new EdgeCounter('learning_sessions_total');
export const learningSessionDuration = new EdgeHistogram('learning_session_duration_minutes');
export const learningCompletionRate = new EdgeGauge('learning_completion_rate');
export const adaptiveChanges = new EdgeCounter('adaptive_changes_total');
export const assessmentAttempts = new EdgeCounter('assessment_attempts_total');
export const assessmentScores = new EdgeHistogram('assessment_scores');
export const userEngagementScore = new EdgeGauge('user_engagement_score');
export const userRetentionDays = new EdgeGauge('user_retention_days');
export const dailyActiveUsers = new EdgeGauge('daily_active_users');
export const contentViews = new EdgeCounter('content_views_total');
export const contentEngagementTime = new EdgeHistogram('content_engagement_time_seconds');
export const memoryUsage = new EdgeGauge('memory_usage_bytes');
export const cpuUsage = new EdgeGauge('cpu_usage_percent');
export const cacheHitRate = new EdgeGauge('cache_hit_rate');
export const errorRate = new EdgeCounter('errors_total');
export const httpErrors = new EdgeCounter('http_errors_total');
export const learningGoalsCompleted = new EdgeCounter('learning_goals_completed_total');
export const recommendationAcceptance = new EdgeGauge('recommendation_acceptance_rate');
export const learningPathProgress = new EdgeGauge('learning_path_progress_percent');

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

  // Update database connections
  updateDbConnections: (active: number, total: number) => {
    dbConnectionsActive.set({}, active);
    dbConnectionsTotal.inc({}, total);
  },

  // Update user engagement
  updateUserEngagement: (userId: string, contentType: string, score: number) => {
    userEngagementScore.set({ user_id: userId, content_type: contentType }, score);
  },

  // Update system metrics
  updateSystemMetrics: (memBytes: number, cpuPercent: number, cacheHit: number) => {
    memoryUsage.set({ type: 'heap' }, memBytes);
    cpuUsage.set({}, cpuPercent);
    cacheHitRate.set({ cache_type: 'default' }, cacheHit);
  },

  // Update business metrics
  updateBusinessMetrics: (userId: string, pathId: string, progress: number) => {
    learningPathProgress.set({ user_id: userId, path_id: pathId }, progress);
  },

  // Update daily active users
  updateDailyActiveUsers: (count: number) => {
    dailyActiveUsers.set({}, count);
  },

  // Update retention
  updateUserRetention: (userId: string, days: number) => {
    userRetentionDays.set({ user_id: userId }, days);
  },

  // Update completion rate
  updateCompletionRate: (contentType: string, difficulty: string, rate: number) => {
    learningCompletionRate.set({ content_type: contentType, difficulty_level: difficulty }, rate);
  },

  // Update recommendation acceptance
  updateRecommendationAcceptance: (type: string, rate: number) => {
    recommendationAcceptance.set({ recommendation_type: type }, rate);
  },

  // Record learning goal completed
  recordLearningGoalCompleted: (userId: string, goalType: string) => {
    learningGoalsCompleted.inc({ user_id: userId, goal_type: goalType });
  },
};

// Export register for compatibility (returns empty string in Edge Runtime)
export const register = {
  metrics: () => {
    // Return a simple text representation of metrics
    return Object.entries(metricsStore)
      .map(([key, value]) => `${key} ${value}`)
      .join('\n');
  }
};
