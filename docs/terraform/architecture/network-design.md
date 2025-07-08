# Network Architecture Design

This document details the network architecture design for the Learning Assistant application, including VPC design, subnet planning, security group configuration, and network flow patterns.

## 🌐 Network Overview

The Learning Assistant network architecture is designed with security, scalability, and performance in mind. It implements a three-tier architecture with clear separation between public, private, and database layers.

### Key Design Principles

- **Defense in Depth**: Multiple layers of network security
- **Principle of Least Privilege**: Minimal required network access
- **High Availability**: Multi-AZ deployment for fault tolerance
- **Scalability**: Network design supports horizontal scaling
- **Cost Optimization**: Efficient use of network resources

## 🏗️ VPC Architecture

### Primary VPC Configuration

```yaml
VPC Configuration:
  Name: learning-assistant-vpc
  CIDR: 10.0.0.0/16
  Enable DNS Hostnames: true
  Enable DNS Resolution: true
  
Availability Zones:
  - us-east-1a (Primary)
  - us-east-1b (Secondary)
  - us-east-1c (Tertiary)
```

### Network Topology Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    VPC: 10.0.0.0/16                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    Public Subnets                               ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             ││
│  │  │    AZ-1a    │  │    AZ-1b    │  │    AZ-1c    │             ││
│  │  │10.0.1.0/24  │  │10.0.2.0/24  │  │10.0.3.0/24  │             ││
│  │  │             │  │             │  │             │             ││
│  │  │ ALB         │  │ ALB         │  │ ALB         │             ││
│  │  │ NAT Gateway │  │ NAT Gateway │  │ NAT Gateway │             ││
│  │  │ Bastion     │  │ Bastion     │  │ Bastion     │             ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                   Private Subnets                               ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             ││
│  │  │    AZ-1a    │  │    AZ-1b    │  │    AZ-1c    │             ││
│  │  │10.0.11.0/24 │  │10.0.12.0/24 │  │10.0.13.0/24 │             ││
│  │  │             │  │             │  │             │             ││
│  │  │ App Servers │  │ App Servers │  │ App Servers │             ││
│  │  │ ECS Tasks   │  │ ECS Tasks   │  │ ECS Tasks   │             ││
│  │  │ Redis       │  │ Redis       │  │ Redis       │             ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                  Database Subnets                               ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             ││
│  │  │    AZ-1a    │  │    AZ-1b    │  │    AZ-1c    │             ││
│  │  │10.0.21.0/24 │  │10.0.22.0/24 │  │10.0.23.0/24 │             ││
│  │  │             │  │             │  │             │             ││
│  │  │ RDS Primary │  │ RDS Replica │  │ RDS Replica │             ││
│  │  │ Redis Cluster│  │ Redis Cluster│  │ Redis Cluster│             ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘             ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## 🔗 Subnet Design

### Public Subnets (DMZ Layer)

#### Purpose
- Internet-facing resources
- Load balancers and NAT gateways
- Bastion hosts for administrative access
- SSL termination points

#### Configuration
```yaml
Public Subnets:
  - Name: learning-assistant-public-1a
    CIDR: 10.0.1.0/24
    AZ: us-east-1a
    Auto-assign Public IP: true
    
  - Name: learning-assistant-public-1b
    CIDR: 10.0.2.0/24
    AZ: us-east-1b
    Auto-assign Public IP: true
    
  - Name: learning-assistant-public-1c
    CIDR: 10.0.3.0/24
    AZ: us-east-1c
    Auto-assign Public IP: true
```

#### Resources
- **Application Load Balancer**: HTTP/HTTPS traffic distribution
- **NAT Gateway**: Outbound internet access for private subnets
- **Bastion Host**: Secure administrative access
- **VPN Gateway**: Site-to-site connectivity (optional)

### Private Subnets (Application Layer)

#### Purpose
- Application servers and services
- Container orchestration (ECS/EKS)
- Application-level caching
- Internal load balancers

#### Configuration
```yaml
Private Subnets:
  - Name: learning-assistant-private-1a
    CIDR: 10.0.11.0/24
    AZ: us-east-1a
    Auto-assign Public IP: false
    
  - Name: learning-assistant-private-1b
    CIDR: 10.0.12.0/24
    AZ: us-east-1b
    Auto-assign Public IP: false
    
  - Name: learning-assistant-private-1c
    CIDR: 10.0.13.0/24
    AZ: us-east-1c
    Auto-assign Public IP: false
```

#### Resources
- **ECS Service**: Containerized application instances
- **Application Servers**: Node.js/Next.js application instances
- **Redis Cluster**: Session and data caching
- **Internal Load Balancer**: Service-to-service communication

