# Backup Testing and Validation Procedures

This directory contains comprehensive automated testing and validation procedures for the Learning Assistant backup and disaster recovery systems.

## Overview

The testing framework provides automated validation of:
- **Backup Integrity**: Verification of backup file completeness and validity
- **Disaster Recovery**: Full system recovery simulation and testing
- **System Health**: Daily monitoring of backup systems and data freshness
- **Compliance**: Security and retention policy compliance validation

## Test Scripts

### 1. Daily Health Check (`daily-health-check.sh`)

**Purpose**: Quick daily verification of backup systems and data integrity  
**Schedule**: Daily at 6:00 AM UTC  
**Duration**: ~15 minutes  
**Checks**:
- Backup file freshness (within 24 hours)
- Database connectivity and basic queries
- Redis connectivity and operations
- Storage space usage
- Backup service health
- Monitoring system status

**Usage**:
```bash
# Run daily health check
./daily-health-check.sh

# Run with custom alert threshold
ALERT_THRESHOLD_HOURS=12 ./daily-health-check.sh

# Disable notifications
NOTIFICATION_ENABLED=false ./daily-health-check.sh
```

**Exit Codes**:
- `0`: All systems healthy
- `1`: Warnings detected
- `2`: Critical issues detected

### 2. Weekly Backup Validation (`weekly-backup-test.sh`)

**Purpose**: Comprehensive backup integrity and restoration verification  
**Schedule**: Weekly on Sundays at 3:00 AM UTC  
**Duration**: ~1 hour  
**Tests**:
- File integrity validation for all backup types
- Database backup restoration simulation
- Cross-region backup synchronization
- Backup retention policy compliance
- Encryption/decryption capability
- Monitoring metrics collection

**Usage**:
```bash
# Run weekly backup validation
./weekly-backup-test.sh

# Run in dry-run mode
DRY_RUN=true ./weekly-backup-test.sh

# Test with parallel processing
PARALLEL_TESTS=5 ./weekly-backup-test.sh

# Test specific backup directory
BACKUP_DIR=/custom/backup/path ./weekly-backup-test.sh
```

**Features**:
- Parallel backup file testing for improved performance
- Detailed integrity validation for each backup type
- Restoration simulation without affecting production
- Cross-region replication verification

### 3. Monthly Disaster Recovery Test (`monthly-dr-test.sh`)

**Purpose**: Full disaster recovery capability testing  
**Schedule**: Monthly on the 1st at 2:00 AM UTC  
**Duration**: ~4 hours  
**Tests**:
- Complete system failure recovery simulation
- Database recovery with point-in-time restore
- Application recovery and health validation
- Redis cluster recovery
- Cross-region failover testing
- Performance recovery validation
- Monitoring and alerting verification
- Security and compliance checks

**Usage**:
```bash
# Run monthly DR test
./monthly-dr-test.sh

# Run in dry-run mode (recommended for first-time setup)
DRY_RUN=true ./monthly-dr-test.sh

# Run with detailed logging
DETAILED_LOGGING=true ./monthly-dr-test.sh

# Test specific namespace
TEST_NAMESPACE=custom-dr-test ./monthly-dr-test.sh
```

**Test Scenarios**:
- Complete data center outage simulation
- Primary database failure and failover
- Application pod failure and recovery
- Cache cluster failure scenarios
- Network connectivity issues

### 4. Test Scheduler (`test-scheduler.sh`)

**Purpose**: Automated test scheduling and management system  
**Features**:
- Cron job management for all tests
- Test execution with retry logic
- Notification management
- Log retention and cleanup
- Concurrent execution control

**Usage**:
```bash
# Initialize default schedule configuration
./test-scheduler.sh init

# Install all scheduled tests
./test-scheduler.sh install

# List scheduled tests
./test-scheduler.sh list

# Run specific test immediately
./test-scheduler.sh run daily_health_check

# Show system status
./test-scheduler.sh status

# Clean up old logs
./test-scheduler.sh cleanup

# Remove all scheduled tests
./test-scheduler.sh remove

# Preview changes without applying
./test-scheduler.sh --dry-run install
```

**Configuration**: The scheduler uses `test-schedule.json` for configuration:
```json
{
  "schedules": [
    {
      "name": "daily_health_check",
      "description": "Daily system health and backup status check",
      "script": "daily-health-check.sh",
      "cron": "0 6 * * *",
      "enabled": true,
      "timeout": 900,
      "retry_count": 2,
      "notification": {
        "on_success": false,
        "on_failure": true,
        "on_warning": true
      }
    }
  ]
}
```

### 5. Scheduled Test Runner (`run-scheduled-test.sh`)

**Purpose**: Helper script for executing scheduled tests with proper logging and error handling  
**Features**:
- Execution locking to prevent concurrent runs
- Environment variable management
- Comprehensive logging
- Result recording
- Notification handling with cooldown

**Usage**: Typically called automatically by cron jobs, but can be run manually:
```bash
# Run specific scheduled test
./run-scheduled-test.sh daily_health_check

# Check execution status
cat /var/log/backup-testing/execution-results.json
```

## Setup and Configuration

### 1. Initial Setup

```bash
# Navigate to testing directory
cd /path/to/learning-assistant/scripts/testing

# Create default schedule configuration
./test-scheduler.sh init

# Install scheduled tests
./test-scheduler.sh install

# Verify installation
./test-scheduler.sh list
```

### 2. Environment Variables

Create a configuration file or set environment variables:

```bash
# Backup and logging paths
export BACKUP_DIR="/var/backups/learning-assistant"
export LOG_DIR="/var/log/backup-testing"

# Database connection
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_USER="postgres"
export DB_NAME="learning_assistant"

# Redis connection
export REDIS_HOST="localhost"
export REDIS_PORT="6379"

# Notification settings
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export EMAIL_RECIPIENTS="admin@example.com"

# AWS configuration (for cross-region testing)
export AWS_DEFAULT_REGION="us-east-1"
export AWS_DR_REGION="us-west-2"

# Test configuration
export NOTIFICATION_ENABLED="true"
export ALERT_THRESHOLD_HOURS="24"
export PARALLEL_TESTS="3"
```

### 3. Directory Structure

The testing system expects the following directory structure:

```
/var/log/backup-testing/
├── daily-health-check-YYYYMMDD.log
├── weekly-backup-test-YYYYMMDD.log
├── monthly-dr-test-YYYYMMDD.log
├── scheduled-execution-YYYYMMDD.log
├── execution-results.json
└── results/
    ├── daily-health-YYYYMMDD-HHMMSS/
    │   ├── health-report.json
    │   └── health-summary.txt
    ├── weekly-backup-test-YYYYMMDD-HHMMSS/
    │   ├── backup-test-report.json
    │   └── summary.txt
    └── dr-test-YYYYMMDD-HHMMSS/
        ├── test-report.json
        └── summary.txt

/var/lock/backup-testing/
├── daily_health_check.lock
├── weekly_backup_validation.lock
└── monthly_disaster_recovery.lock
```

### 4. Kubernetes Integration

For Kubernetes environments, ensure proper RBAC and service access:

```bash
# Check cluster access
kubectl cluster-info

# Verify backup namespace
kubectl get namespace learning-assistant-backup

# Check backup service status
kubectl get pods -n learning-assistant-backup

# Test backup service health
kubectl exec -n learning-assistant-backup deployment/backup-service -- /opt/backup/healthcheck.sh
```

## Monitoring and Alerting

### 1. Test Results Monitoring

Monitor test results through:
- **Log files**: Detailed execution logs for each test
- **JSON reports**: Structured test results and metrics
- **Slack notifications**: Real-time alerts for failures
- **Email alerts**: Critical failure notifications
- **Metrics endpoints**: Prometheus-compatible metrics

### 2. Health Check Metrics

The tests expose metrics for monitoring:
- `backup_test_duration_seconds`: Test execution time
- `backup_test_success_total`: Successful test count
- `backup_test_failure_total`: Failed test count
- `backup_files_validated_total`: Backup files tested
- `backup_files_invalid_total`: Invalid backup files found

### 3. Alerting Rules

Example Prometheus alerting rules:

```yaml
groups:
- name: backup-testing
  rules:
  - alert: BackupTestFailure
    expr: increase(backup_test_failure_total[1h]) > 0
    labels:
      severity: critical
    annotations:
      summary: "Backup test failure detected"
      
  - alert: BackupTooOld
    expr: time() - backup_last_success_timestamp > 86400
    labels:
      severity: warning
    annotations:
      summary: "Backup is older than 24 hours"
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout values in test configuration
   - Check system resources and load
   - Verify network connectivity

2. **Permission Errors**
   - Ensure scripts have execute permissions
   - Check directory permissions for logs and locks
   - Verify database and Redis access credentials

3. **Lock File Issues**
   - Remove stale lock files: `rm /var/lock/backup-testing/*.lock`
   - Check for hung processes: `ps aux | grep backup-test`

4. **Backup File Not Found**
   - Verify backup directory path and permissions
   - Check backup service status
   - Review backup schedule configuration

5. **Notification Failures**
   - Verify webhook URLs and credentials
   - Check network connectivity
   - Review notification cooldown settings

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Enable verbose logging
export DETAILED_LOGGING="true"

# Run with debug output
bash -x ./daily-health-check.sh

# Check system state
./test-scheduler.sh status
```

### Log Analysis

Analyze test logs for issues:

```bash
# View recent test results
tail -f /var/log/backup-testing/scheduled-execution-$(date +%Y%m%d).log

# Search for errors
grep -i error /var/log/backup-testing/*.log

# Check test success rates
jq '.executions[] | select(.status == "FAILED")' /var/log/backup-testing/execution-results.json

# View health check history
find /var/log/backup-testing/results -name "health-summary.txt" -exec cat {} \;
```

## Best Practices

### 1. Test Environment Management
- Use isolated test environments when possible
- Implement proper cleanup procedures
- Avoid testing on production data directly

### 2. Scheduling Considerations
- Stagger test execution to avoid resource conflicts
- Consider maintenance windows for intensive tests
- Allow sufficient time between related tests

### 3. Notification Management
- Configure appropriate notification cooldowns
- Use different notification channels for different severity levels
- Test notification delivery regularly

### 4. Security
- Store credentials securely using environment variables or secrets management
- Limit test script permissions to minimum required
- Regularly audit test access logs

### 5. Performance
- Monitor test execution times and optimize as needed
- Use parallel processing where appropriate
- Archive old test results to manage disk usage

## Integration with CI/CD

The testing framework can be integrated with CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
name: Backup Testing
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
    
jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Run Health Check
      run: ./scripts/testing/daily-health-check.sh
      env:
        NOTIFICATION_ENABLED: "true"
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Support and Maintenance

### Regular Maintenance Tasks
- Weekly log cleanup: `./test-scheduler.sh cleanup`
- Monthly configuration review and updates
- Quarterly test procedure validation
- Annual disaster recovery plan review

### Getting Help
- Review test logs for detailed error information
- Check system status: `./test-scheduler.sh status`
- Validate configuration: `jq . test-schedule.json`
- Contact the infrastructure team for persistent issues

This comprehensive testing framework ensures the reliability and effectiveness of the Learning Assistant backup and disaster recovery systems through automated validation and continuous monitoring.