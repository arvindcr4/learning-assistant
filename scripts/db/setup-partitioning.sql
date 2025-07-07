-- Database Table Partitioning Setup Script
-- This script sets up partitioning for large tables in the learning assistant database

-- ==========================================
-- PARTITIONING STRATEGY
-- ==========================================

-- Tables that will benefit from partitioning:
-- 1. learning_sessions - partition by date (monthly)
-- 2. behavioral_indicators - partition by date (monthly)  
-- 3. assessment_attempts - partition by date (monthly)
-- 4. question_responses - partition by date (monthly)
-- 5. learning_analytics - partition by date (monthly)
-- 6. adaptive_changes - partition by date (monthly)

-- ==========================================
-- LEARNING SESSIONS PARTITIONING
-- ==========================================

-- Create the master partitioned table
CREATE TABLE learning_sessions_partitioned (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    content_id UUID NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER NOT NULL,
    items_completed INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    focus_time INTEGER DEFAULT 0,
    distraction_events INTEGER DEFAULT 0,
    interaction_rate DECIMAL(4,2) DEFAULT 0.00,
    scroll_depth INTEGER DEFAULT 0,
    video_watch_time INTEGER DEFAULT 0,
    pause_frequency INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_learning_sessions_partitioned PRIMARY KEY (id, start_time)
) PARTITION BY RANGE (start_time);

-- Create monthly partitions for the past year and future months
-- Past year partitions
CREATE TABLE learning_sessions_2024_01 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE learning_sessions_2024_02 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE learning_sessions_2024_03 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE learning_sessions_2024_04 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE learning_sessions_2024_05 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE learning_sessions_2024_06 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE learning_sessions_2024_07 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE learning_sessions_2024_08 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE learning_sessions_2024_09 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE learning_sessions_2024_10 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE learning_sessions_2024_11 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE learning_sessions_2024_12 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Future partitions
CREATE TABLE learning_sessions_2025_01 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE learning_sessions_2025_02 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE learning_sessions_2025_03 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE learning_sessions_2025_04 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE learning_sessions_2025_05 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE learning_sessions_2025_06 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE learning_sessions_2025_07 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE learning_sessions_2025_08 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE learning_sessions_2025_09 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE learning_sessions_2025_10 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE learning_sessions_2025_11 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE learning_sessions_2025_12 PARTITION OF learning_sessions_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- ==========================================
-- BEHAVIORAL INDICATORS PARTITIONING
-- ==========================================

CREATE TABLE behavioral_indicators_partitioned (
    id UUID DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('visual', 'auditory', 'reading', 'kinesthetic')),
    engagement_level INTEGER NOT NULL CHECK (engagement_level >= 0 AND engagement_level <= 100),
    completion_rate INTEGER NOT NULL CHECK (completion_rate >= 0 AND completion_rate <= 100),
    time_spent INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_behavioral_indicators_partitioned PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions for behavioral indicators
CREATE TABLE behavioral_indicators_2024_01 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE behavioral_indicators_2024_02 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE behavioral_indicators_2024_03 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE behavioral_indicators_2024_04 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE behavioral_indicators_2024_05 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE behavioral_indicators_2024_06 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE behavioral_indicators_2024_07 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE behavioral_indicators_2024_08 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE behavioral_indicators_2024_09 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE behavioral_indicators_2024_10 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE behavioral_indicators_2024_11 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE behavioral_indicators_2024_12 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE behavioral_indicators_2025_01 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE behavioral_indicators_2025_02 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE behavioral_indicators_2025_03 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE behavioral_indicators_2025_04 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE behavioral_indicators_2025_05 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE behavioral_indicators_2025_06 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE behavioral_indicators_2025_07 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE behavioral_indicators_2025_08 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE behavioral_indicators_2025_09 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE behavioral_indicators_2025_10 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE behavioral_indicators_2025_11 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE behavioral_indicators_2025_12 PARTITION OF behavioral_indicators_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- ==========================================
-- ASSESSMENT ATTEMPTS PARTITIONING
-- ==========================================

CREATE TABLE assessment_attempts_partitioned (
    id UUID DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    assessment_id UUID NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    passed BOOLEAN DEFAULT false,
    time_spent INTEGER,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    CONSTRAINT pk_assessment_attempts_partitioned PRIMARY KEY (id, started_at)
) PARTITION BY RANGE (started_at);

