## Summary

<!-- What changed and why, in 1–3 sentences. -->

Closes #

## Type

- [ ] feat - [ ] fix - [ ] chore - [ ] docs - [ ] refactor - [ ] test - [ ] ci

## How it was tested

<!-- Unit / integration (Testcontainers) / E2E. List the key scenarios. -->

## Checklist

- [ ] Lint, typecheck, and relevant tests pass locally
- [ ] New endpoints have integration tests, including authorization failures
- [ ] External input validated with Zod; shared shapes come from `packages/contracts`
- [ ] Money stays in integer minor units; prices calculated server-side
- [ ] DB changes ship as a generated migration; FKs and new query patterns are indexed
- [ ] Side effects go through the outbox/queue; no external calls in webhook handlers
- [ ] No secrets, tokens, or full PII in code or logs; new env vars added to `.env.example`
- [ ] New dependencies justified (why, alternatives, pinned version)
- [ ] Docs / ADR updated if behavior or a decision changed
- [ ] PR is under ~400 changed lines (excluding generated files), or the reason is explained

## Notes for reviewers

<!-- Trade-offs, follow-ups, anything risky. Screenshots for UI changes. -->
