terraform {
  # Patch updates only; a minor upgrade is a deliberate change (Renovate opens a PR).
  required_version = "~> 1.17.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.73.0"
    }
  }

  # Partial configuration: the bucket name contains the AWS account ID, so it comes from
  # backend.hcl (see backend.hcl.example and infra/README.md). Locking uses an S3 lock file
  # next to the state (use_lockfile), so no DynamoDB table is needed.
  backend "s3" {
    key          = "bootstrap/terraform.tfstate"
    region       = "eu-central-1"
    encrypt      = true
    use_lockfile = true
  }
}
