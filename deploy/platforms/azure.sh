#!/bin/bash

# =============================================================================
# Microsoft Azure Deployment Platform Handler
# =============================================================================

azure_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing Microsoft Azure deployment..."
    
    # Load Azure-specific configuration
    local azure_config_file="${CONFIG_DIR}/azure/${environment}.env"
    if [[ -f "${azure_config_file}" ]]; then
        source "${azure_config_file}"
    fi
    
    # Set defaults
    AZURE_RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-learning-assistant-${environment}}"
    AZURE_LOCATION="${AZURE_LOCATION:-${DEFAULT_REGION:-eastus}}"
    AZURE_APP_SERVICE_PLAN="${AZURE_APP_SERVICE_PLAN:-learning-assistant-plan}"
    AZURE_WEBAPP_NAME="${AZURE_WEBAPP_NAME:-learning-assistant-${environment}-$(date +%s)}"
    AZURE_VM_SIZE="${AZURE_VM_SIZE:-${DEFAULT_INSTANCE_TYPE:-Standard_B2s}}"
    
    # Validate Azure CLI
    if ! command -v az &>/dev/null; then
        log_error "Azure CLI not found. Please install it first."
        return 1
    fi
    
    # Check authentication
    if ! az account show &>/dev/null; then
        log_error "Azure CLI not authenticated. Please run 'az login' first."
        return 1
    fi
    
    # Choose deployment method
    case "${AZURE_DEPLOY_METHOD:-webapp}" in
        "webapp")
            azure_deploy_web_app "${environment}" "${deployment_id}"
            ;;
        "vm")
            azure_deploy_virtual_machine "${environment}" "${deployment_id}"
            ;;
        "aci")
            azure_deploy_container_instance "${environment}" "${deployment_id}"
            ;;
        "aks")
            azure_deploy_kubernetes_service "${environment}" "${deployment_id}"
            ;;
        *)
            log_error "Invalid Azure deployment method: ${AZURE_DEPLOY_METHOD}"
            return 1
            ;;
    esac
}

azure_deploy_web_app() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to Azure Web App..."
    
    # Create resource group
    azure_ensure_resource_group "${AZURE_RESOURCE_GROUP}" "${AZURE_LOCATION}"
    
    # Create App Service Plan
    azure_ensure_app_service_plan "${AZURE_APP_SERVICE_PLAN}" "${AZURE_RESOURCE_GROUP}" "${AZURE_LOCATION}"
    
    # Create Web App
    log_info "Creating Azure Web App: ${AZURE_WEBAPP_NAME}"
    
    if az webapp create \
        --name "${AZURE_WEBAPP_NAME}" \
        --resource-group "${AZURE_RESOURCE_GROUP}" \
        --plan "${AZURE_APP_SERVICE_PLAN}" \
        --runtime "NODE|20-lts" \
        --deployment-container-image-name "nginx:latest"; then
        
        log_success "Azure Web App created: ${AZURE_WEBAPP_NAME}"
        
        # Configure application settings
        azure_configure_webapp_settings "${AZURE_WEBAPP_NAME}" "${AZURE_RESOURCE_GROUP}" "${environment}" "${deployment_id}"
        
        # Deploy application
        azure_deploy_webapp_code "${AZURE_WEBAPP_NAME}" "${AZURE_RESOURCE_GROUP}"
        
        # Get Web App URL
        local webapp_url
        webapp_url=$(az webapp show --name "${AZURE_WEBAPP_NAME}" --resource-group "${AZURE_RESOURCE_GROUP}" --query "defaultHostName" -o tsv)
        export DEPLOYMENT_URL="https://${webapp_url}"
        
        log_success "Azure Web App deployment completed!"
        log_info "Application deployed at: ${DEPLOYMENT_URL}"
        
    else
        log_error "Failed to create Azure Web App"
        return 1
    fi
}