### Database Subnets (Data Layer)

#### Purpose
- Database instances and clusters
- Data storage and backup services
- Database-specific networking
- Isolated data processing

#### Configuration
```yaml
Database Subnets:
  - Name: learning-assistant-db-1a
    CIDR: 10.0.21.0/24
    AZ: us-east-1a
    Auto-assign Public IP: false
    
  - Name: learning-assistant-db-1b
    CIDR: 10.0.22.0/24
    AZ: us-east-1b
    Auto-assign Public IP: false
    
  - Name: learning-assistant-db-1c
    CIDR: 10.0.23.0/24
    AZ: us-east-1c
    Auto-assign Public IP: false
```

#### Resources
- **RDS PostgreSQL**: Primary database instance
- **RDS Read Replicas**: Read-only database copies
- **Redis Cluster**: Advanced caching and session storage
- **Database Backup Storage**: Automated backup solutions

## 🛡️ Security Groups

### Web Tier Security Group

#### Purpose
Protects internet-facing resources like load balancers and web servers.

```yaml
Security Group: learning-assistant-web-sg
Ingress Rules:
  - Port: 80
    Protocol: TCP
    Source: 0.0.0.0/0
    Description: HTTP traffic from internet
    
  - Port: 443
    Protocol: TCP
    Source: 0.0.0.0/0
    Description: HTTPS traffic from internet
    
  - Port: 22
    Protocol: TCP
    Source: 10.0.0.0/16
    Description: SSH access from VPC only

Egress Rules:
  - Port: All
    Protocol: All
    Destination: 0.0.0.0/0
    Description: All outbound traffic
```

### Application Tier Security Group

#### Purpose
Protects application servers and services in private subnets.

```yaml
Security Group: learning-assistant-app-sg
Ingress Rules:
  - Port: 3000
    Protocol: TCP
    Source: learning-assistant-web-sg
    Description: Next.js app port from load balancer
    
  - Port: 8080
    Protocol: TCP
    Source: learning-assistant-web-sg
    Description: Health check port
    
  - Port: 22
    Protocol: TCP
    Source: learning-assistant-bastion-sg
    Description: SSH access from bastion
    
  - Port: 6379
    Protocol: TCP
    Source: learning-assistant-app-sg
    Description: Redis access within app tier

Egress Rules:
  - Port: 443
    Protocol: TCP
    Destination: 0.0.0.0/0
    Description: HTTPS outbound
    
  - Port: 5432
    Protocol: TCP
    Destination: learning-assistant-db-sg
    Description: PostgreSQL database access
```

### Database Tier Security Group

#### Purpose
Protects database instances and related services.

```yaml
Security Group: learning-assistant-db-sg
Ingress Rules:
  - Port: 5432
    Protocol: TCP
    Source: learning-assistant-app-sg
    Description: PostgreSQL from application tier
    
  - Port: 6379
    Protocol: TCP
    Source: learning-assistant-app-sg
    Description: Redis from application tier
    
  - Port: 22
    Protocol: TCP
    Source: learning-assistant-bastion-sg
    Description: SSH access for maintenance

Egress Rules:
  - Port: 443
    Protocol: TCP
    Destination: 0.0.0.0/0
    Description: HTTPS for backups and updates
```

### Bastion Host Security Group

#### Purpose
Secure administrative access to private resources.

```yaml
Security Group: learning-assistant-bastion-sg
Ingress Rules:
  - Port: 22
    Protocol: TCP
    Source: [ADMIN_IP_RANGES]
    Description: SSH from authorized IPs only

Egress Rules:
  - Port: 22
    Protocol: TCP
    Destination: 10.0.0.0/16
    Description: SSH to private instances
    
  - Port: 443
    Protocol: TCP
    Destination: 0.0.0.0/0
    Description: HTTPS for package updates
```

## 📡 Network Access Control Lists (NACLs)

### Public Subnet NACL

```yaml
NACL: learning-assistant-public-nacl
Inbound Rules:
  - Rule: 100
    Protocol: TCP
    Port: 80
    Source: 0.0.0.0/0
    Action: ALLOW
    
  - Rule: 110
    Protocol: TCP
    Port: 443
    Source: 0.0.0.0/0
    Action: ALLOW
    
  - Rule: 120
    Protocol: TCP
    Port: 1024-65535
    Source: 0.0.0.0/0
    Action: ALLOW
    
  - Rule: 32767
    Protocol: ALL
    Port: ALL
    Source: 0.0.0.0/0
    Action: DENY

Outbound Rules:
  - Rule: 100
    Protocol: ALL
    Port: ALL
    Destination: 0.0.0.0/0
    Action: ALLOW
```

