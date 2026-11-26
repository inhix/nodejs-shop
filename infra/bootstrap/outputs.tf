output "state_bucket" {
  description = "S3 bucket for Terraform state; use it in each stack's backend.hcl."
  value       = aws_s3_bucket.state.bucket
}

output "github_terraform_plan_role_arn" {
  description = "Role that GitHub Actions assumes for terraform plan (store as a repository variable)."
  value       = aws_iam_role.github_terraform_plan.arn
}

output "github_oidc_provider_arn" {
  description = "IAM OIDC provider for GitHub Actions; later roles trust this provider."
  value       = aws_iam_openid_connect_provider.github.arn
}
