#!/bin/bash

# HashiCorp Vault Setup Script for Learning Assistant
# This script sets up a HashiCorp Vault instance for secrets management

set -euo pipefail

# Configuration
VAULT_VERSION="1.15.4"
VAULT_PORT=${VAULT_PORT:-8200}
VAULT_DATA_DIR=${VAULT_DATA_DIR:-"./vault-data"}
VAULT_CONFIG_DIR=${VAULT_CONFIG_DIR:-"./vault-config"}
VAULT_LOG_LEVEL=${VAULT_LOG_LEVEL:-"info"}

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

# Check if running on supported OS
check_os() {
    case "$(uname -s)" in
        Linux*)     OS=linux;;
        Darwin*)    OS=darwin;;
        *)          log_error "Unsupported OS: $(uname -s)" && exit 1;;
    esac
    
    case "$(uname -m)" in
        x86_64*)    ARCH=amd64;;
        arm64*)     ARCH=arm64;;
        aarch64*)   ARCH=arm64;;
        *)          log_error "Unsupported architecture: $(uname -m)" && exit 1;;
    esac
}

# Download and install Vault
install_vault() {
    log_info "Installing HashiCorp Vault v${VAULT_VERSION}..."
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Download Vault
    VAULT_ZIP="vault_${VAULT_VERSION}_${OS}_${ARCH}.zip"
    VAULT_URL="https://releases.hashicorp.com/vault/${VAULT_VERSION}/${VAULT_ZIP}"
    
    log_info "Downloading from: $VAULT_URL"
    curl -LO "$VAULT_URL"
    
    # Verify checksum (optional but recommended)
    curl -LO "${VAULT_URL%/*}/vault_${VAULT_VERSION}_SHA256SUMS"
    
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum -c --ignore-missing "vault_${VAULT_VERSION}_SHA256SUMS"
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 -c --ignore-missing "vault_${VAULT_VERSION}_SHA256SUMS"
    else
        log_warning "Could not verify checksum (sha256sum or shasum not found)"
    fi
    
    # Extract and install
    unzip "$VAULT_ZIP"
    
    # Install to /usr/local/bin or current directory
    if [[ -w /usr/local/bin ]]; then
        mv vault /usr/local/bin/
        log_success "Vault installed to /usr/local/bin/vault"
    else
        mv vault ../vault
        log_success "Vault installed to ./vault (add to PATH manually)"
    fi
    
    # Clean up
    cd ..
    rm -rf "$TEMP_DIR"
}

# Create Vault configuration
create_vault_config() {
    log_info "Creating Vault configuration..."
    
    mkdir -p "$VAULT_CONFIG_DIR"
    mkdir -p "$VAULT_DATA_DIR"
    
    cat > "$VAULT_CONFIG_DIR/vault.hcl" <<EOF
# HashiCorp Vault Configuration for Learning Assistant

# Storage backend
storage "file" {
  path = "${VAULT_DATA_DIR}"
}

# Listener
listener "tcp" {
  address = "127.0.0.1:${VAULT_PORT}"
  tls_disable = true
  
  # In production, enable TLS:
  # tls_disable = false
  # tls_cert_file = "/path/to/cert.pem"
  # tls_key_file = "/path/to/key.pem"
}

# API address
api_addr = "http://127.0.0.1:${VAULT_PORT}"

# Cluster address (for HA setups)
cluster_addr = "http://127.0.0.1:8201"

# UI
ui = true

# Logging
log_level = "${VAULT_LOG_LEVEL}"
log_format = "json"

# Disable mlock (for development only)
disable_mlock = true

# Default lease TTL
default_lease_ttl = "168h"    # 7 days
max_lease_ttl = "720h"        # 30 days

# Plugin directory
plugin_directory = "${VAULT_CONFIG_DIR}/plugins"
EOF

    log_success "Vault configuration created at $VAULT_CONFIG_DIR/vault.hcl"
}

# Create systemd service (Linux only)
create_systemd_service() {
    if [[ "$OS" != "linux" ]]; then
        log_warning "Systemd service creation is only supported on Linux"
        return
    fi
    
    log_info "Creating systemd service..."
    
    cat > vault.service <<EOF
[Unit]
Description=HashiCorp Vault
Documentation=https://www.vaultproject.io/docs/
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=$(pwd)/${VAULT_CONFIG_DIR}/vault.hcl

[Service]
Type=notify
User=vault
Group=vault
ProtectSystem=full
ProtectHome=read-only
PrivateTmp=yes
PrivateDevices=yes
SecureBits=keep-caps
AmbientCapabilities=CAP_IPC_LOCK
Capabilities=CAP_IPC_LOCK+ep
CapabilityBoundingSet=CAP_SYSLOG CAP_IPC_LOCK
NoNewPrivileges=yes
ExecStart=/usr/local/bin/vault server -config=$(pwd)/${VAULT_CONFIG_DIR}/vault.hcl
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=process
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
StartLimitInterval=60
StartLimitBurst=3
LimitNOFILE=65536
LimitMEMLOCK=infinity

[Install]
WantedBy=multi-user.target
EOF

    log_info "Systemd service file created. To install:"
    echo "  sudo mv vault.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable vault"
    echo "  sudo systemctl start vault"
}

# Initialize Vault
init_vault() {
    log_info "Initializing Vault..."
    
    # Wait for Vault to be ready
    local retry_count=0
    local max_retries=30
    
    while ! vault status >/dev/null 2>&1 && [[ $retry_count -lt $max_retries ]]; do
        log_info "Waiting for Vault to be ready... (attempt $((retry_count + 1))/$max_retries)"
        sleep 2
        ((retry_count++))
    done
    
    if [[ $retry_count -eq $max_retries ]]; then
        log_error "Vault failed to start within timeout"
        return 1
    fi
    
    # Check if already initialized
    if vault status | grep -q "Initialized.*true"; then
        log_warning "Vault is already initialized"
        return 0
    fi
    
    # Initialize with 5 key shares and threshold of 3
    log_info "Initializing Vault with 5 key shares and threshold of 3..."
    vault operator init -key-shares=5 -key-threshold=3 -format=json > vault-init.json
    
    log_success "Vault initialized successfully!"
    log_warning "IMPORTANT: Save the vault-init.json file securely!"
    log_warning "Initial root token and unseal keys are in vault-init.json"
    
    # Extract unseal keys and root token
    UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' vault-init.json)
    UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' vault-init.json)
    UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' vault-init.json)
    ROOT_TOKEN=$(jq -r '.root_token' vault-init.json)
    
    # Unseal Vault
    log_info "Unsealing Vault..."
    vault operator unseal "$UNSEAL_KEY_1"
    vault operator unseal "$UNSEAL_KEY_2"
    vault operator unseal "$UNSEAL_KEY_3"
    
    log_success "Vault unsealed successfully!"
    
    # Authenticate with root token
    export VAULT_TOKEN="$ROOT_TOKEN"
    
    log_info "Vault root token: $ROOT_TOKEN"
    log_warning "Store this token securely and rotate it after initial setup!"
}

