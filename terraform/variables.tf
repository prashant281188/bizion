variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "grafana_admin_password" {
  description = "Admin password for Grafana UI"
  type        = string
  default     = "admin123!@#"
  sensitive   = true
}
