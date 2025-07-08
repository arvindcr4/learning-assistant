# Disaster Recovery Runbooks for Learning Assistant

## Table of Contents

1. [Overview](#overview)
2. [Emergency Contacts](#emergency-contacts)
3. [Recovery Objectives](#recovery-objectives)
4. [Disaster Scenarios](#disaster-scenarios)
5. [Recovery Procedures](#recovery-procedures)
6. [System Dependencies](#system-dependencies)
7. [Testing and Validation](#testing-and-validation)
8. [Communication Templates](#communication-templates)
9. [Post-Recovery Tasks](#post-recovery-tasks)
10. [Appendices](#appendices)

## Overview

This document provides comprehensive disaster recovery procedures for the Learning Assistant application. It covers various disaster scenarios and provides step-by-step instructions for recovery operations.

### Purpose
- Ensure business continuity during disasters
- Minimize data loss and downtime
- Provide clear procedures for recovery operations
- Meet RTO (Recovery Time Objective) and RPO (Recovery Point Objective) targets

### Scope
This runbook covers:
- Database failures
- Application server failures
- Complete site failures
- Network outages
- Security incidents
- Data corruption scenarios

## Emergency Contacts

### Primary Contacts
- **Incident Commander**: [Name] - [Phone] - [Email]
- **Technical Lead**: [Name] - [Phone] - [Email]
- **DevOps Lead**: [Name] - [Phone] - [Email]
- **Security Officer**: [Name] - [Phone] - [Email]

### Secondary Contacts
- **Backup Technical Lead**: [Name] - [Phone] - [Email]
- **Infrastructure Manager**: [Name] - [Phone] - [Email]
- **Business Continuity Manager**: [Name] - [Phone] - [Email]

### External Contacts
- **Cloud Provider Support**: [Phone] - [Ticket URL]
- **Database Vendor Support**: [Phone] - [Ticket URL]
- **CDN Provider Support**: [Phone] - [Ticket URL]
- **Security Vendor Support**: [Phone] - [Ticket URL]

### Communication Channels
- **Primary**: Slack #incident-response
- **Secondary**: Microsoft Teams - Emergency Channel
- **Conference Bridge**: [Phone/URL]
- **Status Page**: [URL]

## Recovery Objectives

### Service Level Objectives
- **RTO (Recovery Time Objective)**: 4 hours maximum
- **RPO (Recovery Point Objective)**: 1 hour maximum
- **Data Loss Tolerance**: < 1 hour of transactions
- **Availability Target**: 99.9% (8.7 hours downtime/year)

### Priority Classification
1. **Critical (P1)**: Complete service outage
2. **High (P2)**: Partial service outage affecting > 50% users
3. **Medium (P3)**: Degraded performance or < 50% users affected
4. **Low (P4)**: Minor issues with workarounds available

## Disaster Scenarios

### Scenario 1: Database Failure

#### Symptoms
- Database connection errors
- Application error pages
- Slow or failed queries
- Monitoring alerts from database

#### Impact Assessment
- **Users Affected**: All users
- **Services Down**: Complete application
- **Data Risk**: Potential data loss
- **Priority**: P1 - Critical

#### Initial Response
1. **Immediate Actions** (0-15 minutes)
   - Acknowledge alerts in monitoring system
   - Join incident response channel
   - Notify stakeholders via communication template
   - Stop all non-essential background jobs

### Scenario 2: Application Server Failure

#### Symptoms
- HTTP 5xx errors
- Load balancer health check failures
- High error rates in application logs
- User reports of service unavailability

#### Impact Assessment
- **Users Affected**: All or subset of users
- **Services Down**: Web application
- **Data Risk**: Low (database intact)
- **Priority**: P1 - Critical

### Scenario 3: Complete Site Failure

#### Symptoms
- All services unreachable
- Network connectivity issues
- Infrastructure monitoring alerts
- Physical site issues (power, connectivity)

#### Impact Assessment
- **Users Affected**: All users
- **Services Down**: Complete infrastructure
- **Data Risk**: High if local storage affected
- **Priority**: P1 - Critical

### Scenario 4: Security Incident

#### Symptoms
- Unauthorized access detected
- Data breach indicators
- Malware or ransomware detected
- Suspicious user activity

#### Impact Assessment
- **Users Affected**: Potentially all users
- **Services Down**: May require temporary shutdown
- **Data Risk**: High - potential data compromise
- **Priority**: P1 - Critical

## Recovery Procedures

### Database Recovery Procedures

#### Procedure DR-DB-001: Primary Database Failure

**Prerequisites:**
- Access to backup system
- Database administrator credentials
- Latest backup verification completed
- Secondary database environment available

**Steps:**
1. **Assessment Phase** (0-30 minutes)
   ```bash
   # Check database status
   pg_isready -h primary-db.learning-assistant.com -p 5432
   
   # Check backup service status
   curl -s http://backup-service:8080/health
   
   # Verify latest backup
   psql -h backup-db -c "SELECT * FROM backup_metadata ORDER BY created_at DESC LIMIT 1;"
   ```

2. **Failover Preparation** (30-60 minutes)
   ```bash
   # Stop application traffic to database
   kubectl scale deployment learning-assistant-app --replicas=0
   
   # Verify backup integrity
   ./scripts/verify-backup.sh latest
   
   # Prepare restoration environment
   ./scripts/prepare-restore-environment.sh
   ```

3. **Database Restoration** (60-180 minutes)
   ```bash
   # Restore from latest backup
   ./scripts/restore-database.sh \
     --backup-id=$(get-latest-backup-id) \
     --target-host=restore-db.learning-assistant.com \
     --verify-integrity=true
   
   # Verify restoration
   ./scripts/verify-database-restoration.sh
   ```

4. **Application Recovery** (180-210 minutes)
   ```bash
   # Update database configuration
   kubectl patch configmap app-config \
     --patch='{"data":{"DATABASE_HOST":"restore-db.learning-assistant.com"}}'
   
   # Restart application with new database
   kubectl rollout restart deployment learning-assistant-app
   
   # Verify application health
   ./scripts/health-check.sh
   ```

5. **Validation and Testing** (210-240 minutes)
   ```bash
   # Run smoke tests
   ./scripts/smoke-tests.sh
   
   # Verify critical user journeys
   ./scripts/critical-path-tests.sh
   
   # Check data consistency
   ./scripts/data-consistency-check.sh
   ```

#### Procedure DR-DB-002: Point-in-Time Recovery

**Use Case:** Recover to a specific point in time (e.g., before data corruption)

**Prerequisites:**
- WAL (Write-Ahead Log) archives available
- Base backup older than target time
- Exact recovery target time

**Steps:**
1. **Determine Recovery Point**
   ```bash
   # Identify target recovery time
   TARGET_TIME="2024-01-15 14:30:00"
   
   # Find appropriate base backup
   ./scripts/find-base-backup.sh --before="$TARGET_TIME"
   ```

2. **Prepare Recovery Environment**
   ```bash
   # Create recovery database instance
   ./scripts/create-recovery-instance.sh \
     --instance-name="pitr-recovery-$(date +%s)"
   
   # Set recovery parameters
   echo "recovery_target_time = '$TARGET_TIME'" >> recovery.conf
   echo "recovery_target_action = 'promote'" >> recovery.conf
   ```

3. **Perform Point-in-Time Recovery**
   ```bash
   # Start recovery process
   ./scripts/start-pitr-recovery.sh \
     --base-backup="$BASE_BACKUP_ID" \
     --target-time="$TARGET_TIME" \
     --wal-archive-location="s3://backups/wal-archive/"
   
   # Monitor recovery progress
   tail -f /var/log/postgresql/recovery.log
   ```

4. **Validate Recovery**
   ```bash
   # Check database consistency
   ./scripts/check-db-consistency.sh
   
   # Verify data at target time
   ./scripts/verify-data-at-time.sh --time="$TARGET_TIME"
   ```

### Application Recovery Procedures

#### Procedure DR-APP-001: Application Server Failover

**Prerequisites:**
- Load balancer configuration
- Healthy standby servers
- Application deployment artifacts
- Configuration management access

**Steps:**
1. **Server Health Assessment**
   ```bash
   # Check server status
   for server in app-server-{1..3}; do
     echo "Checking $server..."
     curl -f "http://$server:8080/health" || echo "$server is down"
   done
   
   # Check load balancer status
   ./scripts/check-lb-status.sh
   ```

2. **Traffic Rerouting**
   ```bash
   # Remove failed servers from load balancer
   ./scripts/remove-from-lb.sh --server=app-server-1
   
   # Scale up healthy instances
   kubectl scale deployment learning-assistant-app --replicas=6
   
   # Verify traffic distribution
   ./scripts/verify-traffic-distribution.sh
   ```

3. **Failed Server Recovery**
   ```bash
   # Diagnose server issues
   ./scripts/diagnose-server.sh --server=app-server-1
   
   # Restart server if possible
   ./scripts/restart-server.sh --server=app-server-1
   
   # Or deploy new instance
   ./scripts/deploy-new-instance.sh --replace=app-server-1
   ```

#### Procedure DR-APP-002: Complete Application Recovery

**Use Case:** All application servers are down

**Steps:**
1. **Emergency Deployment**
   ```bash
   # Deploy application to emergency infrastructure
   ./scripts/emergency-deploy.sh \
     --cluster=disaster-recovery \
     --region=us-west-2 \
     --replicas=3
   
   # Update DNS to point to emergency infrastructure
   ./scripts/update-dns.sh \
     --domain=app.learning-assistant.com \
     --target=emergency-lb.us-west-2.elb.amazonaws.com
   ```

2. **Data Synchronization**
   ```bash
   # Sync latest data to emergency environment
   ./scripts/sync-data-to-emergency.sh \
     --source=primary-db \
     --target=emergency-db \
     --incremental=true
   ```

3. **Service Validation**
   ```bash
   # Run comprehensive health checks
   ./scripts/comprehensive-health-check.sh --environment=emergency
   
   # Validate critical functionality
   ./scripts/validate-critical-functions.sh
   ```

### Network Recovery Procedures

#### Procedure DR-NET-001: Network Connectivity Issues

**Symptoms:**
- Intermittent connectivity
- High latency
- Packet loss
- DNS resolution issues

**Steps:**
1. **Network Diagnostics**
   ```bash
   # Check network connectivity
   ping -c 5 8.8.8.8
   traceroute google.com
   nslookup learning-assistant.com
   
   # Check internal connectivity
   ./scripts/network-diagnostic.sh --internal
   ```

2. **Traffic Rerouting**
   ```bash
   # Switch to backup network path
   ./scripts/switch-network-path.sh --path=backup
   
   # Update routing tables
   ./scripts/update-routing.sh --emergency-mode=true
   ```

3. **Service Recovery**
   ```bash
   # Restart network-dependent services
   ./scripts/restart-network-services.sh
   
   # Verify connectivity restoration
   ./scripts/verify-network-recovery.sh
   ```

### Security Incident Recovery

#### Procedure DR-SEC-001: Security Breach Response

**Prerequisites:**
- Security incident response team activated
- Legal and compliance teams notified
- Law enforcement contacted if required

**Steps:**
1. **Immediate Containment** (0-15 minutes)
   ```bash
   # Isolate affected systems
   ./scripts/isolate-systems.sh --systems="compromised-server-list"
   
   # Block suspicious IP addresses
   ./scripts/block-ips.sh --ips="attacker-ip-list"
   
   # Revoke potentially compromised credentials
   ./scripts/revoke-credentials.sh --emergency=true
   ```

2. **Assessment and Analysis** (15-60 minutes)
   ```bash
   # Collect forensic evidence
   ./scripts/collect-forensics.sh --preserve-state=true
   
   # Analyze attack vectors
   ./scripts/analyze-attack.sh --timeline=24h
   
   # Assess data exposure
   ./scripts/assess-data-exposure.sh
   ```

3. **System Recovery** (60-240 minutes)
   ```bash
   # Clean compromised systems
   ./scripts/clean-compromised-systems.sh
   
   # Restore from clean backups
   ./scripts/restore-from-clean-backup.sh \
     --backup-date="before-compromise"
   
   # Implement additional security measures
   ./scripts/implement-security-hardening.sh
   ```

4. **Service Restoration** (240-300 minutes)
   ```bash
   # Gradually restore services
   ./scripts/phased-service-restoration.sh
   
   # Monitor for ongoing threats
   ./scripts/enhanced-monitoring.sh --duration=72h
   ```

## System Dependencies

### Critical Dependencies
1. **Database**: PostgreSQL cluster
2. **Cache**: Redis cluster
3. **Storage**: S3-compatible object storage
4. **CDN**: CloudFlare or equivalent
5. **Monitoring**: Prometheus/Grafana stack
6. **Logging**: ELK stack
7. **Service Mesh**: Istio/Envoy

### Dependency Recovery Order
1. Core infrastructure (network, storage)
2. Database services
3. Cache services
4. Application services
5. Monitoring and logging
6. CDN and edge services

### External Service Dependencies
- **Authentication**: Auth0 or equivalent
- **Email**: SendGrid or equivalent
- **Payment**: Stripe or equivalent
- **Analytics**: Google Analytics
- **Error Tracking**: Sentry

## Testing and Validation

### Recovery Testing Schedule
- **Monthly**: Database failover test
- **Quarterly**: Complete DR site failover
- **Bi-annually**: Full disaster simulation
- **Annually**: Business continuity exercise

### Test Procedures

#### Test DR-TEST-001: Database Failover Test
```bash
#!/bin/bash
# Monthly database failover test

echo "Starting database failover test..."

# 1. Create test transaction before failover
TEST_ID=$(./scripts/create-test-transaction.sh)

# 2. Perform planned failover
./scripts/planned-db-failover.sh --test-mode=true

# 3. Verify test transaction exists after failover
./scripts/verify-test-transaction.sh --id="$TEST_ID"

# 4. Run smoke tests
./scripts/smoke-tests.sh --environment=test

# 5. Failback to primary
./scripts/db-failback.sh --test-mode=true

echo "Database failover test completed."
```

#### Test DR-TEST-002: Application Recovery Test
```bash
#!/bin/bash
# Quarterly application recovery test

echo "Starting application recovery test..."

# 1. Create load balancer maintenance mode
./scripts/enable-maintenance-mode.sh

# 2. Simulate application failure
./scripts/simulate-app-failure.sh --servers=50%

# 3. Trigger automatic recovery
./scripts/trigger-auto-recovery.sh

# 4. Verify recovery completion
./scripts/verify-recovery.sh --timeout=300

# 5. Disable maintenance mode
./scripts/disable-maintenance-mode.sh

echo "Application recovery test completed."
```

### Validation Checklist

#### Post-Recovery Validation
- [ ] All critical services are operational
- [ ] Database connectivity restored
- [ ] User authentication working
- [ ] Core functionality verified
- [ ] Performance metrics normal
- [ ] Monitoring and alerting active
- [ ] Backup systems operational
- [ ] Security controls in place

#### Data Integrity Checks
```bash
# Database consistency checks
./scripts/check-db-consistency.sh

# Data validation queries
./scripts/validate-critical-data.sh

# Cross-reference with backup data
./scripts/compare-with-backup.sh --backup-id=latest

# User data verification
./scripts/verify-user-data.sh --sample-size=1000
```

## Communication Templates

### Initial Incident Notification

**Subject**: [URGENT] Service Incident - Learning Assistant Platform

**Body:**
```
INCIDENT ALERT - Learning Assistant Platform

Incident ID: INC-YYYY-MMDD-NNNN
Status: INVESTIGATING
Severity: [P1/P2/P3/P4]
Start Time: [YYYY-MM-DD HH:MM UTC]

DESCRIPTION:
[Brief description of the issue]

IMPACT:
- Affected Services: [List of affected services]
- User Impact: [Description of user impact]
- Estimated Users Affected: [Number or percentage]

ACTIONS TAKEN:
- [List of immediate actions taken]

NEXT STEPS:
- [List of next steps and timeline]

COMMUNICATION:
- Next update: [Time]
- Incident channel: #incident-response
- Conference bridge: [Phone/URL]

Incident Commander: [Name]
Contact: [Email/Phone]
```

### Recovery Status Update

**Subject**: [UPDATE] Service Recovery - Learning Assistant Platform

**Body:**
```
RECOVERY UPDATE - Learning Assistant Platform

Incident ID: INC-YYYY-MMDD-NNNN
Status: [RECOVERING/RESOLVED/MONITORING]
Duration: [X hours Y minutes]

RECOVERY PROGRESS:
- Services Restored: [List]
- Services Still Affected: [List]
- Overall Progress: [X%]

TIMELINE:
- Issue Detected: [HH:MM UTC]
- Response Initiated: [HH:MM UTC]
- Recovery Started: [HH:MM UTC]
- Service Restored: [HH:MM UTC]

ROOT CAUSE:
[Brief explanation of root cause]

PREVENTIVE MEASURES:
- [List of measures to prevent recurrence]

STATUS:
- RTO Target: 4 hours | Actual: [X hours]
- RPO Target: 1 hour | Actual: [X minutes]

Next update: [Time or "Final update"]
```

### Post-Incident Summary

**Subject**: [RESOLVED] Incident Summary - Learning Assistant Platform

**Body:**
```
INCIDENT SUMMARY - Learning Assistant Platform

Incident ID: INC-YYYY-MMDD-NNNN
Status: RESOLVED
Total Duration: [X hours Y minutes]
Services Affected: [List]

TIMELINE:
- Incident Start: [YYYY-MM-DD HH:MM UTC]
- Detection: [YYYY-MM-DD HH:MM UTC]
- Response: [YYYY-MM-DD HH:MM UTC]
- Resolution: [YYYY-MM-DD HH:MM UTC]

ROOT CAUSE:
[Detailed explanation of what caused the incident]

IMPACT ASSESSMENT:
- Users Affected: [Number/Percentage]
- Data Loss: [None/Minimal/Details]
- Financial Impact: [If applicable]
- SLA Impact: [Details]

RESOLUTION:
[Detailed explanation of how the incident was resolved]

LESSONS LEARNED:
- [Key lessons from the incident]

ACTION ITEMS:
1. [Action item 1] - Owner: [Name] - Due: [Date]
2. [Action item 2] - Owner: [Name] - Due: [Date]
3. [Action item 3] - Owner: [Name] - Due: [Date]

POST-INCIDENT REVIEW:
Scheduled for: [Date/Time]
Meeting Link: [URL]
```

## Post-Recovery Tasks

### Immediate Post-Recovery (0-2 hours)
1. **Verify Service Restoration**
   ```bash
   # Comprehensive health check
   ./scripts/post-recovery-health-check.sh
   
   # User acceptance testing
   ./scripts/user-acceptance-tests.sh
   
   # Performance verification
   ./scripts/performance-verification.sh
   ```

2. **Monitor for Issues**
   ```bash
   # Enhanced monitoring for 24 hours
   ./scripts/enhanced-monitoring.sh --duration=24h
   
   # Error rate monitoring
   ./scripts/monitor-error-rates.sh --threshold=0.1%
   ```

3. **Stakeholder Communication**
   - Send recovery confirmation to all stakeholders
   - Update status page
   - Notify customer support team

### Short-term Post-Recovery (2-24 hours)
1. **Data Validation**
   ```bash
   # Comprehensive data integrity check
   ./scripts/comprehensive-data-check.sh
   
   # User data validation
   ./scripts/validate-user-data.sh --full-check=true
   
   # Transaction log verification
   ./scripts/verify-transaction-logs.sh
   ```

2. **Performance Analysis**
   ```bash
   # Performance baseline comparison
   ./scripts/compare-performance-baseline.sh
   
   # Resource utilization analysis
   ./scripts/analyze-resource-usage.sh
   ```

3. **Security Assessment**
   ```bash
   # Security posture check
   ./scripts/security-posture-check.sh
   
   # Access log review
   ./scripts/review-access-logs.sh --period=incident
   ```

### Medium-term Post-Recovery (1-7 days)
1. **Root Cause Analysis**
   - Conduct detailed investigation
   - Document timeline and decisions
   - Identify contributing factors
   - Analyze response effectiveness

2. **Process Improvement**
   - Review recovery procedures
   - Update runbooks based on lessons learned
   - Improve monitoring and alerting
   - Enhance automation where possible

3. **Training and Knowledge Transfer**
   - Conduct team debrief sessions
   - Update training materials
   - Share lessons learned across teams
   - Practice improved procedures

### Long-term Post-Recovery (1-4 weeks)
1. **Infrastructure Improvements**
   - Implement recommended infrastructure changes
   - Upgrade monitoring and alerting systems
   - Enhance backup and recovery capabilities
   - Improve disaster recovery testing

2. **Documentation Updates**
   - Update all relevant documentation
   - Revise disaster recovery procedures
   - Update emergency contact information
   - Review and update SLAs

3. **Compliance and Audit**
   - Complete incident documentation for compliance
   - Conduct internal audit of incident response
   - Update risk assessments
   - Review insurance and legal implications

## Appendices

### Appendix A: Contact Information

#### Primary On-Call Rotation
| Week | Primary | Secondary | Manager |
|------|---------|-----------|---------|
| 1    | [Name]  | [Name]    | [Name]  |
| 2    | [Name]  | [Name]    | [Name]  |
| 3    | [Name]  | [Name]    | [Name]  |
| 4    | [Name]  | [Name]    | [Name]  |

#### Escalation Matrix
| Level | Role | Contact | Response Time |
|-------|------|---------|---------------|
| L1 | On-call Engineer | [Contact] | 15 minutes |
| L2 | Senior Engineer | [Contact] | 30 minutes |
| L3 | Technical Manager | [Contact] | 1 hour |
| L4 | VP Engineering | [Contact] | 2 hours |

### Appendix B: System Architecture

#### High-Level Architecture Diagram
```
[Users] → [CDN] → [Load Balancer] → [Application Servers]
                                           ↓
[Cache Layer] ← [Database Cluster] ← [Application Servers]
     ↓                    ↓
[Monitoring] ← [Log Aggregation] ← [All Components]
```

#### Critical System Components
1. **Load Balancers**: HAProxy/NGINX
2. **Application Servers**: Node.js/Docker containers
3. **Database**: PostgreSQL cluster with read replicas
4. **Cache**: Redis cluster
5. **Storage**: AWS S3 or compatible
6. **Monitoring**: Prometheus + Grafana
7. **Logging**: ELK stack (Elasticsearch, Logstash, Kibana)

### Appendix C: Recovery Scripts

#### Script: health-check.sh
```bash
#!/bin/bash
# Comprehensive health check script

set -e

echo "Starting health check..."

# Check application endpoints
echo "Checking application endpoints..."
curl -f http://app.learning-assistant.com/health || exit 1

# Check database connectivity
echo "Checking database..."
pg_isready -h db.learning-assistant.com -p 5432 || exit 1

# Check cache connectivity
echo "Checking cache..."
redis-cli -h cache.learning-assistant.com ping || exit 1

# Check external dependencies
echo "Checking external dependencies..."
curl -f https://api.external-service.com/health || echo "Warning: External service unavailable"

echo "Health check completed successfully!"
```

#### Script: backup-verification.sh
```bash
#!/bin/bash
# Backup verification script

BACKUP_ID=${1:-latest}

echo "Verifying backup: $BACKUP_ID"

# Check backup metadata
BACKUP_INFO=$(psql -h backup-db -t -c "SELECT * FROM backup_metadata WHERE id='$BACKUP_ID';")
if [[ -z "$BACKUP_INFO" ]]; then
    echo "Error: Backup not found"
    exit 1
fi

# Verify backup file integrity
BACKUP_PATH=$(echo "$BACKUP_INFO" | cut -d'|' -f3 | xargs)
if [[ ! -f "$BACKUP_PATH" ]]; then
    echo "Error: Backup file not found: $BACKUP_PATH"
    exit 1
fi

# Check file size
EXPECTED_SIZE=$(echo "$BACKUP_INFO" | cut -d'|' -f4 | xargs)
ACTUAL_SIZE=$(stat -c%s "$BACKUP_PATH")
if [[ "$ACTUAL_SIZE" -ne "$EXPECTED_SIZE" ]]; then
    echo "Error: Backup file size mismatch"
    exit 1
fi

# Verify checksum
EXPECTED_CHECKSUM=$(echo "$BACKUP_INFO" | cut -d'|' -f5 | xargs)
ACTUAL_CHECKSUM=$(sha256sum "$BACKUP_PATH" | cut -d' ' -f1)
if [[ "$ACTUAL_CHECKSUM" != "$EXPECTED_CHECKSUM" ]]; then
    echo "Error: Backup checksum mismatch"
    exit 1
fi

echo "Backup verification successful!"
```

### Appendix D: Monitoring Queries

#### Database Performance Queries
```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('learning_assistant_db'));

-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check replication lag
SELECT 
    client_addr,
    pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS send_lag,
    pg_wal_lsn_diff(sent_lsn, flush_lsn) AS receive_lag,
    pg_wal_lsn_diff(flush_lsn, replay_lsn) AS replay_lag
FROM pg_stat_replication;
```

#### Application Performance Queries
```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s "http://app.learning-assistant.com/health"

# Check error rates
grep "ERROR" /var/log/app/application.log | wc -l

# Check memory usage
free -h

# Check disk usage
df -h
```

### Appendix E: Compliance and Legal

#### Data Protection Considerations
- GDPR compliance requirements
- Data residency restrictions
- Privacy impact assessments
- Breach notification procedures

#### Legal Notifications
- Customer notification timelines
- Regulatory reporting requirements
- Insurance claim procedures
- Vendor notification requirements

#### Audit Trail Requirements
- Incident response documentation
- Decision rationale documentation
- Timeline documentation
- Communication records

---

**Document Version**: 2.0  
**Last Updated**: [Current Date]  
**Next Review**: [Date + 6 months]  
**Owner**: DevOps Team  
**Approver**: VP Engineering

**Change Log**:
- v2.0: Complete rewrite with comprehensive procedures
- v1.1: Added security incident procedures
- v1.0: Initial version