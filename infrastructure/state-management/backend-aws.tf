# AWS S3 Backend Configuration for Terraform State Management
# This file configures secure remote state storage using AWS S3 with DynamoDB for state locking

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "learning-assistant"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
      CostCenter  = var.cost_center
    }
  }
}

# Random suffix for unique resource naming
resource "random_id" "state_suffix" {
  byte_length = 4
}

# S3 Bucket for Terraform State
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-terraform-state-${var.environment}-${random_id.state_suffix.hex}"
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.terraform_state.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "terraform_state_lifecycle"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = var.state_retention_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# S3 Bucket Notification for State Changes
resource "aws_s3_bucket_notification" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.state_change_notifier.arn
    events              = ["s3:ObjectCreated:*", "s3:ObjectRemoved:*"]
    filter_prefix       = "terraform.tfstate"
  }

  depends_on = [aws_lambda_permission.allow_bucket]
}

# KMS Key for State Encryption
resource "aws_kms_key" "terraform_state" {
  description             = "KMS key for Terraform state encryption"
  deletion_window_in_days = var.kms_deletion_window
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Terraform State Access"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.terraform_state_role.arn,
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/terraform-${var.environment}"
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

# KMS Key Alias
resource "aws_kms_alias" "terraform_state" {
  name          = "alias/terraform-state-${var.environment}"
  target_key_id = aws_kms_key.terraform_state.key_id
}

# DynamoDB Table for State Locking
resource "aws_dynamodb_table" "terraform_state_lock" {
  name           = "${var.project_name}-terraform-state-lock-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.terraform_state.arn
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-terraform-state-lock-${var.environment}"
  }
}

# IAM Role for Terraform State Operations
resource "aws_iam_role" "terraform_state_role" {
  name = "${var.project_name}-terraform-state-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "ec2.amazonaws.com",
            "lambda.amazonaws.com"
          ]
        }
      },
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = var.trusted_role_arns
        }
      }
    ]
  })
}

# IAM Policy for Terraform State Operations
resource "aws_iam_role_policy" "terraform_state_policy" {
  name = "${var.project_name}-terraform-state-policy-${var.environment}"
  role = aws_iam_role.terraform_state_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketVersioning",
          "s3:GetObjectVersion",
          "s3:ListBucketVersions"
        ]
        Resource = [
          aws_s3_bucket.terraform_state.arn,
          "${aws_s3_bucket.terraform_state.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable"
        ]
        Resource = aws_dynamodb_table.terraform_state_lock.arn
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.terraform_state.arn
      }
    ]
  })
}

# Lambda Function for State Change Notifications
resource "aws_lambda_function" "state_change_notifier" {
  filename         = "state-change-notifier.zip"
  function_name    = "${var.project_name}-state-change-notifier-${var.environment}"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 60

  environment {
    variables = {
      SLACK_WEBHOOK_URL = var.slack_webhook_url
      ENVIRONMENT       = var.environment
      PROJECT_NAME      = var.project_name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_cloudwatch_log_group.lambda_logs,
    data.archive_file.lambda_zip
  ]
}

# Lambda Execution Role
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.project_name}-lambda-execution-role-${var.environment}"

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
}

# Lambda Basic Execution Policy
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-state-change-notifier-${var.environment}"
  retention_in_days = 14
}

# Lambda Permission for S3 Bucket
resource "aws_lambda_permission" "allow_bucket" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.state_change_notifier.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.terraform_state.arn
}

# Lambda Function Code
data "archive_file" "lambda_zip" {
  type        = "zip"
  output_path = "state-change-notifier.zip"
  source {
    content = <<EOF
import json
import os
import urllib3
from datetime import datetime

def handler(event, context):
    """
    Lambda function to handle Terraform state change notifications
    """
    http = urllib3.PoolManager()
    
    webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
    environment = os.environ.get('ENVIRONMENT', 'unknown')
    project_name = os.environ.get('PROJECT_NAME', 'terraform')
    
    if not webhook_url:
        print("No Slack webhook URL configured")
        return
    
    try:
        for record in event['Records']:
            s3_event = record['s3']
            bucket_name = s3_event['bucket']['name']
            object_key = s3_event['object']['key']
            event_name = record['eventName']
            
            message = {
                "text": f"🔄 Terraform State Change Alert",
                "attachments": [
                    {
                        "color": "warning" if "ObjectRemoved" in event_name else "good",
                        "fields": [
                            {
                                "title": "Environment",
                                "value": environment,
                                "short": True
                            },
                            {
                                "title": "Project",
                                "value": project_name,
                                "short": True
                            },
                            {
                                "title": "Bucket",
                                "value": bucket_name,
                                "short": True
                            },
                            {
                                "title": "Object",
                                "value": object_key,
                                "short": True
                            },
                            {
                                "title": "Event",
                                "value": event_name,
                                "short": True
                            },
                            {
                                "title": "Timestamp",
                                "value": datetime.now().isoformat(),
                                "short": True
                            }
                        ]
                    }
                ]
            }
            
            response = http.request(
                'POST',
                webhook_url,
                body=json.dumps(message),
                headers={'Content-Type': 'application/json'}
            )
            
            print(f"Notification sent with status: {response.status}")
            
    except Exception as e:
        print(f"Error sending notification: {str(e)}")
        raise
    
    return {
        'statusCode': 200,
        'body': json.dumps('Notifications sent successfully')
    }
EOF
    filename = "index.py"
  }
}

# State Backup Configuration
resource "aws_s3_bucket" "terraform_state_backup" {
  bucket = "${var.project_name}-terraform-state-backup-${var.environment}-${random_id.state_suffix.hex}"
}

# Cross-Region Replication for State Backup
resource "aws_s3_bucket_replication_configuration" "terraform_state_backup" {
  count  = var.enable_cross_region_backup ? 1 : 0
  role   = aws_iam_role.replication_role[0].arn
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    id     = "terraform_state_backup"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.terraform_state_backup.arn
      storage_class = "STANDARD_IA"
      
      encryption_configuration {
        replica_kms_key_id = aws_kms_key.terraform_state.arn
      }
    }
  }

  depends_on = [aws_s3_bucket_versioning.terraform_state]
}

# Replication Role for Cross-Region Backup
resource "aws_iam_role" "replication_role" {
  count = var.enable_cross_region_backup ? 1 : 0
  name  = "${var.project_name}-replication-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })
}

# Data Sources
data "aws_caller_identity" "current" {}

# Variables
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "learning-assistant"
}

variable "owner" {
  description = "Resource owner"
  type        = string
}

variable "cost_center" {
  description = "Cost center for billing"
  type        = string
}

variable "state_retention_days" {
  description = "Number of days to retain old state versions"
  type        = number
  default     = 90
}

variable "kms_deletion_window" {
  description = "KMS key deletion window in days"
  type        = number
  default     = 7
}

variable "trusted_role_arns" {
  description = "List of trusted role ARNs that can assume the state role"
  type        = list(string)
  default     = []
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_cross_region_backup" {
  description = "Enable cross-region backup replication"
  type        = bool
  default     = false
}

# Outputs
output "state_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "state_bucket_arn" {
  description = "ARN of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_state_lock.name
}

output "kms_key_id" {
  description = "ID of the KMS key used for state encryption"
  value       = aws_kms_key.terraform_state.key_id
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for state encryption"
  value       = aws_kms_key.terraform_state.arn
}

output "terraform_state_role_arn" {
  description = "ARN of the IAM role for Terraform state operations"
  value       = aws_iam_role.terraform_state_role.arn
}

output "backend_config" {
  description = "Backend configuration for Terraform"
  value = {
    bucket         = aws_s3_bucket.terraform_state.bucket
    key            = "terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    kms_key_id     = aws_kms_key.terraform_state.arn
    dynamodb_table = aws_dynamodb_table.terraform_state_lock.name
  }
}