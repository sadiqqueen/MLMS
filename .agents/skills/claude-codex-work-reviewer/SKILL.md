---
name: claude-codex-work-reviewer
description: Use this skill when reviewing work completed by Codex, checking git diff, changed files, tests, security risks, deployment risk, and producing a report before commit, merge, or deployment.
---

# Claude Codex Work Reviewer Skill

Use this skill after Codex has completed work.

## Goal

Review Codex's work before the user commits, merges, or deploys.

The review must identify:

- What changed
- Whether the change matches the original request
- Bugs or breakage risks
- Security risks
- Missing tests
- Files that should not have changed
- Whether it is safe to commit
- Whether it is safe to deploy

## Required inputs

Ask the user or Codex for:

1. Original prompt sent to Codex
2. Codex final response
3. `git status --short`
4. `git diff`
5. Test results
6. Any screenshots or error logs
7. Target environment: local, staging, or production

## Review checklist

Check:

1. Did Codex follow the prompt?
2. Did Codex edit only the expected files?
3. Did Codex change frontend design accidentally?
4. Did Codex expose secrets?
5. Did Codex commit passwords, tokens, cookies, private keys, or `.env` files?
6. Did Codex break routes, APIs, auth, or role logic?
7. Did Codex add risky code?
8. Did Codex remove validation?
9. Did Codex weaken security?
10. Did Codex add tests or give testing steps?
11. Did the tests actually pass?
12. Is the change safe for production?

## MTMS-specific review areas

For MTMS, review impact on:

- login/logout
- auth middleware
- role guards
- dashboards
- reports
- evaluations
- certificates
- uploads
- MongoDB models
- Nginx/deployment
- Playwright tests
- honeypot/security logging
- frontend routes
- backend API routes

## Security review

Flag any of these as high risk:

- `.env` files added to Git
- hardcoded credentials
- tokens printed to logs
- passwords exposed
- public upload exposure increased
- auth middleware bypassed
- role checks removed
- production write tests added
- destructive testing against production
- rate limiting weakened
- broad database access added

## Review result format

Return this report:

```txt
# Codex Work Review Report

## Verdict
SAFE TO COMMIT / NEEDS FIXES / DO NOT COMMIT

## Summary
...

## Files Changed
...

## What Looks Good
...

## Problems Found
...

## Security Risks
...

## Possible Breakage
...

## Missing Tests
...

## Commands to Run
...

## Recommended Fix Prompt for Codex
...

## Final Decision
...