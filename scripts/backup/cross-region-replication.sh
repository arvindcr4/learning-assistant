#!/bin/bash

# Cross-Region Backup Replication Script
# Learning Assistant - Multi-Region Backup Distribution and Synchronization
# Version: 2.0.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/learning-assistant}"
REPLICATION_CONFIG_FILE="${REPLICATION_CONFIG_FILE:-/etc/backup/replication.conf}"

# Primary region configuration
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
PRIMARY_BUCKET="${PRIMARY_BUCKET:-learning-assistant-backups-primary}"

# Replication regions and storage
declare -A REPLICATION_TARGETS=(
    ["us-west-2"]="learning-assistant-backups-west"
    ["eu-west-1"]="learning-assistant-backups-eu"
    ["ap-southeast-1"]="learning-assistant-backups-asia"
)

# Replication settings
REPLICATION_MODE="${REPLICATION_MODE:-async}"  # async, sync, scheduled
REPLICATION_SCHEDULE="${REPLICATION_SCHEDULE:-*/30 * * * *}"  # Every 30 minutes
COMPRESSION_ENABLED="${COMPRESSION_ENABLED:-true}"
ENCRYPTION_IN_TRANSIT="${ENCRYPTION_IN_TRANSIT:-true}"
DELTA_SYNC="${DELTA_SYNC:-true}"
BANDWIDTH_LIMIT="${BANDWIDTH_LIMIT:-100M}"  # Bandwidth limit per region

# Multi-cloud support
ENABLE_AZURE="${ENABLE_AZURE:-false}"
ENABLE_GCP="${ENABLE_GCP:-false}"
AZURE_STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT}"
AZURE_CONTAINER_PREFIX="${AZURE_CONTAINER_PREFIX:-learning-assistant-backups}"
GCP_PROJECT="${GCP_PROJECT}"
GCP_BUCKET_PREFIX="${GCP_BUCKET_PREFIX:-learning-assistant-backups}"

# Replication policies
RETENTION_POLICY="${RETENTION_POLICY:-30d}"
LIFECYCLE_POLICY="${LIFECYCLE_POLICY:-true}"
CROSS_REGION_VERIFICATION="${CROSS_REGION_VERIFICATION:-true}"
CONSISTENCY_CHECK_INTERVAL="${CONSISTENCY_CHECK_INTERVAL:-24h}"

# Performance and monitoring
PARALLEL_TRANSFERS="${PARALLEL_TRANSFERS:-4}"
TRANSFER_TIMEOUT="${TRANSFER_TIMEOUT:-3600}"  # 1 hour
MONITORING_ENABLED="${MONITORING_ENABLED:-true}"
METRICS_RETENTION="${METRICS_RETENTION:-90d}"

# Disaster recovery settings
FAILOVER_ENABLED="${FAILOVER_ENABLED:-true}"
AUTOMATIC_FAILOVER="${AUTOMATIC_FAILOVER:-false}"
FAILOVER_THRESHOLD="${FAILOVER_THRESHOLD:-5}"  # Minutes of unavailability

# Security
ACCESS_CONTROL_ENABLED="${ACCESS_CONTROL_ENABLED:-true}"
AUDIT_LOGGING="${AUDIT_LOGGING:-true}"
ENCRYPTION_KEY_ROTATION="${ENCRYPTION_KEY_ROTATION:-90d}"

# Notification settings
SLACK_WEBHOOK="${SLACK_WEBHOOK}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK}"
EMAIL_ALERTS="${EMAIL_ALERTS}"
CRITICAL_ALERTS_ONLY="${CRITICAL_ALERTS_ONLY:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Global tracking variables
REPLICATION_START_TIME=0
TOTAL_TRANSFERRED=0
TOTAL_REGIONS=0
SUCCESSFUL_REPLICATIONS=0
FAILED_REPLICATIONS=0
REPLICATION_METRICS=()

# Enhanced logging for cross-region operations
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="${BACKUP_DIR}/replication.log"
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$log_file")"
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message" | tee -a "$log_file"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message" | tee -a "$log_file"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message" | tee -a "$log_file"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} ${timestamp}: $message" | tee -a "$log_file"
            ;;
        "REPLICATION")
            echo -e "${CYAN}[REPLICATION]${NC} ${timestamp}: $message" | tee -a "$log_file"
            ;;
    esac
}

# Cross-region notification system
send_replication_notification() {
    local status=$1
    local message=$2
    local severity="${3:-info}"
    local transfer_stats="${4:-}"
    
    # Only send critical alerts if configured
    if [[ "$CRITICAL_ALERTS_ONLY" == "true" && "$severity" != "critical" ]]; then
        return 0
    fi
    
    # Slack notification
    if [[ -n "$SLACK_WEBHOOK" ]]; then
        local color="good"
        local icon=":globe_with_meridians:"
        
        case $severity in
            "critical"|"error")
                color="danger"
                icon=":red_circle:"
                ;;
            "warning")
                color="warning"
                icon=":warning:"
                ;;
        esac
        
        local fields="[]"
        if [[ -n "$transfer_stats" ]]; then
            fields=$(cat << EOF
[
    {
        "title": "Total Transferred",
        "value": "$transfer_stats",
        "short": true
    },
    {
        "title": "Successful Regions",
        "value": "$SUCCESSFUL_REPLICATIONS/$TOTAL_REGIONS",
        "short": true
    },
    {
        "title": "Replication Mode",
        "value": "$REPLICATION_MODE",
        "short": true
    },
    {
        "title": "Primary Region",
        "value": "$PRIMARY_REGION",
        "short": true
    }
]
EOF
)
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"${icon} Cross-Region Replication $status\",
                    \"text\": \"$message\",
                    \"fields\": $fields,
                    \"footer\": \"Learning Assistant Backup Replication\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
    
    # Discord notification
    if [[ -n "$DISCORD_WEBHOOK" ]]; then
        local embed_color=65280  # Green
        case $severity in
            "critical"|"error") embed_color=16711680 ;;  # Red
            "warning") embed_color=16776960 ;;  # Yellow
        esac
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"🌍 Cross-Region Replication $status\",
                    \"description\": \"$message\",
                    \"color\": $embed_color,
                    \"fields\": [
                        {\"name\": \"Mode\", \"value\": \"$REPLICATION_MODE\", \"inline\": true},
                        {\"name\": \"Regions\", \"value\": \"$SUCCESSFUL_REPLICATIONS/$TOTAL_REGIONS\", \"inline\": true},
                        {\"name\": \"Primary\", \"value\": \"$PRIMARY_REGION\", \"inline\": true}
                    ],
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" \
            "$DISCORD_WEBHOOK" 2>/dev/null || true
    fi
}

# Validate replication prerequisites
validate_replication_prerequisites() {
    log "REPLICATION" "Validating cross-region replication prerequisites..."
    
    # Check required tools
    local required_tools=("aws" "jq" "curl" "rsync")
    
    if [[ "$ENABLE_AZURE" == "true" ]]; then
        required_tools+=("az")
    fi
    
    if [[ "$ENABLE_GCP" == "true" ]]; then
        required_tools+=("gsutil" "gcloud")
    fi
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool not found: $tool"
            return 1
        fi
    done
    
    # Check AWS credentials and permissions
    if ! aws sts get-caller-identity &> /dev/null; then
        log "ERROR" "AWS credentials not configured or invalid"
        return 1
    fi
    
    # Verify primary bucket access
    if ! aws s3 ls "s3://$PRIMARY_BUCKET" &> /dev/null; then
        log "ERROR" "Cannot access primary bucket: $PRIMARY_BUCKET"
        return 1
    fi
    
    # Check Azure credentials if enabled
    if [[ "$ENABLE_AZURE" == "true" ]]; then
        if ! az account show &> /dev/null; then
            log "ERROR" "Azure credentials not configured"
            return 1
        fi
    fi
    
    # Check GCP credentials if enabled
    if [[ "$ENABLE_GCP" == "true" ]]; then
        if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -1 &> /dev/null; then
            log "ERROR" "GCP credentials not configured"
            return 1
        fi
    fi
    
    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "ERROR" "Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    
    # Verify replication targets
    for region in "${!REPLICATION_TARGETS[@]}"; do
        local bucket="${REPLICATION_TARGETS[$region]}"
        
        if ! aws s3 ls "s3://$bucket" --region "$region" &> /dev/null; then
            log "WARN" "Cannot access replication bucket: $bucket in $region"
        fi
    done
    
    log "SUCCESS" "Replication prerequisites validated"
    return 0
}

# Setup replication infrastructure
setup_replication_infrastructure() {
    log "REPLICATION" "Setting up cross-region replication infrastructure..."
    
    # Create replication buckets if they don't exist
    for region in "${!REPLICATION_TARGETS[@]}"; do
        local bucket="${REPLICATION_TARGETS[$region]}"
        
        log "INFO" "Setting up replication bucket: $bucket in $region"
        
        # Create bucket if it doesn't exist
        if ! aws s3 ls "s3://$bucket" --region "$region" &> /dev/null; then
            if aws s3 mb "s3://$bucket" --region "$region"; then
                log "SUCCESS" "Created replication bucket: $bucket"
            else
                log "ERROR" "Failed to create replication bucket: $bucket"
                continue
            fi
        fi
        
        # Configure bucket lifecycle policy
        if [[ "$LIFECYCLE_POLICY" == "true" ]]; then
            setup_lifecycle_policy "$bucket" "$region"
        fi
        
        # Configure bucket replication
        setup_bucket_replication "$bucket" "$region"
        
        # Set up access controls
        if [[ "$ACCESS_CONTROL_ENABLED" == "true" ]]; then
            setup_access_controls "$bucket" "$region"
        fi
    done
    
    # Setup Azure containers if enabled
    if [[ "$ENABLE_AZURE" == "true" ]]; then
        setup_azure_infrastructure
    fi
    
    # Setup GCP buckets if enabled
    if [[ "$ENABLE_GCP" == "true" ]]; then
        setup_gcp_infrastructure
    fi
    
    log "SUCCESS" "Replication infrastructure setup completed"
}

# Setup lifecycle policy for bucket
setup_lifecycle_policy() {
    local bucket="$1"
    local region="$2"
    
    local lifecycle_policy=$(cat << EOF
{
    "Rules": [
        {
            "ID": "LearningAssistantBackupLifecycle",
            "Status": "Enabled",
            "Filter": {
                "Prefix": "backups/"
            },
            "Transitions": [
                {
                    "Days": 7,
                    "StorageClass": "STANDARD_IA"
                },
                {
                    "Days": 30,
                    "StorageClass": "GLACIER"
                },
                {
                    "Days": 90,
                    "StorageClass": "DEEP_ARCHIVE"
                }
            ],
            "Expiration": {
                "Days": 365
            }
        }
    ]
}
EOF
)
    
    echo "$lifecycle_policy" > "/tmp/lifecycle_policy_${bucket}.json"
    
    if aws s3api put-bucket-lifecycle-configuration \
        --bucket "$bucket" \
        --region "$region" \
        --lifecycle-configuration file:///tmp/lifecycle_policy_${bucket}.json; then
        
        log "SUCCESS" "Lifecycle policy configured for: $bucket"
    else
        log "WARN" "Failed to configure lifecycle policy for: $bucket"
    fi
    
    rm -f "/tmp/lifecycle_policy_${bucket}.json"
}

# Setup bucket replication
setup_bucket_replication() {
    local bucket="$1"
    local region="$2"
    
    # Enable versioning (required for replication)
    aws s3api put-bucket-versioning \
        --bucket "$bucket" \
        --region "$region" \
        --versioning-configuration Status=Enabled 2>/dev/null || true
    
    # Configure server-side encryption
    local encryption_config=$(cat << EOF
{
    "Rules": [
        {
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            },
            "BucketKeyEnabled": true
        }
    ]
}
EOF
)
    
    echo "$encryption_config" > "/tmp/encryption_${bucket}.json"
    
    aws s3api put-bucket-encryption \
        --bucket "$bucket" \
        --region "$region" \
        --server-side-encryption-configuration file:///tmp/encryption_${bucket}.json 2>/dev/null || true
    
    rm -f "/tmp/encryption_${bucket}.json"
    
    log "INFO" "Bucket replication settings configured for: $bucket"
}

