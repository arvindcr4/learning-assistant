-- Initialize learning assistant database
-- This file is executed when PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create development user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'learning_assistant_dev') THEN
        CREATE ROLE learning_assistant_dev WITH LOGIN PASSWORD 'dev_password';
    END IF;
END
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE learning_assistant_dev TO learning_assistant_dev;
GRANT ALL PRIVILEGES ON SCHEMA public TO learning_assistant_dev;

-- Set default permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO learning_assistant_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO learning_assistant_dev;

-- Basic logging
\echo 'Database initialized successfully for learning assistant development';