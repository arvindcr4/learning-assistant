# IAM Module for Learning Assistant Application
# Provides secure IAM roles and policies with least privilege access

# ECS Task Execution Role
resource "aws_iam_role" "ecs_task_execution_role" {
  count = var.create_ecs_task_execution_role ? 1 : 0

  name = "${var.name_prefix}-ecs-task-execution-role"

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

  tags = var.tags
}

# ECS Task Execution Role Policy Attachment
resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  count = var.create_ecs_task_execution_role ? 1 : 0

  role       = aws_iam_role.ecs_task_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Additional ECS Task Execution Role Policy for ECR and CloudWatch
resource "aws_iam_role_policy" "ecs_task_execution_additional" {
  count = var.create_ecs_task_execution_role ? 1 : 0

  name = "${var.name_prefix}-ecs-task-execution-additional"
  role = aws_iam_role.ecs_task_execution_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          for param in var.parameter_store_parameters :
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${param}"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:/${var.name_prefix}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [
          "arn:aws:kms:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:key/*"
        ]
        Condition = {
          StringEquals = {
            "kms:ViaService" = [
              "ssm.${data.aws_region.current.name}.amazonaws.com",
              "secretsmanager.${data.aws_region.current.name}.amazonaws.com"
            ]
          }
        }
      }
    ]
  })
}

# ECS Task Role
resource "aws_iam_role" "ecs_task_role" {
  count = var.create_ecs_task_role ? 1 : 0

  name = "${var.name_prefix}-ecs-task-role"

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

  tags = var.tags
}

# ECS Task Role Policy for Application Permissions
resource "aws_iam_role_policy" "ecs_task_policy" {
  count = var.create_ecs_task_role ? 1 : 0

  name = "${var.name_prefix}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          for param in var.parameter_store_parameters :
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${param}"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:/${var.name_prefix}/*"
        ]
      }
    ]
  })
}

# S3 Access Policy (if S3 buckets are provided)
resource "aws_iam_role_policy" "s3_access" {
  count = var.create_ecs_task_role && length(var.s3_bucket_arns) > 0 ? 1 : 0

  name = "${var.name_prefix}-s3-access"
  role = aws_iam_role.ecs_task_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = concat(
          var.s3_bucket_arns,
          [for arn in var.s3_bucket_arns : "${arn}/*"]
        )
      }
    ]
  })
}

# Lambda Execution Role (if Lambda functions are used)
resource "aws_iam_role" "lambda_execution_role" {
  count = var.create_lambda_execution_role ? 1 : 0

  name = "${var.name_prefix}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Lambda Execution Role Policy Attachment
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  count = var.create_lambda_execution_role ? 1 : 0

  role       = aws_iam_role.lambda_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda VPC Execution Role Policy Attachment
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  count = var.create_lambda_execution_role ? 1 : 0

  role       = aws_iam_role.lambda_execution_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# CodeBuild Service Role
resource "aws_iam_role" "codebuild_role" {
  count = var.create_codebuild_role ? 1 : 0

  name = "${var.name_prefix}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# CodeBuild Service Role Policy
resource "aws_iam_role_policy" "codebuild_policy" {
  count = var.create_codebuild_role ? 1 : 0

  name = "${var.name_prefix}-codebuild-policy"
  role = aws_iam_role.codebuild_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:GetAuthorizationToken",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.name_prefix}-*/*"
        ]
      }
    ]
  })
}

# CodePipeline Service Role
resource "aws_iam_role" "codepipeline_role" {
  count = var.create_codepipeline_role ? 1 : 0

  name = "${var.name_prefix}-codepipeline-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "codepipeline.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# CodePipeline Service Role Policy
resource "aws_iam_role_policy" "codepipeline_policy" {
  count = var.create_codepipeline_role ? 1 : 0

  name = "${var.name_prefix}-codepipeline-policy"
  role = aws_iam_role.codepipeline_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:GetBucketVersioning"
        ]
        Resource = [
          "arn:aws:s3:::${var.name_prefix}-*",
          "arn:aws:s3:::${var.name_prefix}-*/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codebuild:BatchGetBuilds",
          "codebuild:StartBuild"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          aws_iam_role.ecs_task_execution_role[0].arn,
          aws_iam_role.ecs_task_role[0].arn
        ]
      }
    ]
  })
}

# Application Auto Scaling Role
resource "aws_iam_role" "autoscaling_role" {
  count = var.create_autoscaling_role ? 1 : 0

  name = "${var.name_prefix}-autoscaling-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "application-autoscaling.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# Application Auto Scaling Role Policy Attachment
resource "aws_iam_role_policy_attachment" "autoscaling_role_policy" {
  count = var.create_autoscaling_role ? 1 : 0

  role       = aws_iam_role.autoscaling_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSServiceRolePolicy"
}

# Additional Auto Scaling Policy for ECS
resource "aws_iam_role_policy" "autoscaling_ecs_policy" {
  count = var.create_autoscaling_role ? 1 : 0

  name = "${var.name_prefix}-autoscaling-ecs-policy"
  role = aws_iam_role.autoscaling_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:UpdateService",
          "cloudwatch:DescribeAlarms"
        ]
        Resource = "*"
      }
    ]
  })
}

# Cross-account access role (for multi-account deployments)
resource "aws_iam_role" "cross_account_role" {
  count = var.create_cross_account_role ? 1 : 0

  name = "${var.name_prefix}-cross-account-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = var.trusted_account_arns
        }
        Condition = {
          StringEquals = {
            "sts:ExternalId" = var.external_id
          }
        }
      }
    ]
  })

  tags = var.tags
}

# Instance Profile for EC2 instances (if needed)
resource "aws_iam_instance_profile" "ec2_profile" {
  count = var.create_ec2_instance_profile ? 1 : 0

  name = "${var.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2_role[0].name

  tags = var.tags
}

# EC2 Instance Role
resource "aws_iam_role" "ec2_role" {
  count = var.create_ec2_instance_profile ? 1 : 0

  name = "${var.name_prefix}-ec2-role"

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

  tags = var.tags
}

# EC2 Role Policy for CloudWatch and SSM
resource "aws_iam_role_policy_attachment" "ec2_cloudwatch" {
  count = var.create_ec2_instance_profile ? 1 : 0

  role       = aws_iam_role.ec2_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  count = var.create_ec2_instance_profile ? 1 : 0

  role       = aws_iam_role.ec2_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}