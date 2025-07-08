# IAM Module Variables

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "create_ecs_task_execution_role" {
  description = "Create ECS task execution role"
  type        = bool
  default     = true
}

variable "create_ecs_task_role" {
  description = "Create ECS task role"
  type        = bool
  default     = true
}

variable "create_lambda_execution_role" {
  description = "Create Lambda execution role"
  type        = bool
  default     = false
}

variable "create_codebuild_role" {
  description = "Create CodeBuild service role"
  type        = bool
  default     = false
}

variable "create_codepipeline_role" {
  description = "Create CodePipeline service role"
  type        = bool
  default     = false
}

variable "create_autoscaling_role" {
  description = "Create auto scaling role"
  type        = bool
  default     = false
}

variable "create_cross_account_role" {
  description = "Create cross-account access role"
  type        = bool
  default     = false
}

variable "create_ec2_instance_profile" {
  description = "Create EC2 instance profile"
  type        = bool
  default     = false
}

variable "parameter_store_parameters" {
  description = "List of Parameter Store parameters to grant access to"
  type        = list(string)
  default     = []
}

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs for IAM access"
  type        = list(string)
  default     = []
}

variable "trusted_account_arns" {
  description = "List of trusted account ARNs for cross-account access"
  type        = list(string)
  default     = []
}

variable "external_id" {
  description = "External ID for cross-account access"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}