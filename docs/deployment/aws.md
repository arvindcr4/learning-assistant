# AWS Deployment Guide

## Overview

AWS provides comprehensive deployment options from simple container services to full Kubernetes orchestration. This guide covers multiple deployment strategies including ECS, EKS, App Runner, and EC2.

## Prerequisites

### Required
- AWS Account ([sign up](https://aws.amazon.com/))
- AWS CLI installed and configured
- Docker installed
- Git repository

### Optional
- AWS CDK/CloudFormation knowledge
- Kubernetes knowledge (for EKS)
- Terraform knowledge

## Deployment Options

### 1. AWS App Runner (Easiest)
- Fully managed container service
- Automatic scaling
- Source-to-URL deployment
- Minimal configuration

### 2. ECS with Fargate (Recommended)
- Serverless containers
- Managed scaling
- Load balancing
- Cost-effective

### 3. EKS (Advanced)
- Kubernetes orchestration
- High availability
- Advanced networking
- Enterprise features

### 4. EC2 (Full Control)
- Complete server control
- Custom configuration
- Cost optimization
- Self-managed

## Option 1: AWS App Runner (5-10 minutes)

### 1. Prepare Source Code
```bash
# Ensure your repository has proper Dockerfile
# App Runner will automatically build and deploy
```

### 2. Create App Runner Service
```bash
# Using AWS CLI
aws apprunner create-service \
  --service-name learning-assistant \
  --source-configuration '{
    "ImageRepository": {
      "ImageIdentifier": "public.ecr.aws/your-account/learning-assistant:latest",
      "ImageConfiguration": {
        "Port": "3000",
        "RuntimeEnvironmentVariables": {
          "NODE_ENV": "production",
          "PORT": "3000"
        }
      },
      "ImageRepositoryType": "ECR_PUBLIC"
    },
    "AutoDeploymentsEnabled": true
  }' \
  --instance-configuration '{
    "Cpu": "0.25 vCPU",
    "Memory": "0.5 GB"
  }'
```

### 3. Configure via AWS Console
1. Go to AWS App Runner console
2. Create service
3. Choose source type (GitHub/ECR)
4. Configure build settings
5. Set environment variables
6. Deploy

### App Runner Configuration
```yaml
# apprunner.yaml
version: 1.0
runtime: nodejs20
build:
  commands:
    build:
      - npm install
      - npm run build
run:
  runtime-version: 20
  command: npm start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
    - name: NEXT_TELEMETRY_DISABLED
      value: "1"
```

## Option 2: ECS with Fargate (10-15 minutes)

### 1. Create ECR Repository
```bash
# Create repository
aws ecr create-repository --repository-name learning-assistant

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build and push image
docker build -t learning-assistant .
docker tag learning-assistant:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/learning-assistant:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/learning-assistant:latest
```

### 2. Create ECS Task Definition
```json
{
  "family": "learning-assistant",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "learning-assistant",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/learning-assistant:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:us-east-1:123456789012:parameter/learning-assistant/database-url"
        },
        {
          "name": "BETTER_AUTH_SECRET",
          "valueFrom": "arn:aws:ssm:us-east-1:123456789012:parameter/learning-assistant/auth-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/learning-assistant",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

### 3. Create ECS Service
```bash
# Create cluster
aws ecs create-cluster --cluster-name learning-assistant-cluster

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster learning-assistant-cluster \
  --service-name learning-assistant-service \
  --task-definition learning-assistant:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345,subnet-67890],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

### 4. Set Up Application Load Balancer
```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name learning-assistant-alb \
  --subnets subnet-12345 subnet-67890 \
  --security-groups sg-12345

# Create target group
aws elbv2 create-target-group \
  --name learning-assistant-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-12345 \
  --target-type ip \
  --health-check-path /api/health

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/learning-assistant-alb/1234567890123456 \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/learning-assistant-targets/1234567890123456
```

## Option 3: EKS Deployment (Advanced)

### 1. Create EKS Cluster
```bash
# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Create cluster
eksctl create cluster \
  --name learning-assistant-cluster \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed
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
        image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/learning-assistant:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
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
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
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
```

### 3. Deploy to EKS
```bash
# Apply manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n learning-assistant
kubectl get services -n learning-assistant

# Get external IP
kubectl get service learning-assistant-service -n learning-assistant
```

## Option 4: EC2 Deployment

### 1. Launch EC2 Instance
```bash
# Create security group
aws ec2 create-security-group \
  --group-name learning-assistant-sg \
  --description "Security group for Learning Assistant"

# Add rules
aws ec2 authorize-security-group-ingress \
  --group-name learning-assistant-sg \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-name learning-assistant-sg \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Launch instance
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --count 1 \
  --instance-type t3.medium \
  --key-name my-key-pair \
  --security-groups learning-assistant-sg \
  --user-data file://user-data.sh
```

### 2. User Data Script
```bash
#!/bin/bash
# user-data.sh
yum update -y
yum install -y docker git

# Start Docker
service docker start
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Clone and deploy
git clone https://github.com/your-username/learning-assistant.git /app
cd /app

# Set environment variables
echo "NODE_ENV=production" > .env
echo "PORT=3000" >> .env
echo "DATABASE_URL=sqlite:./app.db" >> .env

# Deploy
docker-compose up -d
```

## Database Setup

### 1. Amazon RDS (PostgreSQL)
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier learning-assistant-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password YourSecurePassword \
  --allocated-storage 20 \
  --storage-type gp2 \
  --vpc-security-group-ids sg-12345 \
  --db-subnet-group-name default

# Get connection info
aws rds describe-db-instances --db-instance-identifier learning-assistant-db
```

### 2. Amazon ElastiCache (Redis)
```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id learning-assistant-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --security-group-ids sg-12345
```

## Environment Variables & Secrets

### 1. AWS Systems Manager Parameter Store
```bash
# Store secrets
aws ssm put-parameter \
  --name "/learning-assistant/database-url" \
  --value "postgresql://user:pass@host:5432/database" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/learning-assistant/auth-secret" \
  --value "your-secure-secret-key" \
  --type "SecureString"
```

### 2. AWS Secrets Manager
```bash
# Create secret
aws secretsmanager create-secret \
  --name learning-assistant/database \
  --description "Database credentials" \
  --secret-string '{"username":"postgres","password":"YourSecurePassword","host":"your-rds-endpoint","port":"5432","database":"learning_assistant"}'
```

## Domain & SSL

### 1. Route 53 (DNS)
```bash
# Create hosted zone
aws route53 create-hosted-zone \
  --name your-domain.com \
  --caller-reference $(date +%s)

# Create A record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://change-batch.json
```

### 2. AWS Certificate Manager (SSL)
```bash
# Request certificate
aws acm request-certificate \
  --domain-name your-domain.com \
  --subject-alternative-names *.your-domain.com \
  --validation-method DNS

# Add to load balancer
aws elbv2 add-listener-certificates \
  --listener-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/learning-assistant-alb/1234567890123456/1234567890123456 \
  --certificates CertificateArn=arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012
```

## Monitoring & Logging

### 1. CloudWatch
```bash
# Create log group
aws logs create-log-group --log-group-name /aws/ecs/learning-assistant

# Create CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name learning-assistant \
  --dashboard-body file://dashboard.json
```

### 2. AWS X-Ray (Tracing)
```bash
# Enable X-Ray tracing
# Add to task definition
"environment": [
  {
    "name": "_X_AMZN_TRACE_ID",
    "value": "Root=1-5e1b4151-5ac6c58304fccb0b0a2c1b5e"
  }
]
```

## Auto Scaling

### 1. ECS Auto Scaling
```bash
# Create scaling policy
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/learning-assistant-cluster/learning-assistant-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name learning-assistant-scale-up \
  --service-namespace ecs \
  --resource-id service/learning-assistant-cluster/learning-assistant-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

### 2. EKS Auto Scaling
```bash
# Install cluster autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml

# Configure HPA
kubectl autoscale deployment learning-assistant --cpu-percent=50 --min=1 --max=10 -n learning-assistant
```

## Cost Optimization

### Estimated Monthly Costs
- **App Runner**: $25-50 (0.25 vCPU, 0.5 GB)
- **ECS Fargate**: $15-40 (256 CPU, 512 MB)
- **EKS**: $73+ (cluster) + nodes
- **EC2**: $10-30 (t3.medium)
- **RDS**: $15-25 (db.t3.micro)
- **ALB**: $20-25

### Cost-Saving Tips
1. **Reserved Instances**: For predictable workloads
2. **Spot Instances**: For fault-tolerant workloads
3. **Right-sizing**: Monitor and adjust resources
4. **Auto-scaling**: Scale down during low usage
5. **S3 Lifecycle**: Optimize storage costs

## Security Best Practices

### 1. IAM Roles & Policies
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/learning-assistant/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:learning-assistant/*"
    }
  ]
}
```

### 2. Security Groups
```bash
# Web tier - Allow HTTP/HTTPS
aws ec2 authorize-security-group-ingress \
  --group-id sg-web \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# App tier - Allow from web tier only
aws ec2 authorize-security-group-ingress \
  --group-id sg-app \
  --protocol tcp \
  --port 3000 \
  --source-group sg-web

# Database tier - Allow from app tier only
aws ec2 authorize-security-group-ingress \
  --group-id sg-db \
  --protocol tcp \
  --port 5432 \
  --source-group sg-app
```

### 3. VPC Configuration
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create subnets
aws ec2 create-subnet --vpc-id vpc-12345 --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-12345 --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
```

## CI/CD Pipeline

### 1. AWS CodePipeline
```json
{
  "pipeline": {
    "name": "learning-assistant-pipeline",
    "roleArn": "arn:aws:iam::123456789012:role/CodePipelineServiceRole",
    "stages": [
      {
        "name": "Source",
        "actions": [
          {
            "name": "Source",
            "actionTypeId": {
              "category": "Source",
              "owner": "ThirdParty",
              "provider": "GitHub",
              "version": "1"
            },
            "configuration": {
              "Owner": "your-username",
              "Repo": "learning-assistant",
              "Branch": "main",
              "OAuthToken": "your-github-token"
            },
            "outputArtifacts": [
              {
                "name": "SourceOutput"
              }
            ]
          }
        ]
      },
      {
        "name": "Build",
        "actions": [
          {
            "name": "Build",
            "actionTypeId": {
              "category": "Build",
              "owner": "AWS",
              "provider": "CodeBuild",
              "version": "1"
            },
            "configuration": {
              "ProjectName": "learning-assistant-build"
            },
            "inputArtifacts": [
              {
                "name": "SourceOutput"
              }
            ],
            "outputArtifacts": [
              {
                "name": "BuildOutput"
              }
            ]
          }
        ]
      },
      {
        "name": "Deploy",
        "actions": [
          {
            "name": "Deploy",
            "actionTypeId": {
              "category": "Deploy",
              "owner": "AWS",
              "provider": "ECS",
              "version": "1"
            },
            "configuration": {
              "ClusterName": "learning-assistant-cluster",
              "ServiceName": "learning-assistant-service",
              "FileName": "imagedefinitions.json"
            },
            "inputArtifacts": [
              {
                "name": "BuildOutput"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### 2. GitHub Actions
```yaml
# .github/workflows/aws-deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Build, tag, and push image to Amazon ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: learning-assistant
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "::set-output name=image::$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
      
      - name: Deploy to Amazon ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: task-definition.json
          service: learning-assistant-service
          cluster: learning-assistant-cluster
          wait-for-service-stability: true
```

## Troubleshooting

### Common Issues

#### 1. ECS Task Failures
```bash
# Check service events
aws ecs describe-services --cluster learning-assistant-cluster --services learning-assistant-service

# Check task logs
aws logs get-log-events --log-group-name /ecs/learning-assistant --log-stream-name ecs/learning-assistant/task-id
```

#### 2. Database Connection Issues
```bash
# Test RDS connection
aws rds describe-db-instances --db-instance-identifier learning-assistant-db

# Check security groups
aws ec2 describe-security-groups --group-ids sg-12345
```

#### 3. Load Balancer Issues
```bash
# Check target health
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/learning-assistant-targets/1234567890123456

# Check listener rules
aws elbv2 describe-listeners --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:123456789012:loadbalancer/app/learning-assistant-alb/1234567890123456
```

## Support Resources

### Official Documentation
- [AWS Documentation](https://docs.aws.amazon.com/)
- [ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [EKS Documentation](https://docs.aws.amazon.com/eks/)
- [AWS Support](https://aws.amazon.com/support/)

### Useful Commands
```bash
# AWS CLI
aws sts get-caller-identity
aws ecs list-clusters
aws rds describe-db-instances
aws elasticache describe-cache-clusters

# Docker
docker build -t learning-assistant .
docker run -p 3000:3000 learning-assistant

# Kubernetes
kubectl get pods -n learning-assistant
kubectl logs -f deployment/learning-assistant -n learning-assistant
```

## Next Steps

1. **Choose Method**: App Runner → ECS → EKS based on complexity
2. **Set up Database**: RDS PostgreSQL for production
3. **Configure DNS**: Route 53 and SSL certificates
4. **Set up Monitoring**: CloudWatch and X-Ray
5. **Implement CI/CD**: CodePipeline or GitHub Actions
6. **Optimize Costs**: Monitor and adjust resources

---

**Tip**: Start with AWS App Runner for the simplest deployment, then migrate to ECS as you need more control. AWS provides excellent documentation and support for scaling your application as it grows.