### Private Subnet NACL

```yaml
NACL: learning-assistant-private-nacl
Inbound Rules:
  - Rule: 100
    Protocol: TCP
    Port: 3000
    Source: 10.0.0.0/16
    Action: ALLOW
    
  - Rule: 110
    Protocol: TCP
    Port: 8080
    Source: 10.0.0.0/16
    Action: ALLOW
    
  - Rule: 120
    Protocol: TCP
    Port: 1024-65535
    Source: 0.0.0.0/0
    Action: ALLOW
    
  - Rule: 32767
    Protocol: ALL
    Port: ALL
    Source: 0.0.0.0/0
    Action: DENY

Outbound Rules:
  - Rule: 100
    Protocol: ALL
    Port: ALL
    Destination: 0.0.0.0/0
    Action: ALLOW
```

## 🌉 Gateway Configuration

### Internet Gateway

```yaml
Internet Gateway: learning-assistant-igw
Attachment: learning-assistant-vpc
Purpose: Internet access for public subnets
```

### NAT Gateway

```yaml
NAT Gateways:
  - Name: learning-assistant-nat-1a
    Subnet: learning-assistant-public-1a
    Allocation ID: [EIP_ALLOCATION_ID]
    
  - Name: learning-assistant-nat-1b
    Subnet: learning-assistant-public-1b
    Allocation ID: [EIP_ALLOCATION_ID]
    
  - Name: learning-assistant-nat-1c
    Subnet: learning-assistant-public-1c
    Allocation ID: [EIP_ALLOCATION_ID]
```

### VPN Gateway (Optional)

```yaml
VPN Gateway: learning-assistant-vpn-gw
Type: IPSec VPN
BGP ASN: 65000
Purpose: Site-to-site connectivity
```

## 🛣️ Route Tables

### Public Route Table

```yaml
Route Table: learning-assistant-public-rt
Routes:
  - Destination: 10.0.0.0/16
    Target: Local
    
  - Destination: 0.0.0.0/0
    Target: learning-assistant-igw
    
Associated Subnets:
  - learning-assistant-public-1a
  - learning-assistant-public-1b
  - learning-assistant-public-1c
```

### Private Route Tables

```yaml
Route Table: learning-assistant-private-rt-1a
Routes:
  - Destination: 10.0.0.0/16
    Target: Local
    
  - Destination: 0.0.0.0/0
    Target: learning-assistant-nat-1a
    
Associated Subnets:
  - learning-assistant-private-1a

Route Table: learning-assistant-private-rt-1b
Routes:
  - Destination: 10.0.0.0/16
    Target: Local
    
  - Destination: 0.0.0.0/0
    Target: learning-assistant-nat-1b
    
Associated Subnets:
  - learning-assistant-private-1b

Route Table: learning-assistant-private-rt-1c
Routes:
  - Destination: 10.0.0.0/16
    Target: Local
    
  - Destination: 0.0.0.0/0
    Target: learning-assistant-nat-1c
    
Associated Subnets:
  - learning-assistant-private-1c
```

### Database Route Table

```yaml
Route Table: learning-assistant-db-rt
Routes:
  - Destination: 10.0.0.0/16
    Target: Local
    
Associated Subnets:
  - learning-assistant-db-1a
  - learning-assistant-db-1b
  - learning-assistant-db-1c
```

## 🔀 Network Flow Patterns

### Inbound Traffic Flow

```
Internet ──▶ Internet Gateway ──▶ Public Subnet ──▶ Load Balancer
                                                          │
                                                          ▼
Private Subnet ──▶ Application Servers ──▶ Database Subnet ──▶ RDS
```

### Outbound Traffic Flow

```
Database Subnet ──▶ Private Subnet ──▶ NAT Gateway ──▶ Internet Gateway ──▶ Internet
```

### Internal Communication

```
Application Tier ←──▶ Database Tier (Direct communication within VPC)
Application Tier ←──▶ Cache Tier (Internal load balancing)
```

## 🏥 High Availability Design

### Multi-AZ Deployment

#### Load Balancer Configuration
- **Application Load Balancer**: Spans all public subnets
- **Health Checks**: Monitors application health across AZs
- **Failover**: Automatic traffic redirection on failure

#### Database High Availability
- **RDS Multi-AZ**: Synchronous replication across AZs
- **Read Replicas**: Distributed across multiple AZs
- **Automated Backups**: Cross-AZ backup replication

