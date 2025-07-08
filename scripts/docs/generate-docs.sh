#!/bin/bash

# Terraform Documentation Generator
# This script automatically generates comprehensive documentation for Terraform modules and infrastructure

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs/terraform"
MODULES_DIR="$PROJECT_ROOT/modules"
INFRA_DIR="$PROJECT_ROOT/infra"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log_step "Checking dependencies..."
    
    local deps=("terraform" "terraform-docs" "jq" "pandoc" "graphviz")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing_deps+=("$dep")
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install missing dependencies:"
        for dep in "${missing_deps[@]}"; do
            case $dep in
                "terraform-docs")
                    echo "  brew install terraform-docs"
                    echo "  # or"
                    echo "  go install github.com/terraform-docs/terraform-docs@latest"
                    ;;
                "pandoc")
                    echo "  brew install pandoc"
                    echo "  # or"
                    echo "  apt-get install pandoc"
                    ;;
                "graphviz")
                    echo "  brew install graphviz"
                    echo "  # or"
                    echo "  apt-get install graphviz"
                    ;;
                *)
                    echo "  Please install $dep"
                    ;;
            esac
        done
        exit 1
    fi
    
    log_success "All dependencies are installed"
}

# Create directory structure
create_structure() {
    log_step "Creating documentation structure..."
    
    local dirs=(
        "$DOCS_DIR/generated"
        "$DOCS_DIR/generated/modules"
        "$DOCS_DIR/generated/diagrams"
        "$DOCS_DIR/generated/examples"
        "$DOCS_DIR/generated/outputs"
        "$DOCS_DIR/generated/variables"
        "$DOCS_DIR/generated/resources"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        log_info "Created directory: $dir"
    done
    
    log_success "Documentation structure created"
}

# Generate module documentation
generate_module_docs() {
    log_step "Generating module documentation..."
    
    if [ ! -d "$MODULES_DIR" ]; then
        log_warning "Modules directory not found: $MODULES_DIR"
        return
    fi
    
    local module_count=0
    
    for module_path in "$MODULES_DIR"/*; do
        if [ -d "$module_path" ]; then
            local module_name=$(basename "$module_path")
            log_info "Processing module: $module_name"
            
            # Generate terraform-docs
            generate_terraform_docs "$module_path" "$module_name"
            
            # Generate enhanced documentation
            generate_enhanced_module_docs "$module_path" "$module_name"
            
            # Generate examples
            generate_module_examples "$module_path" "$module_name"
            
            ((module_count++))
        fi
    done
    
    log_success "Generated documentation for $module_count modules"
}

# Generate terraform-docs for a module
generate_terraform_docs() {
    local module_path="$1"
    local module_name="$2"
    local output_file="$DOCS_DIR/generated/modules/$module_name.md"
    
    log_info "Generating terraform-docs for $module_name"
    
    # Check if module has Terraform files
    if ! find "$module_path" -name "*.tf" -o -name "*.tf.json" | head -1 | grep -q .; then
        log_warning "No Terraform files found in $module_path"
        return
    fi
    
    # Generate documentation
    terraform-docs markdown table "$module_path" > "$output_file"
    
    # Enhance with custom header
    local temp_file=$(mktemp)
    cat > "$temp_file" << EOF
# $module_name Module

**Generated on:** $(date)
**Module Path:** \`$module_path\`

## Overview

This documentation is automatically generated from the Terraform module source code.

$(cat "$output_file")

## Additional Resources

- [Module Source Code]($module_path)
- [Examples](#examples)
- [Variables Reference](#variables)
- [Outputs Reference](#outputs)

---
*This documentation was generated automatically by terraform-docs*
EOF
    
    mv "$temp_file" "$output_file"
    log_success "Generated terraform-docs for $module_name"
}

# Generate enhanced module documentation
generate_enhanced_module_docs() {
    local module_path="$1"
    local module_name="$2"
    local output_file="$DOCS_DIR/generated/modules/${module_name}_enhanced.md"
    
    log_info "Generating enhanced documentation for $module_name"
    
    # Extract module information
    local description=""
    local version=""
    local author=""
    
    # Try to extract from README or main.tf
    if [ -f "$module_path/README.md" ]; then
        description=$(head -5 "$module_path/README.md" | tail -1)
    fi
    
    # Generate enhanced documentation
    cat > "$output_file" << EOF
# $module_name Module - Enhanced Documentation

**Generated on:** $(date)
**Module Version:** $version
**Author:** $author

## Description

$description

## Module Structure

\`\`\`
$(find "$module_path" -type f -name "*.tf" -o -name "*.tf.json" -o -name "*.md" | sed "s|$module_path/||" | sort)
\`\`\`

## Resources

$(generate_resource_list "$module_path")

## Variables Analysis

$(generate_variable_analysis "$module_path")

## Outputs Analysis

$(generate_output_analysis "$module_path")

## Usage Patterns

$(generate_usage_patterns "$module_path" "$module_name")

## Security Considerations

$(generate_security_analysis "$module_path")

## Cost Considerations

$(generate_cost_analysis "$module_path")

## Testing

$(generate_testing_info "$module_path")

---
*This enhanced documentation was generated automatically*
EOF
    
    log_success "Generated enhanced documentation for $module_name"
}

# Generate resource list
generate_resource_list() {
    local module_path="$1"
    
    echo "### Terraform Resources"
    echo ""
    
    if find "$module_path" -name "*.tf" | xargs grep -h "^resource" 2>/dev/null | sort | uniq; then
        find "$module_path" -name "*.tf" | xargs grep -h "^resource" 2>/dev/null | \
            sed 's/resource "\([^"]*\)" "\([^"]*\)".*/- `\1.\2`/' | sort | uniq
    else
        echo "No resources found"
    fi
    
    echo ""
    echo "### Data Sources"
    echo ""
    
    if find "$module_path" -name "*.tf" | xargs grep -h "^data" 2>/dev/null | sort | uniq; then
        find "$module_path" -name "*.tf" | xargs grep -h "^data" 2>/dev/null | \
            sed 's/data "\([^"]*\)" "\([^"]*\)".*/- `data.\1.\2`/' | sort | uniq
    else
        echo "No data sources found"
    fi
    
    echo ""
}

# Generate variable analysis
generate_variable_analysis() {
    local module_path="$1"
    
    echo "### Variable Analysis"
    echo ""
    
    local vars_file="$module_path/variables.tf"
    if [ -f "$vars_file" ]; then
        local total_vars=$(grep -c "^variable" "$vars_file" 2>/dev/null || echo "0")
        local required_vars=$(grep -A 10 "^variable" "$vars_file" | grep -c "default.*=" 2>/dev/null || echo "0")
        local optional_vars=$((total_vars - required_vars))
        
        echo "- **Total Variables:** $total_vars"
        echo "- **Required Variables:** $required_vars"
        echo "- **Optional Variables:** $optional_vars"
        echo ""
        
        echo "#### Variable Types"
        echo ""
        grep -A 5 "^variable" "$vars_file" | grep "type.*=" | \
            sed 's/.*type.*=.*\(string\|number\|bool\|list\|map\|object\).*/\1/' | \
            sort | uniq -c | sed 's/^ *\([0-9]*\) \(.*\)/- **\2:** \1/'
    else
        echo "No variables.tf file found"
    fi
    
    echo ""
}

# Generate output analysis
generate_output_analysis() {
    local module_path="$1"
    
    echo "### Output Analysis"
    echo ""
    
    local outputs_file="$module_path/outputs.tf"
    if [ -f "$outputs_file" ]; then
        local total_outputs=$(grep -c "^output" "$outputs_file" 2>/dev/null || echo "0")
        local sensitive_outputs=$(grep -A 5 "^output" "$outputs_file" | grep -c "sensitive.*=.*true" 2>/dev/null || echo "0")
        
        echo "- **Total Outputs:** $total_outputs"
        echo "- **Sensitive Outputs:** $sensitive_outputs"
        echo ""
        
        echo "#### Output List"
        echo ""
        grep "^output" "$outputs_file" | sed 's/output "\([^"]*\)".*/- `\1`/' | sort
    else
        echo "No outputs.tf file found"
    fi
    
    echo ""
}

# Generate usage patterns
generate_usage_patterns() {
    local module_path="$1"
    local module_name="$2"
    
    echo "### Common Usage Patterns"
    echo ""
    
    # Check for examples directory
    if [ -d "$module_path/examples" ]; then
        echo "#### Available Examples"
        echo ""
        find "$module_path/examples" -name "*.tf" | while read -r example; do
            local example_name=$(basename "$(dirname "$example")")
            echo "- [$example_name]($example)"
        done
        echo ""
    fi
    
    echo "#### Basic Usage"
    echo ""
    echo "\`\`\`hcl"
    echo "module \"$module_name\" {"
    echo "  source = \"./modules/$module_name\""
    echo ""
    
    # Extract required variables
    if [ -f "$module_path/variables.tf" ]; then
        grep -A 10 "^variable" "$module_path/variables.tf" | \
        grep -B 10 "default.*=" | \
        grep "^variable" | \
        sed 's/variable "\([^"]*\)".*/  \1 = "TODO"/' | head -5
    fi
    
    echo "}"
    echo "\`\`\`"
    echo ""
}

# Generate security analysis
generate_security_analysis() {
    local module_path="$1"
    
    echo "### Security Analysis"
    echo ""
    
    local security_issues=()
    
    # Check for hardcoded values
    if find "$module_path" -name "*.tf" | xargs grep -l "password\|secret\|key" &>/dev/null; then
        security_issues+=("Potential sensitive data in code")
    fi
    
    # Check for public access
    if find "$module_path" -name "*.tf" | xargs grep -l "0.0.0.0/0\|::/0" &>/dev/null; then
        security_issues+=("Open network access detected")
    fi
    
    # Check for encryption
    if find "$module_path" -name "*.tf" | xargs grep -l "encrypt" &>/dev/null; then
        echo "✅ Encryption configurations found"
    else
        security_issues+=("No encryption configurations found")
    fi
    
    if [ ${#security_issues[@]} -eq 0 ]; then
        echo "✅ No obvious security issues detected"
    else
        echo "⚠️ **Security considerations:**"
        for issue in "${security_issues[@]}"; do
            echo "- $issue"
        done
    fi
    
    echo ""
}

# Generate cost analysis
generate_cost_analysis() {
    local module_path="$1"
    
    echo "### Cost Analysis"
    echo ""
    
    # Check for expensive resources
    local expensive_resources=()
    
    if find "$module_path" -name "*.tf" | xargs grep -l "instance_type.*large\|instance_class.*large" &>/dev/null; then
        expensive_resources+=("Large instance types detected")
    fi
    
    if find "$module_path" -name "*.tf" | xargs grep -l "multi_az.*true" &>/dev/null; then
        expensive_resources+=("Multi-AZ configuration (higher cost)")
    fi
    
    if find "$module_path" -name "*.tf" | xargs grep -l "backup_retention" &>/dev/null; then
        expensive_resources+=("Backup retention configured")
    fi
    
    if [ ${#expensive_resources[@]} -eq 0 ]; then
        echo "💰 Cost-optimized configuration detected"
    else
        echo "💰 **Cost considerations:**"
        for item in "${expensive_resources[@]}"; do
            echo "- $item"
        done
    fi
    
    echo ""
}

# Generate testing information
generate_testing_info() {
    local module_path="$1"
    
    echo "### Testing Information"
    echo ""
    
    if [ -d "$module_path/test" ] || [ -d "$module_path/tests" ]; then
        echo "✅ Test files found"
        echo ""
        find "$module_path" -path "*/test*" -name "*.go" -o -name "*.tf" | \
            sed "s|$module_path/||" | sed 's/^/- /'
    else
        echo "⚠️ No test files found"
        echo ""
        echo "Consider adding tests for this module:"
        echo "- Unit tests with Terratest"
        echo "- Integration tests"
        echo "- Security tests with checkov"
    fi
    
    echo ""
}

# Generate module examples
generate_module_examples() {
    local module_path="$1"
    local module_name="$2"
    local output_dir="$DOCS_DIR/generated/examples"
    
    log_info "Generating examples for $module_name"
    
    # Create examples from any existing examples directory
    if [ -d "$module_path/examples" ]; then
        cp -r "$module_path/examples" "$output_dir/$module_name"
        log_success "Copied examples for $module_name"
    else
        # Generate basic example
        mkdir -p "$output_dir/$module_name"
        cat > "$output_dir/$module_name/basic.tf" << EOF
# Basic example for $module_name module
module "$module_name" {
  source = "../../modules/$module_name"
  
  # TODO: Add required variables
  name = "example-$module_name"
  
  tags = {
    Environment = "example"
    Module      = "$module_name"
  }
}

# Example outputs
output "${module_name}_outputs" {
  description = "All outputs from $module_name module"
  value       = module.$module_name
}
EOF
        log_success "Generated basic example for $module_name"
    fi
}

# Generate infrastructure diagrams
generate_diagrams() {
    log_step "Generating infrastructure diagrams..."
    
    local diagrams_dir="$DOCS_DIR/generated/diagrams"
    
    # Generate Terraform graph
    generate_terraform_graph "$diagrams_dir"
    
    # Generate architecture diagrams
    generate_architecture_diagrams "$diagrams_dir"
    
    log_success "Infrastructure diagrams generated"
}

# Generate Terraform dependency graph
generate_terraform_graph() {
    local output_dir="$1"
    
    log_info "Generating Terraform dependency graph"
    
    # Check if we have terraform directories
    for tf_dir in "$TERRAFORM_DIR" "$INFRA_DIR"; do
        if [ -d "$tf_dir" ]; then
            local dir_name=$(basename "$tf_dir")
            
            # Initialize if needed
            if [ ! -d "$tf_dir/.terraform" ]; then
                log_info "Initializing Terraform in $tf_dir"
                (cd "$tf_dir" && terraform init -backend=false) || log_warning "Failed to initialize $tf_dir"
            fi
            
            # Generate graph
            if [ -d "$tf_dir/.terraform" ]; then
                log_info "Generating graph for $dir_name"
                (cd "$tf_dir" && terraform graph) | dot -Tpng > "$output_dir/${dir_name}_graph.png" 2>/dev/null || \
                    log_warning "Failed to generate graph for $dir_name"
            fi
        fi
    done
}

# Generate architecture diagrams
generate_architecture_diagrams() {
    local output_dir="$1"
    
    log_info "Generating architecture diagrams"
    
    # Create a simple architecture diagram using Graphviz
    cat > "$output_dir/architecture.dot" << 'EOF'
digraph architecture {
    rankdir=TB;
    node [shape=box, style=rounded];
    
    // Define components
    subgraph cluster_public {
        label="Public Subnet";
        style=filled;
        color=lightblue;
        
        ALB [label="Application\nLoad Balancer"];
        CDN [label="CloudFront\nCDN"];
        WAF [label="Web Application\nFirewall"];
    }
    
    subgraph cluster_private {
        label="Private Subnet";
        style=filled;
        color=lightgreen;
        
        APP [label="Application\nServers"];
        CACHE [label="Redis\nCache"];
    }
    
    subgraph cluster_database {
        label="Database Subnet";
        style=filled;
        color=lightyellow;
        
        DB [label="PostgreSQL\nDatabase"];
        REPLICA [label="Read\nReplicas"];
    }
    
    // Define connections
    CDN -> WAF;
    WAF -> ALB;
    ALB -> APP;
    APP -> CACHE;
    APP -> DB;
    DB -> REPLICA;
}
EOF
    
    # Generate PNG from DOT file
    dot -Tpng "$output_dir/architecture.dot" > "$output_dir/architecture.png" 2>/dev/null || \
        log_warning "Failed to generate architecture diagram"
    
    # Generate SVG version
    dot -Tsvg "$output_dir/architecture.dot" > "$output_dir/architecture.svg" 2>/dev/null || \
        log_warning "Failed to generate SVG architecture diagram"
}

# Generate summary report
generate_summary() {
    log_step "Generating documentation summary..."
    
    local summary_file="$DOCS_DIR/generated/SUMMARY.md"
    local timestamp=$(date)
    
    cat > "$summary_file" << EOF
# Terraform Documentation Summary

**Generated on:** $timestamp
**Project:** Learning Assistant Infrastructure

## Overview

This documentation was automatically generated from the Terraform infrastructure code.

## Modules

$(find "$DOCS_DIR/generated/modules" -name "*.md" -not -name "*_enhanced.md" | wc -l) modules documented:

$(find "$DOCS_DIR/generated/modules" -name "*.md" -not -name "*_enhanced.md" | while read -r file; do
    local module_name=$(basename "$file" .md)
    echo "- [$module_name](./modules/$module_name.md)"
done)

## Enhanced Documentation

$(find "$DOCS_DIR/generated/modules" -name "*_enhanced.md" | wc -l) enhanced module docs:

$(find "$DOCS_DIR/generated/modules" -name "*_enhanced.md" | while read -r file; do
    local module_name=$(basename "$file" _enhanced.md)
    echo "- [$module_name Enhanced](./modules/${module_name}_enhanced.md)"
done)

## Examples

$(find "$DOCS_DIR/generated/examples" -type d -mindepth 1 | wc -l) example sets:

$(find "$DOCS_DIR/generated/examples" -type d -mindepth 1 | while read -r dir; do
    local example_name=$(basename "$dir")
    echo "- [$example_name](./examples/$example_name/)"
done)

## Diagrams

$(find "$DOCS_DIR/generated/diagrams" -name "*.png" | wc -l) diagrams generated:

$(find "$DOCS_DIR/generated/diagrams" -name "*.png" | while read -r file; do
    local diagram_name=$(basename "$file" .png)
    echo "- [$diagram_name](./diagrams/$diagram_name.png)"
done)

## Statistics

- **Total Files Generated:** $(find "$DOCS_DIR/generated" -type f | wc -l)
- **Total Size:** $(du -sh "$DOCS_DIR/generated" | cut -f1)
- **Last Updated:** $timestamp

## Quality Checks

### Module Coverage
$(check_module_coverage)

### Documentation Quality
$(check_documentation_quality)

## Next Steps

1. Review generated documentation for accuracy
2. Add custom content where needed
3. Update examples with real-world scenarios
4. Configure automated documentation updates

---
*This summary was generated automatically*
EOF
    
    log_success "Documentation summary generated"
}

# Check module coverage
check_module_coverage() {
    local total_modules=$(find "$MODULES_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l 2>/dev/null || echo "0")
    local documented_modules=$(find "$DOCS_DIR/generated/modules" -name "*.md" -not -name "*_enhanced.md" | wc -l 2>/dev/null || echo "0")
    
    if [ "$total_modules" -gt 0 ]; then
        local coverage=$((documented_modules * 100 / total_modules))
        echo "- **Module Coverage:** $documented_modules/$total_modules ($coverage%)"
    else
        echo "- **Module Coverage:** No modules found"
    fi
}

# Check documentation quality
check_documentation_quality() {
    local total_docs=$(find "$DOCS_DIR/generated" -name "*.md" | wc -l)
    local non_empty_docs=$(find "$DOCS_DIR/generated" -name "*.md" -size +100c | wc -l)
    
    if [ "$total_docs" -gt 0 ]; then
        local quality=$((non_empty_docs * 100 / total_docs))
        echo "- **Documentation Quality:** $non_empty_docs/$total_docs docs have substantial content ($quality%)"
    else
        echo "- **Documentation Quality:** No documentation files found"
    fi
}

# Generate PDF documentation
generate_pdf() {
    log_step "Generating PDF documentation..."
    
    if ! command -v pandoc &> /dev/null; then
        log_warning "Pandoc not found, skipping PDF generation"
        return
    fi
    
    local pdf_dir="$DOCS_DIR/generated/pdf"
    mkdir -p "$pdf_dir"
    
    # Combine all markdown files
    local combined_md="$pdf_dir/combined.md"
    
    # Start with summary
    if [ -f "$DOCS_DIR/generated/SUMMARY.md" ]; then
        cat "$DOCS_DIR/generated/SUMMARY.md" > "$combined_md"
        echo -e "\n\n---\n\n" >> "$combined_md"
    fi
    
    # Add module documentation
    find "$DOCS_DIR/generated/modules" -name "*.md" -not -name "*_enhanced.md" | sort | while read -r file; do
        echo -e "\n\n---\n\n" >> "$combined_md"
        cat "$file" >> "$combined_md"
    done
    
    # Generate PDF
    pandoc "$combined_md" -o "$pdf_dir/terraform-documentation.pdf" \
        --toc \
        --toc-depth=3 \
        --number-sections \
        --highlight-style=github \
        2>/dev/null || log_warning "Failed to generate PDF"
    
    if [ -f "$pdf_dir/terraform-documentation.pdf" ]; then
        log_success "PDF documentation generated: $pdf_dir/terraform-documentation.pdf"
    fi
}

# Validate generated documentation
validate_docs() {
    log_step "Validating generated documentation..."
    
    local issues=()
    
    # Check for empty files
    while IFS= read -r -d '' file; do
        if [ ! -s "$file" ]; then
            issues+=("Empty file: $file")
        fi
    done < <(find "$DOCS_DIR/generated" -name "*.md" -print0)
    
    # Check for broken links (basic check)
    local broken_links=0
    find "$DOCS_DIR/generated" -name "*.md" -exec grep -l "](.*\.md)" {} \; | while read -r file; do
        grep -o "](.*\.md)" "$file" | sed 's/](\(.*\))/\1/' | while read -r link; do
            local full_path
            if [[ "$link" =~ ^/ ]]; then
                full_path="$PROJECT_ROOT$link"
            else
                full_path="$(dirname "$file")/$link"
            fi
            
            if [ ! -f "$full_path" ]; then
                issues+=("Broken link in $file: $link")
                ((broken_links++))
            fi
        done
    done
    
    # Report issues
    if [ ${#issues[@]} -eq 0 ]; then
        log_success "Documentation validation passed"
    else
        log_warning "Documentation validation found ${#issues[@]} issues:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
    fi
}

# Main execution
main() {
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                 Terraform Documentation Generator              ║"
    echo "║                     Learning Assistant Infrastructure          ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Parse command line options
    local generate_pdf_flag=false
    local validate_flag=true
    local clean_flag=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --pdf)
                generate_pdf_flag=true
                shift
                ;;
            --no-validate)
                validate_flag=false
                shift
                ;;
            --clean)
                clean_flag=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --pdf         Generate PDF documentation"
                echo "  --no-validate Skip documentation validation"
                echo "  --clean       Clean generated files before running"
                echo "  -h, --help    Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Clean if requested
    if [ "$clean_flag" = true ]; then
        log_step "Cleaning generated documentation..."
        rm -rf "$DOCS_DIR/generated"
        log_success "Cleaned generated documentation"
    fi
    
    # Execute steps
    check_dependencies
    create_structure
    generate_module_docs
    generate_diagrams
    generate_summary
    
    if [ "$generate_pdf_flag" = true ]; then
        generate_pdf
    fi
    
    if [ "$validate_flag" = true ]; then
        validate_docs
    fi
    
    # Final report
    echo ""
    log_success "Documentation generation completed!"
    echo ""
    echo -e "${CYAN}📊 Generated Documentation Summary:${NC}"
    echo "   📁 Output Directory: $DOCS_DIR/generated"
    echo "   📄 Files Generated: $(find "$DOCS_DIR/generated" -type f | wc -l)"
    echo "   📈 Total Size: $(du -sh "$DOCS_DIR/generated" 2>/dev/null | cut -f1 || echo "Unknown")"
    echo ""
    echo -e "${CYAN}🔗 Quick Links:${NC}"
    echo "   📋 Summary: $DOCS_DIR/generated/SUMMARY.md"
    echo "   🧩 Modules: $DOCS_DIR/generated/modules/"
    echo "   💡 Examples: $DOCS_DIR/generated/examples/"
    echo "   📊 Diagrams: $DOCS_DIR/generated/diagrams/"
    echo ""
    echo -e "${GREEN}✅ All documentation has been generated successfully!${NC}"
}

# Run main function
main "$@"