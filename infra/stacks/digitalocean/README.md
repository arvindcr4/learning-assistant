# DigitalOcean Stack

This directory contains the root module for DigitalOcean infrastructure deployment.

## Overview

This stack provisions and manages DigitalOcean-specific resources by composing various modules from the `../../modules/` directory.

## Structure

```
digitalocean/
├── main.tf         # Main configuration composing modules
├── variables.tf    # DigitalOcean-specific variables
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

- `do_region` - DigitalOcean region for deployment
- `project_name` - Name of the project
- `environment` - Deployment environment (dev/staging/prod)

## Outputs

See `outputs.tf` for available outputs from this stack.
