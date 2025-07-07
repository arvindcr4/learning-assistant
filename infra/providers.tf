# Terraform providers configuration
# Define the required providers and their versions

terraform {
  required_version = ">= 1.0"

  required_providers {
    # AWS Provider
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Google Cloud Provider
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }

    # Azure Provider
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }

    # DigitalOcean Provider
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# Provider configurations (uncomment and configure as needed)

# provider "aws" {
#   region = var.aws_region
# }

# provider "google" {
#   project = var.gcp_project_id
#   region  = var.gcp_region
# }

# provider "azurerm" {
#   features {}
# }

# provider "digitalocean" {
#   token = var.do_token
# }
