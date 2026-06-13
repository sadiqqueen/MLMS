# MTMS / MLMS — Claude Project Instructions

Medical Training Management System. React+Vite frontend, Node.js/Express backend, MongoDB/Mongoose, JWT auth with httpOnly refresh cookie, 7 role-based dashboards, Railway/VPS deployment, sensitive medical/training data.

## Agent + model routing (read this first)

This project splits coding work by model. Follow it on every task:

- **Frontend / UI / React / CSS / responsiveness / accessibility / forms / dashboards / UX → Claude Code + Fable 5.**
- **Backend / Express routes / Mongoose / JWT / permissions / API security / deployment backend / server errors / production hardening → Codex + GPT-5.5.**
- **Full-stack → split:** frontend part to Claude Code + Fable 5, backend/security/database part to Codex + GPT-5.5, then compare both outputs against one API contract before applying.

The Coworker is the coordinator: understand → inspect → route → review/merge → test → report. Full procedure and the exact instruction blocks to hand each agent live in the `mtms-agent-routing` skill. Supporting skills: `mtms-codebase-navigator`, `mtms-security-auditor`, `mtms-backend-debugger`, `mtms-frontend-debugger`, `mtms-deployment-vps-railway`, `mtms-testing-checklist`, `mtms-codex-claude-workflow`.

## Safety rules

- Never print or expose secrets from `.env` / `backend/.env`. If a secret is found, report only the file path and say it must be rotated.
- Never commit passwords, DB URLs, JWT secrets, cookies, private keys, or tokens.
- No destructive database changes without explicit approval. Seed/migration/reset scripts are gated behind `CONFIRM_*` / `DRY_RUN` env flags — leave them safe.
- Do not remove existing features or rename files/routes/roles/DB fields unless the task requires it. Preserve the project structure.
- The backend enforces permissions (`auth` → `allowRoles` → `scopeGuard`); frontend role guards (`ProtectedRoute`, `ROLE_HOME`) are UX only and must mirror the backend.
- For medical/user data: prioritize privacy, access control, and auditability.

## Testing is required before "done"

Never call a task complete until checks run. Use: `npm run build:frontend`, `npm run check:backend`, `npm run deploy:check`, `npm run test:e2e:trainee`, backend startup, `/health`, API smoke, and login + role-redirect when auth-related. If no automated test exists for a part, say so explicitly and verify manually/statically. Test against local/non-production data unless a live check is explicitly authorized.

## Key files

`backend/server.js` (routes + middleware), `backend/middleware/{auth,roles,scopeGuard}.js`, `backend/models/User.js`, `frontend/src/App.jsx` (routes + `ROLE_HOME`), `frontend/src/api/axios.js`, `frontend/src/context/AuthContext.jsx`. Deploy: `backend/Procfile` (Railway), `scripts/deploy-vps.sh` + PM2 `mlms-backend` + Nginx (VPS), `frontend/vercel.json`.
