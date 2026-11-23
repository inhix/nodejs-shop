#!/usr/bin/env node
// PreToolUse hook for Claude Code: blocks dangerous shell commands.
//
// Permission rules in settings.json match command prefixes, so a chained command like
// `cd infra && terraform apply` can slip past them. This hook inspects the full command
// string instead. Exit code 2 blocks the call and sends stderr back to Claude as the reason.

import { readFileSync } from 'node:fs';

const BLOCKED = [
  {
    pattern: /\b(terraform|tofu)\s+(apply|destroy|import)\b/,
    reason: 'Terraform apply/destroy/import must be run by a human. Run `terraform plan` and report the result instead.',
  },
  {
    pattern: /\b(terraform|tofu)\s+state\s+(rm|mv|push|replace-provider)\b/,
    reason: 'Modifying Terraform state is not allowed. Ask the user to do it.',
  },
  {
    pattern: /\bgit\s+push\b[^;&|]*(--force\b|--force-with-lease\b|\s-f\b)/,
    reason: 'Force-pushing is not allowed.',
  },
  {
    pattern: /\bgit\s+push\b[^;&|]*[\s:](main|master)(?=\s|$|[;&|])/,
    reason: 'Pushing to main is not allowed. Push a feature branch and open a PR.',
  },
  {
    pattern: /\bgit\s+(commit|push)\b[^;&|]*--no-verify\b/,
    reason: 'Skipping git hooks (--no-verify) is not allowed. Fix the lint, type, or commit message issue instead.',
  },
  {
    pattern: /\bdrizzle-kit\s+push\b/,
    reason: 'Schema changes must go through generated, committed migrations (drizzle-kit generate), not drizzle-kit push.',
  },
  {
    pattern: /\b(drop|truncate)\s+(database|schema|table)\b/i,
    reason: 'Destructive SQL (DROP/TRUNCATE) is not allowed. Write a migration and ask the user to review it.',
  },
  {
    pattern: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*\s+(\/|~|\$HOME|\.\.)(\/?\s|\/?$)/,
    reason: 'Recursive deletion of root, home, or parent directories is not allowed.',
  },
];

// AWS: allow only read-only actions (describe-*, list-*, get-*, and `s3 ls`).
const READ_ONLY_AWS_ACTION = /^(describe|list|get|help|wait)/;

function checkAws(command) {
  const matches = command.matchAll(/\baws\s+([a-z0-9-]+)\s+([a-z0-9-]+)/g);
  for (const [, service, action] of matches) {
    if (service === 's3' && action === 'ls') continue;
    if (service === 'sts' && action === 'get-caller-identity') continue;
    if (!READ_ONLY_AWS_ACTION.test(action)) {
      return `AWS command "aws ${service} ${action}" can change infrastructure. Only read-only AWS commands are allowed; infrastructure changes go through Terraform and CI.`;
    }
  }
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.exit(0); // Not our concern if the payload is unreadable; let Claude Code handle it.
  }

  if (input?.tool_name !== 'Bash') process.exit(0);
  const command = String(input?.tool_input?.command ?? '');

  for (const { pattern, reason } of BLOCKED) {
    if (pattern.test(command)) {
      process.stderr.write(`Blocked by .claude/hooks/guard-bash.mjs: ${reason}\n`);
      process.exit(2);
    }
  }

  const awsReason = checkAws(command);
  if (awsReason) {
    process.stderr.write(`Blocked by .claude/hooks/guard-bash.mjs: ${awsReason}\n`);
    process.exit(2);
  }

  process.exit(0);
}

main();
