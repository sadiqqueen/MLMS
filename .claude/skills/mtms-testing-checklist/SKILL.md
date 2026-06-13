---
name: mtms-testing-checklist
description: Repeatable verification flow to run before declaring any MTMS / MLMS change complete. Use after editing backend or frontend code, before committing, or before deploy. Covers install/build/lint/test, backend boot, frontend build, login + role-redirect smoke tests, API smoke tests, /health, and a git diff / files-changed summary.
---

# MTMS Testing Checklist

Run this gate before saying work is done. Skip a step only if it does not apply to this repo (e.g. there is no `lint` script) and say so explicitly — never silently skip. Do everything against LOCAL/non-production data.

## When to use it

- After any code change, before commit/PR, and before deploy.

## 0. Scope the change

```bash
git status
git diff --stat
```
Decide which sections below the change can affect (backend, frontend, both, deploy).

## 1. Install / build / lint / test (only what exists)

This repo's available scripts (root `package.json` + sub-packages):
```bash
# install (if deps changed)
npm run install:all

# backend: syntax/boot check (no jest configured)
npm run check:backend          # node --check backend/server.js

# frontend: production build
npm run build:frontend         # vite build (installs dev deps)

# combined gate
npm run deploy:check           # check:backend + build:frontend

# e2e (Playwright) — requires app running locally; trainee read-only suite
npm run test:e2e:trainee
```
There is no `lint` or unit-`test` script today — state "no lint/unit-test script present" rather than inventing one. If a `lint`/`test` script is added later, run it here.

## 2. Backend startup test

```bash
npm --prefix backend run dev
```
Expect `MongoDB connected` then `MTMS V2 Server running on port <PORT>`. A `FATAL: Missing required environment variable` means the local `.env` is incomplete (compare to `.env.example`, do not print values). Point `MONGO_URI` at a local/disposable DB, never production.

## 3. Frontend build test

```bash
npm run build:frontend
```
Must finish with no rollup/Vite errors and emit both `frontend/dist/landing.html` and `frontend/dist/app.html`. Watch for case-sensitive import errors that pass on Windows but fail on Linux.

## 4. Login test (local)

```bash
curl -si -c cookies.txt -X POST localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<local-test-account>","password":"<local-test-pass>"}'
```
Expect `200` with `{token, user}` and a `Set-Cookie: refreshToken` (httpOnly). Then `curl -s localhost:5000/api/auth/me -H "Authorization: Bearer <token>"` returns the user. Remove `cookies.txt` after (gitignored). Use seeded local credentials only — never real ones.

## 5. Role redirect test

For each role touched by the change, log in (in the browser) and confirm the landing route matches `ROLE_HOME`:
super_admin→`/admin/dashboard`, dio→`/dio/dashboard`, secretary→`/secretary/trainees`, supervisor→`/supervisor/trainees`, program_director→`/program-director/trainees`, president→`/president/trainees`, trainee→`/timeline`. Confirm a role CANNOT open another role's route (ProtectedRoute redirects). For backend, confirm `allowRoles`/`scopeGuard` still reject cross-role/cross-scope access.

## 6. API smoke tests

Hit a couple of endpoints relevant to the change with a valid token, e.g.:
```bash
curl -s localhost:5000/api/notifications -H "Authorization: Bearer <token>"
curl -s localhost:5000/api/dashboard     -H "Authorization: Bearer <token>"
```
Expect `200` and the documented shape; confirm a request WITHOUT a token returns `401`, and a wrong-role token returns `403`. Confirm scoped routes return only the caller's data.

## 7. Deployment healthcheck

```bash
curl -s localhost:5000/health            # {status:'ok'}
```
If deploying, also curl `https://<domain>/health` through the proxy.

## 8. Git diff summary

```bash
git diff --stat
git diff                                  # review every hunk
git ls-files --others --exclude-standard  # confirm no stray secrets/uploads/dist added
```

## 9. Files-changed summary

List each changed file with a one-line reason. Confirm NO secret files (`.env`, `backend/.env`), NO `backend/uploads/*`, and NO `frontend/dist/` are staged.

## Safety rules

- All tests run against local/disposable data; never production `MONGO_URI`.
- Do not run `seed:*` / `migrate:*` / `reseed:*` / `resetPassword.js` as part of testing.
- Delete local artifacts (`cookies.txt`, `*login*.json`) when finished.
- Do not mark work complete if any applicable step above failed.

## Expected output

A checklist report: each step → PASS / FAIL / N/A (with reason), then the `git diff --stat`, a files-changed-with-reasons list, and a final verdict: "Ready" only if every applicable step passed.