# Setup secrets engines and policies
setup_vault() {
    log_info "Setting up Vault for Learning Assistant..."
    
    # Enable KV v2 secrets engine
    vault secrets enable -path=learning-assistant kv-v2
    
    # Create policy for the application
    cat > learning-assistant-policy.hcl <<EOF
# Policy for Learning Assistant application

# Allow read/write access to application secrets
path "learning-assistant/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "learning-assistant/metadata/*" {
  capabilities = ["read", "list"]
}

# Allow listing secrets
path "learning-assistant/*" {
  capabilities = ["list"]
}

# Allow token renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}

# Allow token lookup
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
EOF

    vault policy write learning-assistant learning-assistant-policy.hcl
    
    # Create a token for the application
    APP_TOKEN=$(vault token create -policy=learning-assistant -ttl=8760h -format=json | jq -r '.auth.client_token')
    
    log_success "Application token created: $APP_TOKEN"
    log_info "Add this token to your .env file as SECRETS_TOKEN"
    
    # Create some example secrets
    vault kv put learning-assistant/resend-api-key value="your-resend-api-key-here"
    vault kv put learning-assistant/tambo-api-key value="your-tambo-api-key-here"
    vault kv put learning-assistant/lingo-dev-api-key value="your-lingo-dev-api-key-here"
    vault kv put learning-assistant/firecrawl-api-key value="your-firecrawl-api-key-here"
    vault kv put learning-assistant/better-auth-secret value="$(openssl rand -hex 32)"
    vault kv put learning-assistant/jwt-secret value="$(openssl rand -hex 32)"
    vault kv put learning-assistant/jwt-refresh-secret value="$(openssl rand -hex 32)"
    vault kv put learning-assistant/csrf-secret value="$(openssl rand -hex 32)"
    vault kv put learning-assistant/supabase-service-role-key value="your-supabase-service-role-key-here"
    
    log_success "Example secrets created in Vault"
    
    # Save configuration
    cat > vault-env.sh <<EOF
#!/bin/bash
# Vault environment configuration for Learning Assistant

export VAULT_ADDR="http://127.0.0.1:${VAULT_PORT}"
export VAULT_TOKEN="$APP_TOKEN"
export SECRETS_PROVIDER="hashicorp-vault"
export SECRETS_ENDPOINT="http://127.0.0.1:${VAULT_PORT}"
export SECRETS_TOKEN="$APP_TOKEN"
export SECRETS_NAMESPACE="learning-assistant"
export SECRETS_ENCRYPTION_KEY="$(openssl rand -hex 32)"

echo "Vault environment configured for Learning Assistant"
EOF

    chmod +x vault-env.sh
    
    log_success "Environment configuration saved to vault-env.sh"
    log_info "Source this file to set environment variables: source vault-env.sh"
}

# Start Vault server
start_vault() {
    log_info "Starting Vault server..."
    
    export VAULT_ADDR="http://127.0.0.1:${VAULT_PORT}"
    
    if pgrep -f "vault server" >/dev/null; then
        log_warning "Vault server is already running"
        return 0
    fi
    
    # Start Vault in background
    vault server -config="$VAULT_CONFIG_DIR/vault.hcl" > vault.log 2>&1 &
    VAULT_PID=$!
    
    log_info "Vault server started with PID: $VAULT_PID"
    log_info "Logs are being written to vault.log"
    
    # Save PID for later use
    echo $VAULT_PID > vault.pid
    
    # Wait a moment for startup
    sleep 3
    
    log_success "Vault server is running on http://127.0.0.1:${VAULT_PORT}"
}

# Stop Vault server
stop_vault() {
    log_info "Stopping Vault server..."
    
    if [[ -f vault.pid ]]; then
        PID=$(cat vault.pid)
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            rm vault.pid
            log_success "Vault server stopped"
        else
            log_warning "Vault server was not running"
            rm vault.pid
        fi
    else
        # Try to find and kill vault processes
        pkill -f "vault server" && log_success "Vault server stopped" || log_warning "No Vault server found"
    fi
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install     Install HashiCorp Vault"
    echo "  configure   Create Vault configuration"
    echo "  start       Start Vault server"
    echo "  init        Initialize Vault"
    echo "  setup       Setup secrets engines and policies"
    echo "  stop        Stop Vault server"
    echo "  status      Show Vault status"
    echo "  unseal      Unseal Vault (requires unseal keys)"
    echo "  full        Full setup (install, configure, start, init, setup)"
    echo ""
    echo "Environment variables:"
    echo "  VAULT_PORT           Port for Vault server (default: 8200)"
    echo "  VAULT_DATA_DIR       Data directory (default: ./vault-data)"
    echo "  VAULT_CONFIG_DIR     Config directory (default: ./vault-config)"
    echo "  VAULT_LOG_LEVEL      Log level (default: info)"
}

# Check Vault status
check_status() {
    export VAULT_ADDR="http://127.0.0.1:${VAULT_PORT}"
    
    if ! command -v vault >/dev/null 2>&1; then
        log_error "Vault is not installed"
        return 1
    fi
    
    if ! vault status >/dev/null 2>&1; then
        log_error "Vault server is not running or not accessible"
        return 1
    fi
    
    vault status
}

# Unseal Vault
unseal_vault() {
    export VAULT_ADDR="http://127.0.0.1:${VAULT_PORT}"
    
    if [[ ! -f vault-init.json ]]; then
        log_error "vault-init.json not found. Initialize Vault first."
        return 1
    fi
    
    if vault status | grep -q "Sealed.*false"; then
        log_info "Vault is already unsealed"
        return 0
    fi
    
    log_info "Unsealing Vault..."
    
    UNSEAL_KEY_1=$(jq -r '.unseal_keys_b64[0]' vault-init.json)
    UNSEAL_KEY_2=$(jq -r '.unseal_keys_b64[1]' vault-init.json)
    UNSEAL_KEY_3=$(jq -r '.unseal_keys_b64[2]' vault-init.json)
    
    vault operator unseal "$UNSEAL_KEY_1"
    vault operator unseal "$UNSEAL_KEY_2"
    vault operator unseal "$UNSEAL_KEY_3"
    
    log_success "Vault unsealed successfully!"
}

# Main script logic
main() {
    check_os
    
    case "${1:-}" in
        install)
            install_vault
            ;;
        configure)
            create_vault_config
            create_systemd_service
            ;;
        start)
            start_vault
            ;;
        init)
            init_vault
            ;;
        setup)
            setup_vault
            ;;
        stop)
            stop_vault
            ;;
        status)
            check_status
            ;;
        unseal)
            unseal_vault
            ;;
        full)
            install_vault
            create_vault_config
            start_vault
            init_vault
            setup_vault
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"