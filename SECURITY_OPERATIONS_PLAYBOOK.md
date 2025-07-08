# Security Operations Playbook

## 🚨 Emergency Response Procedures

### Critical Security Incident Response

#### Immediate Actions (0-15 minutes)
1. **Assess Severity**
   ```bash
   # Check system status
   curl -s https://your-domain.com/api/health
   
   # Review recent security events
   grep "ERROR\|CRITICAL" /var/log/app/security.log | tail -50
   
   # Check for active attacks
   netstat -tulpn | grep :80
   netstat -tulpn | grep :443
   ```

2. **Contain the Threat**
   ```bash
   # Block malicious IP addresses
   iptables -A INPUT -s MALICIOUS_IP -j DROP
   
   # Enable DDoS protection
   systemctl enable --now ddos-protection
   
   # Isolate affected systems
   docker stop learning-assistant
   ```

3. **Notify Security Team**
   ```bash
   # Send emergency alert
   curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
     -H 'Content-type: application/json' \
     --data '{"text":"🚨 CRITICAL SECURITY INCIDENT - Immediate attention required"}'
   ```

#### Short-term Actions (15 minutes - 2 hours)
1. **Evidence Collection**
   ```bash
   # Collect system logs
   tar -czf incident-logs-$(date +%Y%m%d-%H%M%S).tar.gz \
     /var/log/nginx/ \
     /var/log/app/ \
     /var/log/audit/
   
   # Database backup for forensics
   pg_dump -h localhost -U postgres learning_assistant > \
     incident-db-backup-$(date +%Y%m%d-%H%M%S).sql
   
   # Memory dump (if system compromise suspected)
   dd if=/dev/mem of=memory-dump-$(date +%Y%m%d-%H%M%S).raw
   ```

2. **Communication**
   ```bash
   # Notify stakeholders
   cat > incident-notification.txt << EOF
   Subject: Security Incident Notification
   
   A security incident has been detected and contained.
   Incident ID: INC-$(date +%Y%m%d-%H%M%S)
   Severity: CRITICAL
   Status: CONTAINED
   
   Investigation in progress.
   EOF
   ```

### Data Breach Response

#### Immediate Assessment
```bash
# Check for data exfiltration
grep -i "select\|dump\|export" /var/log/app/database.log | tail -100

# Review authentication logs
grep -i "failed\|unauthorized" /var/log/auth.log | tail -100

# Check file access patterns
find /var/www -name "*.log" -exec grep -l "sensitive\|personal\|credit" {} \;
```

#### Containment Procedures
```bash
# Revoke all active sessions
redis-cli FLUSHDB

# Force password reset for affected users
psql -d learning_assistant -c "UPDATE users SET password_reset_required = true WHERE id IN (SELECT affected_user_ids);"

# Enable additional monitoring
echo "log_statement = 'all'" >> /etc/postgresql/postgresql.conf
systemctl reload postgresql
```

## 🔍 Security Monitoring Procedures

### Daily Security Health Check
```bash
#!/bin/bash
# daily-security-check.sh

echo "=== Daily Security Health Check - $(date) ==="

# Check system resources
echo "Memory Usage:"
free -h

echo "Disk Usage:"
df -h

echo "CPU Load:"
uptime

# Check security events
echo "Security Events (Last 24h):"
grep -c "security_event" /var/log/app/security.log

# Check failed login attempts
echo "Failed Login Attempts:"
grep -c "auth_failure" /var/log/app/auth.log

# Check rate limiting violations
echo "Rate Limit Violations:"
grep -c "rate_limit_exceeded" /var/log/nginx/error.log

# Check SSL certificate expiry
echo "SSL Certificate Status:"
openssl x509 -in /etc/ssl/certs/your-domain.crt -noout -dates

# Check for suspicious network connections
echo "Suspicious Network Connections:"
netstat -tulpn | grep -E ":(22|3389|5900)" | wc -l

echo "=== Health Check Complete ==="
```

