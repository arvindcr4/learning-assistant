terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Configure remote state storage
  backend "gcs" {
    bucket = "learning-assistant-terraform-state"
    prefix = "terraform/state"
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
  
  default_labels = {
    environment = var.environment
    project     = "learning-assistant"
    managed_by  = "terraform"
  }
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
  
  default_labels = {
    environment = var.environment
    project     = "learning-assistant"
    managed_by  = "terraform"
  }
}

provider "random" {}
provider "tls" {}