# Runs without AWS credentials: the mock provider stands in for AWS, and every run is a plan.
# Policies are built with jsonencode (not aws_iam_policy_document data sources) so their
# content is computed locally and can be checked here.

mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
    }
  }

  mock_resource "aws_s3_bucket" {
    defaults = {
      arn = "arn:aws:s3:::nodejs-shop-tfstate-123456789012"
    }
  }

  mock_resource "aws_ce_anomaly_monitor" {
    defaults = {
      arn = "arn:aws:ce::123456789012:anomalymonitor/00000000-0000-0000-0000-000000000000"
    }
  }

  mock_resource "aws_iam_openid_connect_provider" {
    defaults = {
      arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    }
  }
}

variables {
  alert_emails = ["alerts@example.com"]
}

run "state_bucket_is_private_versioned_encrypted" {
  command = apply # with a mock provider, apply only computes values; nothing reaches AWS

  assert {
    condition     = aws_s3_bucket.state.bucket == "nodejs-shop-tfstate-123456789012"
    error_message = "The state bucket name must include the account ID."
  }

  assert {
    condition     = aws_s3_bucket_versioning.state.versioning_configuration[0].status == "Enabled"
    error_message = "State versioning must be enabled."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.state.block_public_acls,
      aws_s3_bucket_public_access_block.state.block_public_policy,
      aws_s3_bucket_public_access_block.state.ignore_public_acls,
      aws_s3_bucket_public_access_block.state.restrict_public_buckets,
    ])
    error_message = "All public access must be blocked."
  }

  assert {
    condition     = one(one(aws_s3_bucket_server_side_encryption_configuration.state.rule).apply_server_side_encryption_by_default).sse_algorithm == "AES256"
    error_message = "State must be encrypted at rest."
  }

  assert {
    condition     = jsondecode(aws_s3_bucket_policy.state.policy).Statement[0].Condition.Bool["aws:SecureTransport"] == "false"
    error_message = "The bucket policy must deny requests without TLS."
  }
}

run "plan_role_trusts_only_this_repository" {
  command = apply

  assert {
    condition = jsondecode(aws_iam_role.github_terraform_plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == [
      "repo:inhix/nodejs-shop:pull_request",
      "repo:inhix/nodejs-shop:ref:refs/heads/main",
    ]
    error_message = "Only this repository's pull requests and main may assume the plan role."
  }

  assert {
    condition     = jsondecode(aws_iam_role.github_terraform_plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    error_message = "The token audience must be sts.amazonaws.com."
  }

  assert {
    condition     = aws_iam_role_policy_attachment.github_terraform_plan_read_only.policy_arn == "arn:aws:iam::aws:policy/ReadOnlyAccess"
    error_message = "The plan role must be read-only."
  }

  assert {
    condition     = jsondecode(aws_iam_role_policy.github_terraform_plan_state_lock.policy).Statement[0].Resource == "arn:aws:s3:::nodejs-shop-tfstate-123456789012/*.tflock"
    error_message = "Write access must be limited to state lock files."
  }
}

run "budget_alerts_at_50_80_100_percent_and_forecast" {
  command = apply

  assert {
    condition     = aws_budgets_budget.monthly.limit_amount == "20" && aws_budgets_budget.monthly.limit_unit == "USD"
    error_message = "The default budget is 20 USD per month."
  }

  assert {
    condition = toset([for n in aws_budgets_budget.monthly.notification : "${n.notification_type}:${n.threshold}"]) == toset([
      "ACTUAL:50", "ACTUAL:80", "ACTUAL:100", "FORECASTED:100",
    ])
    error_message = "Budget notifications must cover 50/80/100% actual and 100% forecast."
  }
}

run "rejects_invalid_alert_email" {
  command = plan

  variables {
    alert_emails = ["not-an-email"]
  }

  expect_failures = [var.alert_emails]
}

run "rejects_wrong_repository_format" {
  command = plan

  variables {
    github_repository = "nodejs-shop"
  }

  expect_failures = [var.github_repository]
}
