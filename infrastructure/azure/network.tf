# Azure Virtual Network Configuration
# This file defines the networking infrastructure including VNet, subnets, NSGs, and routing

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "${local.name_prefix}-vnet"
  address_space       = var.vnet_address_space
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  # DNS servers for internal resolution
  dns_servers = var.environment == "production" ? ["168.63.129.16", "8.8.8.8"] : []

  tags = local.common_tags
}

# Subnet for AKS system node pool
resource "azurerm_subnet" "aks_system" {
  name                 = "${local.name_prefix}-aks-system-subnet"
  resource_group_name  = azurerm_resource_group.networking.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [local.subnet_cidrs.aks_system]

  # Enable service endpoints
  service_endpoints = [
    "Microsoft.Storage",
    "Microsoft.KeyVault",
    "Microsoft.ContainerRegistry",
    "Microsoft.Sql"
  ]

  # Delegate subnet to AKS
  delegation {
    name = "aks-delegation"
    service_delegation {
      name    = "Microsoft.ContainerService/managedClusters"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

# Subnet for AKS user node pool
resource "azurerm_subnet" "aks_user" {
  name                 = "${local.name_prefix}-aks-user-subnet"
  resource_group_name  = azurerm_resource_group.networking.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [local.subnet_cidrs.aks_user]

  # Enable service endpoints
  service_endpoints = [
    "Microsoft.Storage",
    "Microsoft.KeyVault",
    "Microsoft.ContainerRegistry",
    "Microsoft.Sql"
  ]

  # Delegate subnet to AKS
  delegation {
    name = "aks-delegation"
    service_delegation {
      name    = "Microsoft.ContainerService/managedClusters"
      actions = ["Microsoft.Network/virtualNetworks/subnets/action"]
    }
  }
}

# Subnet for PostgreSQL database
resource "azurerm_subnet" "database" {
  name                 = "${local.name_prefix}-database-subnet"
  resource_group_name  = azurerm_resource_group.networking.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [local.subnet_cidrs.database]

  # Enable service endpoints
  service_endpoints = [
    "Microsoft.Storage"
  ]

  # Delegate subnet to PostgreSQL
  delegation {
    name = "postgresql-delegation"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# Subnet for Redis cache
resource "azurerm_subnet" "redis" {
  name                 = "${local.name_prefix}-redis-subnet"
  resource_group_name  = azurerm_resource_group.networking.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [local.subnet_cidrs.redis]

  # Enable service endpoints
  service_endpoints = [
    "Microsoft.Storage"
  ]
}

# Subnet for Application Gateway
resource "azurerm_subnet" "app_gateway" {
  name                 = "${local.name_prefix}-appgw-subnet"
  resource_group_name  = azurerm_resource_group.networking.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [local.subnet_cidrs.app_gateway]

  # Enable service endpoints
  service_endpoints = [
    "Microsoft.KeyVault"
  ]
}

# Subnet for private endpoints
resource "azurerm_subnet" "private_endpoints" {
  name                 = "${local.name_prefix}-private-endpoints-subnet"
  resource_group_name  = azurerm_resource_group.networking.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [local.subnet_cidrs.private_link]

  # Disable private endpoint network policies
  private_endpoint_network_policies_enabled = false

  # Enable service endpoints
  service_endpoints = [
    "Microsoft.Storage",
    "Microsoft.KeyVault",
    "Microsoft.Sql"
  ]
}

# Subnet for Azure Bastion (if enabled)
resource "azurerm_subnet" "bastion" {
  count = var.environment == "production" ? 1 : 0
  
  name                 = "AzureBastionSubnet"  # Must be exactly this name
  resource_group_name  = azurerm_resource_group.networking.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [local.subnet_cidrs.bastion]
}

# Network Security Group for AKS system nodes
resource "azurerm_network_security_group" "aks_system" {
  name                = "${local.name_prefix}-aks-system-nsg"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  # Allow inbound traffic from load balancer
  security_rule {
    name                       = "AllowLoadBalancerInBound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "AzureLoadBalancer"
    destination_address_prefix = "*"
  }

  # Allow inbound traffic from VNet
  security_rule {
    name                       = "AllowVnetInBound"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "*"
  }

  # Allow outbound to internet
  security_rule {
    name                       = "AllowInternetOutBound"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "Internet"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

# Network Security Group for AKS user nodes
resource "azurerm_network_security_group" "aks_user" {
  name                = "${local.name_prefix}-aks-user-nsg"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  # Allow inbound traffic from load balancer
  security_rule {
    name                       = "AllowLoadBalancerInBound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "AzureLoadBalancer"
    destination_address_prefix = "*"
  }

  # Allow inbound traffic from VNet
  security_rule {
    name                       = "AllowVnetInBound"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "*"
  }

  # Allow inbound HTTP/HTTPS from Application Gateway
  security_rule {
    name                       = "AllowAppGatewayInBound"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_ranges    = ["80", "443", "8080"]
    source_address_prefix      = local.subnet_cidrs.app_gateway
    destination_address_prefix = "*"
  }

  # Allow outbound to internet
  security_rule {
    name                       = "AllowInternetOutBound"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "Internet"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

# Network Security Group for database subnet
resource "azurerm_network_security_group" "database" {
  name                = "${local.name_prefix}-database-nsg"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  # Allow PostgreSQL traffic from AKS subnets
  security_rule {
    name                       = "AllowPostgreSQLFromAKS"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefixes    = [local.subnet_cidrs.aks_system, local.subnet_cidrs.aks_user]
    destination_address_prefix = "*"
  }

  # Allow traffic from private endpoints subnet
  security_rule {
    name                       = "AllowPrivateEndpoints"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = local.subnet_cidrs.private_link
    destination_address_prefix = "*"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

# Network Security Group for Redis subnet
resource "azurerm_network_security_group" "redis" {
  name                = "${local.name_prefix}-redis-nsg"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  # Allow Redis traffic from AKS subnets
  security_rule {
    name                       = "AllowRedisFromAKS"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "6380"  # SSL port
    source_address_prefixes    = [local.subnet_cidrs.aks_system, local.subnet_cidrs.aks_user]
    destination_address_prefix = "*"
  }

  # Allow traffic from private endpoints subnet
  security_rule {
    name                       = "AllowPrivateEndpoints"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = local.subnet_cidrs.private_link
    destination_address_prefix = "*"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

# Network Security Group for Application Gateway subnet
resource "azurerm_network_security_group" "app_gateway" {
  name                = "${local.name_prefix}-appgw-nsg"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  # Allow HTTP traffic from internet
  security_rule {
    name                       = "AllowHTTPInBound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }

  # Allow HTTPS traffic from internet
  security_rule {
    name                       = "AllowHTTPSInBound"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "Internet"
    destination_address_prefix = "*"
  }

  # Allow Application Gateway management traffic
  security_rule {
    name                       = "AllowGatewayManagerInBound"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "65200-65535"
    source_address_prefix      = "GatewayManager"
    destination_address_prefix = "*"
  }

  # Allow Azure Load Balancer
  security_rule {
    name                       = "AllowAzureLoadBalancerInBound"
    priority                   = 130
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "AzureLoadBalancer"
    destination_address_prefix = "*"
  }

  # Allow outbound to internet
  security_rule {
    name                       = "AllowInternetOutBound"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "Internet"
  }

  # Deny all other inbound traffic
  security_rule {
    name                       = "DenyAllInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

# Network Security Group for private endpoints subnet
resource "azurerm_network_security_group" "private_endpoints" {
  name                = "${local.name_prefix}-private-endpoints-nsg"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name

  # Allow inbound traffic from VNet
  security_rule {
    name                       = "AllowVnetInBound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "*"
  }

  # Allow outbound to VNet
  security_rule {
    name                       = "AllowVnetOutBound"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "VirtualNetwork"
  }

  # Deny all other traffic
  security_rule {
    name                       = "DenyAllInBound"
    priority                   = 4096
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

# Associate NSGs with subnets
resource "azurerm_subnet_network_security_group_association" "aks_system" {
  subnet_id                 = azurerm_subnet.aks_system.id
  network_security_group_id = azurerm_network_security_group.aks_system.id
}

resource "azurerm_subnet_network_security_group_association" "aks_user" {
  subnet_id                 = azurerm_subnet.aks_user.id
  network_security_group_id = azurerm_network_security_group.aks_user.id
}

resource "azurerm_subnet_network_security_group_association" "database" {
  subnet_id                 = azurerm_subnet.database.id
  network_security_group_id = azurerm_network_security_group.database.id
}

resource "azurerm_subnet_network_security_group_association" "redis" {
  subnet_id                 = azurerm_subnet.redis.id
  network_security_group_id = azurerm_network_security_group.redis.id
}

resource "azurerm_subnet_network_security_group_association" "app_gateway" {
  subnet_id                 = azurerm_subnet.app_gateway.id
  network_security_group_id = azurerm_network_security_group.app_gateway.id
}

resource "azurerm_subnet_network_security_group_association" "private_endpoints" {
  subnet_id                 = azurerm_subnet.private_endpoints.id
  network_security_group_id = azurerm_network_security_group.private_endpoints.id
}

# Route table for custom routing (if needed)
resource "azurerm_route_table" "main" {
  name                          = "${local.name_prefix}-rt"
  location                      = azurerm_resource_group.networking.location
  resource_group_name           = azurerm_resource_group.networking.name
  disable_bgp_route_propagation = false

  tags = local.common_tags
}

# Public IP for Application Gateway
resource "azurerm_public_ip" "app_gateway" {
  name                = "${local.name_prefix}-appgw-pip"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name
  allocation_method   = "Static"
  sku                 = "Standard"
  zones               = local.availability_zones

  tags = local.common_tags
}

# Public IP for Azure Bastion (if enabled)
resource "azurerm_public_ip" "bastion" {
  count = var.environment == "production" ? 1 : 0
  
  name                = "${local.name_prefix}-bastion-pip"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = local.common_tags
}

# Azure Bastion for secure access (production only)
resource "azurerm_bastion_host" "main" {
  count = var.environment == "production" ? 1 : 0
  
  name                = "${local.name_prefix}-bastion"
  location            = azurerm_resource_group.networking.location
  resource_group_name = azurerm_resource_group.networking.name
  sku                 = "Standard"

  ip_configuration {
    name                 = "configuration"
    subnet_id            = azurerm_subnet.bastion[0].id
    public_ip_address_id = azurerm_public_ip.bastion[0].id
  }

  tags = local.common_tags
}

# Network outputs
output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "subnet_ids" {
  description = "Map of subnet IDs"
  value = {
    aks_system        = azurerm_subnet.aks_system.id
    aks_user          = azurerm_subnet.aks_user.id
    database          = azurerm_subnet.database.id
    redis             = azurerm_subnet.redis.id
    app_gateway       = azurerm_subnet.app_gateway.id
    private_endpoints = azurerm_subnet.private_endpoints.id
  }
}

output "nsg_ids" {
  description = "Map of Network Security Group IDs"
  value = {
    aks_system        = azurerm_network_security_group.aks_system.id
    aks_user          = azurerm_network_security_group.aks_user.id
    database          = azurerm_network_security_group.database.id
    redis             = azurerm_network_security_group.redis.id
    app_gateway       = azurerm_network_security_group.app_gateway.id
    private_endpoints = azurerm_network_security_group.private_endpoints.id
  }
}

output "app_gateway_public_ip" {
  description = "Public IP address of the Application Gateway"
  value       = azurerm_public_ip.app_gateway.ip_address
}

output "bastion_public_ip" {
  description = "Public IP address of the Azure Bastion"
  value       = var.environment == "production" ? azurerm_public_ip.bastion[0].ip_address : null
}