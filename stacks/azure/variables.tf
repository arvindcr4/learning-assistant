variable "location" {
  description = "The Azure region where resources will be created."
  default     = "East US"
}

variable "resource_group_name" {
  description = "The name of the resource group."
}

variable "tags" {
  type        = map(string)
  default     = {}
}