-- Create monthly partitions for assessment attempts
CREATE TABLE assessment_attempts_2024_01 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE assessment_attempts_2024_02 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE assessment_attempts_2024_03 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE assessment_attempts_2024_04 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE assessment_attempts_2024_05 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE assessment_attempts_2024_06 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE assessment_attempts_2024_07 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE assessment_attempts_2024_08 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE assessment_attempts_2024_09 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE assessment_attempts_2024_10 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE assessment_attempts_2024_11 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE assessment_attempts_2024_12 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE assessment_attempts_2025_01 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE assessment_attempts_2025_02 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE assessment_attempts_2025_03 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE assessment_attempts_2025_04 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE assessment_attempts_2025_05 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE assessment_attempts_2025_06 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE assessment_attempts_2025_07 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE assessment_attempts_2025_08 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE assessment_attempts_2025_09 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE assessment_attempts_2025_10 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE assessment_attempts_2025_11 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE assessment_attempts_2025_12 PARTITION OF assessment_attempts_partitioned
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- ==========================================
-- PARTITION MANAGEMENT FUNCTIONS
-- ==========================================

-- Function to create a new partition
CREATE OR REPLACE FUNCTION create_partition(
    p_table_name TEXT,
    p_partition_name TEXT,
    p_start_date DATE,
    p_end_date DATE
) RETURNS BOOLEAN AS $$
DECLARE
    v_sql TEXT;
BEGIN
    v_sql := format(
        'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
        p_partition_name,
        p_table_name,
        p_start_date,
        p_end_date
    );
    
    EXECUTE v_sql;
    
    -- Add indexes to the new partition
    PERFORM create_partition_indexes(p_table_name, p_partition_name);
    
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to create partition %: %', p_partition_name, SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to create indexes on a partition
CREATE OR REPLACE FUNCTION create_partition_indexes(
    p_table_name TEXT,
    p_partition_name TEXT
) RETURNS VOID AS $$
BEGIN
    CASE p_table_name
        WHEN 'learning_sessions_partitioned' THEN
            EXECUTE format('CREATE INDEX idx_%I_user_id ON %I (user_id)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_start_time ON %I (start_time)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_content_id ON %I (content_id)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_completed ON %I (completed)', p_partition_name, p_partition_name);
            
        WHEN 'behavioral_indicators_partitioned' THEN
            EXECUTE format('CREATE INDEX idx_%I_profile_id ON %I (profile_id)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_timestamp ON %I (timestamp)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_content_type ON %I (content_type)', p_partition_name, p_partition_name);
            
        WHEN 'assessment_attempts_partitioned' THEN
            EXECUTE format('CREATE INDEX idx_%I_user_id ON %I (user_id)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_assessment_id ON %I (assessment_id)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_started_at ON %I (started_at)', p_partition_name, p_partition_name);
            EXECUTE format('CREATE INDEX idx_%I_passed ON %I (passed)', p_partition_name, p_partition_name);
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create future partitions
CREATE OR REPLACE FUNCTION create_future_partitions(
    p_table_name TEXT,
    p_months_ahead INTEGER DEFAULT 6
) RETURNS INTEGER AS $$
DECLARE
    v_current_date DATE := CURRENT_DATE;
    v_start_date DATE;
    v_end_date DATE;
    v_partition_name TEXT;
    v_count INTEGER := 0;
    i INTEGER;
BEGIN
    -- Create partitions for the next N months
    FOR i IN 1..p_months_ahead LOOP
        v_start_date := date_trunc('month', v_current_date + (i || ' months')::interval)::date;
        v_end_date := date_trunc('month', v_start_date + '1 month'::interval)::date;
        
        v_partition_name := format('%s_%s', 
            p_table_name, 
            to_char(v_start_date, 'YYYY_MM')
        );
        
        -- Check if partition already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = v_partition_name
        ) THEN
            IF create_partition(p_table_name, v_partition_name, v_start_date, v_end_date) THEN
                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions
CREATE OR REPLACE FUNCTION drop_old_partitions(
    p_table_name TEXT,
    p_months_to_keep INTEGER DEFAULT 12
) RETURNS INTEGER AS $$
DECLARE
    v_cutoff_date DATE := CURRENT_DATE - (p_months_to_keep || ' months')::interval;
    v_partition_name TEXT;
    v_count INTEGER := 0;
    r RECORD;
BEGIN
    -- Find partitions older than the cutoff date
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE tablename LIKE p_table_name || '_%'
          AND tablename ~ '\d{4}_\d{2}$'
    LOOP
        -- Extract date from partition name
        v_partition_name := r.tablename;
        
        -- Check if this partition is older than cutoff
        IF to_date(right(v_partition_name, 7), 'YYYY_MM') < v_cutoff_date THEN
            EXECUTE format('DROP TABLE %I CASCADE', v_partition_name);
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- PARTITION MAINTENANCE AUTOMATION
-- ==========================================

