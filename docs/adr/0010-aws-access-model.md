# 0010. AWS access model: one account, short-lived credentials only

- Status: Accepted
- Date: 2026-11-26

## Context

The shop runs on AWS in `eu-central-1` (PROJECT_BRIEF, section 7). People need console and CLI
access, and GitHub Actions needs access for `terraform plan` now and deployments later. Leaked
long-lived access keys are one of the most common causes of AWS account compromise, and this
repository is public. Costs must be watched from day one.

## Decision

- **One AWS account,** with separate environments inside it (staging and production stacks in
  Phase 8). The account is the management account of an AWS Organization with no other
  members, because IAM Identity Center for account access requires an organization.
- **Root user:** MFA, no access keys, used only for account-level emergencies.
- **People:** IAM Identity Center users with MFA and permission sets. The CLI uses
  `aws sso login`, which issues short-lived credentials. No IAM users with access keys.
- **GitHub Actions:** an IAM OIDC provider for `token.actions.githubusercontent.com`. Roles trust
  exact subjects of this repository only (for the plan role: its pull requests and `main`),
  and the audience `sts.amazonaws.com`. Credentials last one hour at most.
- **Roles now:** `github-terraform-plan` with `ReadOnlyAccess` plus write access to state lock
  files only. No apply or deploy role until Phase 8, when protected GitHub environments with
  required reviewers gate them.
- **Cost guards:** a monthly budget (default 20 USD) with alerts at 50, 80 and 100 percent of
  actual spend and 100 percent of forecast, and Cost Anomaly Detection per service.

## Consequences

- No long-lived AWS keys exist anywhere: not on laptops, not in GitHub secrets.
- CI can read the whole account for planning (`ReadOnlyAccess`), but cannot change anything.
  This includes reading most resource configuration; it excludes secret values.
- OIDC trust is tied to the repository name. If the repository is renamed or transferred, the
  roles stop working until the subjects are updated, and the old name must not be reused by
  someone else while the roles still trust it.
- Environments share one account, so isolation between staging and production relies on IAM
  policies and resource naming, not on account boundaries.

## Alternatives considered

- **Multiple accounts (management, staging, production) via Organizations:** the standard for
  larger teams; strong isolation and separate billing. More setup and cost overhead than this
  project needs now. The organization created here makes that move possible later.
- **IAM users with access keys (for people or CI):** simple, but keys are long-lived and leak
  through laptops, logs and CI configuration.
- **IAM Identity Center account instance without an organization:** cannot grant access to AWS
  accounts, only to applications.
- **Wildcard OIDC subjects (`repo:owner/name:*`):** would let any branch or workflow event,
  including from tags or environments not reviewed, assume the role.
