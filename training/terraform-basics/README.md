# Terraform Basics Training

Welcome to the comprehensive Terraform basics training for the Learning Assistant infrastructure project. This training is designed to take you from beginner to proficient in Terraform fundamentals.

## 🎯 Training Overview

### Learning Objectives
By the end of this training, you will be able to:
- Understand Infrastructure as Code (IaC) principles
- Install and configure Terraform
- Write and organize Terraform configurations
- Deploy and manage infrastructure using Terraform
- Implement best practices for Terraform development
- Troubleshoot common Terraform issues

### Prerequisites
- Basic understanding of cloud computing concepts
- Familiarity with command line interface
- Basic knowledge of at least one cloud provider (AWS, GCP, Azure)
- Text editor or IDE installed

### Training Duration
- **Self-paced**: 8-12 hours
- **Instructor-led**: 2 days
- **Hands-on labs**: 4-6 hours

## 📚 Training Modules

### Module 1: Introduction to Infrastructure as Code
**Duration**: 45 minutes

#### Learning Objectives
- Understand the concept of Infrastructure as Code
- Learn the benefits of IaC
- Compare imperative vs declarative approaches
- Understand Terraform's role in the IaC ecosystem

#### Topics Covered
1. **What is Infrastructure as Code?**
   - Traditional infrastructure management challenges
   - IaC benefits: consistency, repeatability, version control
   - IaC best practices

2. **Introduction to Terraform**
   - HashiCorp Terraform overview
   - Terraform vs other IaC tools
   - Terraform's declarative approach

3. **Terraform Ecosystem**
   - Terraform CLI
   - Terraform providers
   - Terraform modules
   - Terraform Cloud/Enterprise

#### Hands-on Lab 1.1: Environment Setup (15 minutes)
```bash
# Install Terraform
# Verify installation
terraform version

# Configure cloud provider credentials
# AWS example
aws configure

# Create first Terraform file
echo 'terraform {
  required_version = ">= 1.0"
}' > main.tf

# Initialize Terraform
terraform init
```

#### Knowledge Check
- What are the main benefits of Infrastructure as Code?
- How does Terraform differ from imperative tools like scripts?
- What is the Terraform state and why is it important?

### Module 2: Terraform Fundamentals
**Duration**: 90 minutes

#### Learning Objectives
- Understand Terraform configuration syntax (HCL)
- Learn about Terraform blocks and structure
- Work with variables, outputs, and locals
- Understand the Terraform workflow

#### Topics Covered
1. **HashiCorp Configuration Language (HCL)**
   - HCL syntax basics
   - Comments and formatting
   - Data types and structures

2. **Terraform Configuration Blocks**
   ```hcl
   # Terraform block
   terraform {
     required_version = ">= 1.0"
     required_providers {
       aws = {
         source  = "hashicorp/aws"
         version = "~> 5.0"
       }
     }
   }
   
   # Provider block
   provider "aws" {
     region = "us-east-1"
   }
   
   # Resource block
   resource "aws_instance" "example" {
     ami           = "ami-0c02fb55956c7d316"
     instance_type = "t3.micro"
   }
   
   # Data block
   data "aws_ami" "latest" {
     most_recent = true
     owners      = ["amazon"]
   }
   ```

3. **Variables and Outputs**
   ```hcl
   # Variables
   variable "instance_type" {
     description = "EC2 instance type"
     type        = string
     default     = "t3.micro"
   }
   
   # Outputs
   output "instance_ip" {
     description = "The public IP of the instance"
     value       = aws_instance.example.public_ip
   }
   ```

4. **Terraform Workflow**
   - `terraform init`
   - `terraform plan`
   - `terraform apply`
   - `terraform destroy`

#### Hands-on Lab 2.1: First Infrastructure (30 minutes)
Create your first infrastructure with Terraform:

```hcl
# variables.tf
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

# main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  
  tags = {
    Name = "terraform-example"
  }
}

# outputs.tf
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.web.id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.web.public_ip
}
```

#### Knowledge Check
- What is the purpose of the `terraform init` command?
- How do you reference a variable in Terraform?
- What's the difference between a resource and a data source?

### Module 3: Working with Resources and Data Sources
**Duration**: 75 minutes

#### Learning Objectives
- Understand Terraform resources in depth
- Learn to use data sources effectively
- Work with resource dependencies
- Understand resource lifecycle management

#### Topics Covered
1. **Resource Syntax and Arguments**
   ```hcl
   resource "resource_type" "resource_name" {
     argument1 = "value1"
     argument2 = "value2"
     
     nested_block {
       nested_argument = "nested_value"
     }
   }
   ```

2. **Resource Dependencies**
   ```hcl
   # Implicit dependency
   resource "aws_instance" "web" {
     subnet_id = aws_subnet.public.id
   }
   
   # Explicit dependency
   resource "aws_instance" "web" {
     depends_on = [aws_security_group.web]
   }
   ```

3. **Data Sources**
   ```hcl
   data "aws_availability_zones" "available" {
     state = "available"
   }
   
   data "aws_ami" "ubuntu" {
     most_recent = true
     owners      = ["099720109477"] # Canonical
   }
   ```

4. **Resource Lifecycle**
   ```hcl
   resource "aws_instance" "example" {
     lifecycle {
       create_before_destroy = true
       prevent_destroy       = true
       ignore_changes       = [tags]
     }
   }
   ```

#### Hands-on Lab 3.1: Building a VPC (45 minutes)
Build a complete VPC with subnets:

```hcl
# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "terraform-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "terraform-igw"
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Public Subnet
resource "aws_subnet" "public" {
  count = 2
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "terraform-public-subnet-${count.index + 1}"
  }
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  
  tags = {
    Name = "terraform-public-rt"
  }
}

# Route Table Association
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
```

#### Knowledge Check
- How do you create implicit dependencies between resources?
- When would you use a data source instead of a resource?
- What is the purpose of the lifecycle block?

### Module 4: Variables, Outputs, and Locals
**Duration**: 60 minutes

#### Learning Objectives
- Master Terraform variables
- Create meaningful outputs
- Use locals for computed values
- Understand variable precedence

#### Topics Covered
1. **Input Variables**
   ```hcl
   variable "instance_count" {
     description = "Number of instances to create"
     type        = number
     default     = 1
     
     validation {
       condition     = var.instance_count > 0
       error_message = "Instance count must be positive."
     }
   }
   
   variable "environment" {
     description = "Environment name"
     type        = string
     
     validation {
       condition = contains(["dev", "staging", "prod"], var.environment)
       error_message = "Environment must be dev, staging, or prod."
     }
   }
   ```

2. **Output Values**
   ```hcl
   output "vpc_id" {
     description = "ID of the VPC"
     value       = aws_vpc.main.id
   }
   
   output "private_subnets" {
     description = "List of IDs of private subnets"
     value       = aws_subnet.private[*].id
   }
   
   output "database_endpoint" {
     description = "RDS instance endpoint"
     value       = aws_db_instance.database.endpoint
     sensitive   = true
   }
   ```

3. **Local Values**
   ```hcl
   locals {
     common_tags = {
       Environment = var.environment
       Project     = "learning-assistant"
       ManagedBy   = "terraform"
     }
     
     instance_name = "${var.environment}-web-server"
   }
   
   resource "aws_instance" "web" {
     tags = local.common_tags
   }
   ```

4. **Variable Precedence**
   1. Environment variables (`TF_VAR_name`)
   2. `terraform.tfvars` file
   3. `terraform.tfvars.json` file
   4. `*.auto.tfvars` or `*.auto.tfvars.json` files
   5. `-var` and `-var-file` command-line flags

#### Hands-on Lab 4.1: Parameterized Infrastructure (30 minutes)
Create a parameterized web server setup:

```hcl
# variables.tf
variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
  default     = 1
}

# locals.tf
locals {
  common_tags = {
    Environment = var.environment
    Project     = "terraform-training"
    ManagedBy   = "terraform"
  }
  
  instance_name_prefix = "${var.environment}-web"
}

# main.tf
resource "aws_instance" "web" {
  count = var.instance_count
  
  ami           = data.aws_ami.amazon_linux.id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.public[count.index % length(aws_subnet.public)].id
  
  tags = merge(local.common_tags, {
    Name = "${local.instance_name_prefix}-${count.index + 1}"
  })
}

# outputs.tf
output "instance_ids" {
  description = "List of instance IDs"
  value       = aws_instance.web[*].id
}

output "instance_public_ips" {
  description = "List of public IP addresses"
  value       = aws_instance.web[*].public_ip
}

# terraform.tfvars
environment     = "dev"
instance_type   = "t3.micro"
instance_count  = 2
```

#### Knowledge Check
- What are the different ways to provide values for variables?
- When should you mark an output as sensitive?
- How do locals differ from variables?

### Module 5: State Management
**Duration**: 75 minutes

#### Learning Objectives
- Understand Terraform state
- Learn state file management
- Work with remote state backends
- Understand state locking

#### Topics Covered
1. **Understanding State**
   - What is Terraform state?
   - State file structure
   - State vs real infrastructure
   - State file security considerations

2. **Local State Management**
   ```bash
   # View state
   terraform show
   terraform state list
   terraform state show aws_instance.web
   
   # Import existing resources
   terraform import aws_instance.web i-1234567890abcdef0
   
   # Remove from state
   terraform state rm aws_instance.web
   ```

3. **Remote State Backends**
   ```hcl
   # S3 backend
   terraform {
     backend "s3" {
       bucket = "terraform-state-bucket"
       key    = "dev/terraform.tfstate"
       region = "us-east-1"
       
       dynamodb_table = "terraform-locks"
       encrypt        = true
     }
   }
   ```

4. **State Locking**
   - Preventing concurrent modifications
   - DynamoDB for state locking
   - Handling locked state

#### Hands-on Lab 5.1: Remote State Setup (45 minutes)
Set up remote state with S3 and DynamoDB:

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "my-terraform-state-bucket"
    key            = "learning-assistant/dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-locks"
  }
}

