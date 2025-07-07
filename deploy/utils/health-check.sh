#!/bin/bash

# =============================================================================
# Health Check and Monitoring Utilities
# =============================================================================

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# =============================================================================
# Basic Health Check Functions
# =============================================================================

# Simple health check
simple_health_check() {
    local url="$1"
    local timeout="${2:-10}"
    
    echo -e "${BLUE}Performing simple health check on: ${url}${NC}"
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${timeout}" "${url}" 2>/dev/null || echo "000")
    
    if [[ "${response_code}" =~ ^[23][0-9][0-9]$ ]]; then
        echo -e "${GREEN}✅ Health check passed - HTTP ${response_code}${NC}"
        return 0
    else
        echo -e "${RED}❌ Health check failed - HTTP ${response_code}${NC}"
        return 1
    fi
}

# Detailed health check
detailed_health_check() {
    local url="$1"
    local timeout="${2:-10}"
    
    echo -e "${BLUE}Performing detailed health check on: ${url}${NC}"
    
    # Check if URL is reachable
    if ! curl -s --head --max-time "${timeout}" "${url}" > /dev/null 2>&1; then
        echo -e "${RED}❌ URL is not reachable${NC}"
        return 1
    fi
    
    # Get response details
    local response
    response=$(curl -s --max-time "${timeout}" -w "HTTPSTATUS:%{http_code};TIME:%{time_total};SIZE:%{size_download}" "${url}" 2>/dev/null)
    
    local http_code
    local response_time
    local response_size
    
    http_code=$(echo "${response}" | sed -n 's/.*HTTPSTATUS:\([0-9]*\);.*/\1/p')
    response_time=$(echo "${response}" | sed -n 's/.*TIME:\([0-9.]*\);.*/\1/p')
    response_size=$(echo "${response}" | sed -n 's/.*SIZE:\([0-9]*\)$/\1/p')
    
    # Remove status info from response body
    local response_body
    response_body=$(echo "${response}" | sed 's/HTTPSTATUS:.*$//')
    
    echo "  Response Code: ${http_code}"
    echo "  Response Time: ${response_time}s"
    echo "  Response Size: ${response_size} bytes"
    
    # Check response code
    if [[ "${http_code}" =~ ^[23][0-9][0-9]$ ]]; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        
        # Additional checks for JSON response
        if echo "${response_body}" | jq . > /dev/null 2>&1; then
            echo -e "${CYAN}📊 Response is valid JSON${NC}"
            
            # Check for health status in JSON
            local health_status
            health_status=$(echo "${response_body}" | jq -r '.status // .health // "unknown"' 2>/dev/null)
            if [[ "${health_status}" != "unknown" ]]; then
                echo "  Health Status: ${health_status}"
            fi
        fi
        
        return 0
    else
        echo -e "${RED}❌ Health check failed${NC}"
        return 1
    fi
}