-- Create partition maintenance log table
CREATE TABLE partition_maintenance_log (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation VARCHAR(50) NOT NULL,
    partition_name TEXT,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main maintenance function
CREATE OR REPLACE FUNCTION maintain_partitions() RETURNS TABLE(
    table_name TEXT,
    partitions_created INTEGER,
    partitions_dropped INTEGER,
    status TEXT
) AS $$
DECLARE
    v_table_name TEXT;
    v_created INTEGER;
    v_dropped INTEGER;
    v_tables TEXT[] := ARRAY[
        'learning_sessions_partitioned',
        'behavioral_indicators_partitioned',
        'assessment_attempts_partitioned'
    ];
BEGIN
    FOREACH v_table_name IN ARRAY v_tables LOOP
        BEGIN
            -- Create future partitions
            SELECT create_future_partitions(v_table_name, 6) INTO v_created;
            
            -- Drop old partitions (keep 12 months)
            SELECT drop_old_partitions(v_table_name, 12) INTO v_dropped;
            
            -- Log the operation
            INSERT INTO partition_maintenance_log (table_name, operation, status)
            VALUES (v_table_name, 'maintain', 'success');
            
            RETURN QUERY SELECT v_table_name, v_created, v_dropped, 'success'::TEXT;
            
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO partition_maintenance_log (table_name, operation, status, error_message)
            VALUES (v_table_name, 'maintain', 'error', SQLERRM);
            
            RETURN QUERY SELECT v_table_name, 0, 0, 'error: ' || SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- PARTITION STATISTICS AND MONITORING
-- ==========================================

-- View to show partition information
CREATE OR REPLACE VIEW partition_info AS
SELECT 
    schemaname,
    tablename as partition_name,
    CASE 
        WHEN tablename LIKE '%learning_sessions%' THEN 'learning_sessions_partitioned'
        WHEN tablename LIKE '%behavioral_indicators%' THEN 'behavioral_indicators_partitioned'
        WHEN tablename LIKE '%assessment_attempts%' THEN 'assessment_attempts_partitioned'
        ELSE 'unknown'
    END as parent_table,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
    (SELECT reltuples::bigint FROM pg_class WHERE relname = tablename) as estimated_rows,
    CASE 
        WHEN tablename ~ '\d{4}_\d{2}$' THEN 
            to_date(right(tablename, 7), 'YYYY_MM')
        ELSE NULL
    END as partition_date
FROM pg_tables
WHERE tablename LIKE '%_partitioned'
   OR tablename ~ '_(learning_sessions|behavioral_indicators|assessment_attempts)_\d{4}_\d{2}$'
ORDER BY parent_table, partition_date;

-- Function to get partition statistics
CREATE OR REPLACE FUNCTION get_partition_stats(p_table_name TEXT DEFAULT NULL)
RETURNS TABLE(
    parent_table TEXT,
    partition_count BIGINT,
    total_size TEXT,
    total_size_bytes BIGINT,
    total_rows BIGINT,
    avg_rows_per_partition NUMERIC,
    oldest_partition DATE,
    newest_partition DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pi.parent_table,
        count(*)::bigint as partition_count,
        pg_size_pretty(sum(pi.size_bytes)) as total_size,
        sum(pi.size_bytes) as total_size_bytes,
        sum(coalesce(pi.estimated_rows, 0)) as total_rows,
        round(avg(coalesce(pi.estimated_rows, 0)), 2) as avg_rows_per_partition,
        min(pi.partition_date) as oldest_partition,
        max(pi.partition_date) as newest_partition
    FROM partition_info pi
    WHERE pi.parent_table != 'unknown'
      AND (p_table_name IS NULL OR pi.parent_table = p_table_name)
      AND pi.partition_date IS NOT NULL
    GROUP BY pi.parent_table
    ORDER BY pi.parent_table;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- PARTITION PRUNING OPTIMIZATION
-- ==========================================

-- Enable constraint exclusion for better partition pruning
SET constraint_exclusion = partition;

-- Create check constraints on partitions for better pruning
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Add check constraints to existing partitions
    FOR r IN 
        SELECT tablename, 
               substring(tablename from '\d{4}_\d{2}$') as date_part
        FROM pg_tables 
        WHERE tablename ~ '_(learning_sessions|behavioral_indicators|assessment_attempts)_\d{4}_\d{2}$'
    LOOP
        -- Skip if constraint already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = r.tablename 
              AND constraint_name = 'check_' || r.tablename || '_date'
        ) THEN
            -- Add appropriate check constraints based on table type
            IF r.tablename LIKE '%learning_sessions%' THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD CONSTRAINT check_%I_date CHECK (start_time >= %L AND start_time < %L)',
                    r.tablename, r.tablename,
                    to_date(r.date_part, 'YYYY_MM'),
                    to_date(r.date_part, 'YYYY_MM') + interval '1 month'
                );
            ELSIF r.tablename LIKE '%behavioral_indicators%' THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD CONSTRAINT check_%I_date CHECK (timestamp >= %L AND timestamp < %L)',
                    r.tablename, r.tablename,
                    to_date(r.date_part, 'YYYY_MM'),
                    to_date(r.date_part, 'YYYY_MM') + interval '1 month'
                );
            ELSIF r.tablename LIKE '%assessment_attempts%' THEN
                EXECUTE format(
                    'ALTER TABLE %I ADD CONSTRAINT check_%I_date CHECK (started_at >= %L AND started_at < %L)',
                    r.tablename, r.tablename,
                    to_date(r.date_part, 'YYYY_MM'),
                    to_date(r.date_part, 'YYYY_MM') + interval '1 month'
                );
            END IF;
        END IF;
    END LOOP;
