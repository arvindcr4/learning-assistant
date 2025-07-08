#!/bin/bash

# ==============================================================================
# COMPREHENSIVE SECURITY AUDIT SCRIPT
# Advanced security scanning, vulnerability assessment, and compliance validation
# ==============================================================================

set -euo pipefail

# Global Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECURITY_DIR="$PROJECT_ROOT/security-reports"
DATE=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$SECURITY_DIR/security_audit_$DATE.json"

# Ensure security reports directory exists
mkdir -p "$SECURITY_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message"
}

info() { log "INFO" "$@"; }
warn() { log "WARN" "$@"; }
error() { log "ERROR" "$@"; }
success() { log "SUCCESS" "$@"; }

# Pretty print functions
print_header() {
    echo -e "${BLUE}=================================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================================================${NC}"
}

print_step() {
    echo -e "${CYAN}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_critical() {
    echo -e "${RED}🚨 CRITICAL: $1${NC}"
}

# Initialize security report
init_security_report() {
    cat > "$REPORT_FILE" <<EOF
{
  "audit": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "1.0.0",
    "project": "learning-assistant",
    "environment": "${ENVIRONMENT:-unknown}"
  },
  "summary": {
    "total_checks": 0,
    "passed": 0,
    "failed": 0,
    "warnings": 0,
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0
  },
  "categories": {}
}
EOF
}

# Update security report
update_report() {
    local category="$1"
    local check_name="$2"
    local status="$3"
    local severity="${4:-medium}"
    local details="$5"
    
    # Create category if it doesn't exist
    if ! jq -e ".categories.\"$category\"" "$REPORT_FILE" > /dev/null; then
        jq ".categories.\"$category\" = {\"checks\": []}" "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    fi
    
    # Add check result
    local check_result=$(cat <<EOF
{
  "name": "$check_name",
  "status": "$status",
  "severity": "$severity",
  "details": "$details",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)
    
    jq ".categories.\"$category\".checks += [$check_result]" "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    
    # Update summary counters
    jq ".summary.total_checks += 1" "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    jq ".summary.\"$status\" += 1" "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    
    if [[ "$status" == "failed" ]]; then
        jq ".summary.\"$severity\" += 1" "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    fi
}

# Dependency vulnerability scanning
scan_dependencies() {
    print_step "Scanning dependencies for vulnerabilities..."
    
    cd "$PROJECT_ROOT"
    
    # NPM Audit
    local npm_audit_output
    if npm_audit_output=$(npm audit --json 2>/dev/null); then
        local vulnerabilities=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.total // 0')
        local critical=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.critical // 0')
        local high=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.high // 0')
        local moderate=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.moderate // 0')
        local low=$(echo "$npm_audit_output" | jq '.metadata.vulnerabilities.low // 0')
        
        if [[ "$vulnerabilities" -gt 0 ]]; then
            if [[ "$critical" -gt 0 ]]; then
                update_report "dependencies" "npm_audit" "failed" "critical" "Found $critical critical, $high high, $moderate moderate, $low low vulnerabilities"
                print_critical "Found $critical critical vulnerabilities in dependencies"
            elif [[ "$high" -gt 0 ]]; then
                update_report "dependencies" "npm_audit" "failed" "high" "Found $high high, $moderate moderate, $low low vulnerabilities"
                print_error "Found $high high-severity vulnerabilities in dependencies"
            else
                update_report "dependencies" "npm_audit" "failed" "medium" "Found $moderate moderate, $low low vulnerabilities"
                print_warning "Found $moderate moderate and $low low-severity vulnerabilities"
            fi
        else
            update_report "dependencies" "npm_audit" "passed" "low" "No vulnerabilities found"
            print_success "No dependency vulnerabilities found"
        fi
        
        # Save detailed report
        echo "$npm_audit_output" > "$SECURITY_DIR/npm_audit_$DATE.json"
    else
        update_report "dependencies" "npm_audit" "failed" "medium" "NPM audit failed to run"
        print_error "NPM audit failed to run"
    fi
    
    # Snyk scanning (if available)
    if command -v snyk &> /dev/null; then
        print_step "Running Snyk vulnerability scan..."
        
        if snyk auth "$SNYK_TOKEN" &> /dev/null 2>&1 && snyk test --json > "$SECURITY_DIR/snyk_report_$DATE.json" 2>/dev/null; then
            local snyk_vulnerabilities=$(jq '.vulnerabilities | length' "$SECURITY_DIR/snyk_report_$DATE.json" 2>/dev/null || echo "0")
            
            if [[ "$snyk_vulnerabilities" -gt 0 ]]; then
                update_report "dependencies" "snyk_scan" "failed" "high" "Found $snyk_vulnerabilities vulnerabilities"
                print_error "Snyk found $snyk_vulnerabilities vulnerabilities"
            else
                update_report "dependencies" "snyk_scan" "passed" "low" "No vulnerabilities found"
                print_success "Snyk scan passed"
            fi
        else
            update_report "dependencies" "snyk_scan" "failed" "low" "Snyk scan failed or token not configured"
            print_warning "Snyk scan failed (token may not be configured)"
        fi
    fi
}

# Container security scanning
scan_containers() {
    print_step "Scanning container images for vulnerabilities..."
    
    local dockerfile_path="$PROJECT_ROOT/Dockerfile"
    
    if [[ ! -f "$dockerfile_path" ]]; then
        update_report "containers" "dockerfile_exists" "failed" "medium" "Dockerfile not found"
        print_error "Dockerfile not found"
        return 1
    fi
    
    # Dockerfile security best practices check
    local dockerfile_issues=0
    
    # Check for non-root user
    if ! grep -q "USER" "$dockerfile_path"; then
        update_report "containers" "dockerfile_nonroot_user" "failed" "high" "Dockerfile does not specify non-root user"
        print_error "Dockerfile does not specify non-root user"
        ((dockerfile_issues++))\n    else\n        update_report "containers" "dockerfile_nonroot_user" "passed" "low" "Non-root user specified"\n        print_success "Non-root user specified in Dockerfile"\n    fi\n    \n    # Check for COPY instead of ADD\n    if grep -q "^ADD" "$dockerfile_path"; then\n        update_report "containers" "dockerfile_copy_vs_add" "failed" "medium" "Dockerfile uses ADD instead of COPY"\n        print_warning "Dockerfile uses ADD instead of COPY (security risk)"\n        ((dockerfile_issues++))\n    else\n        update_report "containers" "dockerfile_copy_vs_add" "passed" "low" "Uses COPY instead of ADD"\n        print_success "Dockerfile uses COPY instead of ADD"\n    fi\n    \n    # Check for specific package versions\n    if grep -q "apt-get install.*[^=]$" "$dockerfile_path"; then\n        update_report "containers" "dockerfile_package_versions" "failed" "medium" "Dockerfile installs packages without specific versions"\n        print_warning "Dockerfile installs packages without specific versions"\n        ((dockerfile_issues++))\n    else\n        update_report "containers" "dockerfile_package_versions" "passed" "low" "Package versions are pinned"\n        print_success "Package versions are appropriately pinned"\n    fi\n    \n    # Trivy scanning (if available)\n    if command -v trivy &> /dev/null; then\n        print_step "Running Trivy container scan..."\n        \n        if trivy image --format json --output "$SECURITY_DIR/trivy_report_$DATE.json" "$IMAGE_NAME:${IMAGE_TAG:-latest}" &> /dev/null; then\n            local trivy_critical=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length' "$SECURITY_DIR/trivy_report_$DATE.json" 2>/dev/null || echo "0")\n            local trivy_high=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length' "$SECURITY_DIR/trivy_report_$DATE.json" 2>/dev/null || echo "0")\n            local trivy_medium=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity == "MEDIUM")] | length' "$SECURITY_DIR/trivy_report_$DATE.json" 2>/dev/null || echo "0")\n            \n            if [[ "$trivy_critical" -gt 0 ]]; then\n                update_report "containers" "trivy_scan" "failed" "critical" "Found $trivy_critical critical, $trivy_high high, $trivy_medium medium vulnerabilities"\n                print_critical "Trivy found $trivy_critical critical vulnerabilities in container image"\n            elif [[ "$trivy_high" -gt 0 ]]; then\n                update_report "containers" "trivy_scan" "failed" "high" "Found $trivy_high high, $trivy_medium medium vulnerabilities"\n                print_error "Trivy found $trivy_high high-severity vulnerabilities"\n            elif [[ "$trivy_medium" -gt 0 ]]; then\n                update_report "containers" "trivy_scan" "failed" "medium" "Found $trivy_medium medium vulnerabilities"\n                print_warning "Trivy found $trivy_medium medium-severity vulnerabilities"\n            else\n                update_report "containers" "trivy_scan" "passed" "low" "No significant vulnerabilities found"\n                print_success "Trivy container scan passed"\n            fi\n        else\n            update_report "containers" "trivy_scan" "failed" "low" "Trivy scan failed to run"\n            print_warning "Trivy scan failed to run"\n        fi\n    fi\n}\n\n# Infrastructure security scanning\nscan_infrastructure() {\n    print_step "Scanning infrastructure configuration..."\n    \n    # Terraform security scanning\n    if [[ -d "$PROJECT_ROOT/terraform" ]]; then\n        cd "$PROJECT_ROOT/terraform"\n        \n        # Checkov scanning\n        if command -v checkov &> /dev/null; then\n            print_step "Running Checkov infrastructure scan..."\n            \n            if checkov -d . --framework terraform --output json --output-file-path "$SECURITY_DIR/checkov_terraform_$DATE.json" &> /dev/null; then\n                local checkov_failed=$(jq '.results.failed_checks | length' "$SECURITY_DIR/checkov_terraform_$DATE.json" 2>/dev/null || echo "0")\n                local checkov_passed=$(jq '.results.passed_checks | length' "$SECURITY_DIR/checkov_terraform_$DATE.json" 2>/dev/null || echo "0")\n                \n                if [[ "$checkov_failed" -gt 0 ]]; then\n                    update_report "infrastructure" "checkov_terraform" "failed" "high" "Found $checkov_failed failed security checks"\n                    print_error "Checkov found $checkov_failed failed security checks in Terraform"\n                else\n                    update_report "infrastructure" "checkov_terraform" "passed" "low" "All $checkov_passed security checks passed"\n                    print_success "All Checkov Terraform security checks passed"\n                fi\n            else\n                update_report "infrastructure" "checkov_terraform" "failed" "low" "Checkov scan failed to run"\n                print_warning "Checkov Terraform scan failed to run"\n            fi\n        fi\n        \n        # TFSec scanning\n        if command -v tfsec &> /dev/null; then\n            print_step "Running TFSec security scan..."\n            \n            if tfsec . --format json --out "$SECURITY_DIR/tfsec_report_$DATE.json" &> /dev/null; then\n                local tfsec_critical=$(jq '[.results[] | select(.severity == "CRITICAL")] | length' "$SECURITY_DIR/tfsec_report_$DATE.json" 2>/dev/null || echo "0")\n                local tfsec_high=$(jq '[.results[] | select(.severity == "HIGH")] | length' "$SECURITY_DIR/tfsec_report_$DATE.json" 2>/dev/null || echo "0")\n                local tfsec_medium=$(jq '[.results[] | select(.severity == "MEDIUM")] | length' "$SECURITY_DIR/tfsec_report_$DATE.json" 2>/dev/null || echo "0")\n                \n                if [[ "$tfsec_critical" -gt 0 ]]; then\n                    update_report "infrastructure" "tfsec_scan" "failed" "critical" "Found $tfsec_critical critical, $tfsec_high high, $tfsec_medium medium issues"\n                    print_critical "TFSec found $tfsec_critical critical security issues"\n                elif [[ "$tfsec_high" -gt 0 ]]; then\n                    update_report "infrastructure" "tfsec_scan" "failed" "high" "Found $tfsec_high high, $tfsec_medium medium issues"\n                    print_error "TFSec found $tfsec_high high-severity issues"\n                elif [[ "$tfsec_medium" -gt 0 ]]; then\n                    update_report "infrastructure" "tfsec_scan" "failed" "medium" "Found $tfsec_medium medium issues"\n                    print_warning "TFSec found $tfsec_medium medium-severity issues"\n                else\n                    update_report "infrastructure" "tfsec_scan" "passed" "low" "No security issues found"\n                    print_success "TFSec infrastructure scan passed"\n                fi\n            else\n                update_report "infrastructure" "tfsec_scan" "failed" "low" "TFSec scan failed to run"\n                print_warning "TFSec scan failed to run"\n            fi\n        fi\n        \n        cd "$PROJECT_ROOT"\n    fi\n    \n    # Kubernetes security scanning\n    if [[ -d "$PROJECT_ROOT/k8s" ]]; then\n        print_step "Scanning Kubernetes manifests..."\n        \n        # Checkov Kubernetes scanning\n        if command -v checkov &> /dev/null; then\n            if checkov -d "$PROJECT_ROOT/k8s" --framework kubernetes --output json --output-file-path "$SECURITY_DIR/checkov_k8s_$DATE.json" &> /dev/null; then\n                local k8s_failed=$(jq '.results.failed_checks | length' "$SECURITY_DIR/checkov_k8s_$DATE.json" 2>/dev/null || echo "0")\n                local k8s_passed=$(jq '.results.passed_checks | length' "$SECURITY_DIR/checkov_k8s_$DATE.json" 2>/dev/null || echo "0")\n                \n                if [[ "$k8s_failed" -gt 0 ]]; then\n                    update_report "infrastructure" "checkov_kubernetes" "failed" "high" "Found $k8s_failed failed Kubernetes security checks"\n                    print_error "Checkov found $k8s_failed failed Kubernetes security checks"\n                else\n                    update_report "infrastructure" "checkov_kubernetes" "passed" "low" "All $k8s_passed Kubernetes security checks passed"\n                    print_success "All Checkov Kubernetes security checks passed"\n                fi\n            fi\n        fi\n        \n        # Polaris security scanning\n        if command -v polaris &> /dev/null; then\n            print_step "Running Polaris security scan..."\n            \n            if polaris audit --audit-path "$PROJECT_ROOT/k8s" --format json --output-file "$SECURITY_DIR/polaris_report_$DATE.json" &> /dev/null; then\n                local polaris_errors=$(jq '.ClusterReport.Results[] | select(.Kind == "error") | length' "$SECURITY_DIR/polaris_report_$DATE.json" 2>/dev/null || echo "0")\n                local polaris_warnings=$(jq '.ClusterReport.Results[] | select(.Kind == "warning") | length' "$SECURITY_DIR/polaris_report_$DATE.json" 2>/dev/null || echo "0")\n                \n                if [[ "$polaris_errors" -gt 0 ]]; then\n                    update_report "infrastructure" "polaris_scan" "failed" "high" "Found $polaris_errors errors, $polaris_warnings warnings"\n                    print_error "Polaris found $polaris_errors security errors"\n                elif [[ "$polaris_warnings" -gt 0 ]]; then\n                    update_report "infrastructure" "polaris_scan" "failed" "medium" "Found $polaris_warnings warnings"\n                    print_warning "Polaris found $polaris_warnings security warnings"\n                else\n                    update_report "infrastructure" "polaris_scan" "passed" "low" "No security issues found"\n                    print_success "Polaris security scan passed"\n                fi\n            else\n                update_report "infrastructure" "polaris_scan" "failed" "low" "Polaris scan failed to run"\n                print_warning "Polaris scan failed to run"\n            fi\n        fi\n    fi\n}\n\n# Secret scanning\nscan_secrets() {\n    print_step "Scanning for exposed secrets..."\n    \n    cd "$PROJECT_ROOT"\n    \n    # GitLeaks scanning\n    if command -v gitleaks &> /dev/null; then\n        print_step "Running GitLeaks secret scan..."\n        \n        if gitleaks detect --source . --report-format json --report-path "$SECURITY_DIR/gitleaks_report_$DATE.json" &> /dev/null; then\n            local secrets_found=$(jq '. | length' "$SECURITY_DIR/gitleaks_report_$DATE.json" 2>/dev/null || echo "0")\n            \n            if [[ "$secrets_found" -gt 0 ]]; then\n                update_report "secrets" "gitleaks_scan" "failed" "critical" "Found $secrets_found potential secrets"\n                print_critical "GitLeaks found $secrets_found potential secrets"\n            else\n                update_report "secrets" "gitleaks_scan" "passed" "low" "No secrets found"\n                print_success "GitLeaks scan passed - no secrets found"\n            fi\n        else\n            # GitLeaks returns exit code 1 when secrets are found, so check the report\n            if [[ -f "$SECURITY_DIR/gitleaks_report_$DATE.json" ]]; then\n                local secrets_found=$(jq '. | length' "$SECURITY_DIR/gitleaks_report_$DATE.json" 2>/dev/null || echo "0")\n                \n                if [[ "$secrets_found" -gt 0 ]]; then\n                    update_report "secrets" "gitleaks_scan" "failed" "critical" "Found $secrets_found potential secrets"\n                    print_critical "GitLeaks found $secrets_found potential secrets"\n                else\n                    update_report "secrets" "gitleaks_scan" "passed" "low" "No secrets found"\n                    print_success "GitLeaks scan passed - no secrets found"\n                fi\n            else\n                update_report "secrets" "gitleaks_scan" "failed" "low" "GitLeaks scan failed to run"\n                print_warning "GitLeaks scan failed to run"\n            fi\n        fi\n    fi\n    \n    # TruffleHog scanning\n    if command -v trufflehog &> /dev/null; then\n        print_step "Running TruffleHog secret scan..."\n        \n        if trufflehog filesystem . --json > "$SECURITY_DIR/trufflehog_report_$DATE.json" 2>/dev/null; then\n            local trufflehog_secrets=$(grep -c "SourceMetadata" "$SECURITY_DIR/trufflehog_report_$DATE.json" 2>/dev/null || echo "0")\n            \n            if [[ "$trufflehog_secrets" -gt 0 ]]; then\n                update_report "secrets" "trufflehog_scan" "failed" "critical" "Found $trufflehog_secrets potential secrets"\n                print_critical "TruffleHog found $trufflehog_secrets potential secrets"\n            else\n                update_report "secrets" "trufflehog_scan" "passed" "low" "No secrets found"\n                print_success "TruffleHog scan passed - no secrets found"\n            fi\n        else\n            update_report "secrets" "trufflehog_scan" "failed" "low" "TruffleHog scan failed to run"\n            print_warning "TruffleHog scan failed to run"\n        fi\n    fi\n    \n    # Manual secret pattern checking\n    print_step "Running manual secret pattern checks..."\n    \n    local secret_patterns=(\n        "password.*=.*['\\\"][^'\\\"]*['\\\"]"\n        "api[_-]?key.*=.*['\\\"][^'\\\"]*['\\\"]"\n        "secret.*=.*['\\\"][^'\\\"]*['\\\"]"\n        "token.*=.*['\\\"][^'\\\"]*['\\\"]"\n        "private[_-]?key.*=.*['\\\"][^'\\\"]*['\\\"]"\n        "aws[_-]?access[_-]?key"\n        "aws[_-]?secret[_-]?key"\n        "-----BEGIN PRIVATE KEY-----"\n        "-----BEGIN RSA PRIVATE KEY-----"\n        "-----BEGIN OPENSSH PRIVATE KEY-----"\n    )\n    \n    local pattern_matches=0\n    for pattern in "${secret_patterns[@]}"; do\n        local matches=$(grep -r -i -E "$pattern" . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=security-reports 2>/dev/null | wc -l || echo "0")\n        if [[ "$matches" -gt 0 ]]; then\n            ((pattern_matches += matches))\n        fi\n    done\n    \n    if [[ "$pattern_matches" -gt 0 ]]; then\n        update_report "secrets" "pattern_matching" "failed" "high" "Found $pattern_matches potential secret patterns"\n        print_error "Found $pattern_matches potential secret patterns in code"\n    else\n        update_report "secrets" "pattern_matching" "passed" "low" "No secret patterns found"\n        print_success "No secret patterns found in code"\n    fi\n}\n\n# Code quality and security analysis\nanalyze_code_security() {\n    print_step "Analyzing code security..."\n    \n    cd "$PROJECT_ROOT"\n    \n    # Semgrep security analysis\n    if command -v semgrep &> /dev/null; then\n        print_step "Running Semgrep security analysis..."\n        \n        if semgrep --config=p/security-audit --config=p/secrets --config=p/nodejs --config=p/typescript --config=p/react --json --output="$SECURITY_DIR/semgrep_report_$DATE.json" . &> /dev/null; then\n            local semgrep_errors=$(jq '[.results[] | select(.extra.severity == "ERROR")] | length' "$SECURITY_DIR/semgrep_report_$DATE.json" 2>/dev/null || echo "0")\n            local semgrep_warnings=$(jq '[.results[] | select(.extra.severity == "WARNING")] | length' "$SECURITY_DIR/semgrep_report_$DATE.json" 2>/dev/null || echo "0")\n            \n            if [[ "$semgrep_errors" -gt 0 ]]; then\n                update_report "code_security" "semgrep_analysis" "failed" "high" "Found $semgrep_errors errors, $semgrep_warnings warnings"\n                print_error "Semgrep found $semgrep_errors security errors"\n            elif [[ "$semgrep_warnings" -gt 0 ]]; then\n                update_report "code_security" "semgrep_analysis" "failed" "medium" "Found $semgrep_warnings warnings"\n                print_warning "Semgrep found $semgrep_warnings security warnings"\n            else\n                update_report "code_security" "semgrep_analysis" "passed" "low" "No security issues found"\n                print_success "Semgrep security analysis passed"\n            fi\n        else\n            update_report "code_security" "semgrep_analysis" "failed" "low" "Semgrep analysis failed to run"\n            print_warning "Semgrep analysis failed to run"\n        fi\n    fi\n    \n    # ESLint security analysis\n    if [[ -f "package.json" ]] && npm list --depth=0 eslint-plugin-security &> /dev/null; then\n        print_step "Running ESLint security analysis..."\n        \n        if npx eslint . --ext .js,.jsx,.ts,.tsx --format json --output-file "$SECURITY_DIR/eslint_security_$DATE.json" &> /dev/null; then\n            local eslint_errors=$(jq '[.[] | .messages[] | select(.severity == 2)] | length' "$SECURITY_DIR/eslint_security_$DATE.json" 2>/dev/null || echo "0")\n            local eslint_warnings=$(jq '[.[] | .messages[] | select(.severity == 1)] | length' "$SECURITY_DIR/eslint_security_$DATE.json" 2>/dev/null || echo "0")\n            \n            if [[ "$eslint_errors" -gt 0 ]]; then\n                update_report "code_security" "eslint_security" "failed" "medium" "Found $eslint_errors errors, $eslint_warnings warnings"\n                print_error "ESLint found $eslint_errors security errors"\n            elif [[ "$eslint_warnings" -gt 0 ]]; then\n                update_report "code_security" "eslint_security" "failed" "low" "Found $eslint_warnings warnings"\n                print_warning "ESLint found $eslint_warnings security warnings"\n            else\n                update_report "code_security" "eslint_security" "passed" "low" "No security issues found"\n                print_success "ESLint security analysis passed"\n            fi\n        else\n            update_report "code_security" "eslint_security" "failed" "low" "ESLint security analysis failed to run"\n            print_warning "ESLint security analysis failed to run"\n        fi\n    fi\n}\n\n# Compliance validation\nvalidate_compliance() {\n    print_step "Validating security compliance..."\n    \n    # GDPR compliance check\n    local gdpr_issues=0\n    \n    # Check for privacy policy\n    if [[ -f "$PROJECT_ROOT/PRIVACY_POLICY.md" ]] || [[ -f "$PROJECT_ROOT/docs/privacy-policy.md" ]]; then\n        update_report "compliance" "gdpr_privacy_policy" "passed" "low" "Privacy policy document found"\n        print_success "Privacy policy document found"\n    else\n        update_report "compliance" "gdpr_privacy_policy" "failed" "medium" "Privacy policy document not found"\n        print_warning "Privacy policy document not found"\n        ((gdpr_issues++))\n    fi\n    \n    # Check for cookie consent implementation\n    if grep -r -i "cookie.*consent" src/ &> /dev/null; then\n        update_report "compliance" "gdpr_cookie_consent" "passed" "low" "Cookie consent implementation found"\n        print_success "Cookie consent implementation found"\n    else\n        update_report "compliance" "gdpr_cookie_consent" "failed" "medium" "Cookie consent implementation not found"\n        print_warning "Cookie consent implementation not found"\n        ((gdpr_issues++))\n    fi\n    \n    # Check for data deletion endpoints\n    if grep -r -i "delete.*user\\|remove.*user\\|purge.*user" src/app/api/ &> /dev/null; then\n        update_report "compliance" "gdpr_data_deletion" "passed" "low" "Data deletion endpoints found"\n        print_success "Data deletion endpoints found"\n    else\n        update_report "compliance" "gdpr_data_deletion" "failed" "high" "Data deletion endpoints not found"\n        print_error "Data deletion endpoints not found (GDPR requirement)"\n        ((gdpr_issues++))\n    fi\n    \n    # SOC 2 compliance checks\n    local soc2_issues=0\n    \n    # Check for access logging\n    if grep -r -i "audit.*log\\|access.*log" src/ &> /dev/null; then\n        update_report "compliance" "soc2_access_logging" "passed" "low" "Access logging implementation found"\n        print_success "Access logging implementation found"\n    else\n        update_report "compliance" "soc2_access_logging" "failed" "high" "Access logging implementation not found"\n        print_error "Access logging implementation not found (SOC 2 requirement)"\n        ((soc2_issues++))\n    fi\n    \n    # Check for encryption at rest\n    if grep -r -i "encrypt" terraform/ k8s/ &> /dev/null; then\n        update_report "compliance" "soc2_encryption_at_rest" "passed" "low" "Encryption at rest configuration found"\n        print_success "Encryption at rest configuration found"\n    else\n        update_report "compliance" "soc2_encryption_at_rest" "failed" "high" "Encryption at rest configuration not found"\n        print_error "Encryption at rest configuration not found (SOC 2 requirement)"\n        ((soc2_issues++))\n    fi\n    \n    # Security configuration validation\n    print_step "Validating security configurations..."\n    \n    # Check for security headers\n    if grep -r -i "content-security-policy\\|x-frame-options\\|x-content-type-options" src/ k8s/ &> /dev/null; then\n        update_report "security_config" "security_headers" "passed" "low" "Security headers configuration found"\n        print_success "Security headers configuration found"\n    else\n        update_report "security_config" "security_headers" "failed" "medium" "Security headers configuration not found"\n        print_warning "Security headers configuration not found"\n    fi\n    \n    # Check for rate limiting\n    if grep -r -i "rate.*limit\\|throttle" src/ k8s/ &> /dev/null; then\n        update_report "security_config" "rate_limiting" "passed" "low" "Rate limiting configuration found"\n        print_success "Rate limiting configuration found"\n    else\n        update_report "security_config" "rate_limiting" "failed" "high" "Rate limiting configuration not found"\n        print_error "Rate limiting configuration not found"\n    fi\n    \n    # Check for input validation\n    if grep -r -i "validate\\|sanitize\\|joi\\|zod\\|yup" src/ &> /dev/null; then\n        update_report "security_config" "input_validation" "passed" "low" "Input validation implementation found"\n        print_success "Input validation implementation found"\n    else\n        update_report "security_config" "input_validation" "failed" "high" "Input validation implementation not found"\n        print_error "Input validation implementation not found"\n    fi\n}\n\n# Network security analysis\nanalyze_network_security() {\n    print_step "Analyzing network security configuration..."\n    \n    # Check for HTTPS enforcement\n    if grep -r -i "ssl\\|tls\\|https" k8s/ terraform/ &> /dev/null; then\n        update_report "network_security" "https_enforcement" "passed" "low" "HTTPS/TLS configuration found"\n        print_success "HTTPS/TLS configuration found"\n    else\n        update_report "network_security" "https_enforcement" "failed" "high" "HTTPS/TLS configuration not found"\n        print_error "HTTPS/TLS configuration not found"\n    fi\n    \n    # Check for network policies\n    if [[ -f "$PROJECT_ROOT/k8s/namespace.yaml" ]] && grep -q "NetworkPolicy" "$PROJECT_ROOT/k8s/namespace.yaml"; then\n        update_report "network_security" "network_policies" "passed" "low" "Kubernetes NetworkPolicies configured"\n        print_success "Kubernetes NetworkPolicies configured"\n    else\n        update_report "network_security" "network_policies" "failed" "medium" "Kubernetes NetworkPolicies not configured"\n        print_warning "Kubernetes NetworkPolicies not configured"\n    fi\n    \n    # Check for service mesh security\n    if grep -r -i "istio\\|linkerd\\|consul.*connect" k8s/ &> /dev/null; then\n        update_report "network_security" "service_mesh" "passed" "low" "Service mesh security configuration found"\n        print_success "Service mesh security configuration found"\n    else\n        update_report "network_security" "service_mesh" "warning" "low" "Service mesh security not configured (optional)"\n        print_warning "Service mesh security not configured"\n    fi\n}\n\n# Generate security recommendations\ngenerate_recommendations() {\n    print_step "Generating security recommendations..."\n    \n    local recommendations_file="$SECURITY_DIR/security_recommendations_$DATE.md"\n    \n    cat > "$recommendations_file" <<EOF\n# Security Audit Recommendations\n\nGenerated: $(date)\nProject: Learning Assistant\nEnvironment: ${ENVIRONMENT:-unknown}\n\n## Executive Summary\n\nThis security audit identified areas for improvement in the Learning Assistant application.\nPlease review and implement the following recommendations based on priority.\n\n## Critical Issues\n\nEOF\n    \n    # Extract critical issues\n    local critical_count=$(jq '.summary.critical' "$REPORT_FILE")\n    if [[ "$critical_count" -gt 0 ]]; then\n        echo "Found $critical_count critical security issues that require immediate attention:" >> "$recommendations_file"\n        jq -r '.categories[] | .checks[] | select(.severity == "critical" and .status == "failed") | "- **" + .name + "**: " + .details' "$REPORT_FILE" >> "$recommendations_file"\n    else\n        echo "✅ No critical security issues found." >> "$recommendations_file"\n    fi\n    \n    cat >> "$recommendations_file" <<EOF\n\n## High Priority Issues\n\nEOF\n    \n    # Extract high priority issues\n    local high_count=$(jq '.summary.high' "$REPORT_FILE")\n    if [[ "$high_count" -gt 0 ]]; then\n        echo "Found $high_count high-priority security issues:" >> "$recommendations_file"\n        jq -r '.categories[] | .checks[] | select(.severity == "high" and .status == "failed") | "- **" + .name + "**: " + .details' "$REPORT_FILE" >> "$recommendations_file"\n    else\n        echo "✅ No high-priority security issues found." >> "$recommendations_file"\n    fi\n    \n    cat >> "$recommendations_file" <<EOF\n\n## Medium Priority Issues\n\nEOF\n    \n    # Extract medium priority issues\n    local medium_count=$(jq '.summary.medium' "$REPORT_FILE")\n    if [[ "$medium_count" -gt 0 ]]; then\n        echo "Found $medium_count medium-priority security issues:" >> "$recommendations_file"\n        jq -r '.categories[] | .checks[] | select(.severity == "medium" and .status == "failed") | "- **" + .name + "**: " + .details' "$REPORT_FILE" >> "$recommendations_file"\n    else\n        echo "✅ No medium-priority security issues found." >> "$recommendations_file"\n    fi\n    \n    cat >> "$recommendations_file" <<EOF\n\n## General Recommendations\n\n### Immediate Actions (Critical/High)\n1. **Implement Secret Management**: Use external secret management solutions (AWS Secrets Manager, Azure Key Vault, HashiCorp Vault)\n2. **Enable Container Security Scanning**: Integrate container vulnerability scanning in CI/CD pipeline\n3. **Implement Network Segmentation**: Configure Kubernetes NetworkPolicies and service mesh security\n4. **Add Security Headers**: Implement comprehensive security headers (CSP, HSTS, etc.)\n5. **Enable Access Logging**: Implement comprehensive audit logging for compliance\n\n### Short-term Improvements (Medium)\n1. **Dependency Management**: Implement automated dependency vulnerability monitoring\n2. **Infrastructure Hardening**: Apply security best practices to Terraform configurations\n3. **Code Security Analysis**: Integrate SAST tools in development workflow\n4. **Compliance Documentation**: Create and maintain privacy policy and security documentation\n\n### Long-term Enhancements\n1. **Zero Trust Architecture**: Implement comprehensive zero trust security model\n2. **Security Training**: Provide security training for development team\n3. **Incident Response**: Develop and test incident response procedures\n4. **Security Metrics**: Implement security KPIs and monitoring dashboards\n\n## Next Steps\n\n1. **Prioritize Critical Issues**: Address all critical and high-priority issues immediately\n2. **Create Action Plan**: Assign owners and timelines for each recommendation\n3. **Implement Monitoring**: Set up continuous security monitoring and alerting\n4. **Regular Audits**: Schedule regular security audits (monthly/quarterly)\n5. **Update Documentation**: Maintain up-to-date security documentation\n\n## Resources\n\n- [OWASP Top 10](https://owasp.org/www-project-top-ten/)\n- [CIS Controls](https://www.cisecurity.org/controls/)\n- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)\n- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)\n\nEOF\n    \n    success "Security recommendations generated: $recommendations_file"\n}\n\n# Generate final report\ngenerate_final_report() {\n    print_step "Generating final security report..."\n    \n    # Calculate final summary\n    local total_checks=$(jq '.summary.total_checks' "$REPORT_FILE")\n    local passed=$(jq '.summary.passed' "$REPORT_FILE")\n    local failed=$(jq '.summary.failed' "$REPORT_FILE")\n    local critical=$(jq '.summary.critical' "$REPORT_FILE")\n    local high=$(jq '.summary.high' "$REPORT_FILE")\n    local medium=$(jq '.summary.medium' "$REPORT_FILE")\n    local low=$(jq '.summary.low' "$REPORT_FILE")\n    \n    # Calculate security score\n    local security_score=100\n    if [[ "$total_checks" -gt 0 ]]; then\n        security_score=$(( (passed * 100) / total_checks ))\n        security_score=$(( security_score - (critical * 20) - (high * 10) - (medium * 5) - (low * 1) ))\n        if [[ "$security_score" -lt 0 ]]; then\n            security_score=0\n        fi\n    fi\n    \n    # Determine security grade\n    local security_grade\n    if [[ "$security_score" -ge 90 ]]; then\n        security_grade="A"\n    elif [[ "$security_score" -ge 80 ]]; then\n        security_grade="B"\n    elif [[ "$security_score" -ge 70 ]]; then\n        security_grade="C"\n    elif [[ "$security_score" -ge 60 ]]; then\n        security_grade="D"\n    else\n        security_grade="F"\n    fi\n    \n    # Update final report\n    jq ".summary.security_score = $security_score | .summary.security_grade = \"$security_grade\"" "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"\n    \n    # Display summary\n    print_header "🔒 Security Audit Summary"\n    echo -e "${BLUE}Security Score: ${security_score}/100 (Grade: $security_grade)${NC}"\n    echo -e "${BLUE}Total Checks: $total_checks${NC}"\n    echo -e "${GREEN}Passed: $passed${NC}"\n    echo -e "${RED}Failed: $failed${NC}"\n    echo\n    echo -e "${RED}Critical Issues: $critical${NC}"\n    echo -e "${YELLOW}High Priority: $high${NC}"\n    echo -e "${CYAN}Medium Priority: $medium${NC}"\n    echo -e "${BLUE}Low Priority: $low${NC}"\n    echo\n    \n    if [[ "$critical" -gt 0 ]]; then\n        print_critical "IMMEDIATE ACTION REQUIRED: $critical critical security issues found"\n    elif [[ "$high" -gt 0 ]]; then\n        print_error "HIGH PRIORITY: $high high-severity issues require attention"\n    elif [[ "$medium" -gt 0 ]]; then\n        print_warning "MEDIUM PRIORITY: $medium medium-severity issues should be addressed"\n    else\n        print_success "No critical or high-priority security issues found"\n    fi\n    \n    success "Detailed security report: $REPORT_FILE"\n    success "Security recommendations: $SECURITY_DIR/security_recommendations_$DATE.md"\n}\n\n# Main execution\nmain() {\n    print_header "🔒 Comprehensive Security Audit"\n    \n    info "Starting security audit for Learning Assistant"\n    info "Target environment: ${ENVIRONMENT:-unknown}"\n    info "Report directory: $SECURITY_DIR"\n    \n    # Initialize report\n    init_security_report\n    \n    # Run security scans\n    scan_dependencies\n    scan_containers\n    scan_infrastructure\n    scan_secrets\n    analyze_code_security\n    validate_compliance\n    analyze_network_security\n    \n    # Generate outputs\n    generate_recommendations\n    generate_final_report\n    \n    print_header "🎉 Security Audit Completed"\n    \n    # Return appropriate exit code\n    local critical=$(jq '.summary.critical' "$REPORT_FILE")\n    local high=$(jq '.summary.high' "$REPORT_FILE")\n    \n    if [[ "$critical" -gt 0 ]]; then\n        return 2  # Critical issues found\n    elif [[ "$high" -gt 0 ]]; then\n        return 1  # High-priority issues found\n    else\n        return 0  # No critical or high-priority issues\n    fi\n}\n\n# Script execution\nif [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then\n    # Set default values\n    ENVIRONMENT="${ENVIRONMENT:-staging}"\n    IMAGE_NAME="${IMAGE_NAME:-ghcr.io/learning-assistant/learning-assistant}"\n    IMAGE_TAG="${IMAGE_TAG:-latest}"\n    \n    # Run main function\n    main "$@"\nfi