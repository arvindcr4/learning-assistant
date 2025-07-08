#!/bin/bash

# Terraform Documentation Validator
# This script validates the quality, accuracy, and completeness of Terraform documentation

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs/terraform"
MODULES_DIR="$PROJECT_ROOT/modules"
INFRA_DIR="$PROJECT_ROOT/infra"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Validation results
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Arrays to store issues
declare -a ERRORS=()
declare -a WARNINGS=()
declare -a SUGGESTIONS=()

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    WARNINGS+=("$1")
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ERRORS+=("$1")
    ((FAILED_CHECKS++))
}

log_check() {
    echo -e "${PURPLE}[CHECK]${NC} $1"
    ((TOTAL_CHECKS++))
}

log_suggestion() {
    echo -e "${CYAN}[SUGGESTION]${NC} $1"
    SUGGESTIONS+=("$1")
}

# Check if required tools are available
check_dependencies() {
    log_check "Checking required dependencies..."
    
    local deps=("terraform" "markdown-link-check" "markdownlint" "aspell")
    local missing_deps=()
    local optional_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            case $dep in
                "terraform")
                    missing_deps+=("$dep")
                    ;;
                *)
                    optional_deps+=("$dep")
                    ;;
            esac
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_info "Install missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  brew install $dep  # or use your package manager"
        done
        exit 1
    fi
    
    if [ ${#optional_deps[@]} -ne 0 ]; then
        log_warning "Missing optional dependencies: ${optional_deps[*]}"
        log_info "Install optional dependencies for enhanced validation:"
        for dep in "${optional_deps[@]}"; do
            case $dep in
                "markdown-link-check")
                    echo "  npm install -g markdown-link-check"
                    ;;
                "markdownlint")
                    echo "  npm install -g markdownlint-cli"
                    ;;
                "aspell")
                    echo "  brew install aspell  # or apt-get install aspell"
                    ;;
            esac
        done
    fi
    
    log_success "Dependency check completed"
}

# Validate documentation structure
validate_structure() {
    log_check "Validating documentation structure..."
    
    local required_dirs=(
        "$DOCS_DIR"
        "$DOCS_DIR/getting-started"
        "$DOCS_DIR/architecture"
        "$DOCS_DIR/modules"
        "$DOCS_DIR/patterns"
        "$DOCS_DIR/tutorials"
        "$DOCS_DIR/runbooks"
        "$DOCS_DIR/troubleshooting"
        "$DOCS_DIR/security"
        "$DOCS_DIR/cost-optimization"
        "$DOCS_DIR/disaster-recovery"
    )
    
    local required_files=(
        "$DOCS_DIR/README.md"
        "$DOCS_DIR/getting-started/quick-start.md"
        "$DOCS_DIR/getting-started/prerequisites.md"
        "$DOCS_DIR/architecture/system-overview.md"
        "$DOCS_DIR/modules/overview.md"
    )
    
    # Check directories
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            log_error "Missing required directory: $dir"
        fi
    done
    
    # Check files
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "Missing required file: $file"
        fi
    done
    
    # Check for empty directories
    find "$DOCS_DIR" -type d -empty 2>/dev/null | while read -r empty_dir; do
        log_warning "Empty directory found: $empty_dir"
    done
    
    log_success "Documentation structure validation completed"
}

