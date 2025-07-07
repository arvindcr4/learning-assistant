# Google Cloud Platform Stack

This directory contains the root module for GCP infrastructure deployment.

## Overview

This stack provisions and manages GCP-specific resources by composing various modules from the `../../modules/` directory.

## Structure

```
gcp/
├── main.tf         # Main configuration composing modules
├── variables.tf    # GCP-specific variables
├── outputs.tf      # Stack outputs
├── terraform.tfvars.example  # Example variable values
└── README.md       # This file
```

## Usage

1. Initialize Terraform:
   ```bash
   terraform init
   ```

2. Create a `terraform.tfvars` file based on `terraform.tfvars.example`

3. Plan the deployment:
   ```bash
   terraform plan
   ```

4. Apply the configuration:
   ```bash
   terraform apply
   ```

## Required Variables

- `gcp_project_id` - GCP project ID
- `gcp_region` - GCP region for deployment
- `project_name` - Name of the project
- `environment` - Deployment environment (dev/staging/prod)

## Outputs

See `outputs.tf` for available outputs from this stack.
