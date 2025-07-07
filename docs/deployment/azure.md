# Microsoft Azure Deployment Guide

## Overview

Microsoft Azure offers comprehensive deployment options from serverless Container Apps to full Azure Kubernetes Service (AKS). This guide covers the most effective deployment strategies for the Learning Assistant application.

## Prerequisites

### Required
- Azure Account ([sign up](https://azure.microsoft.com/free/))
- Azure CLI installed
- Docker installed
- Git repository

### Optional
- Azure DevOps account
- Kubernetes knowledge (for AKS)
- Terraform knowledge

## Deployment Options

### 1. Azure Container Apps (Recommended)
- Serverless containers
- Automatic scaling
- Built-in ingress
- Microservices-friendly

### 2. Azure App Service
- Platform-as-a-Service
- Easy deployment
- Built-in CI/CD
- Multiple runtime support

### 3. Azure Kubernetes Service (AKS)
- Managed Kubernetes
- Enterprise features
- Advanced networking
- High availability

### 4. Azure Container Instances (ACI)
- Simple container deployment
- Pay-per-second billing
- Quick startup
- Serverless

## Option 1: Azure Container Apps (5-10 minutes)

### 1. Setup Azure CLI
```bash
# Install Azure CLI
# macOS
brew install azure-cli

# Login
az login

# Set subscription
az account set --subscription "your-subscription-id"

# Install Container Apps extension
az extension add --name containerapp
```

### 2. Create Resource Group
```bash
# Create resource group
az group create \
  --name learning-assistant-rg \
  --location eastus

# Create Container Apps environment
az containerapp env create \
  --name learning-assistant-env \
  --resource-group learning-assistant-rg \
  --location eastus
```

### 3. Build and Deploy
```bash
# Create Azure Container Registry
az acr create \
  --resource-group learning-assistant-rg \
  --name learningassistantacr \
  --sku Basic

# Build and push image
az acr build \
  --registry learningassistantacr \
  --image learning-assistant:latest \
  --file Dockerfile .

# Deploy to Container Apps
az containerapp create \
  --name learning-assistant \
  --resource-group learning-assistant-rg \
  --environment learning-assistant-env \
  --image learningassistantacr.azurecr.io/learning-assistant:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 10 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
```

### 4. Configure Environment Variables
```bash
# Update with secrets
az containerapp update \
  --name learning-assistant \
  --resource-group learning-assistant-rg \
  --set-env-vars \
    NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=sqlite:./app.db \
    BETTER_AUTH_SECRET=your-secure-secret \
    FEATURE_ANALYTICS_ENABLED=true \
    FEATURE_RECOMMENDATIONS_ENABLED=true \
    FEATURE_CHAT_ENABLED=true
```

## Option 2: Azure App Service (10-15 minutes)

### 1. Create App Service Plan
```bash
# Create App Service Plan
az appservice plan create \
  --name learning-assistant-plan \
  --resource-group learning-assistant-rg \
  --is-linux \
  --sku B1

# Create Web App
az webapp create \
  --resource-group learning-assistant-rg \
  --plan learning-assistant-plan \
  --name learning-assistant-webapp \
  --deployment-container-image-name learningassistantacr.azurecr.io/learning-assistant:latest
```

### 2. Configure App Settings
```bash
# Set app settings
az webapp config appsettings set \
  --resource-group learning-assistant-rg \
  --name learning-assistant-webapp \
  --settings \
    NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=sqlite:./app.db \
    BETTER_AUTH_SECRET=your-secure-secret \
    FEATURE_ANALYTICS_ENABLED=true \
    FEATURE_RECOMMENDATIONS_ENABLED=true \
    FEATURE_CHAT_ENABLED=true

# Configure container settings
az webapp config container set \
  --resource-group learning-assistant-rg \
  --name learning-assistant-webapp \
  --docker-custom-image-name learningassistantacr.azurecr.io/learning-assistant:latest \
  --docker-registry-server-url https://learningassistantacr.azurecr.io
```

### 3. Enable Continuous Deployment
```bash
# Enable CI/CD
az webapp deployment container config \
  --resource-group learning-assistant-rg \
  --name learning-assistant-webapp \
  --enable-cd true
```

## Option 3: Azure Kubernetes Service (AKS) (20-30 minutes)

### 1. Create AKS Cluster
```bash
# Create AKS cluster
az aks create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-aks \
  --node-count 3 \
  --node-vm-size Standard_B2s \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --attach-acr learningassistantacr

# Get credentials
az aks get-credentials \
  --resource-group learning-assistant-rg \
  --name learning-assistant-aks
```

### 2. Kubernetes Manifests
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: learning-assistant
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: learning-assistant
  namespace: learning-assistant
spec:
  replicas: 3
  selector:
    matchLabels:
      app: learning-assistant
  template:
    metadata:
      labels:
        app: learning-assistant
    spec:
      containers:
      - name: app
        image: learningassistantacr.azurecr.io/learning-assistant:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: NEXT_TELEMETRY_DISABLED
          value: "1"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: BETTER_AUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: auth-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: learning-assistant-service
  namespace: learning-assistant
spec:
  selector:
    app: learning-assistant
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: learning-assistant-ingress
  namespace: learning-assistant
  annotations:
    kubernetes.io/ingress.class: "azure/application-gateway"
    appgw.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: learning-assistant-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: learning-assistant-service
            port:
              number: 80
```

### 3. Deploy to AKS
```bash
# Create secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url="postgresql://user:pass@host:5432/database" \
  --from-literal=auth-secret="your-secure-secret" \
  -n learning-assistant

# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n learning-assistant
kubectl get services -n learning-assistant
```

## Option 4: Azure Container Instances (ACI)

### 1. Create Container Instance
```bash
# Create container instance
az container create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-aci \
  --image learningassistantacr.azurecr.io/learning-assistant:latest \
  --cpu 1 \
  --memory 1 \
  --registry-login-server learningassistantacr.azurecr.io \
  --registry-username $(az acr credential show --name learningassistantacr --query username -o tsv) \
  --registry-password $(az acr credential show --name learningassistantacr --query passwords[0].value -o tsv) \
  --dns-name-label learning-assistant-aci \
  --ports 3000 \
  --environment-variables \
    NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=sqlite:./app.db \
    BETTER_AUTH_SECRET=your-secure-secret
```

## Database Setup

### 1. Azure Database for PostgreSQL
```bash
# Create PostgreSQL server
az postgres flexible-server create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-db \
  --admin-user adminuser \
  --admin-password YourSecurePassword123! \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --public-access 0.0.0.0 \
  --storage-size 32 \
  --version 15

# Create database
az postgres flexible-server db create \
  --resource-group learning-assistant-rg \
  --server-name learning-assistant-db \
  --database-name learning_assistant

# Get connection string
az postgres flexible-server show-connection-string \
  --server-name learning-assistant-db \
  --database-name learning_assistant \
  --admin-user adminuser \
  --admin-password YourSecurePassword123!
```

### 2. Azure Cache for Redis
```bash
# Create Redis cache
az redis create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0

# Get Redis connection string
az redis show-access-keys \
  --resource-group learning-assistant-rg \
  --name learning-assistant-redis
```

### 3. Azure Cosmos DB (NoSQL)
```bash
# Create Cosmos DB account
az cosmosdb create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-cosmos \
  --kind GlobalDocumentDB \
  --locations regionName=eastus failoverPriority=0 isZoneRedundant=False

# Create database
az cosmosdb sql database create \
  --resource-group learning-assistant-rg \
  --account-name learning-assistant-cosmos \
  --name learning_assistant

# Get connection string
az cosmosdb keys list \
  --resource-group learning-assistant-rg \
  --name learning-assistant-cosmos \
  --type connection-strings
```

## Environment Variables & Secrets

### 1. Azure Key Vault
```bash
# Create Key Vault
az keyvault create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-kv \
  --location eastus

# Add secrets
az keyvault secret set \
  --vault-name learning-assistant-kv \
  --name "database-url" \
  --value "postgresql://user:pass@host:5432/database"

az keyvault secret set \
  --vault-name learning-assistant-kv \
  --name "auth-secret" \
  --value "your-secure-secret"
```

### 2. Use Secrets in Container Apps
```bash
# Update Container App with Key Vault secrets
az containerapp update \
  --name learning-assistant \
  --resource-group learning-assistant-rg \
  --secrets \
    "database-url=keyvaultref:https://learning-assistant-kv.vault.azure.net/secrets/database-url,identityref:system" \
    "auth-secret=keyvaultref:https://learning-assistant-kv.vault.azure.net/secrets/auth-secret,identityref:system" \
  --set-env-vars \
    DATABASE_URL=secretref:database-url \
    BETTER_AUTH_SECRET=secretref:auth-secret
```

## Domain & SSL

### 1. Azure DNS
```bash
# Create DNS zone
az network dns zone create \
  --resource-group learning-assistant-rg \
  --name your-domain.com

# Add A record
az network dns record-set a add-record \
  --resource-group learning-assistant-rg \
  --zone-name your-domain.com \
  --record-set-name @ \
  --ipv4-address your-ip-address
```

### 2. SSL Certificate
```bash
# Create App Service Certificate
az webapp config ssl create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-webapp \
  --hostname your-domain.com

# Bind certificate
az webapp config ssl bind \
  --resource-group learning-assistant-rg \
  --name learning-assistant-webapp \
  --certificate-thumbprint certificate-thumbprint \
  --ssl-type SNI
```

## Monitoring & Logging

### 1. Azure Monitor
```bash
# Create Log Analytics workspace
az monitor log-analytics workspace create \
  --resource-group learning-assistant-rg \
  --workspace-name learning-assistant-workspace \
  --location eastus

# Create Application Insights
az monitor app-insights component create \
  --resource-group learning-assistant-rg \
  --app learning-assistant-insights \
  --location eastus \
  --application-type web \
  --workspace learning-assistant-workspace
```

### 2. Azure Alerts
```bash
# Create action group
az monitor action-group create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-alerts \
  --short-name la-alerts

# Create metric alert
az monitor metrics alert create \
  --resource-group learning-assistant-rg \
  --name "High CPU Usage" \
  --scopes /subscriptions/your-subscription-id/resourceGroups/learning-assistant-rg/providers/Microsoft.App/containerApps/learning-assistant \
  --condition "avg Percentage CPU > 80" \
  --action learning-assistant-alerts \
  --description "Alert when CPU usage is high"
```

## Auto Scaling

### 1. Container Apps Auto Scaling
```bash
# Configure scaling rules
az containerapp update \
  --name learning-assistant \
  --resource-group learning-assistant-rg \
  --min-replicas 1 \
  --max-replicas 10 \
  --scale-rule-name http-scale \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```

### 2. App Service Auto Scaling
```bash
# Create autoscale profile
az monitor autoscale create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-autoscale \
  --resource /subscriptions/your-subscription-id/resourceGroups/learning-assistant-rg/providers/Microsoft.Web/serverFarms/learning-assistant-plan \
  --min-count 1 \
  --max-count 10 \
  --count 2

# Add scale-out rule
az monitor autoscale rule create \
  --resource-group learning-assistant-rg \
  --autoscale-name learning-assistant-autoscale \
  --condition "Percentage CPU > 70 avg 10m" \
  --scale out 1
```

### 3. AKS Auto Scaling
```bash
# Enable cluster autoscaler
az aks update \
  --resource-group learning-assistant-rg \
  --name learning-assistant-aks \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 10

# Configure HPA
kubectl autoscale deployment learning-assistant \
  --cpu-percent=50 \
  --min=1 \
  --max=10 \
  -n learning-assistant
```

## Cost Optimization

### Estimated Monthly Costs
- **Container Apps**: $0-50 (pay-per-use)
- **App Service**: $10-55 (B1 plan)
- **AKS**: $75+ (cluster) + nodes
- **Container Instances**: $15-40 (1 vCPU, 1GB)
- **PostgreSQL**: $20-40 (Basic tier)
- **Redis**: $15-25 (Basic C0)

### Cost-Saving Tips
1. **Azure Hybrid Benefit**: Use existing licenses
2. **Reserved Instances**: For predictable workloads
3. **Spot Instances**: For AKS nodes
4. **Auto-scaling**: Scale down during low usage
5. **Cost Management**: Set up budgets and alerts

## Security Best Practices

### 1. Managed Identity
```bash
# Enable managed identity for Container Apps
az containerapp identity assign \
  --name learning-assistant \
  --resource-group learning-assistant-rg \
  --system-assigned

# Grant Key Vault access
az keyvault set-policy \
  --name learning-assistant-kv \
  --object-id $(az containerapp identity show --name learning-assistant --resource-group learning-assistant-rg --query principalId -o tsv) \
  --secret-permissions get list
```

### 2. Network Security
```bash
# Create virtual network
az network vnet create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-vnet \
  --address-prefix 10.0.0.0/16 \
  --subnet-name default \
  --subnet-prefix 10.0.1.0/24

# Create network security group
az network nsg create \
  --resource-group learning-assistant-rg \
  --name learning-assistant-nsg

# Add security rules
az network nsg rule create \
  --resource-group learning-assistant-rg \
  --nsg-name learning-assistant-nsg \
  --name allow-http \
  --protocol tcp \
  --priority 1000 \
  --destination-port-range 80 \
  --access allow
```

### 3. Azure Security Center
```bash
# Enable Security Center
az security contact create \
  --email your-email@domain.com \
  --phone "+1234567890" \
  --alert-notifications on \
  --alerts-admins on

# Enable advanced threat protection
az security atp storage update \
  --resource-group learning-assistant-rg \
  --storage-account learning-assistant-storage \
  --is-enabled true
```

## CI/CD Pipeline

### 1. Azure DevOps Pipeline
```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
    - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  containerRegistry: 'learningassistantacr.azurecr.io'
  imageRepository: 'learning-assistant'
  dockerfilePath: '$(Build.SourcesDirectory)/Dockerfile'
  tag: '$(Build.BuildId)'

stages:
- stage: Build
  displayName: Build and push stage
  jobs:
  - job: Build
    displayName: Build
    steps:
    - task: Docker@2
      displayName: Build and push an image to container registry
      inputs:
        command: buildAndPush
        repository: $(imageRepository)
        dockerfile: $(dockerfilePath)
        containerRegistry: $(containerRegistry)
        tags: |
          $(tag)
          latest

- stage: Deploy
  displayName: Deploy stage
  dependsOn: Build
  jobs:
  - job: Deploy
    displayName: Deploy
    steps:
    - task: AzureCLI@2
      displayName: Deploy to Container Apps
      inputs:
        azureSubscription: 'your-service-connection'
        scriptType: bash
        scriptLocation: inlineScript
        inlineScript: |
          az containerapp update \
            --name learning-assistant \
            --resource-group learning-assistant-rg \
            --image $(containerRegistry)/$(imageRepository):$(tag)
```

### 2. GitHub Actions
```yaml
# .github/workflows/azure-deploy.yml
name: Deploy to Azure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Login to Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: learningassistantacr.azurecr.io
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}
      
      - name: Build and push Docker image
        run: |
          docker build -t learningassistantacr.azurecr.io/learning-assistant:${{ github.sha }} .
          docker push learningassistantacr.azurecr.io/learning-assistant:${{ github.sha }}
      
      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name learning-assistant \
            --resource-group learning-assistant-rg \
            --image learningassistantacr.azurecr.io/learning-assistant:${{ github.sha }}
```

## Troubleshooting

### Common Issues

#### 1. Container Apps Deployment Issues
```bash
# Check Container Apps logs
az containerapp logs show \
  --name learning-assistant \
  --resource-group learning-assistant-rg \
  --follow

# Check revision status
az containerapp revision list \
  --name learning-assistant \
  --resource-group learning-assistant-rg
```

#### 2. Database Connection Issues
```bash
# Test PostgreSQL connection
az postgres flexible-server connect \
  --name learning-assistant-db \
  --admin-user adminuser \
  --admin-password YourSecurePassword123!

# Check firewall rules
az postgres flexible-server firewall-rule list \
  --resource-group learning-assistant-rg \
  --name learning-assistant-db
```

#### 3. AKS Issues
```bash
# Check AKS cluster status
az aks show \
  --resource-group learning-assistant-rg \
  --name learning-assistant-aks

# Check node status
kubectl get nodes
kubectl describe node node-name
```

### Debugging Commands
```bash
# Container Apps
az containerapp show --name learning-assistant --resource-group learning-assistant-rg
az containerapp logs show --name learning-assistant --resource-group learning-assistant-rg

# App Service
az webapp show --name learning-assistant-webapp --resource-group learning-assistant-rg
az webapp log tail --name learning-assistant-webapp --resource-group learning-assistant-rg

# AKS
kubectl get pods -n learning-assistant
kubectl logs -f deployment/learning-assistant -n learning-assistant
```

## Support Resources

### Official Documentation
- [Azure Documentation](https://docs.microsoft.com/azure/)
- [Container Apps Documentation](https://docs.microsoft.com/azure/container-apps/)
- [App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [AKS Documentation](https://docs.microsoft.com/azure/aks/)

### Useful Commands
```bash
# Azure CLI
az account list
az group list
az resource list

# Container Apps
az containerapp list
az containerapp show --name SERVICE_NAME --resource-group RESOURCE_GROUP

# Kubernetes
kubectl get all -n learning-assistant
kubectl describe deployment learning-assistant -n learning-assistant
```

## Next Steps

1. **Choose Method**: Container Apps → App Service → AKS
2. **Set up Database**: Azure Database for PostgreSQL
3. **Configure Domain**: Azure DNS and SSL certificates
4. **Set up Monitoring**: Azure Monitor and Application Insights
5. **Implement CI/CD**: Azure DevOps or GitHub Actions
6. **Security**: Enable managed identity and Key Vault

---

**Tip**: Start with Azure Container Apps for the best balance of simplicity and features, then migrate to AKS if you need advanced Kubernetes features. Azure's managed services provide excellent integration and security out of the box.