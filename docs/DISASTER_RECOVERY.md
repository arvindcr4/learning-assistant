# Disaster Recovery Documentation and Runbooks

## Table of Contents
- [Overview](#overview)
- [RTO/RPO Requirements](#rtorpo-requirements)
- [Backup Strategy](#backup-strategy)
- [Recovery Procedures](#recovery-procedures)
- [Testing and Validation](#testing-and-validation)
- [Emergency Contacts](#emergency-contacts)
- [Runbooks](#runbooks)
- [Communication Plan](#communication-plan)
- [Post-Incident Review](#post-incident-review)

## Overview

This document outlines the comprehensive disaster recovery strategy for the Learning Assistant application. The plan addresses various failure scenarios and provides step-by-step procedures to restore services within defined Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO).

### System Architecture Overview

The Learning Assistant consists of:
- **Frontend**: Next.js application
- **Backend**: Node.js API servers
- **Database**: PostgreSQL with read replicas
- **Cache**: Redis cluster
- **File Storage**: AWS S3 / Azure Blob / GCP Cloud Storage
- **Message Queue**: Redis/RabbitMQ
- **Monitoring**: Prometheus, Grafana, ELK Stack

### Disaster Recovery Goals

- **RTO (Recovery Time Objective)**: < 4 hours
- **RPO (Recovery Point Objective)**: < 15 minutes
- **Availability Target**: 99.9% (8.77 hours downtime per year)
- **Data Loss Tolerance**: Minimal (< 15 minutes of data)

## RTO/RPO Requirements

### Service Level Agreements

| Service Component | RTO Target | RPO Target | Critical Level |
|------------------|------------|------------|----------------|
| User Authentication | 30 minutes | 5 minutes | Critical |
| Learning Content API | 1 hour | 15 minutes | Critical |
| Progress Tracking | 2 hours | 15 minutes | High |
| Analytics Dashboard | 4 hours | 1 hour | Medium |
| Notification System | 2 hours | 30 minutes | Medium |
| Admin Portal | 4 hours | 1 hour | Low |

### Data Classification

| Data Type | Criticality | Backup Frequency | Retention Period |
|-----------|-------------|------------------|------------------|
| User Profiles | Critical | Real-time | 7 years |
| Learning Progress | Critical | Every 5 minutes | 3 years |
| Content Data | High | Daily | 2 years |
| Session Data | High | Every 15 minutes | 30 days |
| Analytics Data | Medium | Hourly | 1 year |
| Audit Logs | Critical | Real-time | 7 years |

## Backup Strategy

### 1. Database Backup Strategy

#### PostgreSQL Backup Configuration
- **Primary Method**: WAL-E with continuous WAL archiving
- **Backup Types**: Full, Incremental, Point-in-Time Recovery
- **Frequency**: 
  - Full backup: Daily at 2:00 AM UTC
  - Incremental backup: Every 6 hours
  - WAL shipping: Continuous (every 5 minutes)
- **Storage**: Multi-region (primary + 2 regions)
- **Encryption**: AES-256-CBC with rotating keys

#### Redis Backup Configuration
- **Primary Method**: RDB snapshots + AOF persistence
- **Frequency**: 
  - RDB snapshots: Every 15 minutes
  - AOF fsync: Every second
- **Storage**: Cross-region replication
- **Cluster**: Master-slave with Sentinel failover

### 2. Application Data Backup

#### File Storage Backup
- **Method**: Cross-region replication
- **Frequency**: Real-time sync
- **Versioning**: Enabled with 90-day retention
- **Encryption**: Server-side encryption enabled

#### Configuration Backup
- **Method**: Git repository + encrypted secrets
- **Frequency**: On every deployment
- **Storage**: Private repositories with access controls

### 3. Infrastructure Backup

#### Container Images
- **Method**: Multi-registry push
- **Frequency**: On every build
- **Retention**: 50 versions per image
- **Scanning**: Automated vulnerability scanning

#### Kubernetes Configurations
- **Method**: Git-based GitOps
- **Frequency**: On every change
- **Validation**: Automated testing pipeline

## Recovery Procedures

### 1. Complete System Failure Recovery

#### Prerequisites
- [ ] Verify backup integrity
- [ ] Confirm infrastructure availability
- [ ] Alert stakeholders
- [ ] Document incident start time

#### Step-by-Step Recovery Process

##### Phase 1: Infrastructure Assessment (0-15 minutes)
1. **Assess the scope of failure**
   ```bash
   # Check system status
   kubectl get nodes
   kubectl get pods --all-namespaces
   curl -f https://health.learningassistant.com/api/health
   ```

2. **Verify backup systems**
   ```bash
   # Check backup status
   ./scripts/backup/backup-verification.sh --quick
   aws s3 ls s3://learning-assistant-backups/
   ```

3. **Confirm recovery environment**
   ```bash
   # Switch to DR environment
   kubectl config use-context disaster-recovery
   kubectl get ns learning-assistant-dr
   ```

##### Phase 2: Database Recovery (15-60 minutes)
1. **Restore PostgreSQL from backup**
   ```bash
   # Find latest backup
   ./scripts/recovery/disaster-recovery.sh --mode database-only --dry-run
   
   # Execute restore
   ./scripts/recovery/disaster-recovery.sh --mode database-only \
     --backup-id "$(date +%Y%m%d)" \
     --target-time "2024-01-01 12:00:00"
   ```

2. **Verify database integrity**
   ```bash
   # Run integrity checks
   ./scripts/backup/backup-verification.sh --full --database-only
   ```

3. **Update database connections**
   ```bash
   # Update connection strings
   kubectl patch secret db-credentials -p '{"data":{"host":"new-db-host"}}'
   ```

##### Phase 3: Application Recovery (60-120 minutes)
1. **Deploy application services**
   ```bash
   # Deploy core services
   helm upgrade learning-assistant ./deploy/helm/learning-assistant \
     --namespace learning-assistant-dr \
     --set image.tag=latest-stable
   ```

2. **Restore Redis data**
   ```bash
   # Restore Redis cluster
   ./scripts/recovery/redis-recovery.sh --restore-from-backup
   ```

3. **Verify service health**
   ```bash
   # Check service status
   kubectl get pods -n learning-assistant-dr
   curl -f https://dr.learningassistant.com/api/health
   ```

##### Phase 4: Data Validation (120-180 minutes)
1. **Validate data integrity**
   ```bash
   # Run data validation
   ./scripts/recovery/data-validation.sh --comprehensive
   ```

2. **Test critical user flows**
   ```bash
   # Run smoke tests
   npm run test:smoke:production
   ```

3. **Verify backup resumption**
   ```bash
   # Restart backup processes
   ./scripts/backup/database-backup.sh --verify-schedule
   ```

##### Phase 5: Traffic Restoration (180-240 minutes)
1. **Update DNS records**
   ```bash
   # Switch DNS to DR environment
   aws route53 change-resource-record-sets \
     --hosted-zone-id Z123456789 \
     --change-batch file://dns-failover.json
   ```

2. **Monitor system performance**
   ```bash
   # Monitor key metrics
   ./scripts/monitoring/health-check.sh --extended
   ```

3. **Communicate restoration**
   ```bash
   # Send status update
   ./scripts/communication/send-status-update.sh \
     --status "RESTORED" \
     --eta "Service fully operational"
   ```

### 2. Partial System Failure Recovery

#### Database-Only Failure
```bash
# Quick database failover
./scripts/recovery/database-failover.sh --to-replica
# Verify application connectivity
./scripts/recovery/verify-db-connection.sh
```

#### Application-Only Failure
```bash
# Redeploy application
kubectl rollout restart deployment/learning-assistant
# Scale up replicas
kubectl scale deployment learning-assistant --replicas=3
```

#### Cache Failure
```bash
# Failover to Redis replica
./scripts/recovery/redis-failover.sh
# Warm cache with critical data
./scripts/cache/warm-cache.sh --priority-data
```

### 3. Point-in-Time Recovery

#### When to Use
- Data corruption detected
- Accidental data deletion
- Need to restore to specific timestamp

#### Procedure
```bash
# Identify target recovery time
TARGET_TIME="2024-01-01 12:30:00"

# Restore database to specific point
./scripts/recovery/disaster-recovery.sh \
  --mode point-in-time \
  --target-time "$TARGET_TIME" \
  --confirm

# Validate data consistency
./scripts/recovery/data-validation.sh \
  --timestamp "$TARGET_TIME" \
  --verify-integrity
```

## Testing and Validation

### 1. Automated Testing Schedule

#### Monthly Disaster Recovery Test
- **Schedule**: First Saturday of every month, 2:00 AM UTC
- **Scope**: Full system recovery simulation
- **Duration**: 4 hours
- **Automation**: Fully automated with manual oversight

```bash
# Monthly DR test
./scripts/testing/monthly-dr-test.sh
```

#### Weekly Backup Validation
- **Schedule**: Every Sunday, 3:00 AM UTC
- **Scope**: Backup integrity and restoration verification
- **Duration**: 1 hour
- **Automation**: Fully automated

```bash
# Weekly backup test
./scripts/testing/weekly-backup-test.sh
```

#### Daily Health Checks
- **Schedule**: Every day, 6:00 AM UTC
- **Scope**: System health and backup status
- **Duration**: 15 minutes
- **Automation**: Fully automated

```bash
# Daily health check
./scripts/testing/daily-health-check.sh
```

### 2. Manual Testing Procedures

#### Quarterly DR Exercise
- **Participants**: All engineering teams
- **Scope**: Complete disaster simulation
- **Documentation**: Detailed incident report
- **Improvements**: Action items and process updates

#### Annual DR Audit
- **Participants**: External auditors
- **Scope**: Comprehensive DR capability assessment
- **Documentation**: Compliance report
- **Certification**: DR readiness certification

### 3. Test Scenarios

#### Scenario 1: Primary Database Failure
```bash
# Simulate database failure
./scripts/testing/simulate-db-failure.sh
# Execute recovery procedures
./scripts/recovery/database-failover.sh
# Measure recovery time
./scripts/testing/measure-recovery-time.sh
```

#### Scenario 2: Complete Data Center Outage
```bash
# Simulate DC outage
./scripts/testing/simulate-dc-outage.sh
# Switch to DR site
./scripts/recovery/activate-dr-site.sh
# Validate full functionality
./scripts/testing/validate-dr-functionality.sh
```

#### Scenario 3: Data Corruption
```bash
# Simulate data corruption
./scripts/testing/simulate-data-corruption.sh
# Perform point-in-time recovery
./scripts/recovery/point-in-time-recovery.sh
# Verify data integrity
./scripts/testing/verify-data-integrity.sh
```

## Emergency Contacts

### Primary Response Team

#### Incident Commander
- **Name**: [Primary Engineer]
- **Phone**: [Phone Number]
- **Email**: [Email Address]
- **Escalation**: [Manager Contact]

#### Database Administrator
- **Name**: [DBA Lead]
- **Phone**: [Phone Number]
- **Email**: [Email Address]
- **Backup**: [Secondary DBA]

#### Infrastructure Lead
- **Name**: [DevOps Lead]
- **Phone**: [Phone Number]
- **Email**: [Email Address]
- **Backup**: [Secondary DevOps]

### Secondary Response Team

#### Product Owner
- **Name**: [Product Manager]
- **Phone**: [Phone Number]
- **Email**: [Email Address]

#### Customer Support Lead
- **Name**: [Support Manager]
- **Phone**: [Phone Number]
- **Email**: [Email Address]

### Executive Escalation

#### Engineering Director
- **Name**: [Engineering Director]
- **Phone**: [Phone Number]
- **Email**: [Email Address]

#### CEO
- **Name**: [CEO Name]
- **Phone**: [Phone Number]
- **Email**: [Email Address]

### External Contacts

#### Cloud Provider Support
- **AWS**: [Support Case URL]
- **Azure**: [Support Case URL]
- **GCP**: [Support Case URL]

#### Managed Service Providers
- **Database Provider**: [Contact Information]
- **CDN Provider**: [Contact Information]
- **Monitoring Provider**: [Contact Information]

## Runbooks

### Runbook 1: Database Failover

#### Trigger Conditions
- Primary database unresponsive for > 5 minutes
- Database connection errors > 50% for 5 minutes
- Database CPU > 95% for 10 minutes

#### Steps
1. **Verify database health**
   ```bash
   pg_isready -h $DB_HOST -p $DB_PORT
   ```

2. **Check replica status**
   ```bash
   psql -h $DB_REPLICA_HOST -c "SELECT pg_is_in_recovery();"
   ```

3. **Promote replica to primary**
   ```bash
   pg_promote -D $PGDATA
   ```

4. **Update application configuration**
   ```bash
   kubectl patch configmap db-config --patch '{"data":{"host":"new-primary-host"}}'
   ```

5. **Restart application pods**
   ```bash
   kubectl rollout restart deployment/learning-assistant
   ```

### Runbook 2: Application Recovery

#### Trigger Conditions
- Application health check failures > 5 minutes
- HTTP 5xx errors > 10% for 5 minutes
- Pod crash loops

#### Steps
1. **Check pod status**
   ```bash
   kubectl get pods -n learning-assistant
   ```

2. **Review pod logs**
   ```bash
   kubectl logs -n learning-assistant -l app=learning-assistant --tail=100
   ```

3. **Check resource usage**
   ```bash
   kubectl top pods -n learning-assistant
   ```

4. **Restart failed pods**
   ```bash
   kubectl delete pod -n learning-assistant -l app=learning-assistant
   ```

5. **Scale up if needed**
   ```bash
   kubectl scale deployment learning-assistant --replicas=5
   ```

### Runbook 3: Cache Recovery

#### Trigger Conditions
- Redis unavailable for > 2 minutes
- Cache hit rate < 50% for 10 minutes
- Redis memory usage > 95%

#### Steps
1. **Check Redis cluster status**
   ```bash
   redis-cli -h $REDIS_HOST ping
   redis-cli -h $REDIS_HOST cluster nodes
   ```

2. **Failover to replica**
   ```bash
   redis-cli -h $REDIS_SENTINEL_HOST sentinel failover mymaster
   ```

3. **Warm cache with critical data**
   ```bash
   ./scripts/cache/warm-cache.sh --critical-only
   ```

4. **Monitor cache performance**
   ```bash
   redis-cli -h $REDIS_HOST info stats
   ```

### Runbook 4: Network Connectivity Issues

#### Trigger Conditions
- DNS resolution failures
- External API timeouts > 20%
- CDN connectivity issues

#### Steps
1. **Check DNS resolution**
   ```bash
   nslookup learningassistant.com
   dig learningassistant.com
   ```

2. **Test external connectivity**
   ```bash
   curl -I https://api.external-service.com
   ```

3. **Check CDN status**
   ```bash
   curl -I https://cdn.learningassistant.com
   ```

4. **Switch to backup providers**
   ```bash
   kubectl patch configmap external-apis --patch '{"data":{"endpoint":"backup-endpoint"}}'
   ```

## Communication Plan

### 1. Internal Communication

#### Incident Declaration
- **Channel**: #incident-response Slack channel
- **Participants**: Engineering team, Product team, Customer support
- **Information**: Incident severity, initial assessment, expected resolution time

#### Status Updates
- **Frequency**: Every 30 minutes during active incident
- **Channel**: #incident-response, #engineering-alerts
- **Template**: 
  ```
  🚨 INCIDENT UPDATE - [INCIDENT_ID]
  Status: [INVESTIGATING/MITIGATING/MONITORING/RESOLVED]
  Impact: [Description of user impact]
  ETA: [Expected resolution time]
  Next Update: [Time of next update]
  ```

#### Resolution Communication
- **Channel**: #incident-response, #general
- **Information**: Root cause, resolution steps, prevention measures
- **Follow-up**: Post-incident review scheduling

### 2. External Communication

#### Status Page Updates
- **Platform**: Status.learningassistant.com
- **Frequency**: Real-time during incidents
- **Information**: Service status, incident details, resolution updates

#### Customer Communication
- **Channel**: Email, in-app notifications, social media
- **Trigger**: Incidents affecting > 10% of users or lasting > 30 minutes
- **Template**:
  ```
  Subject: Service Disruption - Learning Assistant
  
  We are currently experiencing issues with our service that may affect your ability to access learning content. Our team is actively working to resolve this issue.
  
  Estimated Resolution: [Time]
  Status Updates: https://status.learningassistant.com
  
  We apologize for any inconvenience and will provide updates as we work to resolve this issue.
  ```

### 3. Escalation Procedures

#### Level 1: Engineering Team
- **Trigger**: Incident declared
- **Response Time**: Immediate
- **Authority**: Technical resolution decisions

#### Level 2: Engineering Manager
- **Trigger**: Incident duration > 1 hour or customer escalation
- **Response Time**: 15 minutes
- **Authority**: Resource allocation, external communication approval

#### Level 3: Director of Engineering
- **Trigger**: Incident duration > 4 hours or revenue impact
- **Response Time**: 30 minutes
- **Authority**: Business decisions, media communication

#### Level 4: Executive Team
- **Trigger**: Incident duration > 8 hours or major customer impact
- **Response Time**: 1 hour
- **Authority**: Strategic decisions, legal implications

## Post-Incident Review

### 1. Incident Documentation

#### Incident Report Template
- **Incident ID**: [Unique identifier]
- **Date/Time**: [Start and end times]
- **Duration**: [Total incident duration]
- **Severity**: [Critical/High/Medium/Low]
- **Impact**: [User impact description]
- **Root Cause**: [Technical root cause]
- **Resolution**: [Steps taken to resolve]
- **Lessons Learned**: [Key takeaways]
- **Action Items**: [Specific improvements needed]

#### Timeline Documentation
- **Format**: Chronological log of all actions taken
- **Detail Level**: Minute-by-minute during critical phases
- **Responsibility**: Incident commander maintains timeline

### 2. Review Process

#### Immediate Review (Within 24 hours)
- **Participants**: Incident response team
- **Focus**: Technical details, immediate improvements
- **Outcome**: Technical action items, process updates

#### Formal Review (Within 1 week)
- **Participants**: Engineering team, product team, stakeholders
- **Focus**: Business impact, customer communication, prevention
- **Outcome**: Strategic action items, policy updates

#### Executive Review (Within 2 weeks)
- **Participants**: Executive team, department heads
- **Focus**: Business continuity, investment decisions
- **Outcome**: Budget allocation, strategic initiatives

### 3. Improvement Implementation

#### Action Item Tracking
- **System**: Jira/GitHub Issues
- **Ownership**: Specific team member assigned
- **Timeline**: Defined completion dates
- **Priority**: Critical/High/Medium/Low

#### Process Updates
- **Documentation**: Update runbooks and procedures
- **Training**: Team training on new procedures
- **Testing**: Validate improvements in next DR test

#### Investment Decisions
- **Infrastructure**: Additional redundancy, monitoring
- **Tooling**: Better incident response tools
- **Training**: Team skill development

## Appendix

### A. Backup File Locations

#### Database Backups
- **Location**: `s3://learning-assistant-backups/database/`
- **Format**: `YYYY/MM/DD/learning-assistant-db-YYYYMMDD-HHMMSS.sql.gz`
- **Retention**: 30 days local, 90 days archive, 7 years compliance

#### Application Backups
- **Location**: `s3://learning-assistant-backups/application/`
- **Format**: `YYYY/MM/DD/learning-assistant-app-YYYYMMDD-HHMMSS.tar.gz`
- **Retention**: 7 days local, 30 days archive

#### Configuration Backups
- **Location**: `s3://learning-assistant-backups/config/`
- **Format**: `YYYY/MM/DD/learning-assistant-config-YYYYMMDD-HHMMSS.tar.gz`
- **Retention**: 90 days local, 1 year archive

### B. Recovery Time Metrics

#### Historical Recovery Times
- **Database Failover**: 2-5 minutes average
- **Application Recovery**: 5-15 minutes average
- **Full System Recovery**: 2-4 hours average
- **Point-in-Time Recovery**: 1-3 hours average

#### SLA Compliance
- **Current Year**: 99.95% uptime
- **RTO Compliance**: 98% of incidents resolved within target
- **RPO Compliance**: 100% data recovery within target

### C. Contact Information Templates

#### Incident Notification Template
```
INCIDENT ALERT - [SEVERITY]
System: Learning Assistant
Time: [UTC timestamp]
Impact: [User impact description]
Estimated Resolution: [Time estimate]
Incident Commander: [Name and contact]
Status Updates: #incident-response
```

#### Customer Notification Template
```
Subject: [SERVICE ALERT] Learning Assistant Status Update

Dear Learning Assistant Users,

We are currently experiencing [brief description of issue]. Our team is actively working to resolve this issue and restore full service.

Current Status: [Status description]
Estimated Resolution: [Time estimate]
Affected Features: [List of affected features]

We will provide updates every 30 minutes until resolved.

Thank you for your patience.
The Learning Assistant Team
```

### D. Useful Commands Reference

#### Database Commands
```bash
# Check database connectivity
pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER

# Check replication status
psql -h $DB_HOST -c "SELECT * FROM pg_stat_replication;"

# Check database size
psql -h $DB_HOST -c "SELECT pg_size_pretty(pg_database_size('learning_assistant'));"

# Check active connections
psql -h $DB_HOST -c "SELECT count(*) FROM pg_stat_activity;"
```

#### Kubernetes Commands
```bash
# Check pod status
kubectl get pods -n learning-assistant -o wide

# Check resource usage
kubectl top pods -n learning-assistant

# Check pod logs
kubectl logs -n learning-assistant -l app=learning-assistant --tail=50

# Check service endpoints
kubectl get endpoints -n learning-assistant
```

#### Monitoring Commands
```bash
# Check service health
curl -f https://learningassistant.com/api/health

# Check metrics endpoint
curl -f https://learningassistant.com/metrics

# Check database metrics
curl -f https://db-exporter.learningassistant.com/metrics
```

---

**Document Version**: 2.0.0  
**Last Updated**: [Current Date]  
**Next Review**: [Next Review Date]  
**Approved By**: [Engineering Director]  
**Classification**: Confidential - Internal Use Only

This document contains sensitive information about our disaster recovery capabilities and should not be shared outside the organization without proper authorization.