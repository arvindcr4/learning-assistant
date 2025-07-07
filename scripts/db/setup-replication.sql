-- Database Replication Setup Script
-- This script sets up PostgreSQL streaming replication for the learning assistant database

-- ==========================================
-- PRIMARY DATABASE CONFIGURATION
-- ==========================================

-- Enable WAL archiving and streaming replication
-- These settings should be added to postgresql.conf on the primary server

/*
-- Primary server postgresql.conf settings:
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'
max_wal_senders = 5
wal_keep_segments = 32
hot_standby = on
*/

-- Create replication user
CREATE USER replication_user WITH REPLICATION LOGIN PASSWORD 'secure_replication_password';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE learning_assistant TO replication_user;
GRANT USAGE ON SCHEMA public TO replication_user;

-- Add replication user to pg_hba.conf
-- Add this line to pg_hba.conf on primary server:
-- host replication replication_user replica_server_ip/32 md5

-- ==========================================
-- REPLICA DATABASE SETUP
-- ==========================================

-- Commands to run on replica server (run as postgres user):
/*
-- 1. Stop PostgreSQL on replica
sudo systemctl stop postgresql

-- 2. Clear data directory
sudo rm -rf /var/lib/postgresql/data/*

-- 3. Create base backup from primary
pg_basebackup -h primary_server_ip -D /var/lib/postgresql/data -U replication_user -P -W -R

-- 4. Start PostgreSQL on replica
sudo systemctl start postgresql
*/

-- ==========================================
-- READ REPLICA OPTIMIZATION
-- ==========================================

-- Create read-only queries optimization
CREATE OR REPLACE FUNCTION is_in_recovery() RETURNS boolean AS $$
BEGIN
    RETURN pg_is_in_recovery();
END;
$$ LANGUAGE plpgsql;

-- Create read-only connection routing function
CREATE OR REPLACE FUNCTION get_connection_info() RETURNS TABLE(
    server_role text,
    is_replica boolean,
    last_wal_receive_lsn pg_lsn,
    last_wal_replay_lsn pg_lsn,
    receive_delay interval,
    replay_delay interval
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN pg_is_in_recovery() THEN 'replica'
            ELSE 'primary'
        END as server_role,
        pg_is_in_recovery() as is_replica,
        pg_last_wal_receive_lsn() as last_wal_receive_lsn,
        pg_last_wal_replay_lsn() as last_wal_replay_lsn,
        CASE 
            WHEN pg_is_in_recovery() THEN 
                now() - pg_last_xact_replay_timestamp()
            ELSE NULL
        END as receive_delay,
        CASE 
            WHEN pg_is_in_recovery() THEN 
                now() - pg_last_xact_replay_timestamp()
            ELSE NULL
        END as replay_delay;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- MONITORING VIEWS FOR REPLICATION
-- ==========================================

-- Primary server replication status view
CREATE OR REPLACE VIEW replication_status AS
SELECT 
    client_addr,
    client_hostname,
    client_port,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state,
    sync_priority
FROM pg_stat_replication;

-- Replica server lag monitoring view
CREATE OR REPLACE VIEW replica_lag_status AS
SELECT 
    CASE 
        WHEN pg_is_in_recovery() THEN 'replica'
        ELSE 'primary'
    END as server_role,
    pg_is_in_recovery() as is_replica,
    pg_last_wal_receive_lsn() as last_wal_receive_lsn,
    pg_last_wal_replay_lsn() as last_wal_replay_lsn,
    CASE 
        WHEN pg_is_in_recovery() THEN 
            extract(epoch from now() - pg_last_xact_replay_timestamp())
        ELSE NULL
    END as replay_lag_seconds,
    CASE 
        WHEN pg_is_in_recovery() THEN 
            pg_last_xact_replay_timestamp()
        ELSE NULL
    END as last_xact_replay_timestamp;

-- ==========================================
-- LOAD BALANCING CONFIGURATION
-- ==========================================

-- Create connection routing table
CREATE TABLE IF NOT EXISTS connection_routing (
    id SERIAL PRIMARY KEY,
    server_name VARCHAR(100) NOT NULL,
    server_host VARCHAR(255) NOT NULL,
    server_port INTEGER NOT NULL DEFAULT 5432,
    server_role VARCHAR(20) NOT NULL CHECK (server_role IN ('primary', 'replica')),
    is_active BOOLEAN DEFAULT true,
    weight INTEGER DEFAULT 1,
    max_connections INTEGER DEFAULT 100,
    current_connections INTEGER DEFAULT 0,
    health_status VARCHAR(20) DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    last_health_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default server configurations
INSERT INTO connection_routing (server_name, server_host, server_port, server_role, weight, max_connections)
VALUES 
    ('primary-db', 'localhost', 5432, 'primary', 1, 100),
    ('replica-db', 'replica-host', 5432, 'replica', 2, 50)
ON CONFLICT DO NOTHING;

-- Create function to get optimal connection
CREATE OR REPLACE FUNCTION get_optimal_connection(
    p_read_only BOOLEAN DEFAULT false,
    p_require_primary BOOLEAN DEFAULT false
) RETURNS TABLE(
    server_name VARCHAR(100),
    server_host VARCHAR(255),
    server_port INTEGER,
    server_role VARCHAR(20)
) AS $$
BEGIN
    -- If primary is required, return primary
    IF p_require_primary THEN
        RETURN QUERY
        SELECT cr.server_name, cr.server_host, cr.server_port, cr.server_role
        FROM connection_routing cr
        WHERE cr.server_role = 'primary' 
          AND cr.is_active = true 
          AND cr.health_status = 'healthy'
        ORDER BY cr.current_connections ASC
        LIMIT 1;
        RETURN;
    END IF;

    -- For read-only queries, prefer replicas
    IF p_read_only THEN
        RETURN QUERY
        SELECT cr.server_name, cr.server_host, cr.server_port, cr.server_role
        FROM connection_routing cr
        WHERE cr.is_active = true 
          AND cr.health_status = 'healthy'
          AND cr.current_connections < cr.max_connections
        ORDER BY 
            CASE WHEN cr.server_role = 'replica' THEN 1 ELSE 2 END,
            cr.current_connections * 1.0 / cr.max_connections ASC,
            cr.weight DESC
        LIMIT 1;
        RETURN;
    END IF;

    -- For write queries, use primary
    RETURN QUERY
    SELECT cr.server_name, cr.server_host, cr.server_port, cr.server_role
    FROM connection_routing cr
    WHERE cr.server_role = 'primary' 
      AND cr.is_active = true 
      AND cr.health_status = 'healthy'
    ORDER BY cr.current_connections ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- FAILOVER PROCEDURES
-- ==========================================

-- Create failover status table
CREATE TABLE IF NOT EXISTS failover_status (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    from_server VARCHAR(100),
    to_server VARCHAR(100),
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_by VARCHAR(100),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Function to trigger failover
CREATE OR REPLACE FUNCTION trigger_failover(
    p_reason TEXT DEFAULT 'Manual failover',
    p_triggered_by VARCHAR(100) DEFAULT 'system'
) RETURNS BOOLEAN AS $$
DECLARE
    v_primary_server VARCHAR(100);
    v_replica_server VARCHAR(100);
    v_failover_id INTEGER;
BEGIN
    -- Get current primary and best replica
    SELECT server_name INTO v_primary_server
    FROM connection_routing
    WHERE server_role = 'primary' AND is_active = true
    LIMIT 1;

    SELECT server_name INTO v_replica_server
    FROM connection_routing
    WHERE server_role = 'replica' AND is_active = true AND health_status = 'healthy'
    ORDER BY weight DESC
    LIMIT 1;

    -- Record failover event
    INSERT INTO failover_status (event_type, from_server, to_server, triggered_by, reason, status)
    VALUES ('failover', v_primary_server, v_replica_server, p_triggered_by, p_reason, 'pending')
    RETURNING id INTO v_failover_id;

    -- Update server roles (this would typically be done by external tooling)
    UPDATE connection_routing 
    SET server_role = 'replica', is_active = false
    WHERE server_name = v_primary_server;

    UPDATE connection_routing 
    SET server_role = 'primary', is_active = true
    WHERE server_name = v_replica_server;

    -- Mark failover as completed
    UPDATE failover_status 
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP
    WHERE id = v_failover_id;

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    -- Mark failover as failed
    UPDATE failover_status 
    SET status = 'failed', error_message = SQLERRM, completed_at = CURRENT_TIMESTAMP
    WHERE id = v_failover_id;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- HEALTH CHECK PROCEDURES
-- ==========================================

-- Function to check server health
CREATE OR REPLACE FUNCTION check_server_health(
    p_server_name VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_healthy BOOLEAN := false;
BEGIN
    -- This is a simplified health check
    -- In practice, this would connect to the actual server
    
    -- Simulate health check
    IF random() > 0.1 THEN -- 90% chance of being healthy
        v_is_healthy := true;
    END IF;

    -- Update health status
    UPDATE connection_routing
    SET 
        health_status = CASE WHEN v_is_healthy THEN 'healthy' ELSE 'unhealthy' END,
        last_health_check = CURRENT_TIMESTAMP
    WHERE server_name = p_server_name;

    RETURN v_is_healthy;
END;
$$ LANGUAGE plpgsql;

-- Function to perform health checks on all servers
CREATE OR REPLACE FUNCTION perform_health_checks() RETURNS TABLE(
    server_name VARCHAR(100),
    is_healthy BOOLEAN,
    health_status VARCHAR(20)
) AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT cr.server_name FROM connection_routing cr WHERE cr.is_active = true LOOP
        RETURN QUERY
        SELECT 
            r.server_name,
            check_server_health(r.server_name) as is_healthy,
            cr.health_status
        FROM connection_routing cr
        WHERE cr.server_name = r.server_name;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- MONITORING AND ALERTING
-- ==========================================

-- Create replication monitoring table
CREATE TABLE IF NOT EXISTS replication_monitoring (
    id SERIAL PRIMARY KEY,
    server_name VARCHAR(100) NOT NULL,
    server_role VARCHAR(20) NOT NULL,
    lag_seconds NUMERIC(10,2),
    bytes_behind BIGINT,
    last_wal_receive_lsn pg_lsn,
    last_wal_replay_lsn pg_lsn,
    is_connected BOOLEAN DEFAULT true,
    sync_state VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to record replication metrics
CREATE OR REPLACE FUNCTION record_replication_metrics() RETURNS VOID AS $$
BEGIN
    -- Record primary server metrics
    IF NOT pg_is_in_recovery() THEN
        INSERT INTO replication_monitoring (
            server_name, server_role, lag_seconds, bytes_behind, 
            last_wal_receive_lsn, last_wal_replay_lsn, is_connected, sync_state
        )
        SELECT 
            'primary-' || client_addr::text,
            'primary',
            extract(epoch from coalesce(replay_lag, '0'::interval)),
            pg_wal_lsn_diff(sent_lsn, replay_lsn),
            sent_lsn,
            replay_lsn,
            state = 'streaming',
            sync_state
        FROM pg_stat_replication;
    ELSE
        -- Record replica server metrics
        INSERT INTO replication_monitoring (
            server_name, server_role, lag_seconds, bytes_behind,
            last_wal_receive_lsn, last_wal_replay_lsn, is_connected
        )
        SELECT 
            'replica-' || inet_server_addr()::text,
            'replica',
            extract(epoch from now() - pg_last_xact_replay_timestamp()),
            pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn()),
            pg_last_wal_receive_lsn(),
            pg_last_wal_replay_lsn(),
            pg_last_wal_receive_lsn() IS NOT NULL;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create alerts table
CREATE TABLE IF NOT EXISTS replication_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    server_name VARCHAR(100),
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    threshold_value NUMERIC,
    current_value NUMERIC,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Function to check replication lag and create alerts
CREATE OR REPLACE FUNCTION check_replication_lag() RETURNS VOID AS $$
DECLARE
    v_lag_threshold NUMERIC := 60; -- 60 seconds
    v_critical_lag_threshold NUMERIC := 300; -- 5 minutes
    r RECORD;
BEGIN
    -- Check for high lag
    FOR r IN 
        SELECT server_name, lag_seconds
        FROM replication_monitoring
        WHERE recorded_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          AND lag_seconds > v_lag_threshold
    LOOP
        INSERT INTO replication_alerts (
            alert_type, server_name, message, severity, threshold_value, current_value
        )
        VALUES (
            'high_replication_lag',
            r.server_name,
            'Replication lag is high: ' || r.lag_seconds || ' seconds',
            CASE WHEN r.lag_seconds > v_critical_lag_threshold THEN 'critical' ELSE 'warning' END,
            v_lag_threshold,
            r.lag_seconds
        );
    END LOOP;

    -- Check for disconnected replicas
    FOR r IN 
        SELECT server_name
        FROM replication_monitoring
        WHERE recorded_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
          AND is_connected = false
    LOOP
        INSERT INTO replication_alerts (
            alert_type, server_name, message, severity
        )
        VALUES (
            'replica_disconnected',
            r.server_name,
            'Replica server is disconnected',
            'critical'
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- COMMENTS AND DOCUMENTATION
-- ==========================================

COMMENT ON TABLE connection_routing IS 'Configuration for database connection routing and load balancing';
COMMENT ON TABLE failover_status IS 'History of failover events and their status';
COMMENT ON TABLE replication_monitoring IS 'Replication metrics and lag monitoring';
COMMENT ON TABLE replication_alerts IS 'Alerts for replication issues';

COMMENT ON FUNCTION get_optimal_connection IS 'Returns the optimal database connection based on read/write requirements';
COMMENT ON FUNCTION trigger_failover IS 'Triggers a failover from primary to replica server';
COMMENT ON FUNCTION check_server_health IS 'Performs health check on a specific server';
COMMENT ON FUNCTION record_replication_metrics IS 'Records current replication metrics';
COMMENT ON FUNCTION check_replication_lag IS 'Checks replication lag and creates alerts if needed';

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_connection_routing_role_active 
ON connection_routing(server_role, is_active, health_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failover_status_triggered_at 
ON failover_status(triggered_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replication_monitoring_recorded_at 
ON replication_monitoring(recorded_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replication_alerts_created_at 
ON replication_alerts(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_replication_alerts_severity 
ON replication_alerts(severity, created_at DESC);

-- ==========================================
-- FINAL SETUP INSTRUCTIONS
-- ==========================================

/*
SETUP INSTRUCTIONS:

1. PRIMARY SERVER:
   - Update postgresql.conf with replication settings
   - Update pg_hba.conf to allow replication connections
   - Create replication user and run this script
   - Restart PostgreSQL

2. REPLICA SERVER:
   - Create base backup from primary using pg_basebackup
   - Configure recovery.conf (PostgreSQL < 12) or postgresql.conf (PostgreSQL >= 12)
   - Start PostgreSQL

3. MONITORING:
   - Set up cron job to run record_replication_metrics() every minute
   - Set up cron job to run check_replication_lag() every 5 minutes
   - Set up cron job to run perform_health_checks() every minute

4. APPLICATION:
   - Update application connection logic to use get_optimal_connection()
   - Implement connection pooling with read/write splitting
   - Set up monitoring dashboard for replication metrics

Example cron jobs:
* * * * * psql -d learning_assistant -c "SELECT record_replication_metrics();"
*/5 * * * * psql -d learning_assistant -c "SELECT check_replication_lag();"
* * * * * psql -d learning_assistant -c "SELECT perform_health_checks();"
*/