# ECS Compute Module
# Enterprise-grade ECS cluster with auto-scaling, monitoring, and security

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for consistent naming and configuration
locals {
  common_tags = merge(
    var.tags,
    {
      Module      = "compute/ecs"
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
    }
  )
  
  name_prefix = "${var.project_name}-${var.environment}"
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"
  
  configuration {
    execute_command_configuration {
      kms_key_id = var.enable_encryption ? aws_kms_key.ecs[0].arn : null
      logging    = var.enable_exec_logging ? "DEFAULT" : "NONE"
    }
  }
  
  dynamic "setting" {
    for_each = var.enable_container_insights ? [1] : []
    content {
      name  = "containerInsights"
      value = "enabled"
    }
  }
  
  tags = local.common_tags
}

# ECS Cluster Capacity Providers
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name
  
  capacity_providers = var.capacity_providers
  
  dynamic "default_capacity_provider_strategy" {
    for_each = var.default_capacity_provider_strategy
    content {
      capacity_provider = default_capacity_provider_strategy.value.capacity_provider
      weight           = default_capacity_provider_strategy.value.weight
      base            = default_capacity_provider_strategy.value.base
    }
  }
}

# Auto Scaling Group for EC2 instances (if using EC2 capacity provider)
resource "aws_autoscaling_group" "ecs" {
  count = var.launch_type == "EC2" ? 1 : 0
  
  name                = "${local.name_prefix}-ecs-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = var.target_group_arns
  health_check_type   = "ELB"
  health_check_grace_period = 300
  
  min_size         = var.min_capacity
  max_size         = var.max_capacity
  desired_capacity = var.desired_capacity
  
  launch_template {
    id      = aws_launch_template.ecs[0].id
    version = "$Latest"
  }
  
  dynamic "tag" {
    for_each = local.common_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
  
  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-ecs-instance"
    propagate_at_launch = true
  }
}

# Launch Template for ECS instances
resource "aws_launch_template" "ecs" {
  count = var.launch_type == "EC2" ? 1 : 0
  
  name_prefix   = "${local.name_prefix}-ecs-"
  image_id      = var.ami_id != "" ? var.ami_id : data.aws_ami.ecs_optimized[0].id
  instance_type = var.instance_type
  
  vpc_security_group_ids = [aws_security_group.ecs_instances[0].id]
  
  iam_instance_profile {
    name = aws_iam_instance_profile.ecs[0].name
  }
  
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    cluster_name = aws_ecs_cluster.main.name
    environment  = var.environment
    project_name = var.project_name
  }))
  
  dynamic "block_device_mappings" {
    for_each = var.block_device_mappings
    content {
      device_name = block_device_mappings.value.device_name
      ebs {
        volume_size = block_device_mappings.value.volume_size
        volume_type = block_device_mappings.value.volume_type
        encrypted   = var.enable_encryption
      }
    }
  }
  
  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, {
      Name = "${local.name_prefix}-ecs-instance"
    })
  }
  
  tag_specifications {
    resource_type = "volume"
    tags = merge(local.common_tags, {
      Name = "${local.name_prefix}-ecs-volume"
    })
  }
}

# Security Group for ECS instances
resource "aws_security_group" "ecs_instances" {
  count = var.launch_type == "EC2" ? 1 : 0
  
  name_prefix = "${local.name_prefix}-ecs-instances-"
  vpc_id      = var.vpc_id
  description = "Security group for ECS instances"
  
  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  # Allow traffic from load balancer
  dynamic "ingress" {
    for_each = var.load_balancer_security_group_ids
    content {
      from_port       = 32768
      to_port         = 65535
      protocol        = "tcp"
      security_groups = [ingress.value]
      description     = "Dynamic port range from load balancer"
    }
  }
  
  # SSH access
  dynamic "ingress" {
    for_each = var.enable_ssh_access ? [1] : []
    content {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.ssh_allowed_cidrs
      description = "SSH access from allowed CIDRs"
    }
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-instances-sg"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "main" {
  family                   = "${local.name_prefix}-task"
  network_mode             = var.network_mode
  requires_compatibilities = [var.launch_type]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn
  
  container_definitions = jsonencode([
    {
      name  = var.container_name
      image = var.container_image
      
      portMappings = [
        {
          containerPort = var.container_port
          hostPort      = var.launch_type == "FARGATE" ? var.container_port : 0
          protocol      = "tcp"
        }
      ]
      
      environment = [
        for key, value in var.environment_variables : {
          name  = key
          value = value
        }
      ]
      
      secrets = [
        for key, value in var.secrets : {
          name      = key
          valueFrom = value
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
      
      healthCheck = var.health_check_enabled ? {
        command = var.health_check_command
        interval = var.health_check_interval
        timeout  = var.health_check_timeout
        retries  = var.health_check_retries
      } : null
      
      essential = true
      
      mountPoints = [
        for mount in var.mount_points : {
          sourceVolume  = mount.source_volume
          containerPath = mount.container_path
          readOnly      = mount.read_only
        }
      ]
      
      volumesFrom = []
      
      ulimits = var.ulimits
      
      linuxParameters = var.enable_init_process ? {
        initProcessEnabled = true
      } : null
      
      firelensConfiguration = var.enable_firelens ? {
        type = "fluentd"
        options = {
          enable-ecs-log-metadata = "true"
        }
      } : null
    }
  ])
  
  dynamic "volume" {
    for_each = var.volumes
    content {
      name = volume.value.name
      
      dynamic "host_path" {
        for_each = volume.value.host_path != null ? [volume.value.host_path] : []
        content {
          path = host_path.value
        }
      }
      
      dynamic "efs_volume_configuration" {
        for_each = volume.value.efs_volume_configuration != null ? [volume.value.efs_volume_configuration] : []
        content {
          file_system_id          = efs_volume_configuration.value.file_system_id
          root_directory          = efs_volume_configuration.value.root_directory
          transit_encryption      = efs_volume_configuration.value.transit_encryption
          transit_encryption_port = efs_volume_configuration.value.transit_encryption_port
          
          dynamic "authorization_config" {
            for_each = efs_volume_configuration.value.authorization_config != null ? [efs_volume_configuration.value.authorization_config] : []
            content {
              access_point_id = authorization_config.value.access_point_id
              iam            = authorization_config.value.iam
            }
          }
        }
      }
    }
  }
  
  tags = local.common_tags
}

# ECS Service
resource "aws_ecs_service" "main" {
  name            = "${local.name_prefix}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.main.arn
  desired_count   = var.desired_count
  launch_type     = var.launch_type
  
  platform_version = var.launch_type == "FARGATE" ? var.platform_version : null
  
  dynamic "capacity_provider_strategy" {
    for_each = var.capacity_provider_strategy
    content {
      capacity_provider = capacity_provider_strategy.value.capacity_provider
      weight           = capacity_provider_strategy.value.weight
      base            = capacity_provider_strategy.value.base
    }
  }
  
  dynamic "network_configuration" {
    for_each = var.launch_type == "FARGATE" ? [1] : []
    content {
      subnets          = var.private_subnet_ids
      security_groups  = [aws_security_group.ecs_service.id]
      assign_public_ip = var.assign_public_ip
    }
  }
  
  dynamic "load_balancer" {
    for_each = var.load_balancer_config
    content {
      target_group_arn = load_balancer.value.target_group_arn
      container_name   = load_balancer.value.container_name
      container_port   = load_balancer.value.container_port
    }
  }
  
  deployment_configuration {
    maximum_percent         = var.deployment_maximum_percent
    minimum_healthy_percent = var.deployment_minimum_healthy_percent
    
    deployment_circuit_breaker {
      enable   = var.enable_circuit_breaker
      rollback = var.enable_rollback
    }
  }
  
  dynamic "service_registries" {
    for_each = var.service_registries
    content {
      registry_arn   = service_registries.value.registry_arn
      port           = service_registries.value.port
      container_name = service_registries.value.container_name
      container_port = service_registries.value.container_port
    }
  }
  
  enable_execute_command = var.enable_execute_command
  
  tags = local.common_tags
  
  depends_on = [
    aws_lb_listener.main,
    aws_iam_role_policy_attachment.ecs_execution,
    aws_iam_role_policy_attachment.ecs_task,
  ]
}

# Security Group for ECS Service (Fargate)
resource "aws_security_group" "ecs_service" {
  name_prefix = "${local.name_prefix}-ecs-service-"
  vpc_id      = var.vpc_id
  description = "Security group for ECS service"
  
  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  # Allow traffic from load balancer
  dynamic "ingress" {
    for_each = var.load_balancer_security_group_ids
    content {
      from_port       = var.container_port
      to_port         = var.container_port
      protocol        = "tcp"
      security_groups = [ingress.value]
      description     = "Container port from load balancer"
    }
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecs-service-sg"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

# Application Load Balancer
resource "aws_lb" "main" {
  count = var.create_load_balancer ? 1 : 0
  
  name               = "${local.name_prefix}-alb"
  internal           = var.internal_load_balancer
  load_balancer_type = "application"
  security_groups    = [aws_security_group.load_balancer[0].id]
  subnets            = var.public_subnet_ids
  
  enable_deletion_protection = var.enable_deletion_protection
  
  dynamic "access_logs" {
    for_each = var.enable_access_logs ? [1] : []
    content {
      bucket  = var.access_logs_bucket
      prefix  = var.access_logs_prefix
      enabled = true
    }
  }
  
  tags = local.common_tags
}

# Load Balancer Security Group
resource "aws_security_group" "load_balancer" {
  count = var.create_load_balancer ? 1 : 0
  
  name_prefix = "${local.name_prefix}-alb-"
  vpc_id      = var.vpc_id
  description = "Security group for application load balancer"
  
  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from anywhere"
  }
  
  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from anywhere"
  }
  
  # All outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

# Target Group
resource "aws_lb_target_group" "main" {
  count = var.create_load_balancer ? 1 : 0
  
  name     = "${local.name_prefix}-tg"
  port     = var.container_port
  protocol = "HTTP"
  vpc_id   = var.vpc_id
  
  target_type = var.launch_type == "FARGATE" ? "ip" : "instance"
  
  health_check {
    enabled             = true
    healthy_threshold   = var.health_check_healthy_threshold
    unhealthy_threshold = var.health_check_unhealthy_threshold
    timeout             = var.health_check_timeout_seconds
    interval            = var.health_check_interval_seconds
    path                = var.health_check_path
    matcher             = var.health_check_matcher
    protocol            = "HTTP"
  }
  
  tags = local.common_tags
}

# Load Balancer Listener
resource "aws_lb_listener" "main" {
  count = var.create_load_balancer ? 1 : 0
  
  load_balancer_arn = aws_lb.main[0].arn
  port              = "80"
  protocol          = "HTTP"
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.main[0].arn
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "ecs_target" {
  count = var.enable_autoscaling ? 1 : 0
  
  max_capacity       = var.autoscaling_max_capacity
  min_capacity       = var.autoscaling_min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Auto Scaling Policy - Scale Up
resource "aws_appautoscaling_policy" "ecs_policy_up" {
  count = var.enable_autoscaling ? 1 : 0
  
  name               = "${local.name_prefix}-scale-up"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target[0].service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    target_value = var.autoscaling_target_cpu
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = var.log_retention_days
  
  tags = local.common_tags
}

# KMS Key for encryption
resource "aws_kms_key" "ecs" {
  count = var.enable_encryption ? 1 : 0
  
  description             = "KMS key for ECS encryption"
  deletion_window_in_days = var.kms_deletion_window
  
  tags = local.common_tags
}

resource "aws_kms_alias" "ecs" {
  count = var.enable_encryption ? 1 : 0
  
  name          = "alias/${local.name_prefix}-ecs"
  target_key_id = aws_kms_key.ecs[0].key_id
}

# Data sources
data "aws_region" "current" {}

data "aws_ami" "ecs_optimized" {
  count = var.launch_type == "EC2" && var.ami_id == "" ? 1 : 0
  
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-x86_64-ebs"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# IAM Roles and Policies
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role" "ecs_instance" {
  count = var.launch_type == "EC2" ? 1 : 0
  
  name = "${local.name_prefix}-ecs-instance-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_instance_profile" "ecs" {
  count = var.launch_type == "EC2" ? 1 : 0
  
  name = "${local.name_prefix}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance[0].name
}

# IAM Role Policy Attachments
resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  count = var.launch_type == "EC2" ? 1 : 0
  
  role       = aws_iam_role.ecs_instance[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "ecs_task" {
  count = length(var.task_role_policy_arns)
  
  role       = aws_iam_role.ecs_task.name
  policy_arn = var.task_role_policy_arns[count.index]
}

# Custom IAM Policy for ECS Task Role
resource "aws_iam_role_policy" "ecs_task_custom" {
  count = var.custom_task_policy != "" ? 1 : 0
  
  name = "${local.name_prefix}-ecs-task-custom-policy"
  role = aws_iam_role.ecs_task.id
  
  policy = var.custom_task_policy
}

# Custom IAM Policy for ECS Execution Role
resource "aws_iam_role_policy" "ecs_execution_custom" {
  count = var.custom_execution_policy != "" ? 1 : 0
  
  name = "${local.name_prefix}-ecs-execution-custom-policy"
  role = aws_iam_role.ecs_execution.id
  
  policy = var.custom_execution_policy
}