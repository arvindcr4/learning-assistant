# Terraform backend configuration
# Configure where Terraform state will be stored

# Example S3 backend configuration (uncomment and configure as needed)
# terraform {
#   backend "s3" {
#     bucket         = "my-terraform-state-bucket"
#     key            = "infra/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "terraform-state-lock"
#   }
# }

# Example Google Cloud Storage backend configuration
# terraform {
#   backend "gcs" {
#     bucket = "my-terraform-state-bucket"
#     prefix = "infra"
#   }
# }

# Example Azure Storage backend configuration
# terraform {
#   backend "azurerm" {
#     resource_group_name  = "terraform-state-rg"
#     storage_account_name = "terraformstate"
#     container_name       = "tfstate"
#     key                  = "infra.terraform.tfstate"
#   }
# }

# Local backend (default) - for development only
# terraform {
#   backend "local" {
#     path = "terraform.tfstate"
#   }
# }