# Setup access controls
setup_access_controls() {
    local bucket="$1"
    local region="$2"
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "$bucket" \
        --region "$region" \
        --public-access-block-configuration \
        BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true 2>/dev/null || true
    
    log "INFO" "Access controls configured for: $bucket"
}

# Setup Azure infrastructure
setup_azure_infrastructure() {
    log "INFO" "Setting up Azure infrastructure..."
    
    # Create storage containers for each region equivalent
    local azure_regions=("eastus2" "westeurope" "southeastasia")
    
    for region in "${azure_regions[@]}"; do
        local container_name="${AZURE_CONTAINER_PREFIX}-${region}"
        
        if ! az storage container exists \
            --account-name "$AZURE_STORAGE_ACCOUNT" \
            --name "$container_name" --output tsv | grep -q true; then
            
            if az storage container create \
                --account-name "$AZURE_STORAGE_ACCOUNT" \
                --name "$container_name" \
                --public-access off; then
                
                log "SUCCESS" "Created Azure container: $container_name"
            else
                log "ERROR" "Failed to create Azure container: $container_name"
            fi
        fi
    done
}

# Setup GCP infrastructure
setup_gcp_infrastructure() {
    log "INFO" "Setting up GCP infrastructure..."
    
    # Create storage buckets for each region
    local gcp_regions=("us-central1" "europe-west1" "asia-southeast1")
    
    for region in "${gcp_regions[@]}"; do
        local bucket_name="${GCP_BUCKET_PREFIX}-${region}"
        
        if ! gsutil ls -b "gs://$bucket_name" &> /dev/null; then
            if gsutil mb -l "$region" "gs://$bucket_name"; then
                log "SUCCESS" "Created GCP bucket: $bucket_name"
                
                # Configure lifecycle
                local lifecycle_config=$(cat << EOF
{
  "rule": [
    {
      "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
      "condition": {"age": 30}
    },
    {
      "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
      "condition": {"age": 90}
    },
    {
      "action": {"type": "Delete"},
      "condition": {"age": 365}
    }
  ]
}
EOF
)
                
                echo "$lifecycle_config" > "/tmp/gcp_lifecycle_${bucket_name}.json"
                gsutil lifecycle set "/tmp/gcp_lifecycle_${bucket_name}.json" "gs://$bucket_name" || true
                rm -f "/tmp/gcp_lifecycle_${bucket_name}.json"
                
            else
                log "ERROR" "Failed to create GCP bucket: $bucket_name"
            fi
        fi
    done
}

