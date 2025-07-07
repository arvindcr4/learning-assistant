# Database Optimization and Performance Tuning

This document provides comprehensive information about the database optimization and performance tuning implementation for the Learning Assistant application.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Connection Management](#database-connection-management)
4. [Query Performance Monitoring](#query-performance-monitoring)
5. [Database Replication](#database-replication)
6. [Table Partitioning](#table-partitioning)
7. [PostgreSQL Configuration](#postgresql-configuration)
8. [Maintenance Automation](#maintenance-automation)
9. [Monitoring and Alerting](#monitoring-and-alerting)
10. [Deployment Guide](#deployment-guide)
11. [Performance Tuning Guide](#performance-tuning-guide)
12. [Troubleshooting](#troubleshooting)

## Overview

The database optimization system provides comprehensive performance tuning and scalability features for the PostgreSQL database powering the Learning Assistant application. The system includes:

- **Intelligent Connection Pooling**: Advanced connection pool management with load balancing
- **Real-time Monitoring**: Query performance tracking and slow query detection
- **High Availability**: Master-slave replication with automatic failover
- **Horizontal Scaling**: Table partitioning for large datasets
- **Production Optimization**: Tuned PostgreSQL configuration for learning workloads
- **Automated Maintenance**: Scheduled database optimization and cleanup tasks

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Database Connection Layer                                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Connection Pool │  │ Query Monitor   │                  │
│  │ Manager         │  │ & Analytics     │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Database Layer                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Primary DB      │  │ Replica DB      │                  │
│  │ (Read/Write)    │  │ (Read Only)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Partitioned     │  │ Monitoring &    │                  │
│  │ Tables          │  │ Alerting        │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/lib/
├── database.ts              # Core database connection with monitoring
├── db-pool.ts              # Advanced connection pool management
└── db-monitoring.ts        # Performance monitoring and alerting

scripts/db/
├── setup-replication.sql   # Database replication configuration
├── setup-partitioning.sql  # Table partitioning setup
└── maintenance.sh          # Automated maintenance scripts

deploy/db/
└── postgresql.conf         # Optimized PostgreSQL configuration
```

## Database Connection Management

### Core Database Connection (`src/lib/database.ts`)

The `DatabaseConnection` class provides:

- **Connection Pooling**: Intelligent pool sizing with health monitoring
- **Query Performance Tracking**: Automatic slow query detection
- **Retry Logic**: Automatic retry with exponential backoff
- **Health Checking**: Periodic database health verification
- **Metrics Collection**: Comprehensive performance metrics

#### Basic Usage

```typescript
import { createDatabase, getDatabaseConfig } from '@/lib/database';

// Create database instance
const config = getDatabaseConfig();
const db = createDatabase(config);

// Execute queries with automatic monitoring
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// Execute transactions
const transactionResult = await db.transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  return client.query('SELECT ...');
});
```

#### Configuration Options

```typescript
const config: DatabaseConfig = {
  connectionString: process.env.DATABASE_URL,
  maxConnections: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  slowQueryThreshold: 1000,
  enableQueryLogging: true,
  enablePerformanceMetrics: true,
  maxRetries: 3,
  retryDelay: 1000,
  healthCheckInterval: 60000,
};
```

### Advanced Pool Management (`src/lib/db-pool.ts`)

The `DatabasePoolManager` provides:

- **Read/Write Splitting**: Automatic query routing to appropriate servers
- **Load Balancing**: Intelligent connection distribution
- **Failover Support**: Automatic failover to replica servers
- **Health Monitoring**: Continuous health checks for all servers

#### Usage Example

```typescript
import { createPoolManager, getPoolManagerConfig } from '@/lib/db-pool';

const config = getPoolManagerConfig();
const poolManager = createPoolManager(config);

// Read queries automatically route to replicas
const users = await poolManager.queryRead('SELECT * FROM users');

// Write queries always use primary
const result = await poolManager.queryWrite('INSERT INTO users ...');

// Explicit routing
const data = await poolManager.query('SELECT ...', [], { readOnly: true });
```

## Query Performance Monitoring

### Real-time Monitoring (`src/lib/db-monitoring.ts`)

The `DatabaseMonitor` class provides:

- **Slow Query Detection**: Automatic identification of performance issues
- **Query Analysis**: Detailed performance analytics with optimization suggestions
- **Health Metrics**: Comprehensive database health monitoring
- **Alert Generation**: Configurable alerting for performance issues

#### Monitoring Setup

```typescript
import { DatabaseMonitor } from '@/lib/db-monitoring';

const monitor = new DatabaseMonitor(database, poolManager, {
  slowQueryThreshold: 1000,
  criticalSlowQueryThreshold: 5000,
  connectionThreshold: 0.8,
  errorRateThreshold: 0.05,
  enableSlowQueryAlerts: true,
  enableConnectionAlerts: true,
  enableErrorRateAlerts: true,
});

// Listen for alerts
monitor.on('alert', (alert) => {
  console.log(`Database Alert: ${alert.type}`, alert.data);
});

// Listen for slow queries
monitor.on('slowQuery', (metrics) => {
  console.log(`Slow Query Detected: ${metrics.duration}ms`, metrics.query);
});
```

#### Performance Metrics

The monitoring system tracks:

- **Query Performance**: Execution time, frequency, error rates
- **Connection Health**: Pool utilization, wait times, failures
- **Database Health**: Cache hit ratio, lock waits, deadlocks
- **Resource Usage**: Memory, disk, CPU utilization
- **Table Statistics**: Row counts, bloat, index usage

## Database Replication

### Replication Setup

The replication system provides:

- **Streaming Replication**: Real-time data synchronization
- **Automatic Failover**: Seamless switching to replica servers
- **Load Balancing**: Read traffic distribution across replicas
- **Monitoring**: Comprehensive replication lag tracking

#### Primary Server Setup

```sql
-- Update postgresql.conf
wal_level = replica
archive_mode = on
max_wal_senders = 5
wal_keep_size = 2GB
hot_standby = on

-- Create replication user
CREATE USER replication_user WITH REPLICATION LOGIN PASSWORD 'secure_password';

-- Configure pg_hba.conf
host replication replication_user replica_ip/32 md5
```

#### Replica Server Setup

```bash
# Stop PostgreSQL on replica
sudo systemctl stop postgresql

# Create base backup
pg_basebackup -h primary_ip -D /var/lib/postgresql/data -U replication_user -P -W -R

# Start PostgreSQL
sudo systemctl start postgresql
```

#### Replication Monitoring

```sql
-- Check replication status on primary
SELECT * FROM replication_status;

-- Check replica lag
SELECT * FROM replica_lag_status;

-- Get optimal connection for queries
SELECT * FROM get_optimal_connection(true); -- read-only query
SELECT * FROM get_optimal_connection(false); -- write query
```

## Table Partitioning

### Partitioning Strategy

Large tables are partitioned by date for optimal performance:

- **learning_sessions**: Monthly partitions by start_time
- **behavioral_indicators**: Monthly partitions by timestamp
- **assessment_attempts**: Monthly partitions by started_at

#### Creating Partitions

```sql
-- Create partitioned table
CREATE TABLE learning_sessions_partitioned (
    -- table definition
) PARTITION BY RANGE (start_time);

-- Create monthly partitions
CREATE TABLE learning_sessions_2025_01 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

#### Automated Partition Management

```sql
-- Create future partitions
SELECT create_future_partitions('learning_sessions_partitioned', 6);

-- Drop old partitions
SELECT drop_old_partitions('learning_sessions_partitioned', 12);

-- Full maintenance
SELECT maintain_partitions();
```

#### Partition Statistics

```sql
-- View partition information
SELECT * FROM partition_info;

-- Get partition statistics
SELECT * FROM get_partition_stats();
SELECT * FROM get_partition_stats('learning_sessions_partitioned');
```

## PostgreSQL Configuration

### Production Configuration

The optimized `postgresql.conf` includes:

#### Memory Settings
```conf
shared_buffers = 2GB                  # 25% of total RAM
effective_cache_size = 6GB            # 75% of total RAM
work_mem = 32MB                       # Memory for operations
maintenance_work_mem = 512MB          # Maintenance memory
```

#### Connection Settings
```conf
max_connections = 200                 # Increased for pooling
superuser_reserved_connections = 5    # Reserved connections
```

#### WAL and Replication
```conf
wal_level = replica                   # Enable replication
wal_buffers = 64MB                    # WAL buffer size
max_wal_senders = 5                   # Replication senders
archive_mode = on                     # Enable archiving
```

#### Query Optimization
```conf
random_page_cost = 1.1                # SSD-optimized
seq_page_cost = 1.0                   # Sequential reads
default_statistics_target = 1000      # Better query plans
constraint_exclusion = partition      # Partition pruning
```

#### Monitoring
```conf
shared_preload_libraries = 'pg_stat_statements,auto_explain,pg_prewarm'
log_min_duration_statement = 1000     # Log slow queries
track_io_timing = on                  # Track I/O timing
```

## Maintenance Automation

### Automated Maintenance Script

The `maintenance.sh` script provides:

- **VACUUM Operations**: Automatic dead tuple cleanup
- **ANALYZE Operations**: Statistics updates for query planning
- **REINDEX Operations**: Index maintenance and optimization
- **Partition Maintenance**: Automated partition creation/cleanup
- **Backup Operations**: Automated database backups
- **Log Cleanup**: Automatic log file rotation and cleanup

#### Running Maintenance

```bash
# Basic maintenance
./scripts/db/maintenance.sh

# Full maintenance with backup
./scripts/db/maintenance.sh full

# Specific operations
./scripts/db/maintenance.sh vacuum
./scripts/db/maintenance.sh analyze
./scripts/db/maintenance.sh backup
./scripts/db/maintenance.sh partitions
```

#### Scheduled Maintenance

Add to crontab for automated execution:

```cron
# Daily maintenance at 2 AM
0 2 * * * /path/to/scripts/db/maintenance.sh

# Weekly full maintenance on Sundays
0 1 * * 0 /path/to/scripts/db/maintenance.sh full

# Partition maintenance weekly
0 3 * * 0 /path/to/scripts/db/maintenance.sh partitions
```

## Monitoring and Alerting

### Alert Types

The monitoring system generates alerts for:

- **Slow Queries**: Queries exceeding performance thresholds
- **High Connection Usage**: Pool utilization above threshold
- **High Error Rate**: Query failure rate above threshold
- **Replication Lag**: Replica synchronization delays
- **Resource Usage**: High disk/memory/CPU usage
- **Connection Failures**: Database connectivity issues

### Alert Configuration

```typescript
const alertConfig = {
  slowQueryThreshold: 1000,           // 1 second
  criticalSlowQueryThreshold: 5000,   // 5 seconds
  connectionThreshold: 0.8,           // 80% pool usage
  errorRateThreshold: 0.05,           // 5% error rate
  diskUsageThreshold: 0.85,           // 85% disk usage
  alertCooldown: 300000,              // 5 minutes
};
```

### Performance Metrics Dashboard

Key metrics to monitor:

- **Query Performance**: Average execution time, slow query count
- **Connection Pool**: Active connections, wait times, utilization
- **Database Health**: Cache hit ratio, lock waits, deadlocks
- **Replication**: Lag time, connection status, throughput
- **Resource Usage**: Disk space, memory usage, CPU load

## Deployment Guide

### Prerequisites

1. **PostgreSQL 13+**: Required for partitioning and replication features
2. **Extensions**: Install required PostgreSQL extensions
3. **System Resources**: Adequate RAM and disk space
4. **Network**: Proper firewall configuration for replication

### Installation Steps

1. **Install Extensions**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS auto_explain;
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
```

2. **Deploy Configuration**:
```bash
# Backup current configuration
sudo cp /etc/postgresql/*/main/postgresql.conf postgresql.conf.backup

# Deploy optimized configuration
sudo cp deploy/db/postgresql.conf /etc/postgresql/*/main/

# Restart PostgreSQL
sudo systemctl restart postgresql
```

3. **Setup Replication** (if required):
```bash
# Run replication setup script
psql -d learning_assistant -f scripts/db/setup-replication.sql
```

4. **Setup Partitioning**:
```bash
# Run partitioning setup script
psql -d learning_assistant -f scripts/db/setup-partitioning.sql
```

5. **Configure Monitoring**:
```typescript
// In your application startup
import { createDatabase, createPoolManager, DatabaseMonitor } from '@/lib';

const db = createDatabase(getDatabaseConfig());
const poolManager = createPoolManager(getPoolManagerConfig());
const monitor = new DatabaseMonitor(db, poolManager);
```

6. **Setup Maintenance**:
```bash
# Make script executable
chmod +x scripts/db/maintenance.sh

# Add to crontab
crontab -e
# Add maintenance schedule
```

### Environment Variables

Required environment variables:

```env
# Primary database
DATABASE_URL=postgresql://user:password@localhost:5432/learning_assistant

# Replica database (optional)
DATABASE_REPLICA_URL=postgresql://user:password@replica:5432/learning_assistant

# Connection pool settings
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Monitoring settings
DB_SLOW_QUERY_THRESHOLD=1000
DB_ENABLE_QUERY_LOGGING=true
DB_HEALTH_CHECK_INTERVAL=60000

# Maintenance settings
DB_BACKUP_ENABLED=true
DB_MAINTENANCE_SCHEDULE="0 2 * * *"
```

## Performance Tuning Guide

### Query Optimization

1. **Index Usage**:
   - Monitor `pg_stat_user_indexes` for unused indexes
   - Create indexes for frequently used WHERE clauses
   - Use partial indexes for filtered queries

2. **Query Patterns**:
   - Avoid SELECT * in application queries
   - Use LIMIT for large result sets
   - Optimize JOIN operations with proper indexes

3. **Statistics**:
   - Keep table statistics current with regular ANALYZE
   - Increase `default_statistics_target` for complex queries
   - Use extended statistics for correlated columns

### Connection Pool Tuning

1. **Pool Size**:
   - Start with `max_connections = 20`
   - Monitor connection utilization
   - Adjust based on application concurrency

2. **Timeouts**:
   - Set appropriate `idle_timeout` (30 seconds)
   - Configure `connection_timeout` (2 seconds)
   - Adjust `query_timeout` based on workload

### Memory Optimization

1. **Buffer Settings**:
   - `shared_buffers`: 25% of total RAM
   - `effective_cache_size`: 75% of total RAM
   - `work_mem`: Based on concurrent queries

2. **Monitoring**:
   - Track cache hit ratio (target: >95%)
   - Monitor buffer usage patterns
   - Adjust based on workload characteristics

### Disk Optimization

1. **Storage Configuration**:
   - Use SSDs for optimal performance
   - Separate WAL files from data files
   - Configure appropriate `random_page_cost`

2. **Maintenance**:
   - Regular VACUUM to reclaim space
   - Monitor table bloat
   - Reindex when necessary

## Troubleshooting

### Common Issues

#### High Connection Usage
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Identify long-running queries
SELECT pid, query, state, query_start 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start;
```

#### Slow Query Performance
```sql
-- Check slow queries
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;

-- Check missing indexes
SELECT schemaname, tablename, seq_scan, seq_tup_read, 
       idx_scan, seq_tup_read / seq_scan as avg_tup_read
FROM pg_stat_user_tables 
WHERE seq_scan > 0 
ORDER BY avg_tup_read DESC;
```

#### Replication Issues
```sql
-- Check replication lag
SELECT * FROM replica_lag_status;

-- Check replication connection
SELECT * FROM pg_stat_replication;
```

#### High Resource Usage
```sql
-- Check table sizes
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check database size
SELECT pg_size_pretty(pg_database_size(current_database()));
```

### Performance Monitoring

#### Key Metrics to Track
- Query execution time and frequency
- Connection pool utilization
- Cache hit ratio
- Replication lag
- Disk usage and growth
- Memory usage patterns

#### Alert Thresholds
- Slow queries: > 1 second
- Connection usage: > 80%
- Cache hit ratio: < 95%
- Replication lag: > 60 seconds
- Disk usage: > 85%

### Recovery Procedures

#### Database Recovery
1. Identify the issue using monitoring data
2. Check logs for error messages
3. Verify connectivity and resource availability
4. Apply appropriate fixes (restart, configuration, scaling)
5. Monitor performance after recovery

#### Failover Procedure
1. Verify primary database failure
2. Promote replica to primary
3. Update application connection strings
4. Verify application functionality
5. Setup new replica when primary is restored

## Best Practices

### Development
- Use connection pooling in all environments
- Monitor query performance during development
- Test with realistic data volumes
- Use transactions appropriately

### Production
- Monitor all key metrics continuously
- Set up appropriate alerting
- Perform regular maintenance
- Keep backups current and tested
- Document incident response procedures

### Security
- Use SSL for all connections
- Implement proper authentication
- Regular security updates
- Monitor for suspicious activity
- Follow principle of least privilege

---

For additional support or questions about the database optimization system, please refer to the PostgreSQL documentation or contact the development team.