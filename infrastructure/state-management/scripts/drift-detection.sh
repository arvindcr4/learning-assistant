#!/bin/bash

# Terraform Drift Detection and Remediation Script
# This script detects configuration drift and provides remediation options

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/drift-detection-config.yaml"
LOG_FILE="${SCRIPT_DIR}/../logs/drift-detection-$(date +%Y%m%d_%H%M%S).log"
DRIFT_REPORTS_DIR="${SCRIPT_DIR}/../reports/drift"
TERRAFORM_DIR="${SCRIPT_DIR}/../../.."
LOCK_FILE="/tmp/terraform-drift-detection.lock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Global variables
TOTAL_DRIFT_DETECTED=0
CRITICAL_DRIFT_DETECTED=0
AUTO_REMEDIATION_ENABLED=false
DRY_RUN=false
ENVIRONMENTS=()
PROVIDERS=()

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
        "DRIFT")
            echo -e "${PURPLE}[DRIFT]${NC} ${message}" | tee -a "$LOG_FILE"
            ;;
    esac
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR" "$1"
    cleanup
    exit 1
}

# Cleanup function
cleanup() {
    if [[ -f "$LOCK_FILE" ]]; then
        rm -f "$LOCK_FILE"
    fi
}

# Set up signal handlers
trap cleanup EXIT
trap 'error_exit "Script interrupted by user"' INT TERM

# Create lock file to prevent concurrent runs
create_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local lock_pid=$(cat "$LOCK_FILE")
        if ps -p "$lock_pid" > /dev/null 2>&1; then
            error_exit "Another instance is already running (PID: $lock_pid)"
        else
            log "WARN" "Stale lock file found, removing it"
            rm -f "$LOCK_FILE"
        fi
    fi
    
    echo $$ > "$LOCK_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    local required_tools=("terraform" "jq" "yq" "curl")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "$tool is required but not installed"
        fi
    done
    
    # Check Terraform version
    local tf_version=$(terraform version -json | jq -r '.terraform_version')
    log "DEBUG" "Terraform version: $tf_version"
    
    # Check if we're in a Terraform directory
    if [[ ! -f "$TERRAFORM_DIR/main.tf" && ! -f "$TERRAFORM_DIR/versions.tf" ]]; then
        error_exit "No Terraform configuration found in $TERRAFORM_DIR"
    fi
}

# Load configuration
load_config() {
    log "INFO" "Loading drift detection configuration..."
    
    if [[ -f "$CONFIG_FILE" ]]; then
        # Parse YAML configuration
        mapfile -t ENVIRONMENTS < <(yq e '.environments[].name' "$CONFIG_FILE")
        mapfile -t PROVIDERS < <(yq e '.providers[].name' "$CONFIG_FILE")
        
        AUTO_REMEDIATION_ENABLED=$(yq e '.drift_detection.auto_remediation.enabled' "$CONFIG_FILE")
        local schedule=$(yq e '.drift_detection.schedule' "$CONFIG_FILE")
        
        log "DEBUG" "Configuration loaded successfully"
        log "DEBUG" "Environments: ${ENVIRONMENTS[*]}"
        log "DEBUG" "Providers: ${PROVIDERS[*]}"
        log "DEBUG" "Auto-remediation: $AUTO_REMEDIATION_ENABLED"
        log "DEBUG" "Schedule: $schedule"
    else
        log "WARN" "Configuration file not found, using defaults"
        ENVIRONMENTS=("dev" "staging" "prod")
        PROVIDERS=("aws" "gcp" "azure")
    fi
}

# Initialize Terraform for environment
init_terraform() {
    local environment="$1"
    local provider="$2"
    
    log "INFO" "Initializing Terraform for $environment environment ($provider provider)..."
    
    local tf_dir="$TERRAFORM_DIR/environments/$environment"
    local backend_config="$TERRAFORM_DIR/infrastructure/state-management/configs/backend-${provider}-${environment}.hcl"
    
    if [[ ! -d "$tf_dir" ]]; then
        log "WARN" "Terraform directory not found: $tf_dir"
        return 1
    fi
    
    cd "$tf_dir"
    
    # Initialize with backend configuration
    if [[ -f "$backend_config" ]]; then
        terraform init -backend-config="$backend_config" -reconfigure -input=false
    else
        terraform init -reconfigure -input=false
    fi
    
    # Select or create workspace
    if terraform workspace list | grep -q "^[[:space:]]*$environment$"; then
        terraform workspace select "$environment"
    else
        terraform workspace new "$environment"
    fi
    
    log "DEBUG" "Terraform initialized for $environment ($provider)"
}

# Detect drift using terraform plan
detect_drift() {
    local environment="$1"
    local provider="$2"
    
    log "INFO" "Detecting drift for $environment environment ($provider provider)..."
    
    local tf_dir="$TERRAFORM_DIR/environments/$environment"
    local plan_file="$DRIFT_REPORTS_DIR/${environment}-${provider}-plan.json"
    local drift_report="$DRIFT_REPORTS_DIR/${environment}-${provider}-drift.json"
    
    cd "$tf_dir"
    
    # Generate plan in JSON format
    if terraform plan -detailed-exitcode -out="/tmp/tfplan-${environment}-${provider}" -json > "$plan_file" 2>/dev/null; then
        log "INFO" "No changes detected for $environment ($provider)"
        echo '{"drift_detected": false, "changes": []}' > "$drift_report"
        return 0
    else
        local exit_code=$?
        if [[ $exit_code -eq 2 ]]; then
            log "DRIFT" "Configuration drift detected for $environment ($provider)"
            
            # Convert binary plan to JSON
            terraform show -json "/tmp/tfplan-${environment}-${provider}" > "$plan_file"
            
            # Analyze the plan for drift
            analyze_drift "$plan_file" "$drift_report" "$environment" "$provider"
            
            TOTAL_DRIFT_DETECTED=$((TOTAL_DRIFT_DETECTED + 1))
            return 2
        else
            log "ERROR" "Terraform plan failed for $environment ($provider) with exit code: $exit_code"
            return 1
        fi
    fi
}

# Analyze drift from plan output
analyze_drift() {
    local plan_file="$1"
    local drift_report="$2"
    local environment="$3"
    local provider="$4"
    
    log "INFO" "Analyzing drift for $environment ($provider)..."
    
    # Extract resource changes
    local changes=$(jq -r '.resource_changes[]' "$plan_file" 2>/dev/null || echo '[]')
    
    # Categorize changes
    local drift_analysis=$(cat << EOF
{
    "drift_detected": true,
    "environment": "$environment",
    "provider": "$provider",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "summary": {
        "total_changes": 0,
        "create": 0,
        "update": 0,
        "delete": 0,
        "replace": 0
    },
    "changes": [],
    "critical_changes": [],
    "security_implications": [],
    "recommendations": []
}
EOF
    )
    
    # Process each change
    while IFS= read -r change; do
        if [[ "$change" != "null" && -n "$change" ]]; then
            local resource_type=$(echo "$change" | jq -r '.type')
            local resource_name=$(echo "$change" | jq -r '.name')
            local actions=$(echo "$change" | jq -r '.change.actions[]' 2>/dev/null || echo "")
            
            log "DRIFT" "Resource: $resource_type.$resource_name - Actions: $actions"
            
            # Update summary counters
            for action in $actions; do
                case "$action" in
                    "create")
                        drift_analysis=$(echo "$drift_analysis" | jq '.summary.create += 1')
                        ;;
                    "update")
                        drift_analysis=$(echo "$drift_analysis" | jq '.summary.update += 1')
                        ;;
                    "delete")
                        drift_analysis=$(echo "$drift_analysis" | jq '.summary.delete += 1')
                        ;;
                    "replace")
                        drift_analysis=$(echo "$drift_analysis" | jq '.summary.replace += 1')
                        ;;
                esac
            done
            
            # Add to changes array
            drift_analysis=$(echo "$drift_analysis" | jq --argjson change "$change" '.changes += [$change]')
            
            # Check for critical changes
            if [[ "$actions" == *"delete"* ]] || [[ "$actions" == *"replace"* ]]; then
                drift_analysis=$(echo "$drift_analysis" | jq --argjson change "$change" '.critical_changes += [$change]')
                CRITICAL_DRIFT_DETECTED=$((CRITICAL_DRIFT_DETECTED + 1))
                log "WARN" "Critical drift detected: $resource_type.$resource_name"
            fi
            
            # Check for security implications
            if [[ "$resource_type" == *"security"* ]] || [[ "$resource_type" == *"iam"* ]] || [[ "$resource_type" == *"policy"* ]]; then
                drift_analysis=$(echo "$drift_analysis" | jq --argjson change "$change" '.security_implications += [$change]')
                log "WARN" "Security-related drift detected: $resource_type.$resource_name"
            fi
        fi
    done < <(echo "$changes" | jq -c '.')
    
    # Update total changes
    drift_analysis=$(echo "$drift_analysis" | jq '.summary.total_changes = (.summary.create + .summary.update + .summary.delete + .summary.replace)')
    
    # Add recommendations
    local recommendations=()
    if [[ $(echo "$drift_analysis" | jq '.summary.delete') -gt 0 ]]; then
        recommendations+=("Review deleted resources - they may have been removed outside of Terraform")
    fi
    if [[ $(echo "$drift_analysis" | jq '.summary.replace') -gt 0 ]]; then
        recommendations+=("Review replaced resources - this may cause downtime")
    fi
    if [[ $(echo "$drift_analysis" | jq '.security_implications | length') -gt 0 ]]; then
        recommendations+=("Security-related changes detected - immediate review required")
    fi
    
    for rec in "${recommendations[@]}"; do
        drift_analysis=$(echo "$drift_analysis" | jq --arg rec "$rec" '.recommendations += [$rec]')
    done
    
    # Save drift analysis
    echo "$drift_analysis" > "$drift_report"
    
    log "INFO" "Drift analysis completed for $environment ($provider)"
    log "INFO" "Total changes: $(echo "$drift_analysis" | jq '.summary.total_changes')"
    log "INFO" "Critical changes: $(echo "$drift_analysis" | jq '.critical_changes | length')"
}

# Generate drift summary report
generate_drift_summary() {
    log "INFO" "Generating drift summary report..."
    
    local summary_report="$DRIFT_REPORTS_DIR/drift-summary-$(date +%Y%m%d_%H%M%S).json"
    local html_report="$DRIFT_REPORTS_DIR/drift-summary-$(date +%Y%m%d_%H%M%S).html"
    
    # Initialize summary
    local summary=$(cat << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "total_environments": ${#ENVIRONMENTS[@]},
    "total_providers": ${#PROVIDERS[@]},
    "total_drift_detected": $TOTAL_DRIFT_DETECTED,
    "critical_drift_detected": $CRITICAL_DRIFT_DETECTED,
    "environments": []
}
EOF
    )
    
    # Process each environment report
    for env in "${ENVIRONMENTS[@]}"; do
        for provider in "${PROVIDERS[@]}"; do
            local drift_report="$DRIFT_REPORTS_DIR/${env}-${provider}-drift.json"
            
            if [[ -f "$drift_report" ]]; then
                local env_drift=$(cat "$drift_report")
                summary=$(echo "$summary" | jq --argjson env_drift "$env_drift" '.environments += [$env_drift]')
            fi
        done
    done
    
    # Save summary
    echo "$summary" > "$summary_report"
    
    # Generate HTML report
    generate_html_report "$summary" "$html_report"
    
    log "INFO" "Drift summary report generated: $summary_report"
    log "INFO" "HTML report generated: $html_report"
}

# Generate HTML report
generate_html_report() {
    local summary="$1"
    local html_file="$2"
    
    cat > "$html_file" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Terraform Drift Detection Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { display: flex; justify-content: space-around; margin: 20px 0; }
        .metric { text-align: center; padding: 10px; background: #e9e9e9; border-radius: 5px; }
        .metric.critical { background: #ffebee; color: #c62828; }
        .metric.warning { background: #fff3e0; color: #ef6c00; }
        .metric.good { background: #e8f5e8; color: #2e7d32; }
        .environment { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .changes { margin: 10px 0; }
        .change { margin: 5px 0; padding: 8px; background: #f9f9f9; border-radius: 3px; }
        .critical { border-left: 4px solid #f44336; }
        .security { border-left: 4px solid #ff9800; }
        .normal { border-left: 4px solid #4caf50; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Terraform Drift Detection Report</h1>
        <p class="timestamp">Generated: $(echo "$summary" | jq -r '.timestamp')</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Environments</h3>
            <p>$(echo "$summary" | jq -r '.total_environments')</p>
        </div>
        <div class="metric">
            <h3>Total Providers</h3>
            <p>$(echo "$summary" | jq -r '.total_providers')</p>
        </div>
        <div class="metric $([ $(echo "$summary" | jq -r '.total_drift_detected') -gt 0 ] && echo "warning" || echo "good")">
            <h3>Drift Detected</h3>
            <p>$(echo "$summary" | jq -r '.total_drift_detected')</p>
        </div>
        <div class="metric $([ $(echo "$summary" | jq -r '.critical_drift_detected') -gt 0 ] && echo "critical" || echo "good")">
            <h3>Critical Drift</h3>
            <p>$(echo "$summary" | jq -r '.critical_drift_detected')</p>
        </div>
    </div>
    
    <h2>Environment Details</h2>
EOF
    
    # Add environment details
    while IFS= read -r env_data; do
        if [[ "$env_data" != "null" && -n "$env_data" ]]; then
            local env_name=$(echo "$env_data" | jq -r '.environment')
            local provider=$(echo "$env_data" | jq -r '.provider')
            local drift_detected=$(echo "$env_data" | jq -r '.drift_detected')
            local total_changes=$(echo "$env_data" | jq -r '.summary.total_changes // 0')
            local critical_changes=$(echo "$env_data" | jq -r '.critical_changes | length // 0')
            
            cat >> "$html_file" << EOF
    <div class="environment">
        <h3>$env_name ($provider)</h3>
        <p><strong>Drift Detected:</strong> $drift_detected</p>
        <p><strong>Total Changes:</strong> $total_changes</p>
        <p><strong>Critical Changes:</strong> $critical_changes</p>
EOF
            
            # Add recommendations if any
            local recommendations=$(echo "$env_data" | jq -r '.recommendations[]' 2>/dev/null || echo "")
            if [[ -n "$recommendations" ]]; then
                echo "        <h4>Recommendations:</h4>" >> "$html_file"
                echo "        <ul>" >> "$html_file"
                while IFS= read -r rec; do
                    echo "            <li>$rec</li>" >> "$html_file"
                done <<< "$recommendations"
                echo "        </ul>" >> "$html_file"
            fi
            
            echo "    </div>" >> "$html_file"
        fi
    done < <(echo "$summary" | jq -c '.environments[]')
    
    cat >> "$html_file" << 'EOF'
</body>
</html>
EOF
}

# Auto-remediation for specific drift types
auto_remediate_drift() {
    local environment="$1"
    local provider="$2"
    
    if [[ "$AUTO_REMEDIATION_ENABLED" != "true" ]]; then
        log "INFO" "Auto-remediation is disabled"
        return 0
    fi
    
    log "INFO" "Attempting auto-remediation for $environment ($provider)..."
    
    local drift_report="$DRIFT_REPORTS_DIR/${environment}-${provider}-drift.json"
    
    if [[ ! -f "$drift_report" ]]; then
        log "WARN" "No drift report found for $environment ($provider)"
        return 1
    fi
    
    local critical_changes=$(cat "$drift_report" | jq -r '.critical_changes | length')
    
    if [[ $critical_changes -gt 0 ]]; then
        log "WARN" "Critical changes detected - auto-remediation skipped"
        return 1
    fi
    
    # Only auto-remediate safe changes
    local safe_changes=$(cat "$drift_report" | jq -r '.changes[] | select(.change.actions[] == "update" or .change.actions[] == "create")')
    
    if [[ -n "$safe_changes" ]]; then
        log "INFO" "Applying safe auto-remediation changes..."
        
        local tf_dir="$TERRAFORM_DIR/environments/$environment"
        cd "$tf_dir"
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log "INFO" "DRY RUN: Would apply auto-remediation changes"
        else
            # Apply only safe changes
            terraform apply -auto-approve -target="$(echo "$safe_changes" | jq -r '.address')"
            log "INFO" "Auto-remediation applied successfully"
        fi
    else
        log "INFO" "No safe changes found for auto-remediation"
    fi
}

# Send notification
send_notification() {
    local summary="$1"
    
    if [[ -z "${SLACK_WEBHOOK_URL:-}" ]]; then
        log "DEBUG" "No Slack webhook URL configured"
        return 0
    fi
    
    local total_drift=$(echo "$summary" | jq -r '.total_drift_detected')
    local critical_drift=$(echo "$summary" | jq -r '.critical_drift_detected')
    
    local color="good"
    local status="No Drift Detected"
    
    if [[ $critical_drift -gt 0 ]]; then
        color="danger"
        status="Critical Drift Detected"
    elif [[ $total_drift -gt 0 ]]; then
        color="warning"
        status="Drift Detected"
    fi
    
    local payload=$(cat << EOF
{
    "attachments": [
        {
            "color": "$color",
            "title": "Terraform Drift Detection - $status",
            "fields": [
                {
                    "title": "Total Environments",
                    "value": "$(echo "$summary" | jq -r '.total_environments')",
                    "short": true
                },
                {
                    "title": "Drift Detected",
                    "value": "$total_drift",
                    "short": true
                },
                {
                    "title": "Critical Drift",
                    "value": "$critical_drift",
                    "short": true
                },
                {
                    "title": "Timestamp",
                    "value": "$(echo "$summary" | jq -r '.timestamp')",
                    "short": true
                }
            ]
        }
    ]
}
EOF
    )
    
    curl -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    
    log "INFO" "Notification sent"
}

# Main drift detection process
main() {
    local start_time=$(date +%s)
    
    log "INFO" "Starting Terraform drift detection process..."
    
    # Create necessary directories
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$DRIFT_REPORTS_DIR"
    
    # Create lock file
    create_lock
    
    # Check prerequisites
    check_prerequisites
    
    # Load configuration
    load_config
    
    # Process each environment and provider
    for env in "${ENVIRONMENTS[@]}"; do
        for provider in "${PROVIDERS[@]}"; do
            log "INFO" "Processing $env environment with $provider provider"
            
            if init_terraform "$env" "$provider"; then
                local drift_exit_code=0
                detect_drift "$env" "$provider" || drift_exit_code=$?
                
                if [[ $drift_exit_code -eq 2 ]]; then
                    # Drift detected, attempt auto-remediation if enabled
                    auto_remediate_drift "$env" "$provider"
                fi
            else
                log "ERROR" "Failed to initialize Terraform for $env ($provider)"
            fi
        done
    done
    
    # Generate summary report
    generate_drift_summary
    
    # Send notification
    local summary_report="$DRIFT_REPORTS_DIR/drift-summary-$(date +%Y%m%d_%H%M%S).json"
    if [[ -f "$summary_report" ]]; then
        send_notification "$(cat "$summary_report")"
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "INFO" "Drift detection process completed in ${duration}s"
    log "INFO" "Total drift detected: $TOTAL_DRIFT_DETECTED"
    log "INFO" "Critical drift detected: $CRITICAL_DRIFT_DETECTED"
    
    if [[ $CRITICAL_DRIFT_DETECTED -gt 0 ]]; then
        exit 2
    elif [[ $TOTAL_DRIFT_DETECTED -gt 0 ]]; then
        exit 1
    else
        exit 0
    fi
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --auto-remediate)
            AUTO_REMEDIATION_ENABLED=true
            shift
            ;;
        --environment)
            ENVIRONMENTS=("$2")
            shift 2
            ;;
        --provider)
            PROVIDERS=("$2")
            shift 2
            ;;
        --help|-h)
            cat << EOF
Terraform Drift Detection Script

Usage: $0 [OPTIONS]

Options:
    --config FILE           Configuration file path
    --dry-run              Show what would be done without executing
    --auto-remediate       Enable auto-remediation for safe changes
    --environment ENV      Process specific environment only
    --provider PROVIDER    Process specific provider only
    --help, -h             Show this help message

Examples:
    $0
    $0 --dry-run
    $0 --auto-remediate
    $0 --environment prod --provider aws
    $0 --config /path/to/config.yaml --dry-run

EOF
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Run main function
main