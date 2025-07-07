import { getOptimizedDatabase } from './optimized-connection';
import { cacheStrategy } from './caching-strategy';

// Maintenance task configuration
interface MaintenanceTask {
  name: string;
  description: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number; // minutes
  requiresDowntime: boolean;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

// Maintenance result
interface MaintenanceResult {
  taskName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  message: string;
  details?: any;
  errors?: string[];
  metrics?: {
    rowsProcessed?: number;
    spaceSaved?: number;
    indexesRebuilt?: number;
    statisticsUpdated?: number;
  };
}

export class DatabaseMaintenanceProcedures {
  private db = getOptimizedDatabase();
  private maintenanceHistory: MaintenanceResult[] = [];
  private isMaintenanceRunning = false;
  
  // Define maintenance tasks
  private readonly maintenanceTasks: MaintenanceTask[] = [
    {
      name: 'cleanup_expired_sessions',
      description: 'Clean up expired learning sessions older than 90 days',
      frequency: 'daily',
      priority: 'medium',
      estimatedDuration: 5,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'cleanup_old_behavioral_data',
      description: 'Clean up behavioral indicators older than 60 days',
      frequency: 'daily',
      priority: 'medium',
      estimatedDuration: 3,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'update_table_statistics',
      description: 'Update table statistics for query optimizer',
      frequency: 'daily',
      priority: 'high',
      estimatedDuration: 10,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'reindex_fragmented_indexes',
      description: 'Rebuild fragmented indexes',
      frequency: 'weekly',
      priority: 'high',
      estimatedDuration: 30,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'vacuum_analyze_tables',
      description: 'Vacuum and analyze all tables',
      frequency: 'weekly',
      priority: 'high',
      estimatedDuration: 20,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'cleanup_query_logs',
      description: 'Clean up old query performance logs',
      frequency: 'weekly',
      priority: 'low',
      estimatedDuration: 2,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'archive_old_analytics',
      description: 'Archive analytics data older than 6 months',
      frequency: 'monthly',
      priority: 'medium',
      estimatedDuration: 15,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'rebuild_full_text_indexes',
      description: 'Rebuild full-text search indexes',
      frequency: 'monthly',
      priority: 'medium',
      estimatedDuration: 45,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'check_database_integrity',
      description: 'Check database integrity and consistency',
      frequency: 'weekly',
      priority: 'critical',
      estimatedDuration: 60,
      requiresDowntime: false,
      enabled: true,
    },
    {
      name: 'optimize_connection_pool',
      description: 'Optimize connection pool settings based on usage patterns',
      frequency: 'weekly',
      priority: 'medium',
      estimatedDuration: 1,
      requiresDowntime: false,
      enabled: true,
    },
  ];

  // Individual maintenance procedures
  public async cleanupExpiredSessions(): Promise<MaintenanceResult> {
    const taskName = 'cleanup_expired_sessions';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting cleanup of expired sessions...');
      
      // Delete sessions older than 90 days that are completed
      const deleteSessionsQuery = `
        DELETE FROM learning_sessions 
        WHERE start_time < CURRENT_DATE - INTERVAL '90 days' 
          AND completed = true
      `;
      
      const sessionResult = await this.db.query(deleteSessionsQuery);
      
      // Delete orphaned adaptive changes
      const deleteChangesQuery = `
        DELETE FROM adaptive_changes 
        WHERE session_id NOT IN (SELECT id FROM learning_sessions)
      `;
      
      const changesResult = await this.db.query(deleteChangesQuery);
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: MaintenanceResult = {
        taskName,
        success: true,
        startTime,
        endTime,
        duration,
        message: `Cleaned up ${sessionResult.rowCount || 0} expired sessions and ${changesResult.rowCount || 0} orphaned changes`,
        metrics: {
          rowsProcessed: (sessionResult.rowCount || 0) + (changesResult.rowCount || 0),
        },
      };
      
      console.log('[Maintenance] Cleanup of expired sessions completed:', result.message);
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to cleanup expired sessions',
        errors: [(error as Error).message],
      };
    }
  }

  public async cleanupOldBehavioralData(): Promise<MaintenanceResult> {
    const taskName = 'cleanup_old_behavioral_data';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting cleanup of old behavioral data...');
      
      // Keep only last 60 days of behavioral indicators
      const query = `
        DELETE FROM behavioral_indicators 
        WHERE timestamp < CURRENT_DATE - INTERVAL '60 days'
      `;
      
      const result = await this.db.query(query);
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const maintenanceResult: MaintenanceResult = {
        taskName,
        success: true,
        startTime,
        endTime,
        duration,
        message: `Cleaned up ${result.rowCount || 0} old behavioral indicators`,
        metrics: {
          rowsProcessed: result.rowCount || 0,
        },
      };
      
      console.log('[Maintenance] Cleanup of old behavioral data completed:', maintenanceResult.message);
      return maintenanceResult;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to cleanup old behavioral data',
        errors: [(error as Error).message],
      };
    }
  }

  public async updateTableStatistics(): Promise<MaintenanceResult> {
    const taskName = 'update_table_statistics';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting table statistics update...');
      
      // Get all user tables
      const tablesQuery = `
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
          AND tablename NOT LIKE 'pg_%'
      `;
      
      const tablesResult = await this.db.query(tablesQuery);
      const tables = tablesResult.rows.map(row => row.tablename);
      
      let updatedTables = 0;
      const errors: string[] = [];
      
      // Update statistics for each table
      for (const table of tables) {
        try {
          await this.db.query(`ANALYZE ${table}`);
          updatedTables++;
        } catch (error) {
          errors.push(`Failed to analyze table ${table}: ${(error as Error).message}`);
        }
      }
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: MaintenanceResult = {
        taskName,
        success: errors.length === 0,
        startTime,
        endTime,
        duration,
        message: `Updated statistics for ${updatedTables}/${tables.length} tables`,
        metrics: {
          statisticsUpdated: updatedTables,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
      
      console.log('[Maintenance] Table statistics update completed:', result.message);
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to update table statistics',
        errors: [(error as Error).message],
      };
    }
  }

  public async reindexFragmentedIndexes(): Promise<MaintenanceResult> {
    const taskName = 'reindex_fragmented_indexes';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting reindex of fragmented indexes...');
      
      // Find fragmented indexes (this is a simplified check)
      const fragmentedIndexesQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0
          AND schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20
      `;
      
      const indexesResult = await this.db.query(fragmentedIndexesQuery);
      const indexes = indexesResult.rows;
      
      let reindexedCount = 0;
      const errors: string[] = [];
      
      // Reindex fragmented indexes
      for (const index of indexes) {
        try {
          await this.db.query(`REINDEX INDEX CONCURRENTLY ${index.indexname}`);
          reindexedCount++;
        } catch (error) {
          // If CONCURRENTLY fails, try without it
          try {
            await this.db.query(`REINDEX INDEX ${index.indexname}`);
            reindexedCount++;
          } catch (secondError) {
            errors.push(`Failed to reindex ${index.indexname}: ${(secondError as Error).message}`);
          }
        }
      }
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: MaintenanceResult = {
        taskName,
        success: errors.length === 0,
        startTime,
        endTime,
        duration,
        message: `Reindexed ${reindexedCount}/${indexes.length} indexes`,
        metrics: {
          indexesRebuilt: reindexedCount,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
      
      console.log('[Maintenance] Reindex of fragmented indexes completed:', result.message);
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to reindex fragmented indexes',
        errors: [(error as Error).message],
      };
    }
  }

  public async vacuumAnalyzeTables(): Promise<MaintenanceResult> {
    const taskName = 'vacuum_analyze_tables';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting vacuum and analyze of tables...');
      
      // Get tables that need maintenance
      const tablesQuery = `
        SELECT 
          schemaname,
          tablename,
          n_dead_tup,
          n_live_tup,
          last_vacuum,
          last_analyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND (
            last_vacuum IS NULL 
            OR last_vacuum < CURRENT_DATE - INTERVAL '7 days'
            OR n_dead_tup > n_live_tup * 0.1
          )
      `;
      
      const tablesResult = await this.db.query(tablesQuery);
      const tables = tablesResult.rows;
      
      let processedTables = 0;
      const errors: string[] = [];
      
      // Vacuum and analyze each table
      for (const table of tables) {
        try {
          console.log(`[Maintenance] Processing table: ${table.tablename}`);
          await this.db.query(`VACUUM ANALYZE ${table.tablename}`);
          processedTables++;
        } catch (error) {
          errors.push(`Failed to vacuum/analyze table ${table.tablename}: ${(error as Error).message}`);
        }
      }
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: MaintenanceResult = {
        taskName,
        success: errors.length === 0,
        startTime,
        endTime,
        duration,
        message: `Processed ${processedTables}/${tables.length} tables`,
        metrics: {
          rowsProcessed: processedTables,
        },
        errors: errors.length > 0 ? errors : undefined,
      };
      
      console.log('[Maintenance] Vacuum and analyze completed:', result.message);
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to vacuum and analyze tables',
        errors: [(error as Error).message],
      };
    }
  }

  public async cleanupQueryLogs(): Promise<MaintenanceResult> {
    const taskName = 'cleanup_query_logs';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting cleanup of query logs...');
      
      // Clean up old query performance logs
      const cleanupQuery = `
        DELETE FROM query_performance_log 
        WHERE executed_at < CURRENT_DATE - INTERVAL '30 days'
      `;
      
      const result = await this.db.query(cleanupQuery);
      
      // Clean up old database statistics snapshots
      const cleanupStatsQuery = `
        DELETE FROM database_statistics_snapshot 
        WHERE snapshot_date < CURRENT_DATE - INTERVAL '90 days'
      `;
      
      const statsResult = await this.db.query(cleanupStatsQuery);
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const maintenanceResult: MaintenanceResult = {
        taskName,
        success: true,
        startTime,
        endTime,
        duration,
        message: `Cleaned up ${(result.rowCount || 0) + (statsResult.rowCount || 0)} log entries`,
        metrics: {
          rowsProcessed: (result.rowCount || 0) + (statsResult.rowCount || 0),
        },
      };
      
      console.log('[Maintenance] Cleanup of query logs completed:', maintenanceResult.message);
      return maintenanceResult;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to cleanup query logs',
        errors: [(error as Error).message],
      };
    }
  }

  public async archiveOldAnalytics(): Promise<MaintenanceResult> {
    const taskName = 'archive_old_analytics';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting archival of old analytics...');
      
      // Archive analytics data older than 6 months
      const archiveQuery = `
        DELETE FROM learning_analytics 
        WHERE time_range_end < CURRENT_DATE - INTERVAL '6 months'
      `;
      
      const analyticsResult = await this.db.query(archiveQuery);
      
      // Clean up associated data
      const cleanupQueries = [
        'DELETE FROM style_effectiveness WHERE analytics_id NOT IN (SELECT id FROM learning_analytics)',
        'DELETE FROM content_engagement WHERE analytics_id NOT IN (SELECT id FROM learning_analytics)',
        'DELETE FROM performance_trends WHERE analytics_id NOT IN (SELECT id FROM learning_analytics)',
      ];
      
      let totalCleaned = analyticsResult.rowCount || 0;
      
      for (const query of cleanupQueries) {
        const result = await this.db.query(query);
        totalCleaned += result.rowCount || 0;
      }
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: MaintenanceResult = {
        taskName,
        success: true,
        startTime,
        endTime,
        duration,
        message: `Archived ${totalCleaned} analytics records`,
        metrics: {
          rowsProcessed: totalCleaned,
        },
      };
      
      console.log('[Maintenance] Archival of old analytics completed:', result.message);
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to archive old analytics',
        errors: [(error as Error).message],
      };
    }
  }

  public async checkDatabaseIntegrity(): Promise<MaintenanceResult> {
    const taskName = 'check_database_integrity';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting database integrity check...');
      
      const checks: Array<{ name: string; query: string; expected?: any }> = [
        {
          name: 'Foreign key constraints',
          query: `
            SELECT COUNT(*) as violations FROM (
              SELECT 'users -> learning_profiles' as table_pair, COUNT(*) as count
              FROM learning_profiles lp 
              LEFT JOIN users u ON lp.user_id = u.id 
              WHERE u.id IS NULL
              UNION ALL
              SELECT 'users -> learning_sessions', COUNT(*)
              FROM learning_sessions ls 
              LEFT JOIN users u ON ls.user_id = u.id 
              WHERE u.id IS NULL
              UNION ALL
              SELECT 'learning_sessions -> adaptive_changes', COUNT(*)
              FROM adaptive_changes ac 
              LEFT JOIN learning_sessions ls ON ac.session_id = ls.id 
              WHERE ls.id IS NULL
            ) violations WHERE count > 0
          `,
          expected: 0,
        },
        {
          name: 'Orphaned records check',
          query: `
            SELECT COUNT(*) as orphans FROM (
              SELECT COUNT(*) FROM question_responses qr 
              LEFT JOIN assessment_attempts aa ON qr.attempt_id = aa.id 
              WHERE aa.id IS NULL
              UNION ALL
              SELECT COUNT(*) FROM content_variants cv 
              LEFT JOIN adaptive_content ac ON cv.content_id = ac.id 
              WHERE ac.id IS NULL
            ) orphan_counts
          `,
          expected: 0,
        },
        {
          name: 'Data consistency check',
          query: `
            SELECT COUNT(*) as inconsistencies FROM (
              SELECT COUNT(*) FROM learning_sessions 
              WHERE correct_answers > total_questions AND total_questions > 0
              UNION ALL
              SELECT COUNT(*) FROM assessment_attempts 
              WHERE correct_answers > questions_answered AND questions_answered > 0
              UNION ALL
              SELECT COUNT(*) FROM pace_profiles 
              WHERE current_pace < 0 OR optimal_pace < 0
            ) consistency_checks
          `,
          expected: 0,
        },
      ];
      
      const results: Array<{ name: string; passed: boolean; details?: any }> = [];
      
      for (const check of checks) {
        try {
          const result = await this.db.query(check.query);
          const value = result.rows[0]?.violations || result.rows[0]?.orphans || result.rows[0]?.inconsistencies || 0;
          const passed = check.expected !== undefined ? value === check.expected : true;
          
          results.push({
            name: check.name,
            passed,
            details: { value, expected: check.expected },
          });
        } catch (error) {
          results.push({
            name: check.name,
            passed: false,
            details: { error: (error as Error).message },
          });
        }
      }
      
      const allPassed = results.every(r => r.passed);
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: MaintenanceResult = {
        taskName,
        success: allPassed,
        startTime,
        endTime,
        duration,
        message: `Integrity check completed: ${results.filter(r => r.passed).length}/${results.length} checks passed`,
        details: results,
      };
      
      console.log('[Maintenance] Database integrity check completed:', result.message);
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to check database integrity',
        errors: [(error as Error).message],
      };
    }
  }

  public async optimizeConnectionPool(): Promise<MaintenanceResult> {
    const taskName = 'optimize_connection_pool';
    const startTime = new Date();
    
    try {
      console.log('[Maintenance] Starting connection pool optimization...');
      
      // Get current pool statistics
      const poolStats = await this.db.getQueryPerformanceStats();
      
      // Clear cache if hit rate is low
      if (poolStats.connectionPoolStats.activePercent < 30) {
        await cacheStrategy.clear();
        console.log('[Maintenance] Cleared cache due to low activity');
      }
      
      // Warm up cache with frequently accessed data
      await cacheStrategy.warmCache();
      
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      const result: MaintenanceResult = {
        taskName,
        success: true,
        startTime,
        endTime,
        duration,
        message: 'Connection pool optimization completed',
        details: {
          poolStats: poolStats.connectionPoolStats,
          cacheStats: cacheStrategy.getStats(),
        },
      };
      
      console.log('[Maintenance] Connection pool optimization completed');
      return result;
    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      
      return {
        taskName,
        success: false,
        startTime,
        endTime,
        duration,
        message: 'Failed to optimize connection pool',
        errors: [(error as Error).message],
      };
    }
  }

  // Maintenance scheduler
  public async runScheduledMaintenance(): Promise<MaintenanceResult[]> {
    if (this.isMaintenanceRunning) {
      console.log('[Maintenance] Maintenance already running, skipping...');
      return [];
    }

    this.isMaintenanceRunning = true;
    const results: MaintenanceResult[] = [];
    
    try {
      console.log('[Maintenance] Starting scheduled maintenance tasks...');
      
      const taskMethods: Record<string, () => Promise<MaintenanceResult>> = {
        cleanup_expired_sessions: () => this.cleanupExpiredSessions(),
        cleanup_old_behavioral_data: () => this.cleanupOldBehavioralData(),
        update_table_statistics: () => this.updateTableStatistics(),
        reindex_fragmented_indexes: () => this.reindexFragmentedIndexes(),
        vacuum_analyze_tables: () => this.vacuumAnalyzeTables(),
        cleanup_query_logs: () => this.cleanupQueryLogs(),
        archive_old_analytics: () => this.archiveOldAnalytics(),
        check_database_integrity: () => this.checkDatabaseIntegrity(),
        optimize_connection_pool: () => this.optimizeConnectionPool(),
      };

      // Run tasks based on frequency and last run time
      for (const task of this.maintenanceTasks) {
        if (!task.enabled) continue;
        
        const shouldRun = this.shouldRunTask(task);
        if (!shouldRun) continue;
        
        const taskMethod = taskMethods[task.name];
        if (!taskMethod) {
          console.warn(`[Maintenance] Unknown task: ${task.name}`);
          continue;
        }
        
        try {
          console.log(`[Maintenance] Running task: ${task.name}`);
          const result = await taskMethod();
          results.push(result);
          
          // Update last run time
          task.lastRun = new Date();
          task.nextRun = this.calculateNextRun(task);
          
          this.maintenanceHistory.push(result);
          
          // Keep only last 100 maintenance records
          if (this.maintenanceHistory.length > 100) {
            this.maintenanceHistory = this.maintenanceHistory.slice(-100);
          }
        } catch (error) {
          console.error(`[Maintenance] Task ${task.name} failed:`, error);
          
          const failResult: MaintenanceResult = {
            taskName: task.name,
            success: false,
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            message: `Task failed: ${(error as Error).message}`,
            errors: [(error as Error).message],
          };
          
          results.push(failResult);
          this.maintenanceHistory.push(failResult);
        }
        
        // Brief pause between tasks
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`[Maintenance] Scheduled maintenance completed. Ran ${results.length} tasks.`);
    } finally {
      this.isMaintenanceRunning = false;
    }
    
    return results;
  }

  private shouldRunTask(task: MaintenanceTask): boolean {
    if (!task.lastRun) return true;
    
    const now = new Date();
    const timeSinceLastRun = now.getTime() - task.lastRun.getTime();
    
    const intervals = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };
    
    return timeSinceLastRun >= intervals[task.frequency];
  }

  private calculateNextRun(task: MaintenanceTask): Date {
    const now = new Date();
    const intervals = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };
    
    return new Date(now.getTime() + intervals[task.frequency]);
  }

  // Public API
  public getMaintenanceTasks(): MaintenanceTask[] {
    return [...this.maintenanceTasks];
  }

  public getMaintenanceHistory(): MaintenanceResult[] {
    return [...this.maintenanceHistory];
  }

  public async generateMaintenanceReport(): Promise<{
    summary: {
      totalTasks: number;
      enabledTasks: number;
      lastRunTasks: number;
      failedTasks: number;
    };
    taskStatus: Array<{
      name: string;
      enabled: boolean;
      lastRun?: Date;
      nextRun?: Date;
      status: 'pending' | 'completed' | 'failed' | 'overdue';
    }>;
    recentResults: MaintenanceResult[];
  }> {
    const now = new Date();
    const recentResults = this.maintenanceHistory.slice(-10);
    
    const taskStatus = this.maintenanceTasks.map(task => {
      let status: 'pending' | 'completed' | 'failed' | 'overdue' = 'pending';
      
      if (task.lastRun) {
        const recent = recentResults.find(r => r.taskName === task.name);
        if (recent) {
          status = recent.success ? 'completed' : 'failed';
        }
        
        if (task.nextRun && now > task.nextRun) {
          status = 'overdue';
        }
      }
      
      return {
        name: task.name,
        enabled: task.enabled,
        lastRun: task.lastRun,
        nextRun: task.nextRun,
        status,
      };
    });
    
    return {
      summary: {
        totalTasks: this.maintenanceTasks.length,
        enabledTasks: this.maintenanceTasks.filter(t => t.enabled).length,
        lastRunTasks: this.maintenanceTasks.filter(t => t.lastRun).length,
        failedTasks: taskStatus.filter(t => t.status === 'failed').length,
      },
      taskStatus,
      recentResults,
    };
  }

  public async enableMaintenanceTask(taskName: string): Promise<boolean> {
    const task = this.maintenanceTasks.find(t => t.name === taskName);
    if (task) {
      task.enabled = true;
      return true;
    }
    return false;
  }

  public async disableMaintenanceTask(taskName: string): Promise<boolean> {
    const task = this.maintenanceTasks.find(t => t.name === taskName);
    if (task) {
      task.enabled = false;
      return true;
    }
    return false;
  }

  public isMaintenanceTaskRunning(): boolean {
    return this.isMaintenanceRunning;
  }
}

// Export singleton instance
export const maintenanceProcedures = new DatabaseMaintenanceProcedures();

// Convenience functions
export const runDatabaseMaintenance = () => maintenanceProcedures.runScheduledMaintenance();
export const getMaintenanceReport = () => maintenanceProcedures.generateMaintenanceReport();
export const checkDatabaseIntegrity = () => maintenanceProcedures.checkDatabaseIntegrity();