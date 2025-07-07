# Fly.io PostgreSQL Database Setup Guide

This guide explains how to set up PostgreSQL for the learning-assistant application on Fly.io.

## Prerequisites

- Fly.io CLI installed and authenticated
- Learning Assistant app already created (`learning-assistant-lively-rain-3457`)

## Database Setup Commands

### 1. Create PostgreSQL Database

```bash
# Create a new PostgreSQL database cluster
fly postgres create --name learning-assistant-db --region bom --initial-cluster-size 1

# Alternative: Create with specific configuration
fly postgres create \
  --name learning-assistant-db \
  --region bom \
  --initial-cluster-size 1 \
  --vm-size shared-cpu-1x \
  --volume-size 10 \
  --snapshot-retention 7
```

### 2. Attach Database to Application

```bash
# Attach the database to your application
fly postgres attach --app learning-assistant-lively-rain-3457 learning-assistant-db

# This will automatically set the DATABASE_URL secret
```

### 3. Verify Database Connection

```bash
# Check database connection
fly postgres connect --app learning-assistant-db

# Or connect directly with psql
fly postgres connect --app learning-assistant-db --database learning_assistant
```

### 4. Configure Database Secrets

The `fly postgres attach` command automatically creates the following secrets:

- `DATABASE_URL` - Full PostgreSQL connection string
- `DATABASE_PRIVATE_URL` - Internal network connection string

Additional secrets to set manually:

```bash
# Set additional database configuration
fly secrets set \
  DB_SSL=true \
  DB_MAX_CONNECTIONS=20 \
  DB_IDLE_TIMEOUT=30000 \
  DB_CONNECTION_TIMEOUT=10000 \
  --app learning-assistant-lively-rain-3457
```

## Database Configuration

### Connection Pool Settings

For production deployment, the following connection pool settings are recommended:

```bash
# Set connection pool settings
fly secrets set \
  DB_MAX_CONNECTIONS=20 \
  DB_MIN_CONNECTIONS=5 \
  DB_ACQUIRE_TIMEOUT=30000 \
  DB_IDLE_TIMEOUT=10000 \
  --app learning-assistant-lively-rain-3457
```

### SSL Configuration

Fly.io PostgreSQL requires SSL connections in production:

```bash
# SSL is automatically enabled, but you can verify settings
fly secrets set \
  DB_SSL=true \
  DB_SSL_REJECT_UNAUTHORIZED=false \
  --app learning-assistant-lively-rain-3457
```

## Database Migration

### Using Release Command

Database migrations are automatically run during deployment using the release command in `fly.toml`:

```toml
[deploy]
  release_command = "node scripts/migrate.js"
```

### Manual Migration

If you need to run migrations manually:

```bash
# Run migrations
fly ssh console --app learning-assistant-lively-rain-3457 --command "node scripts/migrate.js"

# Or connect to the machine and run migrations
fly ssh console --app learning-assistant-lively-rain-3457
$ node scripts/migrate.js
```

## Multi-Region Database Setup

### Primary-Replica Configuration

For multi-region deployment with read replicas:

```bash
# Create read replica in another region
fly postgres create \
  --name learning-assistant-db-replica \
  --region sin \
  --fork-from learning-assistant-db

# Attach replica to application
fly postgres attach --app learning-assistant-lively-rain-3457 learning-assistant-db-replica
```

### Read/Write Splitting

Configure read/write splitting in your application:

```bash
# Set read replica URL
fly secrets set \
  DATABASE_READ_URL="postgres://..." \
  DATABASE_WRITE_URL="postgres://..." \
  --app learning-assistant-lively-rain-3457
```

## Backup and Restore

### Automatic Backups

Fly.io PostgreSQL includes automatic backups:

```bash
# List available backups
fly postgres list-snapshots --app learning-assistant-db

# Restore from backup
fly postgres restore --app learning-assistant-db --snapshot-id <snapshot-id>
```

### Manual Backup

```bash
# Create manual backup
fly postgres backup --app learning-assistant-db

# Export database
fly postgres export --app learning-assistant-db > backup.sql
```

## Monitoring and Maintenance

### Database Metrics

Monitor database performance:

```bash
# View database metrics
fly postgres metrics --app learning-assistant-db

# Check connection status
fly postgres status --app learning-assistant-db
```

### Log Management

```bash
# View database logs
fly logs --app learning-assistant-db

# Follow live logs
fly logs --app learning-assistant-db --follow
```

## Scaling

### Vertical Scaling

```bash
# Scale database VM
fly postgres scale --app learning-assistant-db --vm-size dedicated-cpu-2x

# Scale storage
fly postgres scale --app learning-assistant-db --volume-size 20
```

### Horizontal Scaling

```bash
# Add read replica
fly postgres scale --app learning-assistant-db --count 2
```

## Security Best Practices

1. **Use Internal Networks**: Always use the internal DATABASE_PRIVATE_URL when possible
2. **Enable SSL**: SSL is required for all connections
3. **Limit Connections**: Configure appropriate connection limits
4. **Regular Backups**: Ensure automatic backups are enabled
5. **Monitor Access**: Review database access logs regularly

## Troubleshooting

### Common Issues

1. **Connection Timeouts**:
   ```bash
   fly secrets set DB_CONNECTION_TIMEOUT=20000 --app learning-assistant-lively-rain-3457
   ```

2. **SSL Certificate Issues**:
   ```bash
   fly secrets set DB_SSL_REJECT_UNAUTHORIZED=false --app learning-assistant-lively-rain-3457
   ```

3. **Connection Pool Exhaustion**:
   ```bash
   fly secrets set DB_MAX_CONNECTIONS=30 --app learning-assistant-lively-rain-3457
   ```

### Debug Connection

```bash
# Test database connection
fly ssh console --app learning-assistant-lively-rain-3457 --command "node -e \"
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error(err);
  else console.log('Database connected:', res.rows[0]);
  pool.end();
});
\""
```

## Environment Variables Summary

After setup, your application will have these environment variables:

- `DATABASE_URL` - Primary database connection string
- `DATABASE_PRIVATE_URL` - Internal network connection string
- `DB_SSL` - SSL enabled (true)
- `DB_MAX_CONNECTIONS` - Maximum connections (20)
- `DB_IDLE_TIMEOUT` - Connection idle timeout (30000ms)
- `DB_CONNECTION_TIMEOUT` - Connection timeout (10000ms)