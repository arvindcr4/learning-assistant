#!/bin/bash

# SSL Certificate Setup Script for Learning Assistant
# This script helps set up SSL certificates for HTTPS

set -e

# Configuration
DOMAIN="${DOMAIN:-localhost}"
SSL_DIR="${SSL_DIR:-./nginx/ssl}"
CERT_EMAIL="${CERT_EMAIL:-admin@example.com}"
STAGING="${STAGING:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[INFO]${NC} ${timestamp}: $message"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} ${timestamp}: $message"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} ${timestamp}: $message"
            ;;
        "DEBUG")
            echo -e "${BLUE}[DEBUG]${NC} ${timestamp}: $message"
            ;;
    esac
}

# Create SSL directory
create_ssl_directory() {
    log "INFO" "Creating SSL directory: $SSL_DIR"
    mkdir -p "$SSL_DIR"
    chmod 700 "$SSL_DIR"
}

# Generate self-signed certificate for development
generate_self_signed() {
    log "INFO" "Generating self-signed certificate for $DOMAIN"
    
    # Create OpenSSL configuration
    cat > "${SSL_DIR}/openssl.conf" << EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = CA
L = San Francisco
O = Learning Assistant
OU = IT Department
CN = $DOMAIN

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = localhost
DNS.3 = *.${DOMAIN}
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

    # Generate private key
    openssl genrsa -out "${SSL_DIR}/key.pem" 2048
    
    # Generate certificate
    openssl req -new -x509 -key "${SSL_DIR}/key.pem" \
        -out "${SSL_DIR}/cert.pem" \
        -days 365 \
        -config "${SSL_DIR}/openssl.conf" \
        -extensions v3_req
    
    # Set proper permissions
    chmod 600 "${SSL_DIR}/key.pem"
    chmod 644 "${SSL_DIR}/cert.pem"
    
    # Clean up
    rm -f "${SSL_DIR}/openssl.conf"
    
    log "INFO" "Self-signed certificate generated successfully"
    log "WARN" "This is a self-signed certificate. Browsers will show security warnings."
}

# Install Let's Encrypt certificate using Certbot
install_letsencrypt() {
    log "INFO" "Installing Let's Encrypt certificate for $DOMAIN"
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        log "ERROR" "Certbot is not installed. Please install it first."
        log "INFO" "Ubuntu/Debian: sudo apt-get install certbot"
        log "INFO" "CentOS/RHEL: sudo yum install certbot"
        log "INFO" "macOS: brew install certbot"
        exit 1
    fi
    
    # Check if domain is accessible
    if ! curl -f "http://$DOMAIN" >/dev/null 2>&1; then
        log "WARN" "Domain $DOMAIN is not accessible. Make sure your DNS is configured correctly."
    fi
    
    # Prepare certbot command
    local certbot_args=(
        "certonly"
        "--webroot"
        "-w" "/var/www/html"
        "-d" "$DOMAIN"
        "--email" "$CERT_EMAIL"
        "--agree-tos"
        "--non-interactive"
    )
    
    if [[ "$STAGING" == "true" ]]; then
        certbot_args+=("--staging")
        log "INFO" "Using Let's Encrypt staging environment"
    fi
    
    # Run certbot
    if sudo certbot "${certbot_args[@]}"; then
        log "INFO" "Let's Encrypt certificate obtained successfully"
        
        # Copy certificates to SSL directory
        sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "${SSL_DIR}/cert.pem"
        sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "${SSL_DIR}/key.pem"
        
        # Fix permissions
        sudo chown $(whoami):$(whoami) "${SSL_DIR}/cert.pem" "${SSL_DIR}/key.pem"
        chmod 644 "${SSL_DIR}/cert.pem"
        chmod 600 "${SSL_DIR}/key.pem"
        
        log "INFO" "Certificates copied to $SSL_DIR"
        
        # Set up auto-renewal
        setup_auto_renewal
    else
        log "ERROR" "Failed to obtain Let's Encrypt certificate"
        log "INFO" "Falling back to self-signed certificate"
        generate_self_signed
    fi
}

# Set up certificate auto-renewal
setup_auto_renewal() {
    log "INFO" "Setting up certificate auto-renewal"
    
    # Create renewal script
    cat > "${SSL_DIR}/renew-cert.sh" << 'EOF'
#!/bin/bash

# Certificate renewal script
DOMAIN="${DOMAIN}"
SSL_DIR="${SSL_DIR:-./nginx/ssl}"

# Renew certificate
if sudo certbot renew --quiet; then
    echo "$(date): Certificate renewed successfully"
    
    # Copy new certificates
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "${SSL_DIR}/cert.pem"
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "${SSL_DIR}/key.pem"
    
    # Fix permissions
    sudo chown $(whoami):$(whoami) "${SSL_DIR}/cert.pem" "${SSL_DIR}/key.pem"
    chmod 644 "${SSL_DIR}/cert.pem"
    chmod 600 "${SSL_DIR}/key.pem"
    
    # Reload Nginx
    if command -v docker-compose &> /dev/null; then
        docker-compose restart nginx
    elif systemctl is-active --quiet nginx; then
        sudo systemctl reload nginx
    fi
    
    echo "$(date): Nginx reloaded"
else
    echo "$(date): Certificate renewal failed"
    exit 1
fi
EOF

    chmod +x "${SSL_DIR}/renew-cert.sh"
    
    # Add to crontab (check twice daily)
    (crontab -l 2>/dev/null; echo "0 0,12 * * * ${SSL_DIR}/renew-cert.sh >> /var/log/cert-renewal.log 2>&1") | crontab -
    
    log "INFO" "Auto-renewal configured (runs twice daily)"
}