# Discover backups to replicate
discover_backups_for_replication() {
    log "REPLICATION" "Discovering backups for replication..."
    
    local backup_files=()
    
    # Find recent backup files (last 24 hours)
    if [[ -d "$BACKUP_DIR" ]]; then
        while IFS= read -r -d '' file; do
            backup_files+=("$file")
        done < <(find "$BACKUP_DIR" -name "*_backup_*" -type f -mtime -1 -print0 2>/dev/null)
    fi
    
    # Also check primary S3 bucket
    local s3_objects=()
    if aws s3 ls "s3://$PRIMARY_BUCKET/" --recursive | grep "$(date +%Y%m%d)" | awk '{print $4}'; then
        while IFS= read -r object; do
            s3_objects+=("s3://$PRIMARY_BUCKET/$object")
        done < <(aws s3 ls "s3://$PRIMARY_BUCKET/" --recursive | grep "$(date +%Y%m%d)" | awk '{print $4}')
    fi
    
    log "INFO" "Found ${#backup_files[@]} local backup files and ${#s3_objects[@]} S3 objects for replication"
    
    # Combine local files and S3 objects
    printf '%s\n' "${backup_files[@]}" "${s3_objects[@]}"
}

# Replicate backup to specific region
replicate_to_region() {
    local source="$1"
    local region="$2"
    local bucket="${REPLICATION_TARGETS[$region]}"
    local start_time=$(date +%s)
    
    log "REPLICATION" "Starting replication to $region ($bucket)..."
    
    local object_key
    if [[ "$source" == s3://* ]]; then
        # S3 to S3 replication
        object_key=$(basename "${source#s3://$PRIMARY_BUCKET/}")
        
        if replicate_s3_to_s3 "$source" "$region" "$bucket" "$object_key"; then
            SUCCESSFUL_REPLICATIONS=$((SUCCESSFUL_REPLICATIONS + 1))
        else
            FAILED_REPLICATIONS=$((FAILED_REPLICATIONS + 1))
            return 1
        fi
    else
        # Local to S3 replication
        object_key="backups/$(basename "$source")"
        
        if replicate_local_to_s3 "$source" "$region" "$bucket" "$object_key"; then
            SUCCESSFUL_REPLICATIONS=$((SUCCESSFUL_REPLICATIONS + 1))
        else
            FAILED_REPLICATIONS=$((FAILED_REPLICATIONS + 1))
            return 1
        fi
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local file_size=$(get_file_size "$source")
    
    # Record replication metrics
    REPLICATION_METRICS+=("$region:$duration:$file_size:success")
    TOTAL_TRANSFERRED=$((TOTAL_TRANSFERRED + file_size))
    
    log "SUCCESS" "Replication to $region completed in ${duration}s"
    
    # Replicate to multi-cloud if enabled
    if [[ "$ENABLE_AZURE" == "true" ]]; then
        replicate_to_azure "$source" "$region"
    fi
    
    if [[ "$ENABLE_GCP" == "true" ]]; then
        replicate_to_gcp "$source" "$region"
    fi
    
    return 0
}

# S3 to S3 replication
replicate_s3_to_s3() {
    local source="$1"
    local region="$2"
    local bucket="$3"
    local object_key="$4"
    
    local copy_options=()
    
    if [[ "$COMPRESSION_ENABLED" == "true" ]]; then
        copy_options+=(--metadata-directive REPLACE --metadata "Content-Encoding=gzip")
    fi
    
    if [[ "$ENCRYPTION_IN_TRANSIT" == "true" ]]; then
        copy_options+=(--sse AES256)
    fi
    
    # Use multipart copy for large files
    if aws s3 cp "$source" "s3://$bucket/$object_key" \
        --region "$region" \
        "${copy_options[@]}" \
        --storage-class STANDARD_IA; then
        
        log "SUCCESS" "S3 replication completed: $object_key to $region"
        return 0
    else
        log "ERROR" "S3 replication failed: $object_key to $region"
        return 1
    fi
}

# Local to S3 replication
replicate_local_to_s3() {
    local source="$1"
    local region="$2"
    local bucket="$3"
    local object_key="$4"
    
    local upload_options=()
    
    if [[ "$COMPRESSION_ENABLED" == "true" && ! "$source" =~ \.(gz|zip|bz2)$ ]]; then
        # Compress on the fly for uncompressed files
        upload_options+=(--metadata "Content-Encoding=gzip")
        
        if gzip -c "$source" | aws s3 cp - "s3://$bucket/$object_key" \
            --region "$region" \
            "${upload_options[@]}" \
            --storage-class STANDARD_IA; then
            
            log "SUCCESS" "Local replication with compression completed: $object_key to $region"
            return 0
        fi
    else
        # Direct upload
        if aws s3 cp "$source" "s3://$bucket/$object_key" \
            --region "$region" \
            --storage-class STANDARD_IA; then
            
            log "SUCCESS" "Local replication completed: $object_key to $region"
            return 0
        fi
    fi
    
    log "ERROR" "Local replication failed: $object_key to $region"
    return 1
}

# Replicate to Azure
replicate_to_azure() {
    local source="$1"
    local region="$2"
    
    if [[ ! "$ENABLE_AZURE" == "true" ]]; then
        return 0
    fi
    
    local container_name="${AZURE_CONTAINER_PREFIX}-${region}"
    local blob_name="backups/$(basename "$source")"
    
    if [[ "$source" == s3://* ]]; then
        # Download from S3 first, then upload to Azure
        local temp_file="/tmp/azure_transfer_$$"
        
        if aws s3 cp "$source" "$temp_file"; then
            if az storage blob upload \
                --account-name "$AZURE_STORAGE_ACCOUNT" \
                --container-name "$container_name" \
                --name "$blob_name" \
                --file "$temp_file" \
                --tier Cool; then
                
                log "SUCCESS" "Azure replication completed: $blob_name"
            else
                log "ERROR" "Azure replication failed: $blob_name"
            fi
            
            rm -f "$temp_file"
        fi
    else
        # Direct upload from local file
        if az storage blob upload \
            --account-name "$AZURE_STORAGE_ACCOUNT" \
            --container-name "$container_name" \
            --name "$blob_name" \
            --file "$source" \
            --tier Cool; then
            
            log "SUCCESS" "Azure replication completed: $blob_name"
        else
            log "ERROR" "Azure replication failed: $blob_name"
        fi
    fi
}

# Replicate to GCP
replicate_to_gcp() {
    local source="$1"
    local region="$2"
    
    if [[ ! "$ENABLE_GCP" == "true" ]]; then
        return 0
    fi
    
    local bucket_name="${GCP_BUCKET_PREFIX}-${region}"
    local object_name="backups/$(basename "$source")"
    
    if [[ "$source" == s3://* ]]; then
        # Use gsutil to copy from S3 to GCS
        if gsutil -m cp "$source" "gs://$bucket_name/$object_name"; then
            log "SUCCESS" "GCP replication completed: $object_name"
        else
            log "ERROR" "GCP replication failed: $object_name"
        fi
    else
        # Direct upload from local file
        if gsutil cp "$source" "gs://$bucket_name/$object_name"; then
            log "SUCCESS" "GCP replication completed: $object_name"
        else
            log "ERROR" "GCP replication failed: $object_name"
        fi
    fi
}

# Verify cross-region replication consistency
verify_replication_consistency() {
    log "REPLICATION" "Verifying cross-region replication consistency..."
    
    local consistency_errors=()
    
    # Get list of objects in primary bucket
    local primary_objects=()
    while IFS= read -r object; do
        primary_objects+=("$object")
    done < <(aws s3 ls "s3://$PRIMARY_BUCKET/backups/" --recursive | awk '{print $4}')
    
    # Check each replication region
    for region in "${!REPLICATION_TARGETS[@]}"; do
        local bucket="${REPLICATION_TARGETS[$region]}"
        local region_objects=()
        
        while IFS= read -r object; do
            region_objects+=("$object")
        done < <(aws s3 ls "s3://$bucket/backups/" --region "$region" --recursive | awk '{print $4}')
        
        log "INFO" "Checking consistency for region $region (${#region_objects[@]} objects)"
        
        # Check for missing objects
        for primary_obj in "${primary_objects[@]}"; do
            local found=false
            for region_obj in "${region_objects[@]}"; do
                if [[ "$primary_obj" == "$region_obj" ]]; then
                    found=true
                    break
                fi
            done
            
            if [[ "$found" == false ]]; then
                consistency_errors+=("Missing in $region: $primary_obj")
            fi
        done
        
        # Verify checksums for recent objects (last 24 hours)
        local recent_objects=()
        while IFS= read -r object; do
            recent_objects+=("$object")
        done < <(aws s3 ls "s3://$PRIMARY_BUCKET/backups/" --recursive | grep "$(date +%Y%m%d)" | awk '{print $4}')
        
        for obj in "${recent_objects[@]}"; do
            if verify_object_checksum "$PRIMARY_BUCKET" "$bucket" "$obj" "$region"; then
                log "INFO" "Checksum verified: $obj in $region"
            else
                consistency_errors+=("Checksum mismatch in $region: $obj")
            fi
        done
    done
    
    if [[ ${#consistency_errors[@]} -gt 0 ]]; then
        log "ERROR" "Consistency check failed with ${#consistency_errors[@]} errors:"
        for error in "${consistency_errors[@]}"; do
            log "ERROR" "  - $error"
        done
        return 1
    else
        log "SUCCESS" "Cross-region consistency verification passed"
        return 0
    fi
}

# Verify object checksum between regions
verify_object_checksum() {
    local primary_bucket="$1"
    local replica_bucket="$2"
    local object_key="$3"
    local region="$4"
    
    # Get ETags (which are MD5 checksums for single-part uploads)
    local primary_etag
    local replica_etag
    
    primary_etag=$(aws s3api head-object --bucket "$primary_bucket" --key "$object_key" --query 'ETag' --output text 2>/dev/null || echo "")
    replica_etag=$(aws s3api head-object --bucket "$replica_bucket" --key "$object_key" --region "$region" --query 'ETag' --output text 2>/dev/null || echo "")
    
    if [[ -n "$primary_etag" && -n "$replica_etag" && "$primary_etag" == "$replica_etag" ]]; then
        return 0
    else
        return 1
    fi
}

# Generate replication report
generate_replication_report() {
    local replication_status="$1"
    local total_duration="$2"
    
    local report_file="${BACKUP_DIR}/replication_report_$(date +%Y%m%d_%H%M%S).json"
    
    # Process replication metrics
    local metrics_json="[]"
    if [[ ${#REPLICATION_METRICS[@]} -gt 0 ]]; then
        local metrics_array=()
        
        for metric in "${REPLICATION_METRICS[@]}"; do
            IFS=':' read -r region duration size status <<< "$metric"
            metrics_array+=("{\"region\": \"$region\", \"duration\": $duration, \"size\": $size, \"status\": \"$status\"}")
        done
        
        metrics_json="[$(IFS=','; echo "${metrics_array[*]}")]"
    fi
    
    cat > "$report_file" << EOF
{
    "replication_report": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "status": "$replication_status",
        "duration_seconds": $total_duration,
        "primary_region": "$PRIMARY_REGION",
        "replication_mode": "$REPLICATION_MODE",
        "statistics": {
            "total_regions": $TOTAL_REGIONS,
            "successful_replications": $SUCCESSFUL_REPLICATIONS,
            "failed_replications": $FAILED_REPLICATIONS,
            "total_transferred_bytes": $TOTAL_TRANSFERRED,
            "total_transferred_human": "$(numfmt --to=iec $TOTAL_TRANSFERRED)",
            "average_throughput_mbps": $(awk "BEGIN {printf \"%.2f\", $TOTAL_TRANSFERRED / 1024 / 1024 / $total_duration}" 2>/dev/null || echo "0")
        },
        "replication_targets": {
EOF
    
    # Add replication targets
    local first=true
    for region in "${!REPLICATION_TARGETS[@]}"; do
        if [[ "$first" == true ]]; then
            first=false
        else
            echo "," >> "$report_file"
        fi
        
        echo -n "            \"$region\": \"${REPLICATION_TARGETS[$region]}\"" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

        },
        "regional_metrics": $metrics_json,
        "multi_cloud": {
            "azure_enabled": $ENABLE_AZURE,
            "gcp_enabled": $ENABLE_GCP
        },
        "configuration": {
            "compression_enabled": $COMPRESSION_ENABLED,
            "encryption_in_transit": $ENCRYPTION_IN_TRANSIT,
            "delta_sync": $DELTA_SYNC,
            "parallel_transfers": $PARALLEL_TRANSFERS,
            "consistency_verification": $CROSS_REGION_VERIFICATION
        }
    }
}
EOF
    
    log "SUCCESS" "Replication report generated: $report_file"
    
    # Copy report to backup directory
    cp "$report_file" "${BACKUP_DIR}/latest_replication_report.json"
}

# Cleanup old replicated backups
cleanup_old_replicated_backups() {
    log "REPLICATION" "Cleaning up old replicated backups..."
    
    local retention_days
    case "$RETENTION_POLICY" in
        *d) retention_days=${RETENTION_POLICY%d} ;;
        *) retention_days=30 ;;
    esac
    
    local cutoff_date=$(date -d "$retention_days days ago" +%Y-%m-%d 2>/dev/null || \
                       date -v-${retention_days}d +%Y-%m-%d 2>/dev/null)
    
    # Cleanup AWS S3 replicas
    for region in "${!REPLICATION_TARGETS[@]}"; do
        local bucket="${REPLICATION_TARGETS[$region]}"
        
        log "INFO" "Cleaning up old backups in $region ($bucket)..."
        
        aws s3api list-objects-v2 \
            --bucket "$bucket" \
            --region "$region" \
            --prefix "backups/" \
            --query "Contents[?LastModified<='$cutoff_date'].Key" \
            --output text | \
        while read -r key; do
            if [[ -n "$key" && "$key" != "None" ]]; then
                aws s3 rm "s3://${bucket}/${key}" --region "$region"
                log "INFO" "Deleted old backup: $key from $region"
            fi
        done
    done
    
    # Cleanup Azure replicas
    if [[ "$ENABLE_AZURE" == "true" ]]; then
        cleanup_azure_old_backups "$retention_days"
    fi
    
    # Cleanup GCP replicas
    if [[ "$ENABLE_GCP" == "true" ]]; then
        cleanup_gcp_old_backups "$retention_days"
    fi
    
    log "SUCCESS" "Old backup cleanup completed"
}

# Cleanup old Azure backups
cleanup_azure_old_backups() {
    local retention_days="$1"
    local cutoff_date=$(date -d "$retention_days days ago" +%Y-%m-%d 2>/dev/null || \
                       date -v-${retention_days}d +%Y-%m-%d 2>/dev/null)
    
    local azure_regions=("eastus2" "westeurope" "southeastasia")
    
    for region in "${azure_regions[@]}"; do
        local container_name="${AZURE_CONTAINER_PREFIX}-${region}"
        
        az storage blob list \
            --account-name "$AZURE_STORAGE_ACCOUNT" \
            --container-name "$container_name" \
            --prefix "backups/" \
            --query "[?properties.lastModified<='$cutoff_date'].name" \
            --output tsv | \
        while read -r blob_name; do
            if [[ -n "$blob_name" ]]; then
                az storage blob delete \
                    --account-name "$AZURE_STORAGE_ACCOUNT" \
                    --container-name "$container_name" \
                    --name "$blob_name"
                log "INFO" "Deleted old Azure backup: $blob_name from $region"
            fi
        done
    done
}

# Cleanup old GCP backups
cleanup_gcp_old_backups() {
    local retention_days="$1"
    local cutoff_date=$(date -d "$retention_days days ago" +%Y-%m-%d 2>/dev/null || \
                       date -v-${retention_days}d +%Y-%m-%d 2>/dev/null)
    
    local gcp_regions=("us-central1" "europe-west1" "asia-southeast1")
    
    for region in "${gcp_regions[@]}"; do
        local bucket_name="${GCP_BUCKET_PREFIX}-${region}"
        
        gsutil ls -l "gs://${bucket_name}/backups/**" | \
        awk -v cutoff="$cutoff_date" '$2 < cutoff {print $3}' | \
        while read -r object_path; do
            if [[ -n "$object_path" ]]; then
                gsutil rm "$object_path"
                log "INFO" "Deleted old GCP backup: $object_path from $region"
            fi
        done
    done
}

# Get file size
get_file_size() {
    local file="$1"
    
    if [[ "$file" == s3://* ]]; then
        aws s3api head-object --bucket "${file#s3://*/}" --key "${file##*/}" --query 'ContentLength' --output text 2>/dev/null || echo "0"
    else
        stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo "0"
    fi
}

# Main replication orchestration
main() {
    REPLICATION_START_TIME=$(date +%s)
    
    log "REPLICATION" "=== CROSS-REGION BACKUP REPLICATION STARTED ==="
    log "REPLICATION" "Mode: $REPLICATION_MODE | Primary Region: $PRIMARY_REGION"
    
    send_replication_notification "STARTED" "Cross-region backup replication initiated"
    
    # Validate prerequisites
    if ! validate_replication_prerequisites; then
        log "ERROR" "Replication prerequisites validation failed"
        send_replication_notification "FAILED" "Prerequisites validation failed" "critical"
        exit 1
    fi
    
    # Setup infrastructure if needed
    if ! setup_replication_infrastructure; then
        log "ERROR" "Failed to setup replication infrastructure"
        send_replication_notification "FAILED" "Infrastructure setup failed" "error"
        exit 1
    fi
    
    # Discover backups to replicate
    local backups_to_replicate=()
    while IFS= read -r backup; do
        [[ -n "$backup" ]] && backups_to_replicate+=("$backup")
    done < <(discover_backups_for_replication)
    
    if [[ ${#backups_to_replicate[@]} -eq 0 ]]; then
        log "WARN" "No backups found for replication"
        send_replication_notification "WARNING" "No backups found for replication" "warning"
        exit 0
    fi
    
    log "INFO" "Found ${#backups_to_replicate[@]} backups for replication"
    
    # Initialize counters
    TOTAL_REGIONS=${#REPLICATION_TARGETS[@]}
    
    # Replicate to each region
    for backup in "${backups_to_replicate[@]}"; do
        log "INFO" "Replicating backup: $(basename "$backup")"
        
        # Replicate in parallel if enabled
        if [[ "$PARALLEL_TRANSFERS" -gt 1 ]]; then
            local pids=()
            
            for region in "${!REPLICATION_TARGETS[@]}"; do
                (
                    replicate_to_region "$backup" "$region"
                ) &
                
                pids+=($!)
                
                # Limit concurrent transfers
                if [[ ${#pids[@]} -ge $PARALLEL_TRANSFERS ]]; then
                    wait "${pids[0]}"
                    pids=("${pids[@]:1}")
                fi
            done
            
            # Wait for remaining transfers
            for pid in "${pids[@]}"; do
                wait "$pid"
            done
        else
            # Sequential replication
            for region in "${!REPLICATION_TARGETS[@]}"; do
                replicate_to_region "$backup" "$region"
            done
        fi
    done
    
    # Verify replication consistency if enabled
    if [[ "$CROSS_REGION_VERIFICATION" == "true" ]]; then
        if ! verify_replication_consistency; then
            log "ERROR" "Replication consistency verification failed"
        fi
    fi
    
    # Cleanup old backups
    cleanup_old_replicated_backups
    
    # Calculate final statistics
    local replication_end_time=$(date +%s)
    local total_duration=$((replication_end_time - REPLICATION_START_TIME))
    local success_rate=0
    
    if [[ $TOTAL_REGIONS -gt 0 ]]; then
        success_rate=$(awk "BEGIN {printf \"%.1f\", $SUCCESSFUL_REPLICATIONS / ($TOTAL_REGIONS * ${#backups_to_replicate[@]}) * 100}")
    fi
    
    # Determine final status
    local final_status="SUCCESS"
    local notification_severity="info"
    
    if [[ $FAILED_REPLICATIONS -gt 0 ]]; then
        if [[ $FAILED_REPLICATIONS -gt $SUCCESSFUL_REPLICATIONS ]]; then
            final_status="FAILED"
            notification_severity="critical"
        else
            final_status="PARTIAL"
            notification_severity="warning"
        fi
    fi
    
    # Generate report
    generate_replication_report "$final_status" "$total_duration"
    
    # Final notification
    local transfer_stats="$(numfmt --to=iec $TOTAL_TRANSFERRED)"
    
    log "REPLICATION" "=== CROSS-REGION REPLICATION COMPLETED ==="
    log "REPLICATION" "Status: $final_status | Duration: ${total_duration}s | Success Rate: ${success_rate}%"
    log "REPLICATION" "Transferred: $transfer_stats across $SUCCESSFUL_REPLICATIONS/$((TOTAL_REGIONS * ${#backups_to_replicate[@]})) operations"
    
    send_replication_notification "$final_status" \
        "Cross-region replication completed. Success rate: ${success_rate}% (${SUCCESSFUL_REPLICATIONS}/$((TOTAL_REGIONS * ${#backups_to_replicate[@]})) operations)" \
        "$notification_severity" \
        "$transfer_stats"
    
    # Exit with appropriate code
    case "$final_status" in
        "SUCCESS") exit 0 ;;
        "PARTIAL") exit 2 ;;
        *) exit 1 ;;
    esac
}

# Handle script arguments
case "${1:-main}" in
    "main")
        main
        ;;
    "setup")
        validate_replication_prerequisites && setup_replication_infrastructure
        ;;
    "verify")
        verify_replication_consistency
        ;;
    "cleanup")
        cleanup_old_replicated_backups
        ;;
    "status")
        # Show replication status
        echo "Cross-Region Replication Status:"
        echo "Primary Region: $PRIMARY_REGION"
        echo "Replication Targets: ${!REPLICATION_TARGETS[*]}"
        echo "Mode: $REPLICATION_MODE"
        ;;
    "help")
        cat << EOF
Usage: $0 [COMMAND]

Commands:
  main       - Run cross-region replication (default)
  setup      - Setup replication infrastructure
  verify     - Verify replication consistency
  cleanup    - Cleanup old replicated backups
  status     - Show replication status
  help       - Show this help

Environment Variables:
  PRIMARY_REGION - Primary AWS region
  REPLICATION_MODE - async, sync, scheduled
  ENABLE_AZURE - Enable Azure multi-cloud replication
  ENABLE_GCP - Enable GCP multi-cloud replication
  COMPRESSION_ENABLED - Enable compression during transfer
  PARALLEL_TRANSFERS - Number of parallel transfer operations
  CROSS_REGION_VERIFICATION - Enable consistency verification
EOF
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac