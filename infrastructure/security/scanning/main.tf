# =============================================================================
# SECURITY SCANNING MODULE
# Checkov, tfsec, Terrascan, Semgrep, Trivy Integration
# =============================================================================

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# =============================================================================
# VARIABLES
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "enable_checkov" {
  description = "Enable Checkov scanning"
  type        = bool
  default     = true
}

variable "enable_tfsec" {
  description = "Enable tfsec scanning"
  type        = bool
  default     = true
}

variable "enable_terrascan" {
  description = "Enable Terrascan scanning"
  type        = bool
  default     = true
}

variable "enable_semgrep" {
  description = "Enable Semgrep scanning"
  type        = bool
  default     = true
}

variable "enable_trivy" {
  description = "Enable Trivy scanning"
  type        = bool
  default     = true
}

variable "enable_snyk" {
  description = "Enable Snyk scanning"
  type        = bool
  default     = true
}

variable "enable_codeql" {
  description = "Enable CodeQL scanning"
  type        = bool
  default     = true
}

variable "enable_sonarqube" {
  description = "Enable SonarQube scanning"
  type        = bool
  default     = true
}

variable "scanning_schedule" {
  description = "Cron schedule for security scanning"
  type        = string
  default     = "0 2 * * *" # Daily at 2 AM
}

variable "security_scanning_bucket" {
  description = "S3 bucket for security scanning results"
  type        = string
  default     = ""
}

variable "severity_thresholds" {
  description = "Severity thresholds for different scanners"
  type = object({
    checkov    = string
    tfsec      = string
    terrascan  = string
    semgrep    = string
    trivy      = string
    snyk       = string
    codeql     = string
    sonarqube  = string
  })
  default = {
    checkov    = "HIGH"
    tfsec      = "HIGH"
    terrascan  = "HIGH"
    semgrep    = "HIGH"
    trivy      = "HIGH"
    snyk       = "HIGH"
    codeql     = "HIGH"
    sonarqube  = "HIGH"
  }
}

variable "fail_build_on_severity" {
  description = "Fail build on security findings of this severity or higher"
  type        = string
  default     = "HIGH"
}

variable "enable_automated_remediation" {
  description = "Enable automated remediation for security findings"
  type        = bool
  default     = true
}

variable "notification_email" {
  description = "Email for security scan notifications"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Resource tags"
  type        = map(string)
  default     = {}
}

# =============================================================================
# LOCALS
# =============================================================================

locals {
  common_tags = merge(var.tags, {
    Module = "security-scanning"
  })

  scanner_configs = {
    checkov = {
      enabled = var.enable_checkov
      image = "bridgecrew/checkov:latest"
      config_file = "checkov.yml"
      severity_threshold = var.severity_thresholds.checkov
      command = [
        "checkov",
        "-f", "/workspace",
        "--framework", "terraform",
        "--framework", "cloudformation",
        "--framework", "kubernetes",
        "--framework", "dockerfile",
        "--output", "json",
        "--output", "cli",
        "--output", "sarif",
        "--soft-fail"
      ]
    }
    tfsec = {
      enabled = var.enable_tfsec
      image = "aquasec/tfsec:latest"
      config_file = "tfsec.yml"
      severity_threshold = var.severity_thresholds.tfsec
      command = [
        "tfsec",
        "/workspace",
        "--format", "json",
        "--format", "sarif",
        "--out", "/results/tfsec.json",
        "--sarif-file", "/results/tfsec.sarif",
        "--soft-fail"
      ]
    }
    terrascan = {
      enabled = var.enable_terrascan
      image = "tenable/terrascan:latest"
      config_file = "terrascan.yml"
      severity_threshold = var.severity_thresholds.terrascan
      command = [
        "terrascan",
        "scan",
        "-i", "terraform",
        "-d", "/workspace",
        "-o", "json",
        "-o", "sarif",
        "--output-file", "/results/terrascan.json",
        "--sarif-file", "/results/terrascan.sarif"
      ]
    }
    semgrep = {
      enabled = var.enable_semgrep
      image = "returntocorp/semgrep:latest"
      config_file = "semgrep.yml"
      severity_threshold = var.severity_thresholds.semgrep
      command = [
        "semgrep",
        "--config=auto",
        "--json",
        "--sarif",
        "--output=/results/semgrep.json",
        "--sarif-output=/results/semgrep.sarif",
        "/workspace"
      ]
    }
    trivy = {
      enabled = var.enable_trivy
      image = "aquasec/trivy:latest"
      config_file = "trivy.yml"
      severity_threshold = var.severity_thresholds.trivy
      command = [
        "trivy",
        "fs",
        "--format", "json",
        "--format", "sarif",
        "--output", "/results/trivy.json",
        "--sarif-output", "/results/trivy.sarif",
        "/workspace"
      ]
    }
    snyk = {
      enabled = var.enable_snyk
      image = "snyk/snyk:latest"
      config_file = "snyk.yml"
      severity_threshold = var.severity_thresholds.snyk
      command = [
        "snyk",
        "test",
        "--json",
        "--sarif",
        "--json-file-output=/results/snyk.json",
        "--sarif-file-output=/results/snyk.sarif",
        "/workspace"
      ]
    }
  }

  # CIS Benchmark checks
  cis_benchmark_checks = {
    aws = [
      "CIS-1.1", "CIS-1.2", "CIS-1.3", "CIS-1.4", "CIS-1.5", "CIS-1.6", "CIS-1.7", "CIS-1.8", "CIS-1.9", "CIS-1.10",
      "CIS-1.11", "CIS-1.12", "CIS-1.13", "CIS-1.14", "CIS-1.15", "CIS-1.16", "CIS-1.17", "CIS-1.18", "CIS-1.19", "CIS-1.20",
      "CIS-1.21", "CIS-1.22", "CIS-2.1", "CIS-2.2", "CIS-2.3", "CIS-2.4", "CIS-2.5", "CIS-2.6", "CIS-2.7", "CIS-2.8",
      "CIS-2.9", "CIS-3.1", "CIS-3.2", "CIS-3.3", "CIS-3.4", "CIS-3.5", "CIS-3.6", "CIS-3.7", "CIS-3.8", "CIS-3.9",
      "CIS-3.10", "CIS-3.11", "CIS-3.12", "CIS-3.13", "CIS-3.14", "CIS-4.1", "CIS-4.2", "CIS-4.3", "CIS-4.4"
    ]
    kubernetes = [
      "CIS-1.1.1", "CIS-1.1.2", "CIS-1.1.3", "CIS-1.1.4", "CIS-1.1.5", "CIS-1.1.6", "CIS-1.1.7", "CIS-1.1.8",
      "CIS-1.2.1", "CIS-1.2.2", "CIS-1.2.3", "CIS-1.2.4", "CIS-1.2.5", "CIS-1.2.6", "CIS-1.2.7", "CIS-1.2.8",
      "CIS-1.3.1", "CIS-1.3.2", "CIS-1.3.3", "CIS-1.3.4", "CIS-1.3.5", "CIS-1.3.6", "CIS-1.3.7", "CIS-1.4.1",
      "CIS-1.4.2", "CIS-2.1", "CIS-2.2", "CIS-2.3", "CIS-2.4", "CIS-2.5", "CIS-2.6", "CIS-2.7"
    ]
  }

  # OWASP Top 10 checks
  owasp_top10_checks = [
    "A01-2021-Broken-Access-Control",
    "A02-2021-Cryptographic-Failures",
    "A03-2021-Injection",
    "A04-2021-Insecure-Design",
    "A05-2021-Security-Misconfiguration",
    "A06-2021-Vulnerable-and-Outdated-Components",
    "A07-2021-Identification-and-Authentication-Failures",
    "A08-2021-Software-and-Data-Integrity-Failures",
    "A09-2021-Security-Logging-and-Monitoring-Failures",
    "A10-2021-Server-Side-Request-Forgery"
  ]

  # SANS Top 25 checks
  sans_top25_checks = [
    "CWE-79", "CWE-89", "CWE-20", "CWE-125", "CWE-119", "CWE-22", "CWE-352", "CWE-434", "CWE-862", "CWE-78",
    "CWE-787", "CWE-287", "CWE-190", "CWE-476", "CWE-416", "CWE-362", "CWE-269", "CWE-94", "CWE-798", "CWE-200",
    "CWE-522", "CWE-732", "CWE-611", "CWE-918", "CWE-276"
  ]
}

# =============================================================================
# S3 BUCKET FOR SCANNING RESULTS
# =============================================================================

resource "aws_s3_bucket" "scanning_results" {
  bucket = var.security_scanning_bucket != "" ? var.security_scanning_bucket : "${var.project_name}-${var.environment}-security-scanning-results"
  
  tags = merge(local.common_tags, {
    Purpose = "Security Scanning Results"
  })
}

resource "aws_s3_bucket_versioning" "scanning_results" {
  bucket = aws_s3_bucket.scanning_results.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "scanning_results" {
  bucket = aws_s3_bucket.scanning_results.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "scanning_results" {
  bucket = aws_s3_bucket.scanning_results.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "scanning_results" {
  bucket = aws_s3_bucket.scanning_results.id

  rule {
    id     = "scanning_results_lifecycle"
    status = "Enabled"

    expiration {
      days = 365
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# =============================================================================
# ECR REPOSITORIES FOR SCANNING TOOLS
# =============================================================================

resource "aws_ecr_repository" "security_scanner" {
  name                 = "${var.project_name}-${var.environment}-security-scanner"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "security_scanner" {
  repository = aws_ecr_repository.security_scanner.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Delete untagged images older than 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# =============================================================================
# LAMBDA FUNCTIONS FOR SCANNING
# =============================================================================

# Main scanning orchestrator
resource "aws_lambda_function" "security_scanner_orchestrator" {
  filename         = "security_scanner_orchestrator.zip"
  function_name    = "${var.project_name}-${var.environment}-security-scanner-orchestrator"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900
  memory_size     = 1024

  environment {
    variables = {
      SCANNING_BUCKET = aws_s3_bucket.scanning_results.bucket
      PROJECT_NAME    = var.project_name
      ENVIRONMENT     = var.environment
      REGION          = var.region
      NOTIFICATION_EMAIL = var.notification_email
      FAIL_BUILD_ON_SEVERITY = var.fail_build_on_severity
      ENABLE_AUTOMATED_REMEDIATION = var.enable_automated_remediation
      CHECKOV_ENABLED = var.enable_checkov
      TFSEC_ENABLED = var.enable_tfsec
      TERRASCAN_ENABLED = var.enable_terrascan
      SEMGREP_ENABLED = var.enable_semgrep
      TRIVY_ENABLED = var.enable_trivy
      SNYK_ENABLED = var.enable_snyk
      CODEQL_ENABLED = var.enable_codeql
      SONARQUBE_ENABLED = var.enable_sonarqube
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_logs,
    aws_cloudwatch_log_group.lambda_logs,
  ]

  tags = local.common_tags
}

# Individual scanner functions
resource "aws_lambda_function" "checkov_scanner" {
  count = var.enable_checkov ? 1 : 0
  
  filename         = "checkov_scanner.zip"
  function_name    = "${var.project_name}-${var.environment}-checkov-scanner"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900
  memory_size     = 2048

  environment {
    variables = {
      SCANNING_BUCKET = aws_s3_bucket.scanning_results.bucket
      SEVERITY_THRESHOLD = var.severity_thresholds.checkov
      SCANNER_NAME = "checkov"
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "tfsec_scanner" {
  count = var.enable_tfsec ? 1 : 0
  
  filename         = "tfsec_scanner.zip"
  function_name    = "${var.project_name}-${var.environment}-tfsec-scanner"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900
  memory_size     = 2048

  environment {
    variables = {
      SCANNING_BUCKET = aws_s3_bucket.scanning_results.bucket
      SEVERITY_THRESHOLD = var.severity_thresholds.tfsec
      SCANNER_NAME = "tfsec"
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "terrascan_scanner" {
  count = var.enable_terrascan ? 1 : 0
  
  filename         = "terrascan_scanner.zip"
  function_name    = "${var.project_name}-${var.environment}-terrascan-scanner"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900
  memory_size     = 2048

  environment {
    variables = {
      SCANNING_BUCKET = aws_s3_bucket.scanning_results.bucket
      SEVERITY_THRESHOLD = var.severity_thresholds.terrascan
      SCANNER_NAME = "terrascan"
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "semgrep_scanner" {
  count = var.enable_semgrep ? 1 : 0
  
  filename         = "semgrep_scanner.zip"
  function_name    = "${var.project_name}-${var.environment}-semgrep-scanner"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900
  memory_size     = 2048

  environment {
    variables = {
      SCANNING_BUCKET = aws_s3_bucket.scanning_results.bucket
      SEVERITY_THRESHOLD = var.severity_thresholds.semgrep
      SCANNER_NAME = "semgrep"
    }
  }

  tags = local.common_tags
}

resource "aws_lambda_function" "trivy_scanner" {
  count = var.enable_trivy ? 1 : 0
  
  filename         = "trivy_scanner.zip"
  function_name    = "${var.project_name}-${var.environment}-trivy-scanner"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900
  memory_size     = 2048

  environment {
    variables = {
      SCANNING_BUCKET = aws_s3_bucket.scanning_results.bucket
      SEVERITY_THRESHOLD = var.severity_thresholds.trivy
      SCANNER_NAME = "trivy"
    }
  }

  tags = local.common_tags
}

# =============================================================================
# IAM ROLES AND POLICIES
# =============================================================================

resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.project_name}-${var.environment}-scanner-lambda-role"

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

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_scanning_policy" {
  name = "${var.project_name}-${var.environment}-scanner-lambda-policy"
  role = aws_iam_role.lambda_execution_role.id

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
        Resource = [
          aws_s3_bucket.scanning_results.arn,
          "${aws_s3_bucket.scanning_results.arn}/*"
        ]
      },
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
          "ecs:RunTask",
          "ecs:DescribeTasks",
          "ecs:StopTask"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = aws_iam_role.ecs_task_execution_role.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.security_notifications.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# =============================================================================
# ECS CLUSTER FOR SCANNING TASKS
# =============================================================================

resource "aws_ecs_cluster" "security_scanning" {
  name = "${var.project_name}-${var.environment}-security-scanning"

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      
      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs_logs.name
      }
    }
  }

  tags = local.common_tags
}

resource "aws_ecs_cluster_capacity_providers" "security_scanning" {
  cluster_name = aws_ecs_cluster.security_scanning.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ECS Task Definition for security scanning
resource "aws_ecs_task_definition" "security_scanner" {
  family                   = "${var.project_name}-${var.environment}-security-scanner"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "2048"
  memory                   = "4096"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "security-scanner"
      image = "${aws_ecr_repository.security_scanner.repository_url}:latest"
      
      environment = [
        {
          name  = "SCANNING_BUCKET"
          value = aws_s3_bucket.scanning_results.bucket
        },
        {
          name  = "PROJECT_NAME"
          value = var.project_name
        },
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "REGION"
          value = var.region
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs_logs.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "ecs"
        }
      }

      essential = true
    }
  ])

  tags = local.common_tags
}

# ECS IAM Roles
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-${var.environment}-ecs-task-execution-role"

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

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-${var.environment}-ecs-task-role"

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

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "${var.project_name}-${var.environment}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

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
        Resource = [
          aws_s3_bucket.scanning_results.arn,
          "${aws_s3_bucket.scanning_results.arn}/*"
        ]
      }
    ]
  })
}

# =============================================================================
# CLOUDWATCH LOGS
# =============================================================================

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-security-scanner"
  retention_in_days = 14
  
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "ecs_logs" {
  name              = "/aws/ecs/${var.project_name}-${var.environment}-security-scanning"
  retention_in_days = 14
  
  tags = local.common_tags
}

# =============================================================================
# EVENTBRIDGE RULES FOR SCHEDULED SCANNING
# =============================================================================

resource "aws_cloudwatch_event_rule" "security_scanning_schedule" {
  name                = "${var.project_name}-${var.environment}-security-scanning-schedule"
  description         = "Trigger security scanning on schedule"
  schedule_expression = "cron(${var.scanning_schedule})"

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "security_scanning_target" {
  rule      = aws_cloudwatch_event_rule.security_scanning_schedule.name
  target_id = "SecurityScanningTarget"
  arn       = aws_lambda_function.security_scanner_orchestrator.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.security_scanner_orchestrator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.security_scanning_schedule.arn
}

# =============================================================================
# SNS TOPIC FOR NOTIFICATIONS
# =============================================================================

resource "aws_sns_topic" "security_notifications" {
  name = "${var.project_name}-${var.environment}-security-notifications"

  tags = local.common_tags
}

resource "aws_sns_topic_subscription" "security_email_notifications" {
  topic_arn = aws_sns_topic.security_notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# =============================================================================
# SECURITY SCANNING DASHBOARD
# =============================================================================

resource "aws_cloudwatch_dashboard" "security_scanning_dashboard" {
  dashboard_name = "${var.project_name}-${var.environment}-security-scanning-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.security_scanner_orchestrator.function_name],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.security_scanner_orchestrator.function_name],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.security_scanner_orchestrator.function_name]
          ]
          period = 300
          stat   = "Sum"
          region = var.region
          title  = "Security Scanner Metrics"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          query = "SOURCE '${aws_cloudwatch_log_group.lambda_logs.name}' | fields @timestamp, @message\n| filter @message like /CRITICAL/\n| sort @timestamp desc\n| limit 100"
          region = var.region
          title  = "Critical Security Findings"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", "security-scanning"],
            ["AWS/ECS", "MemoryUtilization", "ServiceName", "security-scanning"]
          ]
          period = 300
          stat   = "Average"
          region = var.region
          title  = "ECS Security Scanning Resources"
        }
      }
    ]
  })

  tags = local.common_tags
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "scanning_results_bucket" {
  description = "S3 bucket for security scanning results"
  value       = aws_s3_bucket.scanning_results.bucket
}

output "scanning_cluster" {
  description = "ECS cluster for security scanning"
  value       = aws_ecs_cluster.security_scanning.name
}

output "scanner_functions" {
  description = "Security scanner Lambda functions"
  value = {
    orchestrator = aws_lambda_function.security_scanner_orchestrator.function_name
    checkov      = var.enable_checkov ? aws_lambda_function.checkov_scanner[0].function_name : null
    tfsec        = var.enable_tfsec ? aws_lambda_function.tfsec_scanner[0].function_name : null
    terrascan    = var.enable_terrascan ? aws_lambda_function.terrascan_scanner[0].function_name : null
    semgrep      = var.enable_semgrep ? aws_lambda_function.semgrep_scanner[0].function_name : null
    trivy        = var.enable_trivy ? aws_lambda_function.trivy_scanner[0].function_name : null
  }
}

output "notification_topic" {
  description = "SNS topic for security notifications"
  value       = aws_sns_topic.security_notifications.arn
}

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.security_scanning_dashboard.dashboard_name}"
}

output "ecr_repository" {
  description = "ECR repository for security scanner images"
  value       = aws_ecr_repository.security_scanner.repository_url
}

output "scanning_schedule" {
  description = "Security scanning schedule"
  value       = var.scanning_schedule
}

output "enabled_scanners" {
  description = "List of enabled security scanners"
  value = {
    checkov    = var.enable_checkov
    tfsec      = var.enable_tfsec
    terrascan  = var.enable_terrascan
    semgrep    = var.enable_semgrep
    trivy      = var.enable_trivy
    snyk       = var.enable_snyk
    codeql     = var.enable_codeql
    sonarqube  = var.enable_sonarqube
  }
}

output "severity_thresholds" {
  description = "Severity thresholds for security scanners"
  value = var.severity_thresholds
}

output "cis_benchmark_checks" {
  description = "CIS benchmark checks being performed"
  value = local.cis_benchmark_checks
}

output "owasp_top10_checks" {
  description = "OWASP Top 10 checks being performed"
  value = local.owasp_top10_checks
}

output "sans_top25_checks" {
  description = "SANS Top 25 checks being performed"
  value = local.sans_top25_checks
}