---
name: mtms-security-auditor
description: Security audit playbook for the MTMS / MLMS medical training LMS. Use when reviewing this repo for exposed secrets, unsafe JWT handling, weak auth guards, broken role/scope access control, insecure uploads, CORS/cookie risks, MongoDB injection, unsafe frontend localStorage, debug logs, and production .env mistakes. Reports findings without ever printing secret values.
---

# MTMS Security Auditor

This app stores sensitive medical/personal data for trainees, supervisors, and hospitals, so treat every finding as potentially high-impact. The codebase already has strong defaults (helmet, bcrypt cost 12, rate limiting, httpOnly refresh cookies, brute-force lockout, scopeGuard). This skill verifies those stay intact and hunts the gaps specific to this repo.

## When to use it

- Before a release or deploy, after auth/upload/CORS changes, or on demand for a security pass.

## Golden rule for secrets

If you find a real secret committed or present, DO NOT print its value. Report exactly:
`secret found in [file path], rotate it.`
Then stop and surface it. Never echo `.env`, tokens, connection strings, or private keys.

## Checklist and how to verify each

### 1. Exposed / committed secrets
- `.env` and `backend/.env` exist locally and are correctly listed in `.gitignore`. Confirm they were never committed historically:
  ```bash
  git ls-files | grep -iE '(^|/)\.env($|\.)' | grep -v example   # expect NO output
  git log --all --diff-filter=A --name-only -- '*.env' 'backend/.env' | head
  ```
- Scan source (never node_modules) for hardcoded secrets:
  ```bash
  grep -rniE "mongodb(\+srv)?://|JWT_SECRET *=|sk_live_|AKIA[0-9A-Z]{16}|-----BEGIN|eyJhbGciOi" \
    backend frontend/src --include=*.js --include=*.jsx | grep -v node_modules
  ```
- If anything tracked is found → report `secret found in [path], rotate it.` and recommend `git rm --cached` + history scrub + rotation.

### 2. Unsafe JWT handling
- Access tokens signed with `JWT_SECRET`, 15m expiry; refresh with `JWT_REFRESH_SECRET`, 7d, httpOnly cookie. Confirm both secrets are required in prod (`server.js` exits if `JWT_SECRET`/`MONGO_URI` missing; `JWT_REFRESH_SECRET` is required only when `NODE_ENV=production` — verify prod sets it; a dev-generated random secret invalidates all sessions on restart).
- Verify tokens are never logged and never returned in URLs.
- Confirm `auth.js` still checks access-vs-refresh user-id match (session-mismatch guard) and `isActive`/`lockUntil`.

### 3. Weak auth guards
- Every mutating route must chain `auth` before handler. Grep for handlers missing it:
  ```bash
  grep -rn "router\.\(post\|put\|patch\|delete\)" backend/routes | grep -v "auth"
  ```
- Confirm `/api/auth/me`, `change-password`, `upload-photo` use `auth`; `president` is blocked from mutations via `denyPresidentMutations`.

### 4. Role-based access control (RBAC)
- Sensitive endpoints must use `allowRoles(...)` (middleware/roles.js). List gates and spot gaps:
  ```bash
  grep -rn "allowRoles" backend/routes
  ```
- Cross-check against `App.jsx` `ProtectedRoute allowedRoles` — frontend gates are UX only; the backend must enforce the same role on every route. Any route protected only on the frontend is a finding.

### 5. Scope / data isolation
- Role-scoped routes (`/api/dio`, `/api/secretary`, `/api/supervisor`, `/api/program-director`, `/api/trainee`, `/api/president`) must filter queries by `req.scope` from `scopeGuard`. Flag any Mongoose query in these routers that ignores `req.scope` (potential cross-hospital / cross-trainee data leak — IDOR).

### 6. Insecure file uploads
- `routes/auth.js` uses multer disk storage to `backend/uploads`, 5MB limit, filter on extension + `image/` mimetype. Verify any other upload route applies the same limits and rejects non-images / executables.
- Filenames are `Date.now()-random.ext` (guessable). Combined with check 7 this enables enumeration.

### 7. Public access to uploads / sensitive files  [known risk]
- `server.js`: `app.use('/uploads', express.static(...))` serves ALL uploads with NO auth. Any file under `backend/uploads` is publicly downloadable by URL. For medical data this is a confidentiality risk. Recommend: gate `/uploads` behind `auth` (+ scope check for owner), or move private docs out of static serving and stream them through an authorized route. Confirm certificates/PDFs are not exposed here.

### 8. CORS
- Origin allowlist from `FRONTEND_URL` (comma-split); requests with no `Origin` are allowed (`cb(null,true)`) for curl/mobile. In production confirm `FRONTEND_URL` is set to the real domain(s) — if unset it silently falls back to `http://localhost:5173`, which must never ship to prod.

### 9. Cookie / session risks
- Refresh cookie: `httpOnly:true`, `sameSite:'lax'`, `secure: NODE_ENV !== 'development'`. Verify prod `NODE_ENV` is `production` (so `secure` is on). If the frontend (Vercel) is on a different site than the API, `sameSite:'lax'` can drop the cookie on cross-site requests — confirm same-site deployment or move to `sameSite:'none'; secure:true` intentionally.
- Confirm `TRUST_PROXY=true` is set when behind nginx/Railway so rate limiting and `secure` cookies see the real client IP/proto.

### 10. MongoDB injection
- Login uses `User.findOne({ email: email.toLowerCase() })`. Ensure request bodies are not passed as query operators (no `{$gt:''}` style bypass). Flag any `find`/`findOne` that spreads untrusted `req.body`/`req.query` directly into the filter without field whitelisting or type checks.

### 11. Unsafe frontend localStorage
- Current state (good): the access token lives in memory only (`api/axios.js`), and only a non-sensitive "safe user" object is in `localStorage`. Flag any new code that writes a JWT, refresh token, password, or full user record (with secrets) to `localStorage`/`sessionStorage`.

### 12. Accidental debug logs
- `server.js` logs errors via `console.error('[ServerError]', err)`. Verify no route logs request bodies, passwords, tokens, or full user docs:
  ```bash
  grep -rn "console\.\(log\|debug\|info\)" backend/routes backend/middleware
  ```

### 13. Production .env mistakes
Required in prod (`.env.example`): `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `PORT`, `TRUST_PROXY=true`, `NODE_ENV=production`. Confirm seed/reset guard vars (`DRY_RUN`, `CONFIRM_RESEED`, `ALLOW_LOCAL_DEMO_SEED`, `CONFIRM_RESET_PASSWORD`) are NOT left in a destructive state on a prod host.

## Safety rules

- Never print secret values; report paths only with the rotate message.
- Audit is read-only — propose fixes, do not apply them without explicit approval.
- Do not exfiltrate `backend/uploads` contents or DB data while testing.

## Expected output

A findings table: `# | severity (high/med/low) | check | file:line | what's wrong | recommended fix`. End with a one-line risk verdict and, separately, any `secret found in [path], rotate it.` lines. Note this is a code review, not a penetration test or legal compliance certification.