azure_deploy_virtual_machine() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to Azure Virtual Machine..."
    
    # Create resource group
    azure_ensure_resource_group "${AZURE_RESOURCE_GROUP}" "${AZURE_LOCATION}"
    
    # Create VM
    local vm_name="learning-assistant-${environment}-vm"
    
    # Create startup script
    local startup_script="${SCRIPT_DIR}/tmp/azure-startup.sh"
    azure_create_startup_script "${startup_script}" "${environment}" "${deployment_id}"
    
    log_info "Creating Azure Virtual Machine: ${vm_name}"
    
    if az vm create \
        --name "${vm_name}" \
        --resource-group "${AZURE_RESOURCE_GROUP}" \
        --location "${AZURE_LOCATION}" \
        --image "Ubuntu2204" \
        --size "${AZURE_VM_SIZE}" \
        --admin-username "azureuser" \
        --generate-ssh-keys \
        --custom-data "${startup_script}" \
        --tags "Environment=${environment}" "DeploymentId=${deployment_id}"; then
        
        log_success "Azure Virtual Machine created: ${vm_name}"
        
        # Get VM IP
        local vm_ip
        vm_ip=$(az vm show --name "${vm_name}" --resource-group "${AZURE_RESOURCE_GROUP}" --show-details --query "publicIps" -o tsv)
        
        log_info "VM IP: ${vm_ip}"
        export DEPLOYMENT_URL="http://${vm_ip}:3000"
        
        # Open firewall ports
        az vm open-port --port 3000 --resource-group "${AZURE_RESOURCE_GROUP}" --name "${vm_name}"
        
        # Wait for deployment to complete
        azure_wait_for_vm_deployment "${vm_name}" "${AZURE_RESOURCE_GROUP}"
        
        log_success "Azure VM deployment completed!"
        
    else
        log_error "Failed to create Azure Virtual Machine"
        return 1
    fi
}

azure_deploy_container_instance() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to Azure Container Instances..."
    
    # Create resource group
    azure_ensure_resource_group "${AZURE_RESOURCE_GROUP}" "${AZURE_LOCATION}"
    
    # Build and push container to Azure Container Registry
    local acr_name="learningassistant${environment}acr"
    local image_name="${acr_name}.azurecr.io/learning-assistant:${deployment_id}"
    
    azure_build_and_push_container "${acr_name}" "${image_name}" "${deployment_id}"
    
    # Create container instance
    local container_name="learning-assistant-${environment}-container"
    
    log_info "Creating Azure Container Instance: ${container_name}"
    
    if az container create \
        --name "${container_name}" \
        --resource-group "${AZURE_RESOURCE_GROUP}" \
        --location "${AZURE_LOCATION}" \
        --image "${image_name}" \
        --cpu 1 \
        --memory 1 \
        --ports 3000 \
        --ip-address public \
        --environment-variables \
            NODE_ENV="${environment}" \
            DEPLOYMENT_ID="${deployment_id}" \
            DEPLOYMENT_TIMESTAMP="$(date)" \
            DATABASE_URL="sqlite:./app.db" \
            BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
            NEXT_TELEMETRY_DISABLED="1" \
            FEATURE_ANALYTICS_ENABLED="true" \
            FEATURE_RECOMMENDATIONS_ENABLED="true" \
            FEATURE_CHAT_ENABLED="false"; then
        
        log_success "Azure Container Instance created: ${container_name}"
        
        # Get container IP
        local container_ip
        container_ip=$(az container show --name "${container_name}" --resource-group "${AZURE_RESOURCE_GROUP}" --query "ipAddress.ip" -o tsv)
        
        export DEPLOYMENT_URL="http://${container_ip}:3000"
        log_info "Container deployed at: ${DEPLOYMENT_URL}"
        
    else
        log_error "Failed to create Azure Container Instance"
        return 1
    fi
}

azure_ensure_resource_group() {
    local resource_group="$1"
    local location="$2"
    
    if ! az group show --name "${resource_group}" &>/dev/null; then
        log_info "Creating resource group: ${resource_group}"
        az group create --name "${resource_group}" --location "${location}"
        log_success "Resource group created: ${resource_group}"
    else
        log_info "Resource group already exists: ${resource_group}"
    fi
}

azure_ensure_app_service_plan() {
    local plan_name="$1"
    local resource_group="$2"
    local location="$3"
    
    if ! az appservice plan show --name "${plan_name}" --resource-group "${resource_group}" &>/dev/null; then
        log_info "Creating App Service Plan: ${plan_name}"
        az appservice plan create \
            --name "${plan_name}" \
            --resource-group "${resource_group}" \
            --location "${location}" \
            --sku B1 \
            --is-linux
        log_success "App Service Plan created: ${plan_name}"
    else
        log_info "App Service Plan already exists: ${plan_name}"
    fi
}

azure_configure_webapp_settings() {
    local webapp_name="$1"
    local resource_group="$2"
    local environment="$3"
    local deployment_id="$4"
    
    log_info "Configuring Web App settings..."
    
    # Set application settings
    az webapp config appsettings set \
        --name "${webapp_name}" \
        --resource-group "${resource_group}" \
        --settings \
            NODE_ENV="${environment}" \
            DEPLOYMENT_ID="${deployment_id}" \
            DEPLOYMENT_TIMESTAMP="$(date)" \
            DATABASE_URL="sqlite:./app.db" \
            BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
            NEXT_TELEMETRY_DISABLED="1" \
            FEATURE_ANALYTICS_ENABLED="true" \
            FEATURE_RECOMMENDATIONS_ENABLED="true" \
            FEATURE_CHAT_ENABLED="false" \
            WEBSITE_NODE_DEFAULT_VERSION="~20" \
            PORT="3000" \
            WEBSITES_PORT="3000"
    
    log_success "Web App settings configured"
}

azure_deploy_webapp_code() {
    local webapp_name="$1"
    local resource_group="$2"
    
    log_info "Deploying application code to Web App..."
    
    # Create deployment package
    local package_file="${SCRIPT_DIR}/tmp/webapp-package.zip"
    azure_create_deployment_package "${package_file}"
    
    # Deploy using ZIP deployment
    if az webapp deployment source config-zip \
        --name "${webapp_name}" \
        --resource-group "${resource_group}" \
        --src "${package_file}"; then
        
        log_success "Application code deployed to Web App"
    else
        log_error "Failed to deploy application code"
        return 1
    fi
}

azure_create_deployment_package() {
    local package_file="$1"
    
    log_info "Creating deployment package..."
    
    mkdir -p "$(dirname "${package_file}")"
    
    # Create a temporary directory for the package
    local temp_dir="${SCRIPT_DIR}/tmp/webapp-package"
    mkdir -p "${temp_dir}"
    
    # Copy application files
    cp -r "${SCRIPT_DIR}/"* "${temp_dir}/" 2>/dev/null || true
    
    # Create package.json if it doesn't exist
    if [[ ! -f "${temp_dir}/package.json" ]]; then
        cat > "${temp_dir}/package.json" << 'EOF'
{
  "name": "learning-assistant",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "build": "echo 'Build completed'"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
EOF
    fi
    
    # Create simple server.js if it doesn't exist
    if [[ ! -f "${temp_dir}/server.js" ]]; then
        cat > "${temp_dir}/server.js" << 'EOF'
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>Learning Assistant</h1><p>Deployed on Azure!</p>');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
EOF
    fi
    
    # Create ZIP package
    cd "${temp_dir}" && zip -r "${package_file}" . && cd - > /dev/null
    
    # Cleanup
    rm -rf "${temp_dir}"
    
    log_success "Deployment package created: ${package_file}"
}

azure_create_startup_script() {
    local script_path="$1"
    local environment="$2"
    local deployment_id="$3"
    
    mkdir -p "$(dirname "${script_path}")"
    
    cat > "${script_path}" << 'EOF'
#!/bin/bash
set -e

# Update system
apt-get update -y
apt-get upgrade -y

# Install required packages
apt-get install -y curl wget git docker.io docker-compose

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Start Docker
systemctl start docker
systemctl enable docker
usermod -aG docker azureuser

# Get VM IP
VM_IP=$(curl -s -H "Metadata:true" "http://169.254.169.254/metadata/instance/network/interface/0/ipv4/ipAddress/0/publicIpAddress?api-version=2021-02-01&format=text")

# Create application directory
mkdir -p /opt/learning-assistant
cd /opt/learning-assistant

# Clone repository or create basic structure
if ! git clone https://github.com/your-repo/learning-assistant.git .; then
    echo "Repository not found, creating basic structure..."
    cat > package.json << 'PKGJSON'
{
  "name": "learning-assistant",
  "version": "1.0.0",
  "scripts": {
    "build": "echo 'Build completed'",
    "start": "node -e \"const http = require('http'); const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<h1>Learning Assistant</h1><p>Deployed on Azure!</p>'); }); server.listen(3000, () => console.log('Server running on port 3000'));\""
  }
}
PKGJSON
fi

# Create environment file
cat > .env.local << ENVFILE
NODE_ENV=production
PORT=3000
DEPLOYMENT_ID=azure-deployment-$(date +%s)
DEPLOYMENT_TIMESTAMP=$(date)
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_API_URL=http://$VM_IP:3000
NEXT_PUBLIC_APP_URL=http://$VM_IP:3000
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false
ENVFILE

# Install dependencies and build
npm install --production
npm run build

# Create systemd service
cat > /etc/systemd/system/learning-assistant.service << 'SERVICEEOF'
[Unit]
Description=Learning Assistant
After=network.target

[Service]
Type=simple
User=azureuser
WorkingDirectory=/opt/learning-assistant
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Enable and start service
systemctl daemon-reload
systemctl enable learning-assistant
systemctl start learning-assistant

# Setup firewall
ufw allow 22
ufw allow 3000
ufw --force enable

# Mark deployment as complete
echo "$(date): Azure deployment completed" > /opt/learning-assistant/deployment-complete
EOF
    
    log_info "Azure startup script created: ${script_path}"
}

azure_wait_for_vm_deployment() {
    local vm_name="$1"
    local resource_group="$2"
    
    log_info "Waiting for Azure VM deployment to complete..."
    
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        if az vm run-command invoke \
            --name "${vm_name}" \
            --resource-group "${resource_group}" \
            --command-id RunShellScript \
            --scripts "[ -f /opt/learning-assistant/deployment-complete ]" \
            --query "value[0].message" -o tsv | grep -q "succeeded" 2>/dev/null; then
            
            log_success "Azure VM deployment completed successfully"
            return 0
        fi
        
        log_info "Waiting for deployment... (${i}/${max_attempts})"
        sleep 20
    done
    
    log_error "Azure VM deployment timed out"
    return 1
}

azure_build_and_push_container() {
    local acr_name="$1"
    local image_name="$2"
    local deployment_id="$3"
    
    log_info "Building and pushing container to Azure Container Registry..."
    
    # Create ACR if it doesn't exist
    if ! az acr show --name "${acr_name}" --resource-group "${AZURE_RESOURCE_GROUP}" &>/dev/null; then
        log_info "Creating Azure Container Registry: ${acr_name}"
        az acr create \
            --name "${acr_name}" \
            --resource-group "${AZURE_RESOURCE_GROUP}" \
            --location "${AZURE_LOCATION}" \
            --sku Basic \
            --admin-enabled true
    fi
    
    # Build and push image
    if az acr build \
        --registry "${acr_name}" \
        --image "learning-assistant:${deployment_id}" \
        "${SCRIPT_DIR}"; then
        
        log_success "Container image built and pushed to ACR"
    else
        log_error "Failed to build and push container image"
        return 1
    fi
}

azure_setup_database() {
    local environment="$1"
    
    log_info "Setting up Azure Database for PostgreSQL..."
    
    local db_server_name="learning-assistant-${environment}-db"
    local db_name="learning_assistant"
    local db_user="learning_assistant_user"
    local db_password="$(openssl rand -base64 32)"
    
    # Create PostgreSQL server
    if az postgres server create \
        --name "${db_server_name}" \
        --resource-group "${AZURE_RESOURCE_GROUP}" \
        --location "${AZURE_LOCATION}" \
        --admin-user "${db_user}" \
        --admin-password "${db_password}" \
        --sku-name B_Gen5_1 \
        --version 13; then
        
        log_success "Azure Database for PostgreSQL created: ${db_server_name}"
        
        # Create database
        az postgres db create \
            --name "${db_name}" \
            --server-name "${db_server_name}" \
            --resource-group "${AZURE_RESOURCE_GROUP}"
        
        log_success "Database created: ${db_name}"
        
    else
        log_error "Failed to create Azure Database for PostgreSQL"
        return 1
    fi
}

azure_show_deployment_info() {
    local environment="$1"
    
    log_info "Microsoft Azure Deployment Information:"
    
    echo -e "\n${CYAN}Resource Group: ${AZURE_RESOURCE_GROUP}${NC}"
    echo -e "${CYAN}Location: ${AZURE_LOCATION}${NC}"
    
    # Show Web Apps
    echo -e "\n${CYAN}Web Apps:${NC}"
    az webapp list --resource-group "${AZURE_RESOURCE_GROUP}" --query "[?contains(name, 'learning-assistant-${environment}')].[name,state,defaultHostName]" -o table || echo "No Web Apps found"
    
    # Show Virtual Machines
    echo -e "\n${CYAN}Virtual Machines:${NC}"
    az vm list --resource-group "${AZURE_RESOURCE_GROUP}" --query "[?contains(name, 'learning-assistant-${environment}')].[name,powerState,location,hardwareProfile.vmSize]" -o table || echo "No VMs found"
    
    # Show Container Instances
    echo -e "\n${CYAN}Container Instances:${NC}"
    az container list --resource-group "${AZURE_RESOURCE_GROUP}" --query "[?contains(name, 'learning-assistant-${environment}')].[name,state,ipAddress.ip,containers[0].ports[0].port]" -o table || echo "No Container Instances found"
    
    # Show Database Servers
    echo -e "\n${CYAN}Database Servers:${NC}"
    az postgres server list --resource-group "${AZURE_RESOURCE_GROUP}" --query "[?contains(name, 'learning-assistant-${environment}')].[name,userVisibleState,location]" -o table || echo "No Database Servers found"
    
    echo -e "\n${YELLOW}Useful Commands:${NC}"
    echo "  View webapp logs: az webapp log tail --name <webapp-name> --resource-group ${AZURE_RESOURCE_GROUP}"
    echo "  SSH to VM: az vm run-command invoke --name <vm-name> --resource-group ${AZURE_RESOURCE_GROUP} --command-id RunShellScript --scripts 'command'"
    echo "  View container logs: az container logs --name <container-name> --resource-group ${AZURE_RESOURCE_GROUP}"
    echo "  Restart webapp: az webapp restart --name <webapp-name> --resource-group ${AZURE_RESOURCE_GROUP}"
}

azure_cleanup_deployment() {
    local environment="$1"
    
    log_info "Cleaning up Azure deployment..."
    
    # Delete entire resource group (this will delete all resources)
    if az group show --name "${AZURE_RESOURCE_GROUP}" &>/dev/null; then
        log_warning "This will delete the entire resource group: ${AZURE_RESOURCE_GROUP}"
        echo -e "${YELLOW}Are you sure you want to continue? [y/N]${NC}"
        read -r confirmation
        
        if [[ "${confirmation}" =~ ^[Yy]$ ]]; then
            log_info "Deleting resource group: ${AZURE_RESOURCE_GROUP}"
            az group delete --name "${AZURE_RESOURCE_GROUP}" --yes --no-wait
            log_success "Resource group deletion initiated"
        else
            log_info "Cleanup cancelled"
        fi
    else
        log_info "Resource group not found: ${AZURE_RESOURCE_GROUP}"
    fi
}