# Create S3 bucket for state (one-time setup)
resource "aws_s3_bucket" "terraform_state" {
  bucket = "my-terraform-state-bucket"
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# DynamoDB table for state locking
resource "aws_dynamodb_table" "terraform_locks" {
  name           = "terraform-state-locks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"
  
  attribute {
    name = "LockID"
    type = "S"
  }
}
```

#### Knowledge Check
- Why is remote state recommended for team environments?
- What happens if state locking fails?
- How do you recover from state file corruption?

### Module 6: Terraform Modules
**Duration**: 90 minutes

#### Learning Objectives
- Understand module concepts
- Create reusable modules
- Use module versioning
- Implement module best practices

#### Topics Covered
1. **Module Basics**
   ```hcl
   # Using a module
   module "vpc" {
     source = "./modules/vpc"
     
     cidr_block = "10.0.0.0/16"
     name       = "my-vpc"
   }
   
   # Accessing module outputs
   output "vpc_id" {
     value = module.vpc.vpc_id
   }
   ```

2. **Module Structure**
   ```
   modules/
   └── vpc/
       ├── main.tf
       ├── variables.tf
       ├── outputs.tf
       └── README.md
   ```

3. **Module Sources**
   - Local paths
   - Git repositories
   - Terraform Registry
   - HTTP URLs

4. **Module Versioning**
   ```hcl
   module "vpc" {
     source  = "terraform-aws-modules/vpc/aws"
     version = "~> 3.0"
   }
   ```

#### Hands-on Lab 6.1: Creating a VPC Module (60 minutes)
Create a reusable VPC module:

```hcl
# modules/vpc/variables.tf
variable "cidr_block" {
  description = "CIDR block for VPC"
  type        = string
}

variable "name" {
  description = "Name prefix for resources"
  type        = string
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = []
}

variable "public_subnets" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
  default     = []
}

variable "private_subnets" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
  default     = []
}

# modules/vpc/main.tf
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = length(var.availability_zones) > 0 ? var.availability_zones : data.aws_availability_zones.available.names
}

resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = var.name
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = {
    Name = "${var.name}-igw"
  }
}

resource "aws_subnet" "public" {
  count = length(var.public_subnets)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
  
  tags = {
    Name = "${var.name}-public-${count.index + 1}"
  }
}

# modules/vpc/outputs.tf
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "List of IDs of public subnets"
  value       = aws_subnet.public[*].id
}

# Using the module
module "vpc" {
  source = "./modules/vpc"
  
  cidr_block      = "10.0.0.0/16"
  name            = "learning-vpc"
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
}
```

#### Knowledge Check
- What are the benefits of using modules?
- How do you version control modules?
- What should be included in a module's README?

## 🎯 Final Project

### Project Overview
Deploy a complete Learning Assistant infrastructure using Terraform modules and best practices.

### Requirements
1. Use remote state backend
2. Create at least 2 custom modules
3. Implement proper variable validation
4. Include comprehensive outputs
5. Use multiple environments (dev, staging)
6. Include proper documentation

### Project Structure
```
learning-assistant-terraform/
├── environments/
│   ├── dev/
│   └── staging/
├── modules/
│   ├── network/
│   ├── database/
│   └── application/
├── main.tf
├── variables.tf
├── outputs.tf
└── README.md
```

### Deliverables
1. Complete Terraform configuration
2. Module documentation
3. Environment-specific tfvars files
4. Deployment instructions
5. Architecture diagram

## 📋 Assessment Criteria

### Knowledge Assessment (40%)
- Understanding of IaC principles
- Terraform fundamentals
- State management concepts
- Module development

### Practical Skills (60%)
- Code quality and organization
- Use of best practices
- Problem-solving approach
- Documentation quality

### Grading Scale
- **90-100%**: Expert level
- **80-89%**: Advanced level
- **70-79%**: Intermediate level
- **60-69%**: Beginner level
- **Below 60%**: Needs improvement

## 🔗 Additional Resources

### Documentation
- [Terraform Official Documentation](https://terraform.io/docs)
- [AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

### Tools
- [Terraform](https://terraform.io/downloads)
- [Visual Studio Code](https://code.visualstudio.com/)
- [HashiCorp Terraform Extension](https://marketplace.visualstudio.com/items?itemName=HashiCorp.terraform)

### Practice Resources
- [Terraform Examples](https://github.com/hashicorp/terraform/tree/main/examples)
- [AWS Terraform Examples](https://github.com/terraform-aws-modules)
- [Learn Terraform](https://learn.hashicorp.com/terraform)

## 📞 Support

### Getting Help
- Instructor office hours
- Online discussion forum
- Slack channel: #terraform-training
- Email: training@learningassistant.com

### Troubleshooting
- Common issues FAQ
- Debug checklist
- Error message reference

---

**Happy Learning! 🚀**

Remember: The best way to learn Terraform is by practicing. Don't hesitate to experiment and break things - that's how you learn!