### Weekly Security Assessment
```bash
#!/bin/bash
# weekly-security-assessment.sh

echo "=== Weekly Security Assessment - $(date) ==="

# Vulnerability scan
nmap -sS -O -sV localhost

# Check for outdated packages
apt list --upgradable | grep -i security

# Review user accounts
echo "User Accounts Review:"
cut -d: -f1 /etc/passwd | sort

# Check for unauthorized SUID files
echo "SUID Files Check:"
find / -perm -4000 -type f 2>/dev/null

# Database security check
psql -d learning_assistant -c "SELECT usename, usesuper, usecreatedb FROM pg_user;"

# Log analysis
echo "Top IP Addresses:"
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -10

echo "=== Assessment Complete ==="
```

## 🛠️ Incident Response Playbooks

### SQL Injection Attack Response

#### Detection Indicators
```bash
# Check for SQL injection patterns
grep -E "(union|select|insert|update|delete|drop)" /var/log/app/database.log -i

# Review suspicious database queries
grep -E "('.*'|;|--|\*)" /var/log/app/api.log -i

# Check for error messages revealing database structure
grep -i "mysql\|postgresql\|database\|table" /var/log/app/error.log
```

#### Response Actions
```bash
# 1. Block suspicious IP addresses
iptables -A INPUT -s SUSPICIOUS_IP -j DROP

# 2. Enable WAF strict mode
echo "SecRuleEngine On" >> /etc/modsecurity/modsecurity.conf

# 3. Review and sanitize all inputs
# (Code review required)

# 4. Check for data exfiltration
pg_stat_statements | grep -E "SELECT.*FROM.*users|passwords|sensitive"
```

### Cross-Site Scripting (XSS) Response

#### Detection and Containment
```bash
# Check for XSS patterns in logs
grep -E "(<script|javascript:|onload=|onerror=)" /var/log/nginx/access.log -i

# Review user input validation
grep -E "(escape|sanitize|validate)" /var/log/app/validation.log

# Enable Content Security Policy
nginx -t && nginx -s reload
```

### Brute Force Attack Response

#### Detection
```bash
# Identify brute force patterns
grep "auth_failure" /var/log/app/auth.log | awk '{print $3}' | sort | uniq -c | sort -nr

# Check for multiple failed attempts
grep -c "failed_login" /var/log/auth.log | tail -20
```

#### Mitigation
```bash
# Implement IP blocking
fail2ban-client status
fail2ban-client set sshd banip MALICIOUS_IP

# Enable account lockout
redis-cli SET "lockout:USER_ID" "true" EX 3600

# Notify user of suspicious activity
echo "Suspicious login attempts detected" | mail user@example.com
```

## 🔐 Security Maintenance Procedures

### Certificate Management
```bash
#!/bin/bash
# certificate-renewal.sh

# Check certificate expiry
CERT_FILE="/etc/ssl/certs/your-domain.crt"
EXPIRY_DATE=$(openssl x509 -in $CERT_FILE -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
    echo "Certificate expires in $DAYS_UNTIL_EXPIRY days - Renewal required"
    # Trigger certificate renewal
    certbot renew --quiet
    systemctl reload nginx
fi
```

### Database Security Maintenance
```sql
-- Weekly database security maintenance
-- Run as database administrator

-- Check for unused accounts
SELECT usename, usesuper, usecreatedb, last_login 
FROM pg_user 
LEFT JOIN pg_stat_activity ON pg_user.usename = pg_stat_activity.usename 
WHERE last_login < NOW() - INTERVAL '90 days' OR last_login IS NULL;

-- Review permissions
SELECT grantee, privilege_type, table_name 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public';

-- Check for weak passwords (if using internal auth)
SELECT usename FROM pg_user WHERE passwd IS NULL;

-- Audit database connections
SELECT client_addr, usename, application_name, state, query_start 
FROM pg_stat_activity 
WHERE state = 'active' AND query_start < NOW() - INTERVAL '1 hour';
```

### Log Rotation and Archival
```bash
#!/bin/bash
# log-management.sh

# Rotate logs
logrotate -f /etc/logrotate.d/learning-assistant

# Archive old logs
tar -czf security-logs-$(date +%Y-%m).tar.gz /var/log/app/security.log.*
mv security-logs-$(date +%Y-%m).tar.gz /backup/security-logs/

# Clean up old archives (keep 1 year)
find /backup/security-logs/ -name "*.tar.gz" -mtime +365 -delete

# Verify log integrity
sha256sum /var/log/app/*.log > /backup/log-checksums-$(date +%Y-%m-%d).txt
```