# API endpoint health check
api_health_check() {
    local base_url="$1"
    local timeout="${2:-10}"
    
    echo -e "${BLUE}Checking API endpoints...${NC}"
    
    local endpoints=(
        "/api/health"
        "/api/status"
        "/"
        "/health"
    )
    
    local success_count=0
    local total_count=${#endpoints[@]}
    
    for endpoint in "${endpoints[@]}"; do
        local full_url="${base_url}${endpoint}"
        echo -n "  Checking ${endpoint}... "
        
        local response_code
        response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${timeout}" "${full_url}" 2>/dev/null || echo "000")
        
        if [[ "${response_code}" =~ ^[23][0-9][0-9]$ ]]; then
            echo -e "${GREEN}✅ ${response_code}${NC}"
            ((success_count++))
        else
            echo -e "${RED}❌ ${response_code}${NC}"
        fi
    done
    
    echo ""
    echo "API Health Summary: ${success_count}/${total_count} endpoints healthy"
    
    if [[ ${success_count} -gt 0 ]]; then
        return 0
    else
        return 1
    fi
}

# Database connectivity check
database_health_check() {
    local db_url="$1"
    
    echo -e "${BLUE}Checking database connectivity...${NC}"
    
    if [[ "${db_url}" =~ ^sqlite: ]]; then
        # SQLite check
        local db_file
        db_file=$(echo "${db_url}" | sed 's/sqlite://')
        
        if [[ -f "${db_file}" ]]; then
            echo -e "${GREEN}✅ SQLite database file exists: ${db_file}${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️ SQLite database file not found: ${db_file}${NC}"
            return 1
        fi
    elif [[ "${db_url}" =~ ^postgres ]]; then
        # PostgreSQL check
        if command -v psql &>/dev/null; then
            if psql "${db_url}" -c "SELECT 1;" &>/dev/null; then
                echo -e "${GREEN}✅ PostgreSQL connection successful${NC}"
                return 0
            else
                echo -e "${RED}❌ PostgreSQL connection failed${NC}"
                return 1
            fi
        else
            echo -e "${YELLOW}⚠️ psql not available, skipping PostgreSQL check${NC}"
            return 0
        fi
    else
        echo -e "${YELLOW}⚠️ Unknown database type, skipping check${NC}"
        return 0
    fi
}

# =============================================================================
# Performance Monitoring
# =============================================================================

# Monitor response times
monitor_response_times() {
    local url="$1"
    local duration="${2:-60}"
    local interval="${3:-5}"
    
    echo -e "${BLUE}Monitoring response times for ${duration}s (interval: ${interval}s)${NC}"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local measurements=()
    
    while [[ $(date +%s) -lt ${end_time} ]]; do
        local response_time
        response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time 30 "${url}" 2>/dev/null || echo "0")
        
        if [[ "${response_time}" != "0" ]]; then
            measurements+=("${response_time}")
            echo "  $(date '+%H:%M:%S') - Response time: ${response_time}s"
        else
            echo "  $(date '+%H:%M:%S') - Request failed"
        fi
        
        sleep "${interval}"
    done
    
    # Calculate statistics
    if [[ ${#measurements[@]} -gt 0 ]]; then
        local total=0
        local min="${measurements[0]}"
        local max="${measurements[0]}"
        
        for time in "${measurements[@]}"; do
            total=$(echo "${total} + ${time}" | bc -l)
            if (( $(echo "${time} < ${min}" | bc -l) )); then
                min="${time}"
            fi
            if (( $(echo "${time} > ${max}" | bc -l) )); then
                max="${time}"
            fi
        done
        
        local avg
        avg=$(echo "scale=3; ${total} / ${#measurements[@]}" | bc -l)
        
        echo ""
        echo -e "${CYAN}Response Time Statistics:${NC}"
        echo "  Measurements: ${#measurements[@]}"
        echo "  Average: ${avg}s"
        echo "  Min: ${min}s"
        echo "  Max: ${max}s"
        
        # Check if performance is acceptable
        if (( $(echo "${avg} < 2.0" | bc -l) )); then
            echo -e "${GREEN}✅ Performance is good (avg < 2s)${NC}"
            return 0
        elif (( $(echo "${avg} < 5.0" | bc -l) )); then
            echo -e "${YELLOW}⚠️ Performance is acceptable (avg < 5s)${NC}"
            return 0
        else
            echo -e "${RED}❌ Performance is poor (avg >= 5s)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ No successful measurements collected${NC}"
        return 1
    fi
}

# Load testing
basic_load_test() {
    local url="$1"
    local concurrent_users="${2:-5}"
    local duration="${3:-30}"
    
    echo -e "${BLUE}Running basic load test: ${concurrent_users} concurrent users for ${duration}s${NC}"
    
    local pids=()
    local results_file="/tmp/load_test_results_$$"
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    
    # Start concurrent users
    for ((i=1; i<=concurrent_users; i++)); do
        (
            local request_count=0
            local success_count=0
            
            while [[ $(date +%s) -lt ${end_time} ]]; do
                local response_code
                response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" 2>/dev/null || echo "000")
                
                ((request_count++))
                
                if [[ "${response_code}" =~ ^[23][0-9][0-9]$ ]]; then
                    ((success_count++))
                fi
                
                sleep 0.1
            done
            
            echo "${request_count} ${success_count}" >> "${results_file}"
        ) &
        pids+=($!)
    done
    
    # Wait for test to complete
    sleep "${duration}"
    
    # Kill any remaining processes
    for pid in "${pids[@]}"; do
        kill "${pid}" 2>/dev/null || true
    done
    
    wait 2>/dev/null || true
    
    # Analyze results
    if [[ -f "${results_file}" ]]; then
        local total_requests=0
        local total_success=0
        
        while read -r requests success; do
            total_requests=$((total_requests + requests))
            total_success=$((total_success + success))
        done < "${results_file}"
        
        local success_rate=0
        if [[ ${total_requests} -gt 0 ]]; then
            success_rate=$(echo "scale=2; ${total_success} * 100 / ${total_requests}" | bc -l)
        fi
        
        local requests_per_second
        requests_per_second=$(echo "scale=2; ${total_requests} / ${duration}" | bc -l)
        
        echo ""
        echo -e "${CYAN}Load Test Results:${NC}"
        echo "  Total Requests: ${total_requests}"
        echo "  Successful Requests: ${total_success}"
        echo "  Success Rate: ${success_rate}%"
        echo "  Requests/Second: ${requests_per_second}"
        
        # Cleanup
        rm -f "${results_file}"
        
        # Evaluate results
        if (( $(echo "${success_rate} >= 95" | bc -l) )); then
            echo -e "${GREEN}✅ Load test passed (success rate >= 95%)${NC}"
            return 0
        elif (( $(echo "${success_rate} >= 90" | bc -l) )); then
            echo -e "${YELLOW}⚠️ Load test marginal (success rate >= 90%)${NC}"
            return 0
        else
            echo -e "${RED}❌ Load test failed (success rate < 90%)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Load test failed - no results collected${NC}"
        return 1
    fi
}

# =============================================================================
# Security Checks
# =============================================================================

# SSL/TLS security check
ssl_security_check() {
    local url="$1"
    
    if [[ ! "${url}" =~ ^https:// ]]; then
        echo -e "${YELLOW}⚠️ URL is not HTTPS, skipping SSL check${NC}"
        return 0
    fi
    
    echo -e "${BLUE}Checking SSL/TLS security...${NC}"
    
    local hostname
    hostname=$(echo "${url}" | sed 's|https://||' | sed 's|/.*||' | sed 's|:.*||')
    
    if command -v openssl &>/dev/null; then
        # Check SSL certificate
        local ssl_output
        ssl_output=$(echo | openssl s_client -servername "${hostname}" -connect "${hostname}:443" 2>/dev/null)
        
        if echo "${ssl_output}" | grep -q "Verify return code: 0 (ok)"; then
            echo -e "${GREEN}✅ SSL certificate is valid${NC}"
            
            # Get certificate details
            local cert_info
            cert_info=$(echo "${ssl_output}" | openssl x509 -noout -dates 2>/dev/null)
            
            if [[ -n "${cert_info}" ]]; then
                echo "  Certificate Details:"
                echo "${cert_info}" | sed 's/^/    /'
            fi
            
            # Check TLS version
            local tls_version
            tls_version=$(echo "${ssl_output}" | grep "Protocol" | head -1 | awk '{print $3}')
            
            if [[ -n "${tls_version}" ]]; then
                echo "  TLS Version: ${tls_version}"
                
                if [[ "${tls_version}" =~ TLSv1\.[23] ]]; then
                    echo -e "${GREEN}✅ TLS version is secure${NC}"
                else
                    echo -e "${YELLOW}⚠️ TLS version may be outdated${NC}"
                fi
            fi
            
            return 0
        else
            echo -e "${RED}❌ SSL certificate validation failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️ OpenSSL not available, skipping SSL check${NC}"
        return 0
    fi
}

# Security headers check
security_headers_check() {
    local url="$1"
    
    echo -e "${BLUE}Checking security headers...${NC}"
    
    local headers
    headers=$(curl -s -I --max-time 10 "${url}" 2>/dev/null)
    
    if [[ -z "${headers}" ]]; then
        echo -e "${RED}❌ Failed to retrieve headers${NC}"
        return 1
    fi
    
    local security_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
        "Content-Security-Policy"
        "Referrer-Policy"
    )
    
    local found_headers=0
    
    for header in "${security_headers[@]}"; do
        if echo "${headers}" | grep -qi "^${header}:"; then
            echo -e "${GREEN}✅ ${header} present${NC}"
            ((found_headers++))
        else
            echo -e "${YELLOW}⚠️ ${header} missing${NC}"
        fi
    done
    
    echo ""
    echo "Security Headers Summary: ${found_headers}/${#security_headers[@]} present"
    
    if [[ ${found_headers} -ge 4 ]]; then
        echo -e "${GREEN}✅ Good security headers coverage${NC}"
        return 0
    elif [[ ${found_headers} -ge 2 ]]; then
        echo -e "${YELLOW}⚠️ Basic security headers present${NC}"
        return 0
    else
        echo -e "${RED}❌ Poor security headers coverage${NC}"
        return 1
    fi
}

# =============================================================================
# Comprehensive Health Check
# =============================================================================

# Run all health checks
comprehensive_health_check() {
    local url="$1"
    local database_url="${2:-}"
    local skip_load_test="${3:-false}"
    
    echo -e "${CYAN}=== Comprehensive Health Check ===${NC}"
    echo "Target URL: ${url}"
    echo "Timestamp: $(date)"
    echo ""
    
    local checks_passed=0
    local total_checks=0
    
    # Basic connectivity
    echo -e "${BLUE}1. Basic Connectivity Check${NC}"
    ((total_checks++))
    if simple_health_check "${url}"; then
        ((checks_passed++))
    fi
    echo ""
    
    # Detailed health check
    echo -e "${BLUE}2. Detailed Health Check${NC}"
    ((total_checks++))
    if detailed_health_check "${url}"; then
        ((checks_passed++))
    fi
    echo ""
    
    # API endpoints
    echo -e "${BLUE}3. API Endpoints Check${NC}"
    ((total_checks++))
    if api_health_check "${url}"; then
        ((checks_passed++))
    fi
    echo ""
    
    # Database connectivity
    if [[ -n "${database_url}" ]]; then
        echo -e "${BLUE}4. Database Connectivity Check${NC}"
        ((total_checks++))
        if database_health_check "${database_url}"; then
            ((checks_passed++))
        fi
        echo ""
    fi
    
    # SSL/TLS security
    echo -e "${BLUE}5. SSL/TLS Security Check${NC}"
    ((total_checks++))
    if ssl_security_check "${url}"; then
        ((checks_passed++))
    fi
    echo ""
    
    # Security headers
    echo -e "${BLUE}6. Security Headers Check${NC}"
    ((total_checks++))
    if security_headers_check "${url}"; then
        ((checks_passed++))
    fi
    echo ""
    
    # Performance monitoring
    echo -e "${BLUE}7. Performance Monitoring${NC}"
    ((total_checks++))
    if monitor_response_times "${url}" 30 5; then
        ((checks_passed++))
    fi
    echo ""
    
    # Load testing (optional)
    if [[ "${skip_load_test}" != "true" ]]; then
        echo -e "${BLUE}8. Basic Load Test${NC}"
        ((total_checks++))
        if basic_load_test "${url}" 3 20; then
            ((checks_passed++))
        fi
        echo ""
    fi
    
    # Summary
    echo -e "${CYAN}=== Health Check Summary ===${NC}"
    echo "Checks Passed: ${checks_passed}/${total_checks}"
    
    local success_rate
    success_rate=$(echo "scale=2; ${checks_passed} * 100 / ${total_checks}" | bc -l)
    echo "Success Rate: ${success_rate}%"
    
    if [[ ${checks_passed} -eq ${total_checks} ]]; then
        echo -e "${GREEN}✅ All health checks passed!${NC}"
        return 0
    elif (( $(echo "${success_rate} >= 80" | bc -l) )); then
        echo -e "${YELLOW}⚠️ Most health checks passed (${success_rate}%)${NC}"
        return 0
    else
        echo -e "${RED}❌ Health check failed (${success_rate}%)${NC}"
        return 1
    fi
}

# =============================================================================
# CLI Interface
# =============================================================================

# Main function for CLI usage
main() {
    local command="${1:-help}"
    local url="${2:-}"
    
    case "${command}" in
        "simple")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 simple <url>"
                exit 1
            fi
            simple_health_check "${url}"
            ;;
        "detailed")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 detailed <url>"
                exit 1
            fi
            detailed_health_check "${url}"
            ;;
        "api")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 api <url>"
                exit 1
            fi
            api_health_check "${url}"
            ;;
        "performance")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 performance <url> [duration] [interval]"
                exit 1
            fi
            monitor_response_times "${url}" "${3:-60}" "${4:-5}"
            ;;
        "load")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 load <url> [concurrent_users] [duration]"
                exit 1
            fi
            basic_load_test "${url}" "${3:-5}" "${4:-30}"
            ;;
        "ssl")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 ssl <url>"
                exit 1
            fi
            ssl_security_check "${url}"
            ;;
        "security")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 security <url>"
                exit 1
            fi
            security_headers_check "${url}"
            ;;
        "comprehensive")
            if [[ -z "${url}" ]]; then
                echo "Usage: $0 comprehensive <url> [database_url] [skip_load_test]"
                exit 1
            fi
            comprehensive_health_check "${url}" "${3:-}" "${4:-false}"
            ;;
        "help"|*)
            echo "Health Check and Monitoring Tool"
            echo ""
            echo "Usage: $0 <command> <url> [options]"
            echo ""
            echo "Commands:"
            echo "  simple <url>                           - Basic health check"
            echo "  detailed <url>                         - Detailed health check"
            echo "  api <url>                              - API endpoints check"
            echo "  performance <url> [duration] [interval] - Performance monitoring"
            echo "  load <url> [users] [duration]         - Basic load test"
            echo "  ssl <url>                              - SSL/TLS security check"
            echo "  security <url>                         - Security headers check"
            echo "  comprehensive <url> [db_url] [skip_load] - Run all checks"
            echo "  help                                   - Show this help"
            ;;
    esac
}

# Execute main function if script is run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi