# IAM Module Outputs

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role"
  value       = var.create_ecs_task_execution_role ? aws_iam_role.ecs_task_execution_role[0].arn : null
}

output "ecs_task_execution_role_name" {
  description = "Name of the ECS task execution role"
  value       = var.create_ecs_task_execution_role ? aws_iam_role.ecs_task_execution_role[0].name : null
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = var.create_ecs_task_role ? aws_iam_role.ecs_task_role[0].arn : null
}

output "ecs_task_role_name" {
  description = "Name of the ECS task role"
  value       = var.create_ecs_task_role ? aws_iam_role.ecs_task_role[0].name : null
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = var.create_lambda_execution_role ? aws_iam_role.lambda_execution_role[0].arn : null
}

output "lambda_execution_role_name" {
  description = "Name of the Lambda execution role"
  value       = var.create_lambda_execution_role ? aws_iam_role.lambda_execution_role[0].name : null
}

output "codebuild_role_arn" {
  description = "ARN of the CodeBuild role"
  value       = var.create_codebuild_role ? aws_iam_role.codebuild_role[0].arn : null
}

output "codebuild_role_name" {
  description = "Name of the CodeBuild role"
  value       = var.create_codebuild_role ? aws_iam_role.codebuild_role[0].name : null
}

output "codepipeline_role_arn" {
  description = "ARN of the CodePipeline role"
  value       = var.create_codepipeline_role ? aws_iam_role.codepipeline_role[0].arn : null
}

output "codepipeline_role_name" {
  description = "Name of the CodePipeline role"
  value       = var.create_codepipeline_role ? aws_iam_role.codepipeline_role[0].name : null
}

output "autoscaling_role_arn" {
  description = "ARN of the auto scaling role"
  value       = var.create_autoscaling_role ? aws_iam_role.autoscaling_role[0].arn : null
}

output "autoscaling_role_name" {
  description = "Name of the auto scaling role"
  value       = var.create_autoscaling_role ? aws_iam_role.autoscaling_role[0].name : null
}

output "cross_account_role_arn" {
  description = "ARN of the cross-account role"
  value       = var.create_cross_account_role ? aws_iam_role.cross_account_role[0].arn : null
}

output "cross_account_role_name" {
  description = "Name of the cross-account role"
  value       = var.create_cross_account_role ? aws_iam_role.cross_account_role[0].name : null
}

output "ec2_instance_profile_arn" {
  description = "ARN of the EC2 instance profile"
  value       = var.create_ec2_instance_profile ? aws_iam_instance_profile.ec2_profile[0].arn : null
}

output "ec2_instance_profile_name" {
  description = "Name of the EC2 instance profile"
  value       = var.create_ec2_instance_profile ? aws_iam_instance_profile.ec2_profile[0].name : null
}

output "ec2_role_arn" {
  description = "ARN of the EC2 role"
  value       = var.create_ec2_instance_profile ? aws_iam_role.ec2_role[0].arn : null
}

output "ec2_role_name" {
  description = "Name of the EC2 role"
  value       = var.create_ec2_instance_profile ? aws_iam_role.ec2_role[0].name : null
}

output "all_role_arns" {
  description = "Map of all role ARNs"
  value = {
    ecs_task_execution = var.create_ecs_task_execution_role ? aws_iam_role.ecs_task_execution_role[0].arn : null
    ecs_task           = var.create_ecs_task_role ? aws_iam_role.ecs_task_role[0].arn : null
    lambda_execution   = var.create_lambda_execution_role ? aws_iam_role.lambda_execution_role[0].arn : null
    codebuild          = var.create_codebuild_role ? aws_iam_role.codebuild_role[0].arn : null
    codepipeline       = var.create_codepipeline_role ? aws_iam_role.codepipeline_role[0].arn : null
    autoscaling        = var.create_autoscaling_role ? aws_iam_role.autoscaling_role[0].arn : null
    cross_account      = var.create_cross_account_role ? aws_iam_role.cross_account_role[0].arn : null
    ec2                = var.create_ec2_instance_profile ? aws_iam_role.ec2_role[0].arn : null
  }
}

output "all_role_names" {
  description = "Map of all role names"
  value = {
    ecs_task_execution = var.create_ecs_task_execution_role ? aws_iam_role.ecs_task_execution_role[0].name : null
    ecs_task           = var.create_ecs_task_role ? aws_iam_role.ecs_task_role[0].name : null
    lambda_execution   = var.create_lambda_execution_role ? aws_iam_role.lambda_execution_role[0].name : null
    codebuild          = var.create_codebuild_role ? aws_iam_role.codebuild_role[0].name : null
    codepipeline       = var.create_codepipeline_role ? aws_iam_role.codepipeline_role[0].name : null
    autoscaling        = var.create_autoscaling_role ? aws_iam_role.autoscaling_role[0].name : null
    cross_account      = var.create_cross_account_role ? aws_iam_role.cross_account_role[0].name : null
    ec2                = var.create_ec2_instance_profile ? aws_iam_role.ec2_role[0].name : null
  }
}