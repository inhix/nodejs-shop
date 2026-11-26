# GitHub Actions gets short-lived AWS credentials through OIDC: no access keys in GitHub.
# See docs/adr/0010-aws-access-model.md.

locals {
  github_oidc_host = "token.actions.githubusercontent.com"

  # Exact subjects only (no wildcards): this repository's pull requests and its main branch.
  plan_role_subjects = [
    "repo:${var.github_repository}:pull_request",
    "repo:${var.github_repository}:ref:refs/heads/main",
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://${local.github_oidc_host}"
  client_id_list = ["sts.amazonaws.com"]
  # No thumbprint_list: AWS validates GitHub's certificate against its own trusted CAs.
}

# Read-only role for `terraform plan` in CI. There is no apply role yet: deploy roles arrive in
# Phase 8 together with protected GitHub environments.
resource "aws_iam_role" "github_terraform_plan" {
  name                 = "github-terraform-plan"
  description          = "terraform plan from GitHub Actions (${var.github_repository}); read-only"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${local.github_oidc_host}:aud" = "sts.amazonaws.com"
            "${local.github_oidc_host}:sub" = local.plan_role_subjects
          }
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_terraform_plan_read_only" {
  role       = aws_iam_role.github_terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}

# ReadOnlyAccess can read state; a locked plan also needs to create and delete the lock file.
resource "aws_iam_role_policy" "github_terraform_plan_state_lock" {
  name = "terraform-state-lock"
  role = aws_iam_role.github_terraform_plan.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ManageStateLockFiles"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.state.arn}/*.tflock"
      },
    ]
  })
}
