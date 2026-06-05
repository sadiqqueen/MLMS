---
name: claude-codex-prompt-reviewer
description: Use this skill when reviewing, improving, or validating a prompt before it is sent to Codex for MTMS development, debugging, testing, deployment, security, or refactoring work.
---

# Claude Codex Prompt Reviewer Skill

Use this skill to review a prompt before the user sends it to Codex.

## Goal

Improve the prompt so Codex does the work safely, clearly, and with fewer mistakes.

The final output should be a better prompt that the user can copy and send to Codex.

## Project context

The project is MTMS, a web application with:

- frontend
- backend
- authentication
- role-based dashboards
- API routes
- deployment on VPS/Railway/Nginx
- MongoDB
- security features
- honeypot and SecurityEvent logging
- Playwright/browser testing work

Common roles may include:

- super admin
- admin
- DIO
- president
- program director
- secretary
- supervisor
- trainee

## Review checklist

Before giving the final Codex prompt, check whether the prompt includes:

1. Clear goal
2. Exact target files or areas if known
3. Whether Codex should edit files or only inspect
4. Safety rules
5. What Codex must not change
6. Testing requirements
7. Expected final report format
8. Whether the work is local, staging, or production
9. Whether the task is read-only or allowed to write
10. Whether secrets/passwords must be protected
11. Whether frontend design must remain unchanged
12. Whether role logic must remain unchanged
13. Whether Git commit is allowed or not

## Safety rules

Always add these when relevant:

- Do not expose .env secrets, passwords, tokens, cookies, private keys, or database credentials.
- Do not change frontend design unless explicitly requested.
- Do not delete files unless explicitly approved.
- Do not run destructive tests.
- Do not run spam or load tests against production.
- Ask before editing if the task is risky.
- For production, prefer read-only checks unless explicitly approved.
- For security work, keep it defensive only.

## Prompt quality rules

A good Codex prompt should:

- Tell Codex which skill to use.
- Start with inspect/plan before editing when risk is high.
- Separate safe changes from risky changes.
- Ask Codex to show changed files.
- Ask Codex to explain how to test.
- Ask Codex to stop before commit unless the user approved commit.
- Ask Codex to avoid touching unrelated files.

## Final response format

Return:

1. Problems with the original prompt
2. Missing details or risks
3. Improved prompt to send to Codex
4. Optional safer version if production is involved
5. Optional follow-up prompt for after Codex finishes

## Final Codex prompt format

The final prompt should be in a copyable code block.

Example:

```txt
Use the mtms-security-debug skill.

Goal:
...

Rules:
...

Before editing:
...

After editing:
...

Final report:
...