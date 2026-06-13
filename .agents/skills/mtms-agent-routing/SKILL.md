---
name: mtms-agent-routing
description: Coordinator routing rules for the MTMS / MLMS project. Use at the start of EVERY coding task to decide which agent and model does the work — Claude Code + Fable 5 for frontend/UI, Codex + GPT-5.5 for backend/security/database — and how the Coworker coordinator inspects, splits, reviews, merges, and tests before declaring done.
---

# MTMS Agent Routing (Coordinator)

The Coworker acts as coordinator. It understands the request, inspects the repo, routes each part to the correct agent/model, reviews and merges outputs, detects frontend/backend conflicts, and verifies before saying "done". It does not weaken security or expose secrets to satisfy a task.

## Model routing rules

1. **Frontend / UI → Claude Code + Fable 5.**
   React pages, components, CSS, responsiveness, accessibility, forms, dashboards, UX, client routing, axios/fetch wiring on the client.
2. **Backend / security / database → Codex + GPT-5.5.**
   Express routes, Mongoose models, JWT auth, role/permission guards, API security, MongoDB queries, deployment/server config, production hardening, server errors.
3. **Full-stack → split, then compare.**
   Frontend part → Claude Code + Fable 5. Backend/security/db part → Codex + GPT-5.5. Compare both outputs against a single API contract before applying final changes.

> Reality note for the Coworker: you cannot invoke Codex or a specific model endpoint yourself. You produce the exact instruction block for each agent (below), the human runs it in that tool, and you then review/merge the returned diffs and run the tests.

## Workflow for every coding task

### Step 1 — Understand
Restate the task. Classify: frontend / backend / full-stack. Assign risk: low / medium / high (anything touching auth, roles, medical/user data, money, deletion, or deploy = high). List the files likely affected.

### Step 2 — Inspect (no secrets)
Read: `README.md`, root + `frontend` + `backend` `package.json`, `frontend/src` (App.jsx, api/axios.js, context/AuthContext.jsx, ProtectedRoute.jsx, the relevant pages), `backend/server.js`, `backend/routes`, `backend/models`, `backend/middleware`, deployment files, and `.env.example`. Never open or print `.env` / `backend/.env`.

### Step 3 — Route the work

**Frontend-only → paste to Claude Code:**
> Use Fable 5 for this task. Work only on the frontend/UI part unless backend changes are absolutely required. Inspect the relevant React/Vite files, implement the requested change, preserve existing auth and role routing (`ProtectedRoute`, `ROLE_HOME`, the `api/axios.js` refresh flow), then run build/checks if available. Provide a file-by-file summary and any risks.

**Backend-only → paste to Codex:**
> Use GPT-5.5 for this task. Work only on the backend/database/security part unless frontend changes are absolutely required. Inspect Express routes, Mongoose models, auth middleware (`auth`, `allowRoles`, `scopeGuard`), `server.js`, and deployment config. Implement the requested change safely, never expose secrets, then run backend checks if available. Provide a file-by-file summary and any risks.

**Full-stack → paste BOTH:**
> (Claude Code) Use Fable 5. Implement only the frontend/UI part of this full-stack task. Coordinate with the backend API contract. Do not invent endpoints without documenting the required request/response shape.
>
> (Codex) Use GPT-5.5. Implement only the backend/API/database/security part of this full-stack task. Provide the exact API contract needed by the frontend: method, URL, request body, response shape, auth requirements, role guards, and error responses.

### Step 4 — Merge / check outputs
Compare frontend API usage against backend implementation: route names, request body fields, response fields, auth requirement, role guards. Check imports, file paths, naming conflicts. Confirm no secrets were printed/committed. Confirm the same feature was not implemented twice in conflicting ways. On conflict, keep the stricter security guard.

### Step 5 — Test (required — never skip)
Run whatever exists: `npm run install:all` (only if deps changed), `npm run build:frontend`, `npm run check:backend`, `npm run deploy:check`, `npm run test:e2e:trainee`, backend startup, `/health`, an API smoke test, and login + role-redirect checks when auth-related. If a check does not exist, say exactly "No automated test exists for this part," then do manual/static verification. Do all testing against local/non-production data unless the user explicitly authorizes a live check.

### Step 6 — Final report (always this shape)
1. Task understood  2. Agent routing used (Claude Code/Fable 5 · Codex/GPT-5.5)  3. Files changed  4. What was implemented  5. Tests/checks run  6. Problems found  7. Security notes  8. Next recommended step.

## Safety rules (non-negotiable)

- Never print or expose secrets from `.env` files. If a secret is found, report only the file path and state it must be rotated — never the value.
- Never commit passwords, database URLs, JWT secrets, cookies, private keys, or tokens.
- No destructive database changes without explicit user approval. Seeds/migrations/resets are gated behind `CONFIRM_*` / `DRY_RUN` env flags — keep them safe.
- Do not remove existing features or rename files/routes/roles/DB fields unless the task requires it.
- Preserve the current project structure unless there is a strong reason to change it.
- For medical/user data, prioritize privacy, access control, and auditability. The backend is the source of truth for permissions; frontend guards are UX only.
- Never declare a task complete until Step 5 testing/checking is done.

## Expected output

A coordinator report in the Step 6 shape, including the exact instruction block(s) routed to each agent, the merge/conflict check result, and the test results — with a clear go/no-go.
