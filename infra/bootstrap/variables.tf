variable "project_name" {
  description = "Prefix for resource names."
  type        = string
  default     = "nodejs-shop"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.project_name))
    error_message = "Use 3-30 lowercase letters, digits or hyphens (it becomes part of an S3 bucket name)."
  }
}

variable "aws_region" {
  description = "Region for regional resources. Budgets, IAM and Cost Explorer are global."
  type        = string
  default     = "eu-central-1"
}

variable "github_repository" {
  description = "GitHub repository (owner/name) whose workflows may assume the plan role."
  type        = string
  default     = "inhix/nodejs-shop"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Use the owner/name form, e.g. inhix/nodejs-shop."
  }
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget in USD. Alerts at 50%, 80% and 100% of actual spend and 100% of forecast."
  type        = number
  default     = 20

  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "The budget must be greater than zero."
  }
}

variable "anomaly_alert_threshold_usd" {
  description = "Cost Anomaly Detection alerts when an anomaly's total impact reaches this many USD."
  type        = number
  default     = 5
}

variable "alert_emails" {
  description = "Addresses for budget and cost anomaly alerts. Set in terraform.tfvars, which is not committed."
  type        = list(string)

  validation {
    condition     = length(var.alert_emails) > 0 && alltrue([for email in var.alert_emails : can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", email))])
    error_message = "Provide at least one valid email address."
  }
}

variable "state_noncurrent_version_days" {
  description = "Days to keep old versions of state files before they expire."
  type        = number
  default     = 90
}
