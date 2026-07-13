---
name: mtms-agent-routing
description: Coordinator workflow for the MTMS / MLMS project. Use at the start of EVERY coding task so the work is understood, inspected, implemented, reviewed, and tested before it is declared done.
---

# MTMS Coordinator Workflow

Claude Code is the coordinator on every coding task: it understands the request, inspects the repo, implements the change, reviews it, and verifies before saying "done". It never weakens security or exposes secrets to satisfy a task.

## Know the two sides of the work

Most tasks touch one or both of:

1. **Frontend / UI.** React pages, components, CSS, responsiveness, accessibility, forms, dashboards, UX, client routing, axios/fetch wiring on the client.
2. **Backend / security / database.** Express routes, Mongoose models, JWT auth, role/permission guards, API security, MongoDB queries, deployment/server config, production hardening, server errors. Give this side extra care — it is the source of truth for permissions.

For a **full-stack** task, define one API contract first (method, URL, request body, response shape, auth requirement, role guards, error responses) and keep the frontend and backend consistent with it.

## Workflow for every coding task

### Step 1 — Understand
Restate the task. Classify: frontend / backend / full-stack. Assign risk: low / medium / high (anything touching auth, roles, medical/user data, money, deletion, or deploy = high). List the files likely affected.

### Step 2 — Inspect (no secrets)
Read: `README.md`, root + `frontend` + `backend` `package.json`, `frontend/src` (App.jsx, api/axios.js, context/AuthContext.jsx, ProtectedRoute.jsx, the relevant pages), `backend/server.js`, `backend/routes`, `backend/models`, `backend/middleware`, deployment files, and `.env.example`. Never open or print `.env` / `backend/.env`.

### Step 3 — Implement
Make the change in the relevant files, preserving existing auth and role routing (`ProtectedRoute`, `ROLE_HOME`, the `api/axios.js` refresh flow, `auth` → `allowRoles` → `scopeGuard`). Keep edits scoped to the task — do not touch unrelated routes, `.env`, or `backend/uploads`. For full-stack work, keep the frontend and backend aligned to the one API contract.

### Step 4 — Review
Cross-check frontend API usage against the backend implementation: route names, request body fields, response fields, auth requirement, role guards. Check imports, file paths, and naming conflicts. Confirm no secrets were printed/committed and the same feature was not implemented twice in conflicting ways. On any conflict, keep the stricter security guard.

### Step 5 — Test (required — never skip)
Run whatever exists: `npm run install:all` (only if deps changed), `npm run build:frontend`, `npm run check:backend`, `npm run deploy:check`, `npm run test:e2e:trainee`, backend startup, `/health`, an API smoke test, and login + role-redirect checks when auth-related. If a check does not exist, say exactly "No automated test exists for this part," then do manual/static verification. Do all testing against local/non-production data unless the user explicitly authorizes a live check.

### Step 6 — Final report (always this shape)
1. Task understood  2. Approach  3. Files changed  4. What was implemented  5. Tests/checks run  6. Problems found  7. Security notes  8. Next recommended step.

## Safety rules (non-negotiable)

- Never print or expose secrets from `.env` files. If a secret is found, report only the file path and state it must be rotated — never the value.
- Never commit passwords, database URLs, JWT secrets, cookies, private keys, or tokens.
- No destructive database changes without explicit user approval. Seeds/migrations/resets are gated behind `CONFIRM_*` / `DRY_RUN` env flags — keep them safe.
- Do not remove existing features or rename files/routes/roles/DB fields unless the task requires it.
- Preserve the current project structure unless there is a strong reason to change it.
- For medical/user data, prioritize privacy, access control, and auditability. The backend is the source of truth for permissions; frontend guards are UX only.
- Never declare a task complete until Step 5 testing/checking is done.

## Expected output

A coordinator report in the Step 6 shape, including the review/conflict-check result and the test results — with a clear go/no-go.
