#!/bin/bash
# Module Publishing Script
# Publishes Terraform modules to registry with versioning and validation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MODULES_DIR="${PROJECT_ROOT}/modules"
PATTERNS_DIR="${PROJECT_ROOT}/patterns"
REGISTRY_BASE_URL="${REGISTRY_BASE_URL:-}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-}"
DRY_RUN="${DRY_RUN:-false}"
FORCE_PUBLISH="${FORCE_PUBLISH:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Module Publishing Script

Usage: $0 [OPTIONS] [MODULE_PATH]

OPTIONS:
    -h, --help              Show this help message
    -d, --dry-run          Perform a dry run without publishing
    -f, --force            Force publish even if validation fails
    -v, --version VERSION  Specify version to publish
    -r, --registry URL     Registry base URL
    -t, --token TOKEN      Registry authentication token
    --validate-only        Only validate, don't publish
    --list-modules         List all available modules

EXAMPLES:
    $0 modules/networking/vpc               # Publish VPC module
    $0 --dry-run modules/compute/ecs       # Dry run ECS module
    $0 --version 1.2.3 modules/database/rds # Publish specific version
    $0 --list-modules                      # List all modules

ENVIRONMENT VARIABLES:
    REGISTRY_BASE_URL      Base URL for module registry
    REGISTRY_TOKEN         Authentication token for registry
    DRY_RUN               Set to 'true' for dry run mode
    FORCE_PUBLISH         Set to 'true' to force publish
EOF
}

# Parse command line arguments
parse_args() {
    local module_path=""
    local version=""
    local validate_only=false
    local list_modules=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE_PUBLISH=true
                shift
                ;;
            -v|--version)
                version="$2"
                shift 2
                ;;
            -r|--registry)
                REGISTRY_BASE_URL="$2"
                shift 2
                ;;
            -t|--token)
                REGISTRY_TOKEN="$2"
                shift 2
                ;;
            --validate-only)
                validate_only=true
                shift
                ;;
            --list-modules)
                list_modules=true
                shift
                ;;
            *)
                if [[ -z "$module_path" ]]; then
                    module_path="$1"
                else
                    log_error "Unknown argument: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    if [[ "$list_modules" == "true" ]]; then
        list_all_modules
        exit 0
    fi
    
    if [[ "$validate_only" == "true" ]]; then
        validate_module "$module_path"
        exit $?
    fi
    
    if [[ -z "$module_path" ]]; then
        log_error "Module path is required"
        show_help
        exit 1
    fi
    
    publish_module "$module_path" "$version"
}

# List all available modules
list_all_modules() {
    log_info "Available modules:"
    echo
    
    find "$MODULES_DIR" -name "main.tf" -type f | while read -r tf_file; do
        local module_dir
        module_dir="$(dirname "$tf_file")"
        local relative_path
        relative_path="$(realpath --relative-to="$PROJECT_ROOT" "$module_dir")"
        
        local version
        version=$(get_module_version "$module_dir")
        
        local description
        description=$(get_module_description "$module_dir")
        
        printf "  %-40s %-10s %s\n" "$relative_path" "$version" "$description"
    done
    
    echo
    log_info "Available patterns:"
    echo
    
    find "$PATTERNS_DIR" -name "main.tf" -type f | while read -r tf_file; do
        local pattern_dir
        pattern_dir="$(dirname "$tf_file")"
        local relative_path
        relative_path="$(realpath --relative-to="$PROJECT_ROOT" "$pattern_dir")"
        
        local version
        version=$(get_module_version "$pattern_dir")
        
        local description
        description=$(get_module_description "$pattern_dir")
        
        printf "  %-40s %-10s %s\n" "$relative_path" "$version" "$description"
    done
}

# Get module version from various sources
get_module_version() {
    local module_dir="$1"
    
    # Try version.tf file
    if [[ -f "$module_dir/version.tf" ]]; then
        grep -E '^\s*version\s*=' "$module_dir/version.tf" | sed 's/.*=\s*"\([^"]*\)".*/\1/' | head -n1
        return
    fi
    
    # Try variables.tf for version variable
    if [[ -f "$module_dir/variables.tf" ]]; then
        local version
        version=$(grep -A5 'variable "version"' "$module_dir/variables.tf" | grep 'default\s*=' | sed 's/.*=\s*"\([^"]*\)".*/\1/')
        if [[ -n "$version" ]]; then
            echo "$version"
            return
        fi
    fi
    
    # Try git tags
    local git_version
    git_version=$(cd "$module_dir" && git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "")
    if [[ -n "$git_version" ]]; then
        echo "$git_version"
        return
    fi
    
    # Default version
    echo "0.1.0"
}

# Get module description
get_module_description() {
    local module_dir="$1"
    
    # Try README.md
    if [[ -f "$module_dir/README.md" ]]; then
        grep -E '^#[^#]' "$module_dir/README.md" | head -n1 | sed 's/^#\s*//' || echo "No description"
        return
    fi
    
    # Try main.tf comment
    if [[ -f "$module_dir/main.tf" ]]; then
        grep -E '^#' "$module_dir/main.tf" | head -n1 | sed 's/^#\s*//' || echo "No description"
        return
    fi
    
    echo "No description"
}

# Validate module structure and configuration
validate_module() {
    local module_path="$1"
    local full_path="$PROJECT_ROOT/$module_path"
    
    log_info "Validating module: $module_path"
    
    # Check if module directory exists
    if [[ ! -d "$full_path" ]]; then
        log_error "Module directory does not exist: $full_path"
        return 1
    fi
    
    # Check required files
    local required_files=("main.tf" "variables.tf" "outputs.tf")
    local missing_files=()
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$full_path/$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        log_error "Missing required files: ${missing_files[*]}"
        return 1
    fi
    
    # Validate Terraform syntax
    log_info "Validating Terraform syntax..."
    if ! (cd "$full_path" && terraform fmt -check); then
        log_error "Terraform formatting check failed"
        if [[ "$FORCE_PUBLISH" != "true" ]]; then
            return 1
        fi
        log_warning "Continuing due to --force flag"
    fi
    
    # Initialize and validate
    if ! (cd "$full_path" && terraform init -backend=false); then
        log_error "Terraform init failed"
        return 1
    fi
    
    if ! (cd "$full_path" && terraform validate); then
        log_error "Terraform validation failed"
        return 1
    fi
    
    # Check for README.md
    if [[ ! -f "$full_path/README.md" ]]; then
        log_warning "README.md not found - documentation should be provided"
        if [[ "$FORCE_PUBLISH" != "true" ]]; then
            return 1
        fi
    fi
    
    # Run security checks
    log_info "Running security checks..."
    if command -v checkov >/dev/null 2>&1; then
        if ! checkov --directory "$full_path" --framework terraform --quiet; then
            log_warning "Security issues found"
            if [[ "$FORCE_PUBLISH" != "true" ]]; then
                return 1
            fi
        fi
    else
        log_warning "Checkov not installed - skipping security checks"
    fi
    
    # Run tflint if available
    if command -v tflint >/dev/null 2>&1; then
        log_info "Running TFLint..."
        if ! (cd "$full_path" && tflint --init && tflint); then
            log_warning "TFLint issues found"
            if [[ "$FORCE_PUBLISH" != "true" ]]; then
                return 1
            fi
        fi
    else
        log_warning "TFLint not installed - skipping lint checks"
    fi
    
    log_success "Module validation passed"
    return 0
}

# Generate module metadata
generate_metadata() {
    local module_path="$1"
    local version="$2"
    local full_path="$PROJECT_ROOT/$module_path"
    
    local metadata_file="$full_path/.terraform-module-metadata.json"
    
    local description
    description=$(get_module_description "$full_path")
    
    local author
    author=$(git config user.name || echo "Unknown")
    
    local email
    email=$(git config user.email || echo "unknown@example.com")
    
    local repo_url
    repo_url=$(git remote get-url origin 2>/dev/null || echo "")
    
    local commit_hash
    commit_hash=$(git rev-parse HEAD 2>/dev/null || echo "")
    
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "$metadata_file" << EOF
{
  "name": "$(basename "$module_path")",
  "namespace": "$(dirname "$module_path" | sed 's|/|-|g')",
  "version": "$version",
  "description": "$description",
  "source": "$repo_url",
  "published_at": "$timestamp",
  "author": {
    "name": "$author",
    "email": "$email"
  },
  "build": {
    "commit": "$commit_hash",
    "branch": "$(git branch --show-current 2>/dev/null || echo "unknown")"
  },
  "terraform": {
    "minimum_version": "1.0",
    "providers": $(extract_providers "$full_path")
  },
  "examples": $(find_examples "$full_path"),
  "dependencies": $(extract_dependencies "$full_path")
}
EOF
    
    log_info "Generated metadata: $metadata_file"
}

# Extract Terraform providers from module
extract_providers() {
    local module_dir="$1"
    
    if [[ -f "$module_dir/versions.tf" ]]; then
        grep -A20 'required_providers' "$module_dir/versions.tf" | \
        awk '/required_providers/,/}/' | \
        grep -E '^\s*\w+\s*=' | \
        sed 's/^\s*//' | \
        jq -Rs 'split("\n") | map(select(. != "")) | map(split(" = ")[0]) | .[0:-1]' 2>/dev/null || echo "[]"
    else
        echo "[]"
    fi
}

# Find example directories
find_examples() {
    local module_dir="$1"
    local examples_dir="$module_dir/examples"
    
    if [[ -d "$examples_dir" ]]; then
        find "$examples_dir" -name "*.tf" -type f | \
        xargs dirname | sort -u | \
        sed "s|$examples_dir/||" | \
        jq -Rs 'split("\n") | map(select(. != ""))' 2>/dev/null || echo "[]"
    else
        echo "[]"
    fi
}

# Extract module dependencies
extract_dependencies() {
    local module_dir="$1"
    
    grep -r "source\s*=" "$module_dir"/*.tf 2>/dev/null | \
    grep -E '\.\./\.\./modules/' | \
    sed 's/.*source\s*=\s*"\([^"]*\)".*/\1/' | \
    sort -u | \
    jq -Rs 'split("\n") | map(select(. != ""))' 2>/dev/null || echo "[]"
}