#### Cache High Availability
- **Redis Cluster**: Multi-node cluster across AZs
- **Automatic Failover**: Redis Sentinel for failure detection
- **Data Persistence**: AOF and RDB persistence

### Disaster Recovery

#### Cross-Region Replication
- **Database Backups**: Automated cross-region backup
- **Infrastructure Code**: Terraform state replication
- **DNS Failover**: Route 53 health checks and failover

## 📊 Network Performance Optimization

### Bandwidth Optimization

#### Instance Types
- **Compute Optimized**: C5n instances for network-intensive workloads
- **Enhanced Networking**: SR-IOV for higher bandwidth
- **Placement Groups**: Cluster placement for low latency

#### Connection Pooling
- **Database Connections**: PgBouncer for connection pooling
- **Application Connections**: HTTP/2 and connection reuse
- **Load Balancer**: Optimized connection handling

### Latency Optimization

#### Geographic Distribution
- **Multi-Region**: Deploy in multiple AWS regions
- **CloudFront**: Edge caching for global performance
- **Route 53**: Latency-based routing

#### Network Optimization
- **Dedicated Tenancy**: For consistent performance
- **Enhanced Networking**: Single root I/O virtualization
- **Jumbo Frames**: 9000 MTU for bulk data transfer

## 🔧 Network Monitoring

### CloudWatch Metrics

#### VPC Flow Logs
- **Traffic Analysis**: Detailed network traffic logs
- **Security Monitoring**: Unusual traffic pattern detection
- **Troubleshooting**: Network connectivity issues

#### Network Performance Metrics
- **Bandwidth Utilization**: Interface-level bandwidth monitoring
- **Packet Loss**: Network quality monitoring
- **Latency Tracking**: End-to-end latency measurement

### Alerting Configuration

```yaml
Network Alerts:
  - Alert: High Network Utilization
    Metric: NetworkIn/NetworkOut
    Threshold: 80%
    Action: Auto-scaling trigger
    
  - Alert: Packet Loss
    Metric: PacketDropCount
    Threshold: 1%
    Action: Engineering notification
    
  - Alert: NAT Gateway Failure
    Metric: NatGatewayHealth
    Threshold: 0
    Action: Immediate escalation
```

## 💰 Cost Optimization

### Network Cost Management

#### Data Transfer Costs
- **CloudFront**: Reduce origin data transfer costs
- **VPC Endpoints**: Eliminate NAT Gateway costs for AWS services
- **Direct Connect**: Dedicated connection for high-volume transfer

#### Resource Optimization
- **NAT Gateway**: Right-size based on bandwidth requirements
- **Load Balancer**: Application vs. Network load balancer cost analysis
- **VPC Endpoints**: S3 and DynamoDB VPC endpoints

### Monitoring and Budgets

```yaml
Cost Monitoring:
  - Budget: Network Services
    Limit: $500/month
    Alerts: 80%, 90%, 100%
    
  - Budget: Data Transfer
    Limit: $200/month
    Alerts: 75%, 90%, 100%
```

## 🔐 Network Security Best Practices

### Security Implementation

#### Network Segmentation
- **Zero Trust**: Verify every network transaction
- **Microsegmentation**: Granular network access control
- **VPC Peering**: Secure inter-VPC communication

#### Encryption
- **TLS 1.3**: All inter-service communication
- **VPN**: Site-to-site encrypted connections
- **Database Encryption**: In-transit and at-rest encryption

### Compliance Requirements

#### Regulatory Compliance
- **PCI DSS**: Network security requirements
- **HIPAA**: Healthcare data protection
- **SOC 2**: Security and availability controls

## 📚 Related Documentation

- [Security Architecture](./security-design.md)
- [System Overview](./system-overview.md)
- [Infrastructure Components](./components.md)
- [Security Patterns](../patterns/security-patterns.md)
- [Monitoring Patterns](../patterns/monitoring-patterns.md)

## 🔗 Network Configuration Examples

### Terraform Configuration

```hcl
# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "learning-assistant-vpc"
    Environment = var.environment
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.availability_zones)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "learning-assistant-public-${count.index + 1}"
    Type = "Public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 11}.0/24"
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "learning-assistant-private-${count.index + 1}"
    Type = "Private"
  }
}

# Database Subnets
resource "aws_subnet" "database" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 21}.0/24"
  availability_zone = var.availability_zones[count.index]
  
  tags = {
    Name = "learning-assistant-database-${count.index + 1}"
    Type = "Database"
  }
}
```

---

This network architecture provides a robust, secure, and scalable foundation for the Learning Assistant application, implementing industry best practices for cloud networking.