# DigitalOcean Infrastructure Stack

This Terraform stack provisions a complete DigitalOcean infrastructure for containerized applications.

## Resources Created

- **VPC**: Private network for all resources
- **Container Registry**: Private Docker image repository
- **App Platform**: Container hosting service with auto-scaling
- **Managed PostgreSQL**: Database cluster with automatic backups
- **Managed Redis**: Optional caching layer
- **Spaces**: Object storage with CDN and optional custom domain
- **Monitoring & Alerts**: CPU, memory, and database monitoring with email/Slack alerts
- **Project**: Organizes all resources in DigitalOcean dashboard

## Prerequisites

1. DigitalOcean account with API token
2. Terraform >= 1.0
3. Docker image pushed to the container registry

## Usage

1. Create a `terraform.tfvars` file:

```hcl
do_token             = "your-digitalocean-api-token"
name                 = "myapp"
bucket_name          = "myapp-storage"
app_image_repository = "myapp-api"
app_image_tag        = "latest"

# Optional: Enable Redis
enable_redis = true

# Optional: Configure alerts
alert_emails = ["ops@example.com"]
slack_webhook_url = "https://hooks.slack.com/services/..."
slack_channel = "#alerts"

# Optional: Custom domain for CDN
cdn_custom_domain = "cdn.example.com"
cdn_certificate_id = "cert-id-from-digitalocean"
```

2. Initialize and apply:

```bash
terraform init
terraform plan
terraform apply
```

## Variables

### Required Variables

| Variable | Description |
|----------|-------------|
| `do_token` | DigitalOcean API token |
| `name` | Name prefix for all resources |
| `bucket_name` | Unique name for Spaces bucket |
| `app_image_repository` | Docker image repository name |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `region` | DigitalOcean region | `nyc3` |
| `environment` | Environment name | `dev` |
| `enable_redis` | Enable Redis cache | `true` |
| `enable_cdn` | Enable CDN for Spaces | `true` |
| `app_instance_count` | Number of app instances | `1` |
| `postgres_size` | PostgreSQL instance size | `db-s-1vcpu-1gb` |
| `redis_size` | Redis instance size | `db-s-1vcpu-1gb` |

See `variables.tf` for all available configuration options.

## Outputs

The stack provides the following outputs:

- `app_live_url`: Live application URL
- `container_registry_endpoint`: Docker registry endpoint
- `postgres_uri`: PostgreSQL connection string (sensitive)
- `redis_uri`: Redis connection string (sensitive)
- `spaces_endpoint`: Object storage endpoint
- `cdn_endpoint`: CDN endpoint (if enabled)
- `connection_strings`: All database connection strings

## Connecting to Services

### Container Registry

```bash
# Login to registry
doctl registry login

# Tag and push image
docker tag myapp:latest registry.digitalocean.com/${name}-registry/myapp-api:latest
docker push registry.digitalocean.com/${name}-registry/myapp-api:latest
```

### Database Access

```bash
# Get connection string
terraform output -raw postgres_uri

# Connect using psql
psql "$(terraform output -raw postgres_uri)"
```

### Spaces (S3-compatible)

```bash
# Configure s3cmd or AWS CLI
export AWS_ACCESS_KEY_ID="your-spaces-key"
export AWS_SECRET_ACCESS_KEY="your-spaces-secret"
export AWS_ENDPOINT_URL="https://$(terraform output -raw spaces_region).digitaloceanspaces.com"

# Upload files
aws s3 cp file.txt s3://$(terraform output -raw spaces_bucket_name)/
```

## Monitoring

Alerts are configured for:
- App CPU usage > 80%
- App memory usage > 80%
- Database CPU usage > 75%

Alerts can be sent to email addresses and/or Slack channels.

## Cost Optimization

To reduce costs for development environments:

1. Set `app_instance_count = 1`
2. Use smaller instance sizes:
   - `postgres_size = "db-s-1vcpu-1gb"`
   - `app_instance_size = "basic-xs"`
3. Disable Redis: `enable_redis = false`
4. Disable CDN: `enable_cdn = false`

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Note**: Ensure you've backed up any important data before destroying resources.
