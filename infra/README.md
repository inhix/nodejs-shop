# Infrastructure (Terraform)

AWS infrastructure as code, region `eu-central-1`. Decisions: ADR 0009 (Terraform) and
ADR 0010 (AWS access model) in `docs/adr/`.

| Stack        | Purpose                                                                                    | Applied by                                  |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `bootstrap/` | State bucket, cost budget and anomaly alerts, GitHub OIDC provider, read-only CI plan role | The repository owner, from a laptop, rarely |

Stacks for staging and production (network, ECS, RDS, ElastiCache, …) arrive in Phase 8.

**Rules:** Claude Code and CI never run `terraform apply` or `destroy` (see CLAUDE.md). Changes
are reviewed in a PR first; `terraform plan` output is part of that review.

## Checks that run without AWS

From the repository root, with Docker running (the same pinned images as CI):

```sh
docker run --rm -v "$PWD:/repo" -w /repo hashicorp/terraform:1.17.2 fmt -check -recursive infra
docker run --rm -v "$PWD:/repo" -w /repo hashicorp/terraform:1.17.2 -chdir=infra/bootstrap init -backend=false
docker run --rm -v "$PWD:/repo" -w /repo hashicorp/terraform:1.17.2 -chdir=infra/bootstrap test
```

`terraform test` uses a mock AWS provider: it checks the stack's logic (private, versioned,
encrypted state bucket; plan role trusted only by this repository; budget thresholds) without
credentials. CI runs these plus tflint and a Trivy misconfiguration scan (`.github/workflows/terraform.yml`).

## One-time AWS account setup (owner, in the AWS console)

Do these once, in order. Nothing here is automated, because it happens before any credentials
exist.

1. **Create the AWS account** (or use an empty one). Use an email address only you control.
2. **Secure the root user**: strong unique password, **MFA** (a passkey or an authenticator
   app), no access keys. Fill in the alternate contacts (billing, operations, security). After
   this, sign in as root only for account-level emergencies.
3. **Billing**: in _Account_, enable _IAM user and role access to billing information_; in
   _Billing preferences_, turn on _Free Tier usage alerts_.
4. **AWS Organizations**: create an organization. This account becomes its management account;
   no other accounts are needed. It is free and is required for the next step.
5. **IAM Identity Center** (region `eu-central-1`): enable it, create a user for yourself with
   MFA, create a permission set based on `AdministratorAccess` (session duration: 4 hours), and
   assign it to your user in this account. Sign in through the AWS access portal from now on.
6. **Install locally**: AWS CLI v2, Terraform 1.17.x (for example `brew install
hashicorp/tap/terraform`), and optionally tflint.
7. **Configure the CLI** with short-lived credentials (no access keys):

   ```sh
   aws configure sso           # profile name: shop-admin, region: eu-central-1
   aws sso login --profile shop-admin
   aws sts get-caller-identity --profile shop-admin   # shows the account ID
   ```

## First apply of the bootstrap stack

The stack creates the bucket its own state should live in. So the first apply keeps state on
your laptop, then moves it into the bucket.

```sh
cd infra/bootstrap
export AWS_PROFILE=shop-admin
cp terraform.tfvars.example terraform.tfvars        # put your alert email in it

# 1. Local state for the first run: an override file (git-ignored) replaces the S3 backend.
printf 'terraform {\n  backend "local" {}\n}\n' > backend_override.tf
terraform init
terraform plan -out=bootstrap.tfplan                # read it before applying
terraform apply bootstrap.tfplan

# 2. Move the state into the new bucket.
rm backend_override.tf
cp backend.hcl.example backend.hcl                  # put the bucket name from the output in it
terraform output state_bucket
terraform init -backend-config=backend.hcl -migrate-state   # answer "yes"
rm terraform.tfstate terraform.tfstate.backup       # now only in S3
```

Afterwards:

- **Confirm the alert emails.** AWS sends a subscription confirmation for Cost Anomaly
  Detection; budget alerts work without one.
- Run `terraform plan` once more: it must report _No changes_.
- Note the outputs `state_bucket` and `github_terraform_plan_role_arn`; the follow-up PR stores
  them as GitHub repository variables so CI can run `terraform plan` through OIDC.

Later changes: `terraform init -backend-config=backend.hcl`, then `plan`, review, `apply`.

## Notes

- **State encryption** uses SSE-S3 (AWS-managed keys). A customer-managed KMS key is an
  accepted, dated exception in `.trivyignore` (Trivy `AWS-0132`), to revisit before
  production state exists.
- **The state bucket cannot be destroyed** by Terraform (`prevent_destroy`). Removing it is a
  deliberate, reviewed change.
- **Costs:** S3 storage for state is a few cents a month; Budgets (up to two), Cost Anomaly
  Detection, Organizations, Identity Center and the OIDC provider are free.
