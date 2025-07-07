# Infrastructure as Code with Terraform

This directory contains the Terraform configurations for managing multi-cloud infrastructure.

## Directory Structure

```
infra/
├── main.tf              # Root module main configuration
├── providers.tf         # Provider configurations
├── backend.tf           # State backend configuration
├── variables.tf         # Input variables
├── outputs.tf           # Output values
├── .terraform.lock.hcl  # Dependency lock file
├── .tflint.hcl         # TFLint configuration
├── .gitignore          # Git ignore patterns
│
├── modules/            # Reusable Terraform modules
│   └── README.md       # Modules documentation
│
├── stacks/             # Cloud-specific root modules
│   ├── aws/            # AWS infrastructure stack
│   ├── gcp/            # Google Cloud Platform stack
│   ├── azure/          # Microsoft Azure stack
│   └── digitalocean/   # DigitalOcean stack
│
└── .github/
    └── workflows/
        └── terraform-lint.yml  # CI/CD pipeline for linting

```

## Quick Start

1. **Choose your cloud provider stack:**
   ```bash
   cd stacks/aws  # or gcp, azure, digitalocean
   ```

2. **Initialize Terraform:**
   ```bash
   terraform init
   ```

3. **Configure your variables:**
   - Copy `terraform.tfvars.example` to `terraform.tfvars`
   - Update with your specific values

4. **Plan your deployment:**
   ```bash
   terraform plan
   ```

5. **Apply the configuration:**
   ```bash
   terraform apply
   ```

## Development Workflow

### Linting and Validation

Run locally before committing:
```bash
# Format check
terraform fmt -recursive

# Validate configuration
terraform validate

# Run TFLint
tflint --init
tflint --recursive
```

### CI/CD

The GitHub Actions workflow automatically runs on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

It performs:
- Terraform format checking
- Configuration validation
- TFLint analysis
- Checkov security scanning

## Module Development

When creating new modules:
1. Create a new directory under `modules/`
2. Include `main.tf`, `variables.tf`, `outputs.tf`, and `README.md`
3. Document all variables and outputs
4. Add examples in the module's README

## State Management

Configure your backend in `backend.tf` based on your cloud provider:
- **AWS**: S3 backend with DynamoDB for state locking
- **GCP**: Google Cloud Storage backend
- **Azure**: Azure Storage backend
- **Local**: For development only

## Security Best Practices

1. Never commit `.tfvars` files with sensitive data
2. Use environment variables or secret management systems for credentials
3. Enable state file encryption
4. Use least-privilege IAM policies
5. Regular security scanning with Checkov

## Contributing

1. Create a feature branch
2. Make your changes
3. Run linting and validation
4. Submit a pull request
5. Ensure CI checks pass

## Support

For issues or questions:
- Check existing documentation in stack-specific READMEs
- Review module documentation
- Create an issue with detailed information
