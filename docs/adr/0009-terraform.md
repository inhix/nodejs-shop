# 0009. Terraform for AWS infrastructure

- Status: Accepted
- Date: 2026-11-26

## Context

All AWS infrastructure (network, ECS, RDS, ElastiCache, S3, SES, IAM) must be reproducible,
reviewed in pull requests, and checkable in CI. Changes are proposed by people and by Claude
Code, but Claude Code and CI never apply them (CLAUDE.md). The state of the infrastructure must
be stored safely, shared, and protected against two concurrent changes.

## Decision

Terraform, pinned to the 1.17 line (`~> 1.17.2`) with the AWS provider pinned exactly. The
provider lock file `.terraform.lock.hcl` is committed with hashes for Linux and macOS.

- **Layout:** one folder per stack under `infra/`. `bootstrap/` holds account-level resources
  (state bucket, cost alerts, GitHub OIDC). Environment stacks arrive in Phase 8.
- **State:** one S3 bucket for all stacks (one key per stack), versioned, private,
  HTTPS-only, encrypted with SSE-S3, protected with `prevent_destroy`. Locking uses S3's
  native lock file (`use_lockfile`), so no DynamoDB table is needed.
- **Bootstrap problem:** the state bucket is created by the stack whose state it stores. The
  first apply uses local state through a git-ignored `backend_override.tf`, then the state is
  migrated into the bucket.
- **Checks without AWS credentials,** on every PR: `fmt`, `validate`, `terraform test` with mock
  providers, tflint with the AWS ruleset, and Trivy's misconfiguration scan. Policies are
  written with `jsonencode` so their content can be asserted in tests.
- **Who applies:** the repository owner, after reviewing `terraform plan`. CI gets a read-only
  plan role (ADR 0010); an apply role comes with protected environments in Phase 8.
- **No secrets in state:** secrets live in Secrets Manager and reach Terraform only through
  ephemeral or write-only arguments.

## Consequences

- Infrastructure changes are diffs in PRs, with tests and scans in CI.
- The bootstrap stack needs one manual, documented first apply (`infra/README.md`).
- Terraform is licensed under the Business Source License 1.1 since version 1.6. Using it to
  manage our own infrastructure is permitted; offering a competing hosted Terraform product
  is not. If the license or HashiCorp's direction becomes a problem, OpenTofu reads the same
  configuration and state with few changes.
- SSE-S3 instead of a customer-managed KMS key is a dated exception (Trivy `AWS-0132` in
  `.trivyignore`), to revisit before production state exists.

## Alternatives considered

- **OpenTofu:** the open-source (MPL 2.0) fork of Terraform, compatible with this code. Not
  chosen because Terraform is the brief's choice and the more recognized tool; it stays the
  fallback named above.
- **AWS CDK / CloudFormation:** AWS-only, and CloudFormation's drift handling and slower
  feedback loop are weaker for review; CDK adds a synthesis step between code and the reviewed
  change.
- **Pulumi:** infrastructure in TypeScript, which fits the stack, but a smaller community for
  AWS modules, and review of generated plans is less established in CI.
- **Console or scripts (ClickOps):** not reproducible or reviewable.
