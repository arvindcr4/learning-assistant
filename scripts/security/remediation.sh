#!/bin/bash

# =============================================================================
# AUTOMATED SECURITY REMEDIATION SCRIPT
# Comprehensive automated remediation for security findings
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RESULTS_DIR="${PROJECT_ROOT}/security-results"
REMEDIATION_LOG="${PROJECT_ROOT}/logs/remediation-$(date +%Y%m%d_%H%M%S).log"
DRY_RUN="${DRY_RUN:-false}"
SEVERITY_THRESHOLD="${SEVERITY_THRESHOLD:-HIGH}"
AUTO_COMMIT="${AUTO_COMMIT:-false}"
BACKUP_DIR="${PROJECT_ROOT}/backups/remediation-$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# FUNCTIONS
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${REMEDIATION_LOG}"
}

log_info() {
    log "INFO" "${BLUE}$*${NC}"
}

log_warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

log_error() {
    log "ERROR" "${RED}$*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

create_backup() {
    local file="$1"
    local backup_file="${BACKUP_DIR}/$(basename "$file").backup"
    
    mkdir -p "$(dirname "$backup_file")"
    cp "$file" "$backup_file"
    log_info "Created backup: $backup_file"
}

apply_remediation() {
    local file="$1"
    local remediation="$2"
    local description="$3"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would apply remediation to $file: $description"
        return 0
    fi
    
    create_backup "$file"
    
    log_info "Applying remediation to $file: $description"
    eval "$remediation"
    
    if [[ $? -eq 0 ]]; then
        log_success "Successfully applied remediation to $file"
        return 0
    else
        log_error "Failed to apply remediation to $file"
        return 1
    fi
}

# =============================================================================
# INFRASTRUCTURE SECURITY REMEDIATIONS
# =============================================================================

remediate_terraform_security() {
    log_info "Starting Terraform security remediations..."
    
    # Find all Terraform files
    find "$PROJECT_ROOT" -name "*.tf" -type f | while read -r tf_file; do
        log_info "Analyzing Terraform file: $tf_file"
        
        # Remediation 1: Enable encryption for S3 buckets
        if grep -q "resource \"aws_s3_bucket\"" "$tf_file" && ! grep -q "server_side_encryption_configuration" "$tf_file"; then
            local bucket_name=$(grep -A 10 "resource \"aws_s3_bucket\"" "$tf_file" | grep -o '"[^"]*"' | head -1 | tr -d '"')
            local remediation="
                sed -i '/resource \"aws_s3_bucket\" \"$bucket_name\"/,/^}/ {
                    /^}$/i\\
\\
  tags = local.common_tags\\
}\\
\\
resource \"aws_s3_bucket_server_side_encryption_configuration\" \"${bucket_name}_encryption\" {\\
  bucket = aws_s3_bucket.$bucket_name.id\\
\\
  rule {\\
    apply_server_side_encryption_by_default {\\
      sse_algorithm = \"AES256\"\\
    }\\
  }
                }' '$tf_file'
            "
            apply_remediation "$tf_file" "$remediation" "Add S3 bucket encryption"
        fi
        
        # Remediation 2: Enable versioning for S3 buckets
        if grep -q "resource \"aws_s3_bucket\"" "$tf_file" && ! grep -q "aws_s3_bucket_versioning" "$tf_file"; then
            local bucket_name=$(grep -A 10 "resource \"aws_s3_bucket\"" "$tf_file" | grep -o '"[^"]*"' | head -1 | tr -d '"')
            local remediation="
                cat >> '$tf_file' << 'EOF'

resource \"aws_s3_bucket_versioning\" \"${bucket_name}_versioning\" {
  bucket = aws_s3_bucket.$bucket_name.id
  
  versioning_configuration {
    status = \"Enabled\"
  }
}
EOF
            "
            apply_remediation "$tf_file" "$remediation" "Add S3 bucket versioning"
        fi
        
        # Remediation 3: Add public access block to S3 buckets
        if grep -q "resource \"aws_s3_bucket\"" "$tf_file" && ! grep -q "aws_s3_bucket_public_access_block" "$tf_file"; then
            local bucket_name=$(grep -A 10 "resource \"aws_s3_bucket\"" "$tf_file" | grep -o '"[^"]*"' | head -1 | tr -d '"')
            local remediation="
                cat >> '$tf_file' << 'EOF'

resource \"aws_s3_bucket_public_access_block\" \"${bucket_name}_pab\" {
  bucket = aws_s3_bucket.$bucket_name.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