END $$;

-- ==========================================
-- INDEXES ON PARTITIONED TABLES
-- ==========================================

-- Create indexes on all existing partitions
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT tablename
        FROM pg_tables 
        WHERE tablename ~ '_(learning_sessions|behavioral_indicators|assessment_attempts)_\d{4}_\d{2}$'
    LOOP
        -- Determine parent table and create appropriate indexes
        IF r.tablename LIKE '%learning_sessions%' THEN
            PERFORM create_partition_indexes('learning_sessions_partitioned', r.tablename);
        ELSIF r.tablename LIKE '%behavioral_indicators%' THEN
            PERFORM create_partition_indexes('behavioral_indicators_partitioned', r.tablename);
        ELSIF r.tablename LIKE '%assessment_attempts%' THEN
            PERFORM create_partition_indexes('assessment_attempts_partitioned', r.tablename);
        END IF;
    END LOOP;
END $$;

-- ==========================================
-- COMMENTS AND DOCUMENTATION
-- ==========================================

COMMENT ON TABLE learning_sessions_partitioned IS 'Partitioned table for learning sessions, partitioned by start_time (monthly)';
COMMENT ON TABLE behavioral_indicators_partitioned IS 'Partitioned table for behavioral indicators, partitioned by timestamp (monthly)';
COMMENT ON TABLE assessment_attempts_partitioned IS 'Partitioned table for assessment attempts, partitioned by started_at (monthly)';

COMMENT ON FUNCTION create_partition IS 'Creates a new partition for the specified table';
COMMENT ON FUNCTION create_partition_indexes IS 'Creates appropriate indexes on a partition';
COMMENT ON FUNCTION create_future_partitions IS 'Creates future partitions for the specified table';
COMMENT ON FUNCTION drop_old_partitions IS 'Drops old partitions older than the specified number of months';
COMMENT ON FUNCTION maintain_partitions IS 'Main partition maintenance function that creates future and drops old partitions';
COMMENT ON FUNCTION get_partition_stats IS 'Returns statistics about partitions';

COMMENT ON VIEW partition_info IS 'Shows information about all partitions including size and estimated row count';

-- ==========================================
-- MIGRATION INSTRUCTIONS
-- ==========================================

/*
MIGRATION INSTRUCTIONS:

1. Backup existing data:
   pg_dump -t learning_sessions -t behavioral_indicators -t assessment_attempts learning_assistant > partition_backup.sql

2. Migrate data to partitioned tables:
   INSERT INTO learning_sessions_partitioned SELECT * FROM learning_sessions;
   INSERT INTO behavioral_indicators_partitioned SELECT * FROM behavioral_indicators;  
   INSERT INTO assessment_attempts_partitioned SELECT * FROM assessment_attempts;

3. Rename tables:
   ALTER TABLE learning_sessions RENAME TO learning_sessions_old;
   ALTER TABLE behavioral_indicators RENAME TO behavioral_indicators_old;
   ALTER TABLE assessment_attempts RENAME TO assessment_attempts_old;
   
   ALTER TABLE learning_sessions_partitioned RENAME TO learning_sessions;
   ALTER TABLE behavioral_indicators_partitioned RENAME TO behavioral_indicators;
   ALTER TABLE assessment_attempts_partitioned RENAME TO assessment_attempts;

4. Update foreign key constraints:
   -- Update any foreign key constraints that reference the old tables

5. Set up automated partition maintenance:
   -- Add to cron job:
   0 2 * * 0 psql -d learning_assistant -c "SELECT maintain_partitions();"

6. Monitor partition performance:
   -- Use partition_info view and get_partition_stats function

7. Drop old tables after verification:
   DROP TABLE learning_sessions_old;
   DROP TABLE behavioral_indicators_old;
   DROP TABLE assessment_attempts_old;
*/