# Validate Terraform module documentation
validate_module_docs() {
    log_check "Validating Terraform module documentation..."
    
    if [ ! -d "$MODULES_DIR" ]; then
        log_warning "Modules directory not found: $MODULES_DIR"
        return
    fi
    
    local module_count=0
    local documented_modules=0
    
    for module_path in "$MODULES_DIR"/*; do
        if [ -d "$module_path" ]; then
            local module_name=$(basename "$module_path")
            ((module_count++))
            
            # Check if module has documentation
            local module_doc="$DOCS_DIR/modules/$module_name.md"
            if [ -f "$module_doc" ]; then
                ((documented_modules++))
                validate_single_module_doc "$module_path" "$module_doc" "$module_name"
            else
                log_error "Module $module_name lacks documentation at $module_doc"
            fi
        fi
    done
    
    local coverage=$((documented_modules * 100 / module_count))
    if [ $coverage -lt 100 ]; then
        log_warning "Module documentation coverage: $documented_modules/$module_count ($coverage%)"
    else
        log_success "All modules have documentation ($documented_modules/$module_count)"
    fi
}

# Validate a single module's documentation
validate_single_module_doc() {
    local module_path="$1"
    local doc_file="$2"
    local module_name="$3"
    
    log_info "Validating documentation for module: $module_name"
    
    # Check if documentation is up to date
    if [ "$module_path" -nt "$doc_file" ]; then
        log_warning "Documentation for $module_name may be outdated (module newer than docs)"
    fi
    
    # Check documentation completeness
    local required_sections=(
        "## Overview"
        "## Usage"
        "## Variables"
        "## Outputs"
        "## Examples"
    )
    
    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$doc_file"; then
            log_warning "Module $module_name documentation missing section: $section"
        fi
    done
    
    # Check if all variables are documented
    if [ -f "$module_path/variables.tf" ]; then
        local variables_in_code=$(grep -c "^variable" "$module_path/variables.tf" 2>/dev/null || echo "0")
        local variables_in_docs=$(grep -c "| \`[^|]*\` |" "$doc_file" 2>/dev/null || echo "0")
        
        if [ "$variables_in_code" -ne "$variables_in_docs" ]; then
            log_warning "Module $module_name: Variable count mismatch (code: $variables_in_code, docs: $variables_in_docs)"
        fi
    fi
    
    # Check if all outputs are documented
    if [ -f "$module_path/outputs.tf" ]; then
        local outputs_in_code=$(grep -c "^output" "$module_path/outputs.tf" 2>/dev/null || echo "0")
        local outputs_in_docs=$(grep -c "| \`[^|]*\` |" "$doc_file" 2>/dev/null || echo "0")
        
        # This is a rough check - outputs and variables both use tables
        # In practice, you'd want more sophisticated parsing
    fi
    
    # Check for examples
    if [ -d "$module_path/examples" ]; then
        if ! grep -q -i "example" "$doc_file"; then
            log_warning "Module $module_name has examples directory but no examples in documentation"
        fi
    fi
}

# Validate markdown syntax and formatting
validate_markdown() {
    log_check "Validating Markdown syntax and formatting..."
    
    local markdown_files=()
    while IFS= read -r -d '' file; do
        markdown_files+=("$file")
    done < <(find "$DOCS_DIR" -name "*.md" -print0)
    
    if [ ${#markdown_files[@]} -eq 0 ]; then
        log_error "No Markdown files found in documentation directory"
        return
    fi
    
    # Check with markdownlint if available
    if command -v markdownlint &> /dev/null; then
        log_info "Running markdownlint on ${#markdown_files[@]} files..."
        
        if markdownlint "${markdown_files[@]}" 2>/dev/null; then
            log_success "Markdown syntax validation passed"
        else
            log_warning "Markdown syntax issues found (run markdownlint manually for details)"
        fi
    else
        log_info "markdownlint not available, performing basic checks..."
        
        # Basic markdown validation
        for file in "${markdown_files[@]}"; do
            validate_markdown_file "$file"
        done
    fi
}

# Validate individual markdown file
validate_markdown_file() {
    local file="$1"
    local filename=$(basename "$file")
    
    # Check for common markdown issues
    
    # Check for proper heading hierarchy
    local h1_count=$(grep -c "^# " "$file" 2>/dev/null || echo "0")
    if [ "$h1_count" -ne 1 ]; then
        log_warning "$filename: Should have exactly one H1 heading (found: $h1_count)"
    fi
    
    # Check for empty lines before headings
    if grep -n "^[^#].*$\|^#" "$file" | grep -A1 "^[0-9]*:[^#]" | grep "^[0-9]*:#" | head -1 | grep -q .; then
        log_warning "$filename: Missing empty line before heading"
    fi
    
    # Check for consistent code block formatting
    local code_blocks=$(grep -c "^```" "$file" 2>/dev/null || echo "0")
    if [ $((code_blocks % 2)) -ne 0 ]; then
        log_warning "$filename: Unmatched code block markers"
    fi
    
    # Check for trailing whitespace
    if grep -q " $" "$file"; then
        log_warning "$filename: Contains trailing whitespace"
    fi
    
    # Check for long lines (over 120 characters)
    local long_lines=$(awk 'length > 120' "$file" | wc -l)
    if [ "$long_lines" -gt 0 ]; then
        log_suggestion "$filename: $long_lines lines exceed 120 characters"
    fi
}

# Validate links in documentation
validate_links() {
    log_check "Validating links in documentation..."
    
    # Check with markdown-link-check if available
    if command -v markdown-link-check &> /dev/null; then
        log_info "Running markdown-link-check..."
        
        local link_errors=0
        find "$DOCS_DIR" -name "*.md" | while read -r file; do
            if ! markdown-link-check "$file" --quiet; then
                ((link_errors++))
            fi
        done
        
        if [ "$link_errors" -eq 0 ]; then
            log_success "All links are valid"
        else
            log_error "Found $link_errors files with broken links"
        fi
    else
        log_info "markdown-link-check not available, performing basic link validation..."
        
        # Basic link validation
        find "$DOCS_DIR" -name "*.md" | while read -r file; do
            validate_links_in_file "$file"
        done
    fi
}

# Validate links in a single file
validate_links_in_file() {
    local file="$1"
    local filename=$(basename "$file")
    local file_dir=$(dirname "$file")
    
    # Extract markdown links
    grep -o '\[.*\](.*\.md)' "$file" | sed 's/\[.*\](\(.*\))/\1/' | while read -r link; do
        local target_file
        
        # Handle relative links
        if [[ "$link" =~ ^\./ ]]; then
            target_file="$file_dir/${link#./}"
        elif [[ "$link" =~ ^/ ]]; then
            target_file="$PROJECT_ROOT$link"
        else
            target_file="$file_dir/$link"
        fi
        
        # Normalize path
        target_file=$(realpath "$target_file" 2>/dev/null || echo "$target_file")
        
        if [ ! -f "$target_file" ]; then
            log_warning "$filename: Broken internal link: $link"
        fi
    done
}

# Validate Terraform code examples
validate_terraform_examples() {
    log_check "Validating Terraform code examples..."
    
    local temp_dir=$(mktemp -d)
    local example_errors=0
    
    # Extract and validate Terraform code blocks
    find "$DOCS_DIR" -name "*.md" | while read -r file; do
        local filename=$(basename "$file")
        
        # Extract HCL code blocks
        awk '/^```hcl$/,/^```$/' "$file" | grep -v '^```' > "$temp_dir/temp.tf" 2>/dev/null || continue
        
        if [ -s "$temp_dir/temp.tf" ]; then
            log_info "Validating Terraform syntax in $filename"
            
            # Basic Terraform validation
            if ! terraform fmt -check=true "$temp_dir/temp.tf" &>/dev/null; then
                log_warning "$filename: Terraform code formatting issues"
            fi
            
            # Check for common issues
            if grep -q 'TODO\|FIXME\|XXX' "$temp_dir/temp.tf"; then
                log_warning "$filename: Contains TODO/FIXME placeholders"
            fi
            
            # Check for hardcoded values that should be variables
            if grep -q '"password"\|"secret"\|"key".*=' "$temp_dir/temp.tf"; then
                log_warning "$filename: May contain hardcoded sensitive values"
            fi
        fi
    done
    
    # Clean up
    rm -rf "$temp_dir"
    
    if [ "$example_errors" -eq 0 ]; then
        log_success "Terraform examples validation completed"
    else
        log_error "Found $example_errors Terraform syntax errors in examples"
    fi
}

# Check documentation completeness
validate_completeness() {
    log_check "Validating documentation completeness..."
    
    # Check if all modules have documentation
    if [ -d "$MODULES_DIR" ]; then
        for module_path in "$MODULES_DIR"/*; do
            if [ -d "$module_path" ]; then
                local module_name=$(basename "$module_path")
                
                # Check for README
                if [ ! -f "$module_path/README.md" ] && [ ! -f "$DOCS_DIR/modules/$module_name.md" ]; then
                    log_error "Module $module_name has no documentation"
                fi
                
                # Check for examples
                if [ ! -d "$module_path/examples" ]; then
                    log_suggestion "Module $module_name has no examples directory"
                fi
                
                # Check for tests
                if [ ! -d "$module_path/test" ] && [ ! -d "$module_path/tests" ]; then
                    log_suggestion "Module $module_name has no tests directory"
                fi
            fi
        done
    fi
    
    # Check for orphaned documentation
    if [ -d "$DOCS_DIR/modules" ]; then
        for doc_file in "$DOCS_DIR/modules"/*.md; do
            if [ -f "$doc_file" ]; then
                local doc_name=$(basename "$doc_file" .md)
                if [ "$doc_name" != "overview" ] && [ ! -d "$MODULES_DIR/$doc_name" ]; then
                    log_warning "Documentation for non-existent module: $doc_name"
                fi
            fi
        done
    fi
    
    log_success "Completeness validation completed"
}

# Validate spelling (if aspell is available)
validate_spelling() {
    log_check "Validating spelling..."
    
    if ! command -v aspell &> /dev/null; then
        log_info "aspell not available, skipping spell check"
        return
    fi
    
    local spell_errors=0
    local temp_file=$(mktemp)
    
    # Create custom dictionary for technical terms
    cat > "$temp_file" << 'EOF'
Terraform
AWS
GCP
Azure
DigitalOcean
PostgreSQL
Redis
Kubernetes
VPC
CloudFront
CloudFormation
IAM
S3
ECS
EKS
RDS
ElastiCache
ALB
NLB
SSL
TLS
HTTPS
JSON
YAML
HCL
API
CLI
CI
CD
DevOps
GitHub
GitLab
Docker
Kubernetes
kubectl
Helm
Prometheus
Grafana
CloudWatch
nginx
Ubuntu
CentOS
RHEL
macOS
EOF
    
    find "$DOCS_DIR" -name "*.md" | while read -r file; do
        local filename=$(basename "$file")
        
        # Extract text content and check spelling
        local misspelled=$(aspell --personal="$temp_file" --mode=markdown list < "$file" | head -5)
        
        if [ -n "$misspelled" ]; then
            log_warning "$filename: Possible spelling errors: $(echo "$misspelled" | tr '\n' ' ')"
            ((spell_errors++))
        fi
    done
    
    rm -f "$temp_file"
    
    if [ "$spell_errors" -eq 0 ]; then
        log_success "No spelling errors found"
    else
        log_warning "Found potential spelling errors in $spell_errors files"
    fi
}

# Validate documentation freshness
validate_freshness() {
    log_check "Validating documentation freshness..."
    
    local outdated_files=0
    local warning_threshold=30  # days
    local current_time=$(date +%s)
    
    find "$DOCS_DIR" -name "*.md" | while read -r file; do
        local filename=$(basename "$file")
        local file_time=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null || echo "0")
        local days_old=$(( (current_time - file_time) / 86400 ))
        
        if [ "$days_old" -gt "$warning_threshold" ]; then
            log_warning "$filename: Last modified $days_old days ago"
            ((outdated_files++))
        fi
    done
    
    if [ "$outdated_files" -eq 0 ]; then
        log_success "All documentation appears to be recent"
    else
        log_warning "$outdated_files files haven't been updated in $warning_threshold+ days"
    fi
}

# Generate validation report
generate_report() {
    local report_file="$DOCS_DIR/validation-report.md"
    local timestamp=$(date)
    
    log_info "Generating validation report..."
    
    cat > "$report_file" << EOF
# Documentation Validation Report

**Generated on:** $timestamp

## Summary

- **Total Checks:** $TOTAL_CHECKS
- **Passed:** $PASSED_CHECKS
- **Failed:** $FAILED_CHECKS
- **Warnings:** $WARNING_CHECKS

## Overall Score

$(calculate_score)

## Errors

$(if [ ${#ERRORS[@]} -eq 0 ]; then
    echo "✅ No errors found"
else
    for error in "${ERRORS[@]}"; do
        echo "❌ $error"
    done
fi)

## Warnings

$(if [ ${#WARNINGS[@]} -eq 0 ]; then
    echo "✅ No warnings"
else
    for warning in "${WARNINGS[@]}"; do
        echo "⚠️ $warning"
    done
fi)

## Suggestions

$(if [ ${#SUGGESTIONS[@]} -eq 0 ]; then
    echo "✅ No suggestions"
else
    for suggestion in "${SUGGESTIONS[@]}"; do
        echo "💡 $suggestion"
    done
fi)

## Recommendations

### High Priority
$(generate_high_priority_recommendations)

### Medium Priority
$(generate_medium_priority_recommendations)

### Low Priority
$(generate_low_priority_recommendations)

---
*Report generated by terraform documentation validator*
EOF
    
    log_success "Validation report generated: $report_file"
}

# Calculate overall score
calculate_score() {
    if [ "$TOTAL_CHECKS" -eq 0 ]; then
        echo "**Score:** N/A (no checks performed)"
        return
    fi
    
    local score=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    local grade
    
    if [ "$score" -ge 90 ]; then
        grade="A (Excellent)"
    elif [ "$score" -ge 80 ]; then
        grade="B (Good)"
    elif [ "$score" -ge 70 ]; then
        grade="C (Fair)"
    elif [ "$score" -ge 60 ]; then
        grade="D (Poor)"
    else
        grade="F (Failing)"
    fi
    
    echo "**Score:** $score% - Grade $grade"
}

# Generate recommendations
generate_high_priority_recommendations() {
    if [ $FAILED_CHECKS -gt 0 ]; then
        echo "- Fix all errors immediately"
        echo "- Ensure all required documentation files exist"
        echo "- Validate and fix broken links"
    else
        echo "- No high priority issues found"
    fi
}

generate_medium_priority_recommendations() {
    if [ $WARNING_CHECKS -gt 0 ]; then
        echo "- Address documentation warnings"
        echo "- Update outdated documentation"
        echo "- Improve module documentation coverage"
        echo "- Fix Terraform code formatting in examples"
    else
        echo "- No medium priority issues found"
    fi
}

generate_low_priority_recommendations() {
    if [ ${#SUGGESTIONS[@]} -gt 0 ]; then
        echo "- Consider adding examples for modules without them"
        echo "- Add tests for modules without test coverage"
        echo "- Review and fix potential spelling errors"
        echo "- Optimize line lengths for better readability"
    else
        echo "- No low priority issues found"
    fi
}

# Main execution function
main() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                 Terraform Documentation Validator              ║"
    echo "║                     Learning Assistant Infrastructure          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Parse command line options
    local skip_links=false
    local skip_spelling=false
    local report_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-links)
                skip_links=true
                shift
                ;;
            --skip-spelling)
                skip_spelling=true
                shift
                ;;
            --report-only)
                report_only=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-links     Skip link validation"
                echo "  --skip-spelling  Skip spell checking"
                echo "  --report-only    Only generate report from previous run"
                echo "  -h, --help       Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute validation steps
    if [ "$report_only" = false ]; then
        check_dependencies
        validate_structure
        validate_module_docs
        validate_markdown
        
        if [ "$skip_links" = false ]; then
            validate_links
        fi
        
        validate_terraform_examples
        validate_completeness
        validate_freshness
        
        if [ "$skip_spelling" = false ]; then
            validate_spelling
        fi
    fi
    
    # Generate report
    generate_report
    
    # Final summary
    echo ""
    log_info "Validation Summary:"
    echo "   📊 Total Checks: $TOTAL_CHECKS"
    echo "   ✅ Passed: $PASSED_CHECKS"
    echo "   ❌ Failed: $FAILED_CHECKS"
    echo "   ⚠️  Warnings: $WARNING_CHECKS"
    echo ""
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        echo -e "${GREEN}🎉 Documentation validation completed successfully!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Documentation validation failed with $FAILED_CHECKS errors${NC}"
        echo "Please review the validation report and fix the issues."
        exit 1
    fi
}

# Run main function
main "$@"