## 📊 Security Metrics Collection

### Key Performance Indicators
```bash
#!/bin/bash
# security-metrics.sh

echo "=== Security Metrics Collection - $(date) ==="

# Authentication metrics
AUTH_SUCCESS=$(grep -c "auth_success" /var/log/app/auth.log)
AUTH_FAILURE=$(grep -c "auth_failure" /var/log/app/auth.log)
AUTH_SUCCESS_RATE=$(echo "scale=2; $AUTH_SUCCESS / ($AUTH_SUCCESS + $AUTH_FAILURE) * 100" | bc)

echo "Authentication Success Rate: $AUTH_SUCCESS_RATE%"

# Security event metrics
CRITICAL_EVENTS=$(grep -c "severity.*critical" /var/log/app/security.log)
HIGH_EVENTS=$(grep -c "severity.*high" /var/log/app/security.log)
MEDIUM_EVENTS=$(grep -c "severity.*medium" /var/log/app/security.log)

echo "Critical Events: $CRITICAL_EVENTS"
echo "High Severity Events: $HIGH_EVENTS"
echo "Medium Severity Events: $MEDIUM_EVENTS"

# Rate limiting metrics
RATE_LIMIT_HITS=$(grep -c "rate_limit_exceeded" /var/log/nginx/error.log)
echo "Rate Limit Violations: $RATE_LIMIT_HITS"

# System availability
UPTIME=$(uptime | awk '{print $3,$4}' | sed 's/,//')
echo "System Uptime: $UPTIME"
```

### Performance Impact Assessment
```bash
#!/bin/bash
# security-performance-impact.sh

# Measure security middleware performance
echo "=== Security Performance Metrics ==="

# Authentication latency
curl -w "@curl-format.txt" -o /dev/null -s "https://your-domain.com/api/auth/status"

# Rate limiting overhead
ab -n 100 -c 10 https://your-domain.com/api/health

# Encryption/decryption performance
time openssl enc -aes-256-cbc -in testfile.txt -out testfile.enc -k "test"
time openssl enc -d -aes-256-cbc -in testfile.enc -out testfile.dec -k "test"
```

## 🔄 Backup and Recovery Procedures

### Security-focused Backup
```bash
#!/bin/bash
# security-backup.sh

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/security/$BACKUP_DATE"

mkdir -p $BACKUP_DIR

# Database backup with encryption
pg_dump learning_assistant | gpg --cipher-algo AES256 --compress-algo 1 \
  --symmetric --output $BACKUP_DIR/database_$BACKUP_DATE.sql.gpg

# Configuration backup
tar -czf $BACKUP_DIR/config_$BACKUP_DATE.tar.gz \
  /etc/nginx/ \
  /etc/ssl/ \
  /etc/fail2ban/ \
  /etc/logrotate.d/

# Security logs backup
tar -czf $BACKUP_DIR/logs_$BACKUP_DATE.tar.gz /var/log/app/security.log*

# Create checksum for integrity verification
sha256sum $BACKUP_DIR/* > $BACKUP_DIR/checksums.txt

# Upload to secure offsite storage
aws s3 cp $BACKUP_DIR/ s3://security-backups/learning-assistant/ --recursive
```

### Disaster Recovery
```bash
#!/bin/bash
# disaster-recovery.sh

echo "=== Disaster Recovery Procedure ==="

# 1. Stop all services
systemctl stop nginx
systemctl stop learning-assistant
systemctl stop postgresql

# 2. Restore from backup
RESTORE_DATE=$1
if [ -z "$RESTORE_DATE" ]; then
    echo "Usage: $0 <YYYYMMDD_HHMMSS>"
    exit 1
fi

BACKUP_DIR="/backup/security/$RESTORE_DATE"

# 3. Verify backup integrity
cd $BACKUP_DIR
sha256sum -c checksums.txt

# 4. Restore database
gpg --decrypt database_$RESTORE_DATE.sql.gpg | psql learning_assistant

# 5. Restore configuration
tar -xzf config_$RESTORE_DATE.tar.gz -C /

# 6. Restart services
systemctl start postgresql
systemctl start learning-assistant
systemctl start nginx

# 7. Verify restoration
curl -s https://your-domain.com/api/health
```

## 📋 Compliance and Audit Support

### GDPR Compliance Checklist
```bash
#!/bin/bash
# gdpr-compliance-check.sh

echo "=== GDPR Compliance Check ==="

# Check data processing records
psql -d learning_assistant -c "SELECT COUNT(*) FROM data_processing_logs WHERE created_at > NOW() - INTERVAL '30 days';"

# Verify consent records
psql -d learning_assistant -c "SELECT consent_type, COUNT(*) FROM user_consents GROUP BY consent_type;"

# Check data retention compliance
psql -d learning_assistant -c "SELECT COUNT(*) FROM users WHERE last_login < NOW() - INTERVAL '2 years';"

# Verify encryption status
gpg --list-secret-keys
openssl ciphers -v 'ECDHE+AESGCM'

echo "=== Compliance Check Complete ==="
```

### Security Audit Trail
```bash
#!/bin/bash
# security-audit-trail.sh

echo "=== Security Audit Trail Generation ==="

# User access patterns
psql -d learning_assistant -c "
SELECT user_id, action, resource, timestamp 
FROM audit_log 
WHERE timestamp > NOW() - INTERVAL '30 days' 
ORDER BY timestamp DESC 
LIMIT 1000;" > audit_trail_$(date +%Y%m%d).csv

# Security configuration changes
grep "config_change" /var/log/app/security.log | tail -100 > config_changes_$(date +%Y%m%d).log

# Authentication events
grep -E "(login|logout|auth_failure)" /var/log/app/auth.log > auth_events_$(date +%Y%m%d).log

# Privilege escalations
grep "privilege_escalation" /var/log/app/security.log > privilege_events_$(date +%Y%m%d).log

echo "Audit trail files generated for $(date +%Y-%m-%d)"
```

## 🚀 Automated Security Responses

### Automated Threat Mitigation
```bash
#!/bin/bash
# automated-response.sh

# Monitor security events and trigger responses
tail -f /var/log/app/security.log | while read line; do
    if echo "$line" | grep -q "sql_injection_attempt"; then
        IP=$(echo "$line" | awk '{print $5}')
        iptables -A INPUT -s $IP -j DROP
        echo "Blocked IP $IP for SQL injection attempt"
    fi
    
    if echo "$line" | grep -q "brute_force_attack"; then
        USER=$(echo "$line" | awk '{print $6}')
        redis-cli SET "lockout:$USER" "true" EX 3600
        echo "Locked account $USER for brute force attack"
    fi
    
    if echo "$line" | grep -q "privilege_escalation"; then
        # Escalate to security team
        curl -X POST https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK \
          -H 'Content-type: application/json' \
          --data "{\"text\":\"🚨 Privilege escalation detected: $line\"}"
    fi
done
```

### Health Check and Auto-Recovery
```bash
#!/bin/bash
# health-check-recovery.sh

while true; do
    # Check application health
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com/api/health)
    
    if [ "$HTTP_STATUS" != "200" ]; then
        echo "Health check failed with status $HTTP_STATUS"
        
        # Restart application
        systemctl restart learning-assistant
        sleep 30
        
        # Verify recovery
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com/api/health)
        if [ "$HTTP_STATUS" = "200" ]; then
            echo "Application recovered successfully"
        else
            # Escalate to operations team
            echo "Application failed to recover - manual intervention required"
        fi
    fi
    
    sleep 60
done
```

---

## 📞 Emergency Contacts

### Security Team
- **Security Operations Center**: +1-XXX-XXX-XXXX
- **Incident Commander**: security-commander@company.com
- **CISO**: ciso@company.com
- **DevOps On-Call**: devops-oncall@company.com

### External Contacts
- **Cyber Insurance**: +1-XXX-XXX-XXXX
- **Legal Counsel**: legal@company.com
- **Law Enforcement**: Contact local authorities
- **Forensics Partner**: forensics@partner.com

---

*This playbook should be reviewed and updated quarterly to ensure all procedures remain current and effective.*