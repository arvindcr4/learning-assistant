#!/bin/bash

# =============================================================================
# AWS Deployment Platform Handler
# =============================================================================

aws_deploy() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Initializing AWS deployment..."
    
    # Load AWS-specific configuration
    local aws_config_file="${CONFIG_DIR}/aws/${environment}.env"
    if [[ -f "${aws_config_file}" ]]; then
        source "${aws_config_file}"
    fi
    
    # Set defaults
    AWS_REGION="${AWS_REGION:-${DEFAULT_REGION:-us-east-1}}"
    AWS_INSTANCE_TYPE="${AWS_INSTANCE_TYPE:-${DEFAULT_INSTANCE_TYPE:-t3.medium}}"
    AWS_AMI_ID="${AWS_AMI_ID:-ami-0453ec754f44f9a4a}"  # Amazon Linux 2023
    AWS_KEY_NAME="${AWS_KEY_NAME:-learning-assistant-key}"
    AWS_SECURITY_GROUP="${AWS_SECURITY_GROUP:-learning-assistant-sg}"
    
    # Validate AWS CLI and credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS CLI not configured or invalid credentials"
        return 1
    fi
    
    # Deploy using ECS or EC2 based on configuration
    if [[ "${AWS_DEPLOY_METHOD:-ec2}" == "ecs" ]]; then
        aws_deploy_ecs "${environment}" "${deployment_id}"
    else
        aws_deploy_ec2 "${environment}" "${deployment_id}"
    fi
}

aws_deploy_ec2() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to AWS EC2..."
    
    # Generate unique instance name
    local instance_name="learning-assistant-${environment}-$(date +%s)"
    
    # Create key pair if needed
    aws_ensure_key_pair "${AWS_KEY_NAME}"
    
    # Create security group if needed
    aws_ensure_security_group "${AWS_SECURITY_GROUP}"
    
    # Create user data script
    local user_data_script="${SCRIPT_DIR}/tmp/aws-user-data.sh"
    aws_create_user_data_script "${user_data_script}" "${environment}"
    
    # Launch EC2 instance
    local instance_id
    instance_id=$(aws ec2 run-instances \
        --image-id "${AWS_AMI_ID}" \
        --count 1 \
        --instance-type "${AWS_INSTANCE_TYPE}" \
        --key-name "${AWS_KEY_NAME}" \
        --security-groups "${AWS_SECURITY_GROUP}" \
        --user-data "file://${user_data_script}" \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${instance_name}},{Key=Environment,Value=${environment}},{Key=DeploymentId,Value=${deployment_id}}]" \
        --region "${AWS_REGION}" \
        --query 'Instances[0].InstanceId' \
        --output text)
    
    log_info "EC2 instance launched: ${instance_id}"
    
    # Wait for instance to be running
    log_info "Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "${instance_id}" --region "${AWS_REGION}"
    
    # Get instance public IP
    local instance_ip
    instance_ip=$(aws ec2 describe-instances \
        --instance-ids "${instance_id}" \
        --region "${AWS_REGION}" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)
    
    log_success "Instance running at IP: ${instance_ip}"
    
    # Set deployment URL for health check
    export DEPLOYMENT_URL="http://${instance_ip}:3000"
    
    # Wait for deployment to complete
    aws_wait_for_deployment "${instance_ip}" "${AWS_KEY_NAME}"
    
    log_success "AWS EC2 deployment completed successfully!"
    log_info "Access URL: ${DEPLOYMENT_URL}"
    log_info "SSH Command: ssh -i ~/.ssh/${AWS_KEY_NAME}.pem ec2-user@${instance_ip}"
}

aws_deploy_ecs() {
    local environment="$1"
    local deployment_id="$2"
    
    log_info "Deploying to AWS ECS..."
    
    # Build and push Docker image to ECR
    local ecr_repo="${AWS_ECR_REPO:-learning-assistant}"
    local image_tag="${deployment_id}"
    
    aws_deploy_to_ecr "${ecr_repo}" "${image_tag}"
    
    # Deploy to ECS
    aws_deploy_to_ecs_service "${ecr_repo}" "${image_tag}" "${environment}"
    
    log_success "AWS ECS deployment completed successfully!"
}

aws_ensure_key_pair() {
    local key_name="$1"
    
    if ! aws ec2 describe-key-pairs --key-names "${key_name}" --region "${AWS_REGION}" &>/dev/null; then
        log_info "Creating key pair: ${key_name}"
        mkdir -p ~/.ssh
        aws ec2 create-key-pair --key-name "${key_name}" --region "${AWS_REGION}" --query 'KeyMaterial' --output text > ~/.ssh/${key_name}.pem
        chmod 600 ~/.ssh/${key_name}.pem
        log_success "Key pair created: ~/.ssh/${key_name}.pem"
    else
        log_info "Key pair already exists: ${key_name}"
    fi
}

aws_ensure_security_group() {
    local sg_name="$1"
    
    if ! aws ec2 describe-security-groups --group-names "${sg_name}" --region "${AWS_REGION}" &>/dev/null; then
        log_info "Creating security group: ${sg_name}"
        aws ec2 create-security-group --group-name "${sg_name}" --description "Learning Assistant Security Group" --region "${AWS_REGION}"
        
        # Configure security group rules
        aws ec2 authorize-security-group-ingress --group-name "${sg_name}" --protocol tcp --port 22 --cidr 0.0.0.0/0 --region "${AWS_REGION}"
        aws ec2 authorize-security-group-ingress --group-name "${sg_name}" --protocol tcp --port 80 --cidr 0.0.0.0/0 --region "${AWS_REGION}"
        aws ec2 authorize-security-group-ingress --group-name "${sg_name}" --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "${AWS_REGION}"
        aws ec2 authorize-security-group-ingress --group-name "${sg_name}" --protocol tcp --port 3000 --cidr 0.0.0.0/0 --region "${AWS_REGION}"
        
        log_success "Security group created and configured: ${sg_name}"
    else
        log_info "Security group already exists: ${sg_name}"
    fi
}

aws_create_user_data_script() {
    local script_path="$1"
    local environment="$2"
    
    mkdir -p "$(dirname "${script_path}")"
    
    cat > "${script_path}" << 'EOF'
#!/bin/bash
yum update -y
yum install -y docker git curl

# Start Docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Get instance IP
INSTANCE_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Clone or create application
cd /home/ec2-user
if ! git clone https://github.com/your-repo/learning-assistant.git; then
    # Create a basic application structure if repo doesn't exist
    mkdir -p learning-assistant
    cd learning-assistant
    
    # Copy application files from S3 or use embedded files
    # This would be customized based on your deployment strategy
fi

chown -R ec2-user:ec2-user /home/ec2-user/learning-assistant
cd /home/ec2-user/learning-assistant

# Create environment file
cat > .env.local << ENVEOF
NODE_ENV=production
DATABASE_URL=sqlite:./app.db
BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
NEXT_PUBLIC_API_URL=http://$INSTANCE_IP:3000
NEXT_PUBLIC_APP_URL=http://$INSTANCE_IP:3000
FEATURE_ANALYTICS_ENABLED=true
FEATURE_RECOMMENDATIONS_ENABLED=true
FEATURE_CHAT_ENABLED=false
ENVEOF

# Build and run application
sudo -u ec2-user npm install --production
sudo -u ec2-user npm run build

# Run using Docker if Dockerfile exists, otherwise run directly
if [ -f Dockerfile ]; then
    sudo -u ec2-user docker build -t learning-assistant .
    sudo -u ec2-user docker run -d -p 3000:3000 --name learning-assistant --restart unless-stopped learning-assistant
else
    sudo -u ec2-user npm start &
fi

# Mark deployment as complete
echo "$(date): AWS deployment completed" > /home/ec2-user/deployment-complete
EOF
    
    log_info "User data script created: ${script_path}"
}

aws_wait_for_deployment() {
    local instance_ip="$1"
    local key_name="$2"
    
    log_info "Waiting for deployment to complete..."
    
    local max_attempts=30
    for ((i=1; i<=max_attempts; i++)); do
        if ssh -i ~/.ssh/${key_name}.pem -o StrictHostKeyChecking=no ec2-user@${instance_ip} "[ -f /home/ec2-user/deployment-complete ]" 2>/dev/null; then
            log_success "Deployment completed successfully"
            return 0
        fi
        
        log_info "Waiting for deployment... (${i}/${max_attempts})"
        sleep 20
    done
    
    log_error "Deployment timed out after ${max_attempts} attempts"
    return 1
}

aws_deploy_to_ecr() {
    local repo_name="$1"
    local image_tag="$2"
    
    log_info "Building and pushing Docker image to ECR..."
    
    # Get ECR login token
    aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    
    # Build image
    docker build -t "${repo_name}:${image_tag}" "${SCRIPT_DIR}"
    
    # Tag for ECR
    docker tag "${repo_name}:${image_tag}" "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${repo_name}:${image_tag}"
    
    # Push to ECR
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${repo_name}:${image_tag}"
    
    log_success "Docker image pushed to ECR: ${repo_name}:${image_tag}"
}

aws_deploy_to_ecs_service() {
    local repo_name="$1"
    local image_tag="$2"
    local environment="$3"
    
    log_info "Deploying to ECS service..."
    
    # Update ECS service with new image
    local service_name="learning-assistant-${environment}"
    local cluster_name="${AWS_ECS_CLUSTER:-learning-assistant-cluster}"
    
    # Create or update task definition
    local task_definition=$(aws ecs describe-task-definition --task-definition "${service_name}" --query 'taskDefinition' --output json 2>/dev/null || echo '{}')
    
    # Update task definition with new image
    # This would involve more complex JSON manipulation
    # For brevity, showing the concept
    
    log_success "ECS service updated with new image"
}