# Create module package
create_package() {
    local module_path="$1"
    local version="$2"
    local full_path="$PROJECT_ROOT/$module_path"
    
    local package_name
    package_name="$(echo "$module_path" | sed 's|/|-|g')-${version}.tar.gz"
    local package_path="$PROJECT_ROOT/dist/$package_name"
    
    log_info "Creating package: $package_name"
    
    # Create dist directory
    mkdir -p "$PROJECT_ROOT/dist"
    
    # Create temporary directory for packaging
    local temp_dir
    temp_dir=$(mktemp -d)
    local module_temp="$temp_dir/$(basename "$module_path")"
    
    # Copy module files
    cp -r "$full_path" "$module_temp"
    
    # Remove temporary and cache files
    find "$module_temp" -name ".terraform" -type d -exec rm -rf {} + 2>/dev/null || true
    find "$module_temp" -name "*.tfstate*" -type f -delete 2>/dev/null || true
    find "$module_temp" -name ".terraform.lock.hcl" -type f -delete 2>/dev/null || true
    
    # Create package
    (cd "$temp_dir" && tar -czf "$package_path" "$(basename "$module_path")")
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_success "Package created: $package_path"
    echo "$package_path"
}

# Publish to registry
publish_to_registry() {
    local module_path="$1"
    local version="$2"
    local package_path="$3"
    
    if [[ -z "$REGISTRY_BASE_URL" ]] || [[ -z "$REGISTRY_TOKEN" ]]; then
        log_error "Registry URL and token are required for publishing"
        return 1
    fi
    
    local module_name
    module_name="$(echo "$module_path" | sed 's|/|-|g')"
    
    local upload_url="$REGISTRY_BASE_URL/modules/$module_name/$version"
    
    log_info "Publishing to registry: $upload_url"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would publish $package_path to $upload_url"
        return 0
    fi
    
    # Upload package
    local response
    response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $REGISTRY_TOKEN" \
        -H "Content-Type: application/octet-stream" \
        -X PUT \
        --data-binary "@$package_path" \
        "$upload_url")
    
    local http_code="${response: -3}"
    local body="${response%???}"
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        log_success "Successfully published $module_name version $version"
        return 0
    else
        log_error "Failed to publish module. HTTP $http_code: $body"
        return 1
    fi
}

# Update registry index
update_registry_index() {
    local module_path="$1"
    local version="$2"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would update registry index"
        return 0
    fi
    
    local module_name
    module_name="$(echo "$module_path" | sed 's|/|-|g')"
    
    local index_url="$REGISTRY_BASE_URL/index"
    
    log_info "Updating registry index..."
    
    local index_payload
    index_payload=$(cat << EOF
{
    "module": "$module_name",
    "version": "$version",
    "published_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "source": "$(git remote get-url origin 2>/dev/null || echo "")"
}
EOF
)
    
    local response
    response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $REGISTRY_TOKEN" \
        -H "Content-Type: application/json" \
        -X POST \
        -d "$index_payload" \
        "$index_url")
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        log_success "Registry index updated"
    else
        log_warning "Failed to update registry index (HTTP $http_code)"
    fi
}

# Main publish function
publish_module() {
    local module_path="$1"
    local version="$2"
    
    log_info "Publishing module: $module_path"
    
    # Get version if not provided
    if [[ -z "$version" ]]; then
        version=$(get_module_version "$PROJECT_ROOT/$module_path")
        log_info "Detected version: $version"
    fi
    
    # Validate module
    if ! validate_module "$module_path"; then
        log_error "Module validation failed"
        return 1
    fi
    
    # Generate metadata
    generate_metadata "$module_path" "$version"
    
    # Create package
    local package_path
    package_path=$(create_package "$module_path" "$version")
    
    # Publish to registry (if configured)
    if [[ -n "$REGISTRY_BASE_URL" ]] && [[ -n "$REGISTRY_TOKEN" ]]; then
        if publish_to_registry "$module_path" "$version" "$package_path"; then
            update_registry_index "$module_path" "$version"
        else
            return 1
        fi
    else
        log_info "No registry configured - package created locally"
    fi
    
    log_success "Module $module_path version $version published successfully"
    
    # Create checksums
    (cd "$(dirname "$package_path")" && sha256sum "$(basename "$package_path")" > "$(basename "$package_path").sha256")
    
    log_success "Checksums created"
    
    return 0
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v terraform >/dev/null 2>&1; then
        missing_deps+=("terraform")
    fi
    
    if ! command -v git >/dev/null 2>&1; then
        missing_deps+=("git")
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        missing_deps+=("jq")
    fi
    
    if ! command -v curl >/dev/null 2>&1; then
        missing_deps+=("curl")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        return 1
    fi
    
    return 0
}

# Main function
main() {
    log_info "Terraform Module Publishing Script"
    
    # Check dependencies
    if ! check_dependencies; then
        exit 1
    fi
    
    # Parse arguments and execute
    parse_args "$@"
}

# Run main function
main "$@"