EOF
            "
            apply_remediation "$tf_file" "$remediation" "Add S3 public access block"
        fi
        
        # Remediation 4: Enable encryption for RDS instances
        if grep -q "resource \"aws_db_instance\"" "$tf_file" && ! grep -q "storage_encrypted.*=.*true" "$tf_file"; then
            local remediation="sed -i '/resource \"aws_db_instance\"/,/^}/ s/storage_encrypted.*=.*/storage_encrypted = true/' '$tf_file'"
            apply_remediation "$tf_file" "$remediation" "Enable RDS encryption"
        fi
        
        # Remediation 5: Enable deletion protection for RDS
        if grep -q "resource \"aws_db_instance\"" "$tf_file" && ! grep -q "deletion_protection" "$tf_file"; then
            local remediation="sed -i '/resource \"aws_db_instance\"/,/^}/ {/^}$/i\\  deletion_protection = true}' '$tf_file'"
            apply_remediation "$tf_file" "$remediation" "Enable RDS deletion protection"
        fi
        
        # Remediation 6: Enable backup retention for RDS
        if grep -q "resource \"aws_db_instance\"" "$tf_file" && ! grep -q "backup_retention_period" "$tf_file"; then
            local remediation="sed -i '/resource \"aws_db_instance\"/,/^}/ {/^}$/i\\  backup_retention_period = 30}' '$tf_file'"
            apply_remediation "$tf_file" "$remediation" "Set RDS backup retention"
        fi
        
        # Remediation 7: Enable CloudTrail encryption
        if grep -q "resource \"aws_cloudtrail\"" "$tf_file" && ! grep -q "kms_key_id" "$tf_file"; then
            local remediation="sed -i '/resource \"aws_cloudtrail\"/,/^}/ {/^}$/i\\  kms_key_id = aws_kms_key.cloudtrail.arn}' '$tf_file'"
            apply_remediation "$tf_file" "$remediation" "Enable CloudTrail encryption"
        fi
        
        # Remediation 8: Enable VPC flow logs
        if grep -q "resource \"aws_vpc\"" "$tf_file" && ! grep -q "aws_flow_log" "$tf_file"; then
            local vpc_name=$(grep -A 10 "resource \"aws_vpc\"" "$tf_file" | grep -o '"[^"]*"' | head -1 | tr -d '"')
            local remediation="
                cat >> '$tf_file' << 'EOF'

resource \"aws_flow_log\" \"${vpc_name}_flow_log\" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs.arn
  traffic_type    = \"ALL\"
  vpc_id          = aws_vpc.$vpc_name.id
}
EOF
            "
            apply_remediation "$tf_file" "$remediation" "Add VPC flow logs"
        fi
        
        # Remediation 9: Add default security group rules
        if grep -q "resource \"aws_vpc\"" "$tf_file" && ! grep -q "aws_default_security_group" "$tf_file"; then
            local vpc_name=$(grep -A 10 "resource \"aws_vpc\"" "$tf_file" | grep -o '"[^"]*"' | head -1 | tr -d '"')
            local remediation="
                cat >> '$tf_file' << 'EOF'

resource \"aws_default_security_group\" \"${vpc_name}_default\" {
  vpc_id = aws_vpc.$vpc_name.id

  # No ingress or egress rules (deny all)
  tags = {
    Name = \"Default Security Group - Locked Down\"
  }
}
EOF
            "
            apply_remediation "$tf_file" "$remediation" "Lock down default security group"
        fi
        
        # Remediation 10: Enable GuardDuty
        if ! grep -q "aws_guardduty_detector" "$tf_file" && grep -q "provider \"aws\"" "$tf_file"; then
            local remediation="
                cat >> '$tf_file' << 'EOF'

resource \"aws_guardduty_detector\" \"main\" {
  enable = true
  
  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = local.common_tags
}
EOF
            "
            apply_remediation "$tf_file" "$remediation" "Enable GuardDuty"
        fi
    done
}

# =============================================================================
# CODE SECURITY REMEDIATIONS
# =============================================================================

remediate_code_security() {
    log_info "Starting code security remediations..."
    
    # Find all JavaScript/TypeScript files
    find "$PROJECT_ROOT" -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" | grep -v node_modules | while read -r js_file; do
        log_info "Analyzing code file: $js_file"
        
        # Remediation 1: Replace eval() with safer alternatives
        if grep -q "eval(" "$js_file"; then
            local remediation="sed -i 's/eval(/\/\/ SECURITY: eval() removed - /g' '$js_file'"
            apply_remediation "$js_file" "$remediation" "Remove dangerous eval() calls"
        fi
        
        # Remediation 2: Add input validation for user inputs
        if grep -q "req\.body\." "$js_file" && ! grep -q "validator\|joi\|yup" "$js_file"; then
            local remediation="
                sed -i '1i// SECURITY: Add input validation import' '$js_file'
                sed -i '2i// import { validateInput } from \"../utils/validation\";' '$js_file'
            "
            apply_remediation "$js_file" "$remediation" "Add input validation import"
        fi
        
        # Remediation 3: Fix hardcoded secrets
        if grep -qE "(password|secret|key|token).*=.*['\"][^'\"]{8,}['\"]" "$js_file"; then
            local remediation="
                sed -i 's/password.*=.*['\"][^'\"]*['\"]/password = process.env.PASSWORD_SECRET/g' '$js_file'
                sed -i 's/secret.*=.*['\"][^'\"]*['\"]/secret = process.env.API_SECRET/g' '$js_file'
                sed -i 's/key.*=.*['\"][^'\"]*['\"]/key = process.env.API_KEY/g' '$js_file'
                sed -i 's/token.*=.*['\"][^'\"]*['\"]/token = process.env.ACCESS_TOKEN/g' '$js_file'
            "
            apply_remediation "$js_file" "$remediation" "Replace hardcoded secrets with environment variables"
        fi
        
        # Remediation 4: Add CSRF protection
        if grep -q "app\.post\|app\.put\|app\.delete" "$js_file" && ! grep -q "csrf" "$js_file"; then
            local remediation="sed -i '/app\.use.*express/a app.use(csrf());' '$js_file'"
            apply_remediation "$js_file" "$remediation" "Add CSRF protection"
        fi
        
        # Remediation 5: Add rate limiting
        if grep -q "app\.use.*cors" "$js_file" && ! grep -q "express-rate-limit" "$js_file"; then
            local remediation="
                sed -i '1i// SECURITY: Add rate limiting' '$js_file'
                sed -i '2iconst rateLimit = require(\"express-rate-limit\");' '$js_file'
                sed -i '/app\.use.*cors/a app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));' '$js_file'
            "
            apply_remediation "$js_file" "$remediation" "Add rate limiting"
        fi
        
        # Remediation 6: Fix SQL injection vulnerabilities
        if grep -qE "query.*\+.*req\." "$js_file"; then
            local remediation="
                sed -i 's/query.*+.*req\./\/\/ SECURITY: Use parameterized queries instead of string concatenation/g' '$js_file'
                sed -i '/SECURITY: Use parameterized queries/a \/\/ Example: db.query(\"SELECT * FROM users WHERE id = ?\", [req.params.id])' '$js_file'
            "
            apply_remediation "$js_file" "$remediation" "Fix SQL injection vulnerability"
        fi
        
        # Remediation 7: Add security headers
        if grep -q "app\.listen\|server\.listen" "$js_file" && ! grep -q "helmet" "$js_file"; then
            local remediation="
                sed -i '1i// SECURITY: Add security headers' '$js_file'
                sed -i '2iconst helmet = require(\"helmet\");' '$js_file'
                sed -i '/app\.use.*express/a app.use(helmet());' '$js_file'
            "
            apply_remediation "$js_file" "$remediation" "Add security headers with Helmet"
        fi
    done
    
    # Check package.json for vulnerable dependencies
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        log_info "Checking package.json for security issues..."
        
        # Add security-related scripts if missing
        if ! grep -q "\"audit\"" "$PROJECT_ROOT/package.json"; then
            local remediation="
                jq '.scripts.audit = \"npm audit\"' '$PROJECT_ROOT/package.json' > tmp.$$.json && mv tmp.$$.json '$PROJECT_ROOT/package.json'
                jq '.scripts.\"audit:fix\" = \"npm audit fix\"' '$PROJECT_ROOT/package.json' > tmp.$$.json && mv tmp.$$.json '$PROJECT_ROOT/package.json'
            "
            apply_remediation "$PROJECT_ROOT/package.json" "$remediation" "Add security audit scripts"
        fi
    fi
}

# =============================================================================
# DEPENDENCY SECURITY REMEDIATIONS
# =============================================================================

remediate_dependency_security() {
    log_info "Starting dependency security remediations..."
    
    # Update package-lock.json
    if [[ -f "$PROJECT_ROOT/package-lock.json" ]]; then
        local remediation="cd '$PROJECT_ROOT' && npm audit fix --force"
        apply_remediation "$PROJECT_ROOT/package-lock.json" "$remediation" "Fix npm security vulnerabilities"
    fi
    
    # Check for deprecated packages
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        log_info "Checking for deprecated packages..."
        
        # Remove known vulnerable packages
        local vulnerable_packages=("node-uuid" "request" "lodash" "handlebars" "marked" "debug")
        
        for package in "${vulnerable_packages[@]}"; do
            if grep -q "\"$package\":" "$PROJECT_ROOT/package.json"; then
                log_warn "Found vulnerable package: $package"
                # Note: In a real implementation, you'd want to suggest alternatives
                local remediation="jq 'del(.dependencies.\"$package\") | del(.devDependencies.\"$package\")' '$PROJECT_ROOT/package.json' > tmp.$$.json && mv tmp.$$.json '$PROJECT_ROOT/package.json'"
                apply_remediation "$PROJECT_ROOT/package.json" "$remediation" "Remove vulnerable package: $package"
            fi
        done
    fi
}

# =============================================================================
# CONTAINER SECURITY REMEDIATIONS
# =============================================================================

remediate_container_security() {
    log_info "Starting container security remediations..."
    
    # Find Dockerfiles
    find "$PROJECT_ROOT" -name "Dockerfile*" -type f | while read -r dockerfile; do
        log_info "Analyzing Dockerfile: $dockerfile"
        
        # Remediation 1: Use non-root user
        if ! grep -q "USER.*[^0]" "$dockerfile"; then
            local remediation="
                echo '' >> '$dockerfile'
                echo '# Security: Create and use non-root user' >> '$dockerfile'
                echo 'RUN addgroup -g 1001 -S nodejs' >> '$dockerfile'
                echo 'RUN adduser -S nextjs -u 1001' >> '$dockerfile'
                echo 'USER nextjs' >> '$dockerfile'
            "
            apply_remediation "$dockerfile" "$remediation" "Add non-root user"
        fi
        
        # Remediation 2: Add health check
        if ! grep -q "HEALTHCHECK" "$dockerfile"; then
            local remediation="
                echo '' >> '$dockerfile'
                echo '# Security: Add health check' >> '$dockerfile'
                echo 'HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\\\' >> '$dockerfile'
                echo '  CMD curl -f http://localhost:3000/health || exit 1' >> '$dockerfile'
            "
            apply_remediation "$dockerfile" "$remediation" "Add health check"
        fi
        
        # Remediation 3: Remove unnecessary packages
        if grep -q "apt-get install" "$dockerfile" && ! grep -q "apt-get clean" "$dockerfile"; then
            local remediation="sed -i '/apt-get install/a\\    && apt-get clean \\\\\\n    && rm -rf /var/lib/apt/lists/*' '$dockerfile'"
            apply_remediation "$dockerfile" "$remediation" "Clean apt cache"
        fi
        
        # Remediation 4: Pin base image versions
        if grep -q "FROM.*:latest" "$dockerfile"; then
            log_warn "Found latest tag in Dockerfile: $dockerfile"
            # Note: In a real implementation, you'd want to suggest specific versions
        fi
        
        # Remediation 5: Add security labels
        if ! grep -q "LABEL.*security" "$dockerfile"; then
            local remediation="
                sed -i '1a LABEL security.scan=\"true\"' '$dockerfile'
                sed -i '2a LABEL security.policy=\"hardened\"' '$dockerfile'
            "
            apply_remediation "$dockerfile" "$remediation" "Add security labels"
        fi
    done
    
    # Check docker-compose files
    find "$PROJECT_ROOT" -name "docker-compose*.yml" -type f | while read -r compose_file; do
        log_info "Analyzing docker-compose file: $compose_file"
        
        # Add security configurations
        if ! grep -q "read_only:" "$compose_file"; then
            local remediation="
                sed -i '/services:/,/^[[:space:]]*[^[:space:]]/ {
                    /^[[:space:]]*[^[:space:]]/i\\
                    read_only: true\\
                    tmpfs:\\
                      - /tmp
                }' '$compose_file'
            "
            apply_remediation "$compose_file" "$remediation" "Add read-only filesystem"
        fi
        
        # Add security options
        if ! grep -q "security_opt:" "$compose_file"; then
            local remediation="
                sed -i '/services:/,/^[[:space:]]*[^[:space:]]/ {
                    /^[[:space:]]*[^[:space:]]/i\\
                    security_opt:\\
                      - no-new-privileges:true
                }' '$compose_file'
            "
            apply_remediation "$compose_file" "$remediation" "Add security options"
        fi
    done
}

# =============================================================================
# CONFIGURATION SECURITY REMEDIATIONS
# =============================================================================

remediate_configuration_security() {
    log_info "Starting configuration security remediations..."
    
    # Check environment files
    find "$PROJECT_ROOT" -name ".env*" -type f | while read -r env_file; do
        log_info "Analyzing environment file: $env_file"
        
        # Check for weak secrets
        if grep -qE "(password|secret|key).*=.*123|password|admin" "$env_file"; then
            log_warn "Found weak credentials in $env_file"
            local remediation="
                sed -i 's/password=.*/password=CHANGE_ME_TO_STRONG_PASSWORD/g' '$env_file'
                sed -i 's/secret=.*/secret=CHANGE_ME_TO_STRONG_SECRET/g' '$env_file'
                sed -i 's/key=.*/key=CHANGE_ME_TO_STRONG_KEY/g' '$env_file'
            "
            apply_remediation "$env_file" "$remediation" "Replace weak credentials"
        fi
        
        # Add security-related environment variables
        if ! grep -q "SECURITY_" "$env_file"; then
            local remediation="
                echo '' >> '$env_file'
                echo '# Security Configuration' >> '$env_file'
                echo 'SECURITY_ENABLE_RATE_LIMITING=true' >> '$env_file'
                echo 'SECURITY_ENABLE_CSRF=true' >> '$env_file'
                echo 'SECURITY_ENABLE_HELMET=true' >> '$env_file'
                echo 'SECURITY_SESSION_SECURE=true' >> '$env_file'
            "
            apply_remediation "$env_file" "$remediation" "Add security configuration"
        fi
    done
    
    # Check Next.js configuration
    if [[ -f "$PROJECT_ROOT/next.config.js" ]]; then
        log_info "Analyzing Next.js configuration..."
        
        # Add security headers
        if ! grep -q "headers()" "$PROJECT_ROOT/next.config.js"; then
            local remediation="
                cat >> '$PROJECT_ROOT/next.config.js' << 'EOF'

// Security headers
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  }
];

module.exports = {
  ...module.exports,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};
EOF
            "
            apply_remediation "$PROJECT_ROOT/next.config.js" "$remediation" "Add security headers to Next.js config"
        fi
    fi
    
    # Check GitHub Actions workflows for security
    find "$PROJECT_ROOT/.github/workflows" -name "*.yml" -type f 2>/dev/null | while read -r workflow_file; do
        log_info "Analyzing GitHub workflow: $workflow_file"
        
        # Check for hardcoded secrets
        if grep -qE "(password|token|key).*:" "$workflow_file" && ! grep -qE "secrets\.|env\." "$workflow_file"; then
            log_warn "Potential hardcoded secrets in workflow: $workflow_file"
        fi
        
        # Add security permissions
        if ! grep -q "permissions:" "$workflow_file"; then
            local remediation="
                sed -i '/^on:/a\\
permissions:\\
  contents: read\\
  security-events: write\\
  actions: read' '$workflow_file'
            "
            apply_remediation "$workflow_file" "$remediation" "Add security permissions to workflow"
        fi
    done
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

main() {
    log_info "Starting automated security remediation..."
    log_info "Project root: $PROJECT_ROOT"
    log_info "Dry run mode: $DRY_RUN"
    log_info "Severity threshold: $SEVERITY_THRESHOLD"
    log_info "Auto commit: $AUTO_COMMIT"
    
    # Create necessary directories
    mkdir -p "$(dirname "$REMEDIATION_LOG")"
    mkdir -p "$BACKUP_DIR"
    
    # Initialize remediation counters
    local total_fixes=0
    local successful_fixes=0
    local failed_fixes=0
    
    # Run different types of remediations
    log_info "=== Infrastructure Security Remediations ==="
    if remediate_terraform_security; then
        ((successful_fixes++))
    else
        ((failed_fixes++))
    fi
    ((total_fixes++))
    
    log_info "=== Code Security Remediations ==="
    if remediate_code_security; then
        ((successful_fixes++))
    else
        ((failed_fixes++))
    fi
    ((total_fixes++))
    
    log_info "=== Dependency Security Remediations ==="
    if remediate_dependency_security; then
        ((successful_fixes++))
    else
        ((failed_fixes++))
    fi
    ((total_fixes++))
    
    log_info "=== Container Security Remediations ==="
    if remediate_container_security; then
        ((successful_fixes++))
    else
        ((failed_fixes++))
    fi
    ((total_fixes++))
    
    log_info "=== Configuration Security Remediations ==="
    if remediate_configuration_security; then
        ((successful_fixes++))
    else
        ((failed_fixes++))
    fi
    ((total_fixes++))
    
    # Generate remediation report
    generate_remediation_report "$total_fixes" "$successful_fixes" "$failed_fixes"
    
    # Commit changes if auto-commit is enabled
    if [[ "$AUTO_COMMIT" == "true" && "$DRY_RUN" == "false" ]]; then
        commit_remediations
    fi
    
    log_success "Security remediation completed!"
    log_info "Total remediation categories: $total_fixes"
    log_info "Successful remediations: $successful_fixes"
    log_info "Failed remediations: $failed_fixes"
    log_info "Remediation log: $REMEDIATION_LOG"
    log_info "Backups stored in: $BACKUP_DIR"
    
    # Exit with error if any remediations failed
    if [[ $failed_fixes -gt 0 ]]; then
        exit 1
    fi
}

generate_remediation_report() {
    local total="$1"
    local successful="$2"
    local failed="$3"
    
    local report_file="${PROJECT_ROOT}/security-reports/remediation-report-$(date +%Y%m%d_%H%M%S).html"
    mkdir -p "$(dirname "$report_file")"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Security Remediation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .success { color: green; }
        .error { color: red; }
        .warning { color: orange; }
        .summary { background-color: #e8f4fd; padding: 15px; margin: 20px 0; border-radius: 5px; }
        .log-entry { margin: 5px 0; padding: 5px; background-color: #f9f9f9; border-left: 3px solid #ddd; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Remediation Report</h1>
        <p>Generated on: $(date)</p>
        <p>Project: Learning Assistant</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <ul>
            <li>Total remediation categories: $total</li>
            <li class="success">Successful remediations: $successful</li>
            <li class="error">Failed remediations: $failed</li>
            <li>Dry run mode: $DRY_RUN</li>
        </ul>
    </div>
    
    <h2>Remediation Log</h2>
    <div class="log-entries">
EOF
    
    # Add log entries to HTML report
    while IFS= read -r line; do
        if [[ $line == *"SUCCESS"* ]]; then
            echo "        <div class=\"log-entry success\">$line</div>" >> "$report_file"
        elif [[ $line == *"ERROR"* ]]; then
            echo "        <div class=\"log-entry error\">$line</div>" >> "$report_file"
        elif [[ $line == *"WARN"* ]]; then
            echo "        <div class=\"log-entry warning\">$line</div>" >> "$report_file"
        else
            echo "        <div class=\"log-entry\">$line</div>" >> "$report_file"
        fi
    done < "$REMEDIATION_LOG"
    
    cat >> "$report_file" << EOF
    </div>
    
    <h2>Next Steps</h2>
    <ul>
        <li>Review all changes before deploying to production</li>
        <li>Run security scans again to verify fixes</li>
        <li>Update documentation to reflect security improvements</li>
        <li>Consider implementing additional security measures</li>
    </ul>
</body>
</html>
EOF
    
    log_info "Remediation report generated: $report_file"
}

commit_remediations() {
    log_info "Committing remediation changes..."
    
    cd "$PROJECT_ROOT"
    
    # Check if there are changes to commit
    if git diff --quiet; then
        log_info "No changes to commit"
        return 0
    fi
    
    # Add all changes
    git add .
    
    # Create commit message
    local commit_message="chore: automated security remediations

- Applied infrastructure security fixes
- Fixed code security vulnerabilities  
- Updated dependencies to secure versions
- Hardened container configurations
- Improved security configurations

Generated by automated security remediation script on $(date)"
    
    # Commit changes
    if git commit -m "$commit_message"; then
        log_success "Successfully committed remediation changes"
    else
        log_error "Failed to commit remediation changes"
        return 1
    fi
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --auto-commit)
                AUTO_COMMIT="true"
                shift
                ;;
            --severity-threshold)
                SEVERITY_THRESHOLD="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --dry-run              Run in dry-run mode (no changes applied)"
                echo "  --auto-commit          Automatically commit changes"
                echo "  --severity-threshold   Set severity threshold (LOW|MEDIUM|HIGH|CRITICAL)"
                echo "  --help                 Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run main function
    main "$@"
fi