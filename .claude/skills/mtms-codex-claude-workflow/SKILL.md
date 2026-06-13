---
name: mtms-codex-claude-workflow
description: Coordinate Claude with Codex-style output from another AI agent on the MTMS / MLMS repo. Use when reading a patch/diff/summary produced by Codex (or any other agent), turning it into clear next prompts, verifying its changes, summarizing diffs, and avoiding duplicate or conflicting edits across agents.
---

# MTMS Codex / Claude Workflow

Multiple agents (Codex and Claude) touch this repo. This skill keeps their work consistent, verified, and conflict-free. Default stance: treat another agent's output as a proposal to verify, not as ground truth.

## When to use it

- A Codex/other-agent diff, patch, file dump, or summary needs to be reviewed, continued, or merged.
- Two agents may be editing overlapping files (routes, `App.jsx`, middleware).

## Read Codex results

1. Identify what you were given: a unified diff/patch, full-file rewrites, a prose summary, or a command transcript.
2. Map it to real files in this repo (backend `routes/models/middleware`, frontend `pages/components/api/context`). Anchor every claim to an actual path.
3. Separate "claimed" from "verified": a summary saying "added role check" is a claim until you read the code.
4. Reconcile against current state:
   ```bash
   git status
   git diff
   git log --oneline -10
   ```
   Determine whether the change is already applied, partially applied, or not applied.

## Convert results into clear next prompts

When handing the next step to Codex (or yourself), write prompts that are specific to this repo:
- Name exact files/functions (e.g. "in `backend/routes/dio.js`, the `GET /trainees` handler").
- State the constraint: "must keep `auth` -> `allowRoles('dio')` -> `scopeGuard()` order and filter by `req.scope.hospitalId`".
- Include the verification bar: "then run `npm run deploy:check` and a login + role-redirect smoke test".
- Forbid scope creep: "do not modify other routes, `.env`, or `backend/uploads`".
Prefer one focused task per prompt over a broad refactor.

## Verify changes from another agent

For every changed file, confirm by reading the code (not the summary):
- Auth/role/scope intact? Cross-check with `mtms-security-auditor` checks 3-5.
- App behavior unchanged except where intended (`server.js` route mounts, `App.jsx` routes + both `ROLE_HOME` copies still agree)?
- No secrets introduced, no `console.log` of sensitive data, no token in `localStorage`.
- Then run the `mtms-testing-checklist` gate (`deploy:check`, backend boot, login, role redirect, API smoke, `/health`).
A change is "verified" only after it both reads correctly and passes the checklist.

## Summarize diffs

```bash
git diff --stat            # files + churn
git diff                   # full review
git diff <base>..<head>    # compare against the agent's base
```
Produce a concise summary: per file, what changed and why, plus risk flags (auth/role/scope/uploads/CORS/env touched?). Keep claims tied to specific hunks.

## Avoid duplicate or conflicting edits

- Before editing, `git status`/`git diff` to see if the other agent already changed the file; don't redo applied work.
- Watch high-contention files: `backend/server.js`, `frontend/src/App.jsx`, `middleware/*`, `api/axios.js`, `context/AuthContext.jsx`. Coordinate edits there explicitly.
- Keep `ROLE_HOME` consistent across `App.jsx` and `ProtectedRoute.jsx` — a classic place two agents diverge.
- Prefer small, sequential commits with clear messages so each agent's contribution is reviewable and revertible.
- On a genuine conflict, prefer the version that preserves the stricter security guard; never weaken `auth`/`allowRoles`/`scopeGuard` to resolve a merge.

## Safety rules

- Do not trust an agent summary over the actual code; verify before continuing or committing.
- Never let an incoming patch introduce secrets, weaken auth, expose `/uploads`, or touch `backend/uploads`/`.env`.
- Do not apply large unreviewed rewrites; break them down and verify in pieces.

## Expected output

A reconciliation report: what Codex proposed, what is actually applied (verified by `git diff`), a per-file diff summary with risk flags, the next-step prompt(s) for the other agent, and the `mtms-testing-checklist` result. End with a clear go/no-go on merging.