# Verify certificate
verify_certificate() {
    log "INFO" "Verifying SSL certificate"
    
    if [[ ! -f "${SSL_DIR}/cert.pem" || ! -f "${SSL_DIR}/key.pem" ]]; then
        log "ERROR" "Certificate files not found"
        return 1
    fi
    
    # Check certificate validity
    if openssl x509 -in "${SSL_DIR}/cert.pem" -text -noout >/dev/null 2>&1; then
        log "INFO" "Certificate is valid"
        
        # Show certificate details
        echo
        echo "Certificate Details:"
        echo "==================="
        openssl x509 -in "${SSL_DIR}/cert.pem" -text -noout | grep -A 5 "Subject:"
        openssl x509 -in "${SSL_DIR}/cert.pem" -text -noout | grep -A 3 "Validity"
        openssl x509 -in "${SSL_DIR}/cert.pem" -text -noout | grep -A 10 "Subject Alternative Name"
        echo
    else
        log "ERROR" "Certificate is invalid"
        return 1
    fi
    
    # Check private key
    if openssl rsa -in "${SSL_DIR}/key.pem" -check -noout >/dev/null 2>&1; then
        log "INFO" "Private key is valid"
    else
        log "ERROR" "Private key is invalid"
        return 1
    fi
    
    # Check if certificate and key match
    cert_hash=$(openssl x509 -in "${SSL_DIR}/cert.pem" -pubkey -noout | openssl md5)
    key_hash=$(openssl rsa -in "${SSL_DIR}/key.pem" -pubout 2>/dev/null | openssl md5)
    
    if [[ "$cert_hash" == "$key_hash" ]]; then
        log "INFO" "Certificate and private key match"
    else
        log "ERROR" "Certificate and private key do not match"
        return 1
    fi
    
    log "INFO" "SSL certificate verification completed successfully"
}

# Show certificate information
show_certificate_info() {
    if [[ -f "${SSL_DIR}/cert.pem" ]]; then
        echo "SSL Certificate Information"
        echo "=========================="
        openssl x509 -in "${SSL_DIR}/cert.pem" -text -noout | grep -E "(Subject:|Issuer:|Not Before:|Not After :|DNS:|IP Address:)"
        echo
        
        # Check expiration
        if openssl x509 -in "${SSL_DIR}/cert.pem" -checkend 86400 >/dev/null 2>&1; then
            echo "✅ Certificate is valid for more than 24 hours"
        else
            echo "⚠️  Certificate expires within 24 hours"
        fi
        
        if openssl x509 -in "${SSL_DIR}/cert.pem" -checkend 2592000 >/dev/null 2>&1; then
            echo "✅ Certificate is valid for more than 30 days"
        else
            echo "⚠️  Certificate expires within 30 days"
        fi
    else
        echo "No certificate found at ${SSL_DIR}/cert.pem"
    fi
}

# Generate Diffie-Hellman parameters
generate_dhparam() {
    log "INFO" "Generating Diffie-Hellman parameters (this may take a while...)"
    
    if [[ ! -f "${SSL_DIR}/dhparam.pem" ]]; then
        openssl dhparam -out "${SSL_DIR}/dhparam.pem" 2048
        chmod 644 "${SSL_DIR}/dhparam.pem"
        log "INFO" "Diffie-Hellman parameters generated"
    else
        log "INFO" "Diffie-Hellman parameters already exist"
    fi
}

# Main setup function
setup_ssl() {
    log "INFO" "Starting SSL setup for domain: $DOMAIN"
    
    create_ssl_directory
    
    if [[ "$DOMAIN" == "localhost" || "$DOMAIN" == "127.0.0.1" ]]; then
        log "INFO" "Local development detected, generating self-signed certificate"
        generate_self_signed
    else
        log "INFO" "Production domain detected, attempting Let's Encrypt certificate"
        install_letsencrypt
    fi
    
    generate_dhparam
    verify_certificate
    
    log "INFO" "SSL setup completed"
    echo
    echo "Next steps:"
    echo "1. Update your nginx configuration to use the certificates"
    echo "2. Restart your web server"
    echo "3. Test HTTPS access to your domain"
    echo
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        setup_ssl
        ;;
    "self-signed")
        create_ssl_directory
        generate_self_signed
        verify_certificate
        ;;
    "letsencrypt")
        create_ssl_directory
        install_letsencrypt
        verify_certificate
        ;;
    "verify")
        verify_certificate
        ;;
    "info")
        show_certificate_info
        ;;
    "renew")
        if [[ -f "${SSL_DIR}/renew-cert.sh" ]]; then
            "${SSL_DIR}/renew-cert.sh"
        else
            log "ERROR" "Renewal script not found. Run setup first."
            exit 1
        fi
        ;;
    "help")
        echo "SSL Setup Script for Learning Assistant"
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  setup       - Auto-detect and setup appropriate certificate (default)"
        echo "  self-signed - Generate self-signed certificate"
        echo "  letsencrypt - Install Let's Encrypt certificate"
        echo "  verify      - Verify existing certificate"
        echo "  info        - Show certificate information"
        echo "  renew       - Renew certificate"
        echo "  help        - Show this help"
        echo
        echo "Environment variables:"
        echo "  DOMAIN      - Domain name (default: localhost)"
        echo "  SSL_DIR     - SSL directory (default: ./nginx/ssl)"
        echo "  CERT_EMAIL  - Email for Let's Encrypt (default: admin@example.com)"
        echo "  STAGING     - Use Let's Encrypt staging (default: false)"
        echo
        echo "Examples:"
        echo "  DOMAIN=example.com $0 setup"
        echo "  DOMAIN=localhost $0 self-signed"
        echo "  $0 verify"
        ;;
    *)
        log "ERROR" "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac