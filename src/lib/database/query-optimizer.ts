import { Pool, PoolClient, QueryResult } from 'pg';

// ====================
// QUERY OPTIMIZATION AND N+1 PREVENTION
// ====================

export interface QueryPlan {
  sql: string;
  params: any[];
  estimatedCost: number;
  batchable: boolean;
  cacheable: boolean;
  cacheKey?: string;
}

export interface BatchedQuery {
  id: string;
  sql: string;
  params: any[];
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export interface QueryCache {
  get(key: string): Promise<any> | any | null;
  set(key: string, value: any, ttl?: number): Promise<void> | void;
  del(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

export class DatabaseQueryOptimizer {
  private pool: Pool;
  private queryCache?: QueryCache;
  private batchedQueries: Map<string, BatchedQuery[]> = new Map();
  private batchTimeout: number = 10; // milliseconds
  private queryStats: Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    lastExecuted: Date;
  }> = new Map();

  constructor(pool: Pool, cache?: QueryCache) {
    this.pool = pool;
    this.queryCache = cache;
  }

  /**
   * Execute optimized query with caching and batching
   */
  public async executeOptimized<T = any>(
    sql: string,
    params: any[] = [],
    options: {
      cache?: boolean;
      cacheTtl?: number;
      batch?: boolean;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const queryPlan = this.createQueryPlan(sql, params, options);

    try {
      let result: QueryResult<T>;

      // 1. Check cache first
      if (options.cache && this.queryCache && queryPlan.cacheKey) {
        const cached = await this.queryCache.get(queryPlan.cacheKey);
        if (cached) {
          this.recordQueryStats(sql, Date.now() - startTime, true);
          return cached;
        }
      }

      // 2. Execute with batching if applicable
      if (options.batch && queryPlan.batchable) {
        result = await this.executeBatched<T>(queryPlan);
      } else {
        result = await this.pool.query<T>(queryPlan.sql, queryPlan.params);
      }

      // 3. Cache result if enabled
      if (options.cache && this.queryCache && queryPlan.cacheKey) {
        await this.queryCache.set(queryPlan.cacheKey, result, options.cacheTtl);
      }

      this.recordQueryStats(sql, Date.now() - startTime, false);
      return result;

    } catch (error) {
      this.recordQueryStats(sql, Date.now() - startTime, false, error as Error);
      throw error;
    }
  }

  /**
   * Batch similar queries to prevent N+1 problems
   */
  private async executeBatched<T>(queryPlan: QueryPlan): Promise<QueryResult<T>> {
    return new Promise((resolve, reject) => {
      const batchKey = this.getBatchKey(queryPlan.sql);
      
      if (!this.batchedQueries.has(batchKey)) {
        this.batchedQueries.set(batchKey, []);
      }

      const batch = this.batchedQueries.get(batchKey)!;
      batch.push({
        id: Math.random().toString(36).substr(2, 9),
        sql: queryPlan.sql,
        params: queryPlan.params,
        resolve,
        reject,
      });

      // Schedule batch execution
      if (batch.length === 1) {
        setTimeout(() => this.executeBatch(batchKey), this.batchTimeout);
      }
    });
  }

  /**
   * Execute batched queries
   */
  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batchedQueries.get(batchKey);
    if (!batch || batch.length === 0) {
      return;
    }

    this.batchedQueries.delete(batchKey);

    try {
      // For SELECT queries, we can use WHERE IN() to batch
      if (this.isBatchableSelect(batch[0].sql)) {
        await this.executeBatchedSelect(batch);
      } else {
        // For other queries, execute individually but in a transaction
        await this.executeBatchedTransaction(batch);
      }
    } catch (error) {
      // Reject all queries in the batch
      batch.forEach(query => query.reject(error as Error));
    }
  }

  /**
   * Execute batched SELECT queries using WHERE IN()
   */
  private async executeBatchedSelect(batch: BatchedQuery[]): Promise<void> {
    if (batch.length === 1) {
      // Single query, execute normally
      try {
        const result = await this.pool.query(batch[0].sql, batch[0].params);
        batch[0].resolve(result);
      } catch (error) {
        batch[0].reject(error as Error);
      }
      return;
    }

    // Extract parameter values for batching
    const paramValues = batch.map(query => query.params[0]); // Assuming first param is the key
    const baseSql = batch[0].sql;
    
    // Convert "WHERE id = $1" to "WHERE id = ANY($1)"
    const batchedSql = baseSql.replace(/WHERE\s+(\w+)\s*=\s*\$1/i, 'WHERE $1 = ANY($1)');
    
    try {
      const result = await this.pool.query(batchedSql, [paramValues]);
      
      // Distribute results back to individual queries
      batch.forEach(query => {
        const queryParam = query.params[0];
        const filteredRows = result.rows.filter((row: any) => {
          // Assuming the key field is 'id' - this could be made more flexible
          return row.id === queryParam || row.user_id === queryParam;
        });
        
        query.resolve({
          rows: filteredRows,
          rowCount: filteredRows.length,
          command: result.command,
          oid: result.oid,
          fields: result.fields,
        });
      });
    } catch (error) {
      // If batching fails, fall back to individual queries
      await Promise.all(batch.map(async query => {
        try {
          const result = await this.pool.query(query.sql, query.params);
          query.resolve(result);
        } catch (individualError) {
          query.reject(individualError as Error);
        }
      }));
    }
  }

  /**
   * Execute batched queries in a transaction
   */
  private async executeBatchedTransaction(batch: BatchedQuery[]): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const results = await Promise.all(
        batch.map(async query => {
          try {
            const result = await client.query(query.sql, query.params);
            return { query, result, error: null };
          } catch (error) {
            return { query, result: null, error: error as Error };
          }
        })
      );

      await client.query('COMMIT');

      // Resolve/reject individual queries
      results.forEach(({ query, result, error }) => {
        if (error) {
          query.reject(error);
        } else {
          query.resolve(result);
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      batch.forEach(query => query.reject(error as Error));
    } finally {
      client.release();
    }
  }

  /**
   * Check if a query can be batched as a SELECT
   */
  private isBatchableSelect(sql: string): boolean {
    return /^\s*SELECT\b/i.test(sql) && /WHERE\s+\w+\s*=\s*\$1\s*$/i.test(sql);
  }

  /**
   * Generate batch key for similar queries
   */
  private getBatchKey(sql: string): string {
    // Remove parameter placeholders and normalize whitespace
    return sql
      .replace(/\$\d+/g, '?')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Create query execution plan
   */
  private createQueryPlan(
    sql: string,
    params: any[],
    options: { cache?: boolean; batch?: boolean }
  ): QueryPlan {
    const estimatedCost = this.estimateQueryCost(sql);
    const batchable = options.batch && this.isQueryBatchable(sql);
    const cacheable = options.cache && this.isQueryCacheable(sql);
    const cacheKey = cacheable ? this.generateCacheKey(sql, params) : undefined;

    return {
      sql,
      params,
      estimatedCost,
      batchable,
      cacheable,
      cacheKey,
    };
  }

  /**
   * Estimate query execution cost (simplified)
   */
  private estimateQueryCost(sql: string): number {
    let cost = 1;

    // Basic cost estimation based on query complexity
    if (/JOIN/i.test(sql)) cost += 2;
    if (/ORDER BY/i.test(sql)) cost += 1;
    if (/GROUP BY/i.test(sql)) cost += 2;
    if (/HAVING/i.test(sql)) cost += 1;
    if (/UNION/i.test(sql)) cost += 3;
    if (/EXISTS|IN\s*\(/i.test(sql)) cost += 2;

    return cost;
  }

  /**
   * Check if query can be batched
   */
  private isQueryBatchable(sql: string): boolean {
    // Only SELECT queries with simple WHERE clauses can be batched
    return /^\s*SELECT\b/i.test(sql) && 
           /WHERE\s+\w+\s*=\s*\$\d+/i.test(sql) &&
           !/LIMIT|OFFSET|ORDER BY|GROUP BY/i.test(sql);
  }

  /**
   * Check if query results can be cached
   */
  private isQueryCacheable(sql: string): boolean {
    // Only SELECT queries are cacheable
    return /^\s*SELECT\b/i.test(sql) && 
           !/NOW\(\)|CURRENT_TIMESTAMP|RANDOM\(\)/i.test(sql);
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(sql: string, params: any[]): string {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramsHash = JSON.stringify(params);
    return `query:${this.hashString(normalizedSql + paramsHash)}`;
  }

  /**
   * Simple string hashing function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Record query statistics
   */
  private recordQueryStats(
    sql: string,
    executionTime: number,
    cached: boolean,
    error?: Error
  ): void {
    const key = this.getBatchKey(sql);
    const existing = this.queryStats.get(key);

    if (existing) {
      existing.count++;
      existing.totalTime += executionTime;
      existing.avgTime = existing.totalTime / existing.count;
      existing.lastExecuted = new Date();
    } else {
      this.queryStats.set(key, {
        count: 1,
        totalTime: executionTime,
        avgTime: executionTime,
        lastExecuted: new Date(),
      });
    }

    // Log slow queries
    if (executionTime > 1000 && !cached) {
      console.warn(`Slow query detected (${executionTime}ms):`, sql.substring(0, 100));
    }

    // Log errors
    if (error) {
      console.error('Query error:', error.message, 'SQL:', sql.substring(0, 100));
    }
  }

  /**
   * Get query performance statistics
   */
  public getQueryStats(): Array<{
    sql: string;
    count: number;
    avgTime: number;
    totalTime: number;
    lastExecuted: Date;
  }> {
    return Array.from(this.queryStats.entries()).map(([sql, stats]) => ({
      sql,
      ...stats,
    }));
  }

  /**
   * Clear query statistics
   */
  public clearStats(): void {
    this.queryStats.clear();
  }

  /**
   * Get slow queries report
   */
  public getSlowQueries(threshold: number = 1000): Array<{
    sql: string;
    avgTime: number;
    count: number;
  }> {
    return this.getQueryStats()
      .filter(stat => stat.avgTime > threshold)
      .sort((a, b) => b.avgTime - a.avgTime);
  }
}

// ====================
// QUERY BUILDER FOR COMMON PATTERNS
// ====================

export class OptimizedQueryBuilder {
  private optimizer: DatabaseQueryOptimizer;

  constructor(optimizer: DatabaseQueryOptimizer) {
    this.optimizer = optimizer;
  }

  /**
   * Optimized user sessions query with eager loading
   */
  public async getUserSessionsWithContent(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<any[]> {
    const sql = `
      SELECT 
        ls.*,
        ac.title as content_title,
        ac.description as content_description,
        ac.difficulty as content_difficulty
      FROM learning_sessions ls
      LEFT JOIN adaptive_content ac ON ls.content_id = ac.id::text
      WHERE ls.user_id = $1
      ORDER BY ls.start_time DESC
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.optimizer.executeOptimized(
      sql,
      [userId, limit, offset],
      { cache: true, cacheTtl: 300 } // Cache for 5 minutes
    );
    
    return result.rows;
  }

  /**
   * Optimized user progress with batched content loading
   */
  public async getUserProgressWithDetails(userId: string): Promise<any> {
    // First get user progress
    const progressResult = await this.optimizer.executeOptimized(
      'SELECT * FROM learning_analytics WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1',
      [userId],
      { cache: true, cacheTtl: 180 }
    );

    if (progressResult.rows.length === 0) {
      return null;
    }

    const progress = progressResult.rows[0];

    // Get style effectiveness in parallel
    const styleEffectivenessPromise = this.optimizer.executeOptimized(
      'SELECT * FROM style_effectiveness WHERE analytics_id = $1',
      [progress.id],
      { cache: true, cacheTtl: 300 }
    );

    // Get content engagement in parallel
    const contentEngagementPromise = this.optimizer.executeOptimized(
      'SELECT * FROM content_engagement WHERE analytics_id = $1',
      [progress.id],
      { cache: true, cacheTtl: 300 }
    );

    const [styleResult, contentResult] = await Promise.all([
      styleEffectivenessPromise,
      contentEngagementPromise,
    ]);

    return {
      ...progress,
      styleEffectiveness: styleResult.rows,
      contentEngagement: contentResult.rows,
    };
  }

  /**
   * Optimized recommendations with user context
   */
  public async getActiveRecommendations(
    userId: string,
    type?: string
  ): Promise<any[]> {
    let sql = `
      SELECT 
        r.*,
        u.name as user_name,
        up.learning_goals,
        up.preferred_topics
      FROM recommendations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN user_preferences up ON u.id = up.user_id
      WHERE r.user_id = $1 AND r.status = 'active'
    `;
    
    const params = [userId];
    
    if (type) {
      sql += ' AND r.recommendation_type = $2';
      params.push(type);
    }
    
    sql += ' ORDER BY r.priority DESC, r.created_at DESC';
    
    const result = await this.optimizer.executeOptimized(
      sql,
      params,
      { cache: true, cacheTtl: 120 } // Cache for 2 minutes
    );
    
    return result.rows;
  }

  /**
   * Optimized assessment attempts with question details
   */
  public async getAssessmentAttemptWithQuestions(
    attemptId: string
  ): Promise<any> {
    // Get attempt details
    const attemptResult = await this.optimizer.executeOptimized(
      `
        SELECT 
          aa.*,
          a.title as assessment_title,
          a.description as assessment_description
        FROM assessment_attempts aa
        JOIN adaptive_assessments a ON aa.assessment_id = a.id
        WHERE aa.id = $1
      `,
      [attemptId],
      { cache: true, cacheTtl: 600 }
    );

    if (attemptResult.rows.length === 0) {
      return null;
    }

    const attempt = attemptResult.rows[0];

    // Get responses with question details
    const responsesResult = await this.optimizer.executeOptimized(
      `
        SELECT 
          qr.*,
          aq.question_text,
          aq.question_type,
          aq.correct_answer,
          aq.explanation
        FROM question_responses qr
        JOIN adaptive_questions aq ON qr.question_id = aq.id
        WHERE qr.attempt_id = $1
        ORDER BY qr.response_time
      `,
      [attemptId],
      { cache: true, cacheTtl: 600 }
    );

    return {
      ...attempt,
      responses: responsesResult.rows,
    };
  }
}

// ====================
// EXPORTS
// ====================

export default {
  DatabaseQueryOptimizer,
  OptimizedQueryBuilder,
};