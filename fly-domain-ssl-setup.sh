#!/bin/bash

# Fly.io Custom Domain and SSL Setup for Learning Assistant
# This script configures custom domains, SSL certificates, and DNS

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Application configuration
APP_NAME="learning-assistant-lively-rain-3457"

echo -e "${BLUE}🌐 Setting up custom domain and SSL for Learning Assistant${NC}"
echo -e "${BLUE}App: ${APP_NAME}${NC}"

# Function to prompt for yes/no
prompt_yes_no() {
    local prompt="$1"
    local response
    
    while true; do
        read -p "$prompt [y/N]: " response
        case $response in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Function to prompt for input with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local value
    
    read -p "$prompt [$default]: " value
    echo "${value:-$default}"
}

# Function to validate domain format
validate_domain() {
    local domain="$1"
    if [[ $domain =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        return 0
    else
        return 1
    fi
}

# Get domain information
echo -e "\n${YELLOW}📋 Domain Configuration:${NC}"
if prompt_yes_no "Do you want to set up a custom domain?"; then
    
    # Primary domain
    while true; do
        domain=$(prompt_with_default "Primary domain (e.g., yourdomain.com)" "")
        if [ -n "$domain" ] && validate_domain "$domain"; then
            break
        else
            echo -e "${RED}Invalid domain format. Please enter a valid domain.${NC}"
        fi
    done
    
    # WWW subdomain
    if prompt_yes_no "Do you want to add www subdomain?"; then
        www_domain="www.$domain"
        use_www=true
    else
        use_www=false
    fi
    
    # API subdomain
    if prompt_yes_no "Do you want to add api subdomain?"; then
        api_domain="api.$domain"
        use_api=true
    else
        use_api=false
    fi
    
    echo -e "\n${GREEN}Domain configuration:${NC}"
    echo "Primary domain: $domain"
    [ "$use_www" = true ] && echo "WWW domain: $www_domain"
    [ "$use_api" = true ] && echo "API domain: $api_domain"
    
else
    echo -e "${YELLOW}Skipping custom domain setup${NC}"
    exit 0
fi

# Add domains to Fly.io
echo -e "\n${BLUE}🔗 Adding domains to Fly.io...${NC}"

# Add primary domain
echo -e "${GREEN}Adding primary domain: $domain${NC}"
if fly certs create "$domain" --app "$APP_NAME"; then
    echo -e "${GREEN}✅ Primary domain added successfully${NC}"
else
    echo -e "${RED}❌ Failed to add primary domain${NC}"
    exit 1
fi

# Add www subdomain if requested
if [ "$use_www" = true ]; then
    echo -e "${GREEN}Adding www subdomain: $www_domain${NC}"
    if fly certs create "$www_domain" --app "$APP_NAME"; then
        echo -e "${GREEN}✅ WWW subdomain added successfully${NC}"
    else
        echo -e "${RED}❌ Failed to add www subdomain${NC}"
    fi
fi

# Add API subdomain if requested
if [ "$use_api" = true ]; then
    echo -e "${GREEN}Adding API subdomain: $api_domain${NC}"
    if fly certs create "$api_domain" --app "$APP_NAME"; then
        echo -e "${GREEN}✅ API subdomain added successfully${NC}"
    else
        echo -e "${RED}❌ Failed to add API subdomain${NC}"
    fi
fi

# Get DNS configuration
echo -e "\n${BLUE}🔍 Getting DNS configuration...${NC}"
fly certs list --app "$APP_NAME"

# Get IP addresses for DNS setup
echo -e "\n${BLUE}📡 Getting IP addresses for DNS configuration...${NC}"
fly ips list --app "$APP_NAME"

# Create DNS configuration guide
echo -e "\n${BLUE}📝 Creating DNS configuration guide...${NC}"
cat > /tmp/dns-setup-guide.md << EOF
# DNS Configuration Guide for Learning Assistant

## DNS Records Required

Based on your domain configuration, you need to add the following DNS records to your domain registrar:

### Primary Domain: $domain

\`\`\`
Type: A
Name: @
Value: [IPv4 address from fly ips list]
TTL: 300

Type: AAAA
Name: @
Value: [IPv6 address from fly ips list]
TTL: 300
\`\`\`

EOF

if [ "$use_www" = true ]; then
    cat >> /tmp/dns-setup-guide.md << EOF
### WWW Subdomain: $www_domain

\`\`\`
Type: CNAME
Name: www
Value: $domain
TTL: 300
\`\`\`

OR (if you prefer A/AAAA records):

\`\`\`
Type: A
Name: www
Value: [IPv4 address from fly ips list]
TTL: 300

Type: AAAA
Name: www
Value: [IPv6 address from fly ips list]
TTL: 300
\`\`\`

EOF
fi

if [ "$use_api" = true ]; then
    cat >> /tmp/dns-setup-guide.md << EOF
### API Subdomain: $api_domain

\`\`\`
Type: CNAME
Name: api
Value: $domain
TTL: 300
\`\`\`

OR (if you prefer A/AAAA records):

\`\`\`
Type: A
Name: api
Value: [IPv4 address from fly ips list]
TTL: 300

Type: AAAA
Name: api
Value: [IPv6 address from fly ips list]
TTL: 300
\`\`\`

EOF
fi

cat >> /tmp/dns-setup-guide.md << EOF
## DNS Verification

After adding DNS records, verify they are propagated:

\`\`\`bash
# Check A record
dig $domain A

# Check AAAA record
dig $domain AAAA

# Check from different locations
nslookup $domain 8.8.8.8
nslookup $domain 1.1.1.1
\`\`\`

## SSL Certificate Status

Check SSL certificate status:

\`\`\`bash
fly certs show $domain --app $APP_NAME
\`\`\`

## Common DNS Providers

### Cloudflare
1. Go to DNS settings
2. Add A record: @ → [IPv4 address]
3. Add AAAA record: @ → [IPv6 address]
4. Set proxy status to "DNS only" (gray cloud)

### GoDaddy
1. Go to DNS Management
2. Add A record: @ → [IPv4 address]
3. Add AAAA record: @ → [IPv6 address]

### Namecheap
1. Go to Domain List → Manage → Advanced DNS
2. Add A record: @ → [IPv4 address]
3. Add AAAA record: @ → [IPv6 address]

### Route 53 (AWS)
1. Go to Route 53 → Hosted Zones
2. Create A record: $domain → [IPv4 address]
3. Create AAAA record: $domain → [IPv6 address]

## Troubleshooting

### SSL Certificate Issues
- Wait 15-30 minutes after DNS propagation
- Check certificate status: \`fly certs show $domain --app $APP_NAME\`
- Verify DNS propagation: \`dig $domain\`

### DNS Propagation
- DNS changes can take 24-48 hours to fully propagate
- Use online DNS propagation checkers
- Test from different locations

### Mixed Content Issues
- Ensure all resources use HTTPS
- Update any hardcoded HTTP URLs
- Check browser console for mixed content warnings
EOF

echo -e "${GREEN}DNS configuration guide created at /tmp/dns-setup-guide.md${NC}"

# Create SSL certificate monitoring script
echo -e "\n${BLUE}🔒 Creating SSL certificate monitoring...${NC}"
cat > /tmp/ssl-monitor.sh << 'EOF'
#!/bin/bash

# SSL Certificate Monitoring Script for Learning Assistant
# This script monitors SSL certificate status and expiration

set -e

APP_NAME="learning-assistant-lively-rain-3457"
DOMAINS=()

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Add your domains here
DOMAINS+=("REPLACE_WITH_YOUR_DOMAIN")

# Function to check SSL certificate
check_ssl_cert() {
    local domain="$1"
    local output
    
    echo -e "${BLUE}Checking SSL certificate for: $domain${NC}"
    
    # Get certificate info from Fly.io
    output=$(fly certs show "$domain" --app "$APP_NAME" 2>/dev/null || echo "ERROR")
    
    if [ "$output" = "ERROR" ]; then
        echo -e "${RED}❌ Failed to get certificate info for $domain${NC}"
        return 1
    fi
    
    # Parse certificate status
    if echo "$output" | grep -q "Certificate is valid"; then
        echo -e "${GREEN}✅ Certificate is valid for $domain${NC}"
        
        # Check expiration
        if echo "$output" | grep -q "expires"; then
            expiry=$(echo "$output" | grep "expires" | cut -d' ' -f3-)
            echo -e "${GREEN}   Expires: $expiry${NC}"
        fi
    else
        echo -e "${RED}❌ Certificate issue detected for $domain${NC}"
        echo "$output"
        return 1
    fi
    
    return 0
}

# Function to check domain resolution
check_domain_resolution() {
    local domain="$1"
    
    echo -e "${BLUE}Checking DNS resolution for: $domain${NC}"
    
    # Check A record
    if dig +short "$domain" A | grep -q "[0-9]"; then
        echo -e "${GREEN}✅ A record resolved${NC}"
    else
        echo -e "${RED}❌ A record not found${NC}"
        return 1
    fi
    
    # Check AAAA record
    if dig +short "$domain" AAAA | grep -q ":"; then
        echo -e "${GREEN}✅ AAAA record resolved${NC}"
    else
        echo -e "${YELLOW}⚠️  AAAA record not found (IPv6)${NC}"
    fi
    
    return 0
}

# Function to test HTTPS connection
test_https_connection() {
    local domain="$1"
    
    echo -e "${BLUE}Testing HTTPS connection for: $domain${NC}"
    
    # Test HTTPS connection
    if curl -s -f -I "https://$domain" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTPS connection successful${NC}"
        
        # Get response headers
        response_code=$(curl -s -o /dev/null -w "%{http_code}" "https://$domain")
        echo -e "${GREEN}   Response code: $response_code${NC}"
        
        # Check SSL certificate details
        ssl_info=$(curl -s -I "https://$domain" --cert-status 2>/dev/null | head -1)
        echo -e "${GREEN}   SSL Status: $ssl_info${NC}"
        
    else
        echo -e "${RED}❌ HTTPS connection failed${NC}"
        return 1
    fi
    
    return 0
}

# Main monitoring function
monitor_certificates() {
    echo -e "${BLUE}🔒 SSL Certificate Monitoring Report${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo "App: $APP_NAME"
    echo "Timestamp: $(date)"
    echo
    
    local all_good=true
    
    for domain in "${DOMAINS[@]}"; do
        if [ "$domain" = "REPLACE_WITH_YOUR_DOMAIN" ]; then
            echo -e "${YELLOW}⚠️  Please update the script with your actual domains${NC}"
            continue
        fi
        
        echo -e "\n${YELLOW}📊 Checking domain: $domain${NC}"
        echo "----------------------------------------"
        
        # Check DNS resolution
        if ! check_domain_resolution "$domain"; then
            all_good=false
            continue
        fi
        
        # Check SSL certificate
        if ! check_ssl_cert "$domain"; then
            all_good=false
            continue
        fi
        
        # Test HTTPS connection
        if ! test_https_connection "$domain"; then
            all_good=false
            continue
        fi
        
        echo -e "${GREEN}✅ All checks passed for $domain${NC}"
    done
    
    echo -e "\n${BLUE}=====================================${NC}"
    
    if [ "$all_good" = true ]; then
        echo -e "${GREEN}🎉 All certificates are healthy!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some certificates need attention${NC}"
        exit 1
    fi
}

# Run monitoring
monitor_certificates
EOF

chmod +x /tmp/ssl-monitor.sh
echo -e "${GREEN}SSL monitoring script created at /tmp/ssl-monitor.sh${NC}"

# Create domain redirect configuration
echo -e "\n${BLUE}🔀 Creating domain redirect configuration...${NC}"
cat > /tmp/domain-redirects.js << 'EOF'
// Domain redirect middleware for Next.js
// Add this to your middleware.ts file

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const url = request.nextUrl.clone();
  
  // Define your primary domain
  const primaryDomain = 'yourdomain.com'; // Replace with your actual domain
  const wwwDomain = `www.${primaryDomain}`;
  
  // Redirect www to non-www (or vice versa)
  if (host === wwwDomain) {
    url.host = primaryDomain;
    return NextResponse.redirect(url);
  }
  
  // Redirect HTTP to HTTPS (handled by Fly.io, but good to have)
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return NextResponse.redirect(url);
  }
  
  // Handle API subdomain routing
  if (host?.startsWith('api.')) {
    // Rewrite API requests to /api path
    if (!url.pathname.startsWith('/api')) {
      url.pathname = `/api${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  
  // Add security headers
  const response = NextResponse.next();
  
  // HSTS Header
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Domain-specific headers
  response.headers.set('X-Custom-Domain', host || 'unknown');
  response.headers.set('X-Forwarded-Proto', 'https');
  
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
EOF

echo -e "${GREEN}Domain redirect configuration created at /tmp/domain-redirects.js${NC}"

# Update environment variables for custom domain
echo -e "\n${BLUE}🔧 Updating environment variables...${NC}"
if [ -n "$domain" ]; then
    echo -e "${GREEN}Setting domain-related environment variables...${NC}"
    
    # Set primary domain
    fly secrets set \
        NEXT_PUBLIC_DOMAIN="$domain" \
        NEXTAUTH_URL="https://$domain" \
        CORS_ORIGIN="https://$domain" \
        --app "$APP_NAME"
    
    # Set additional domains if configured
    if [ "$use_www" = true ]; then
        fly secrets set \
            NEXT_PUBLIC_WWW_DOMAIN="$www_domain" \
            --app "$APP_NAME"
    fi
    
    if [ "$use_api" = true ]; then
        fly secrets set \
            NEXT_PUBLIC_API_DOMAIN="$api_domain" \
            --app "$APP_NAME"
    fi
    
    echo -e "${GREEN}✅ Environment variables updated${NC}"
fi

# Create certificate renewal automation
echo -e "\n${BLUE}🔄 Creating certificate renewal automation...${NC}"
cat > /tmp/cert-renewal.sh << 'EOF'
#!/bin/bash

# Certificate renewal automation for Learning Assistant
# This script checks and renews SSL certificates automatically

set -e

APP_NAME="learning-assistant-lively-rain-3457"
DOMAINS=()

# Add your domains here
DOMAINS+=("REPLACE_WITH_YOUR_DOMAIN")

# Function to check certificate expiry
check_cert_expiry() {
    local domain="$1"
    local days_until_expiry
    
    # Get certificate info
    cert_info=$(fly certs show "$domain" --app "$APP_NAME" 2>/dev/null || echo "ERROR")
    
    if [ "$cert_info" = "ERROR" ]; then
        echo "Failed to get certificate info for $domain"
        return 1
    fi
    
    # Parse expiry date (this is a simplified example)
    # In practice, you'd need to parse the actual date format
    if echo "$cert_info" | grep -q "expires in"; then
        days_until_expiry=$(echo "$cert_info" | grep "expires in" | grep -o "[0-9]*" | head -1)
        
        if [ "$days_until_expiry" -lt 30 ]; then
            echo "Certificate for $domain expires in $days_until_expiry days"
            return 0
        else
            echo "Certificate for $domain is valid for $days_until_expiry days"
            return 1
        fi
    fi
    
    return 1
}

# Function to renew certificate
renew_certificate() {
    local domain="$1"
    
    echo "Renewing certificate for $domain..."
    
    # Delete old certificate
    fly certs delete "$domain" --app "$APP_NAME" --yes
    
    # Create new certificate
    if fly certs create "$domain" --app "$APP_NAME"; then
        echo "Certificate renewed successfully for $domain"
        return 0
    else
        echo "Failed to renew certificate for $domain"
        return 1
    fi
}

# Main renewal process
for domain in "${DOMAINS[@]}"; do
    if [ "$domain" = "REPLACE_WITH_YOUR_DOMAIN" ]; then
        continue
    fi
    
    if check_cert_expiry "$domain"; then
        renew_certificate "$domain"
    fi
done
EOF

chmod +x /tmp/cert-renewal.sh
echo -e "${GREEN}Certificate renewal script created at /tmp/cert-renewal.sh${NC}"

# Display setup summary
echo -e "\n${GREEN}🎉 Custom Domain and SSL Setup Summary:${NC}"
echo "1. Domains added to Fly.io application"
echo "2. SSL certificates created and configured"
echo "3. DNS configuration guide generated"
echo "4. SSL monitoring script created"
echo "5. Domain redirect configuration prepared"
echo "6. Certificate renewal automation setup"

echo -e "\n${YELLOW}📋 Next Steps:${NC}"
echo "1. Configure DNS records with your domain registrar"
echo "2. Wait for DNS propagation (15-30 minutes)"
echo "3. Verify SSL certificates: fly certs list --app $APP_NAME"
echo "4. Test domain access: curl https://$domain"
echo "5. Update application URLs in your code"
echo "6. Set up monitoring: ./ssl-monitor.sh"
echo "7. Configure certificate renewal automation"

echo -e "\n${BLUE}📁 Files Created:${NC}"
echo "- /tmp/dns-setup-guide.md - DNS configuration guide"
echo "- /tmp/ssl-monitor.sh - SSL certificate monitoring"
echo "- /tmp/domain-redirects.js - Domain redirect middleware"
echo "- /tmp/cert-renewal.sh - Certificate renewal automation"

echo -e "\n${YELLOW}⚠️  Important Notes:${NC}"
echo "- DNS propagation can take 24-48 hours"
echo "- SSL certificates are automatically managed by Fly.io"
echo "- Test thoroughly before switching production traffic"
echo "- Monitor certificate expiration dates"
echo "- Keep DNS records updated if IP addresses change"

echo -e "\n${GREEN}🔗 Useful Commands:${NC}"
echo "# List certificates"
echo "fly certs list --app $APP_NAME"
echo ""
echo "# Check specific certificate"
echo "fly certs show $domain --app $APP_NAME"
echo ""
echo "# Test domain resolution"
echo "dig $domain"
echo ""
echo "# Test HTTPS connection"
echo "curl -I https://$domain"

echo -e "\n${GREEN}✅ Custom domain and SSL setup complete!${NC}"