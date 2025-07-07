# DigitalOcean Production Resources

## Created Resources

### 1. Droplet
- **Name**: learning-assistant-prod
- **ID**: 506589281
- **Specs**: 2 vCPU / 2 GB RAM / 60 GB Disk
- **OS**: Ubuntu 22.04 LTS x64
- **Region**: NYC3
- **Public IP**: 165.227.110.159
- **Private IP**: 10.108.0.2
- **Floating IP**: 138.197.50.3 (Reserved IPv4)
- **Features**: Backups, Monitoring, Private Networking
- **Tags**: production, learning-assistant

### 2. SSH Access
- **SSH Key Name**: learning-assistant-prod
- **Key ID**: 49153951
- **Private Key**: `~/.ssh/do_learning_assistant`
- **Public Key**: `~/.ssh/do_learning_assistant.pub`

To connect to the droplet:
```bash
ssh -i ~/.ssh/do_learning_assistant root@138.197.50.3
```

### 3. Container Registry (DOCR)
- **Name**: learning-assistant
- **Endpoint**: registry.digitalocean.com/learning-assistant
- **Region**: SFO2
- **Tier**: Starter (500MB free storage)

### 4. Next Steps

#### Personal Access Token (PAT)
You need to manually create a PAT for CI/CD:
1. Go to: https://cloud.digitalocean.com/account/api/tokens
2. Click 'Generate New Token'
3. Name it: 'learning-assistant-ci'
4. Select scopes: Read + Write (for registry)
5. Save the token securely (it's shown only once!)

#### DNS Configuration
Configure your domain's DNS A record to point to the floating IP:
- **A Record**: `@` or `www` → `138.197.50.3`

#### Optional: Managed Databases
If you want managed databases instead of Docker containers:

**PostgreSQL:**
```bash
doctl databases create learning-assistant-db \
  --engine pg \
  --region nyc3 \
  --size db-s-1vcpu-1gb \
  --version 15
```

**Redis:**
```bash
doctl databases create learning-assistant-redis \
  --engine redis \
  --region nyc3 \
  --size db-s-1vcpu-1gb \
  --version 7
```

#### Optional: Load Balancer
For automatic HTTPS termination:
```bash
doctl compute load-balancer create \
  --name learning-assistant-lb \
  --region nyc3 \
  --forwarding-rules "entry_protocol:https,entry_port:443,target_protocol:http,target_port:80,certificate_id:<cert-id>" \
  --forwarding-rules "entry_protocol:http,entry_port:80,target_protocol:http,target_port:80" \
  --droplet-ids 506589281 \
  --redirect-http-to-https
```

Note: You'll need to add an SSL certificate first using:
```bash
doctl compute certificate create \
  --name learning-assistant-cert \
  --type lets_encrypt \
  --dns-names "yourdomain.com,www.yourdomain.com"
```
