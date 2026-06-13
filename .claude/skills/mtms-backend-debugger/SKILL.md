---
name: mtms-backend-debugger
description: Debug the MTMS / MLMS Node.js + Express + Mongoose backend. Use when an API route 4xx/5xxes, login or token refresh fails, the server won't boot, /health is down, or MongoDB won't connect. Covers tracing routes, inspecting Mongoose models, testing auth, and diagnosing DB problems without touching production data.
---

# MTMS Backend Debugger

Backend entry is `backend/server.js` (Express app, exported for tests, started only when run directly). Mongoose connects with `process.env.MONGO_URI`; the process exits on missing `MONGO_URI`/`JWT_SECRET` or a failed DB connect.

## When to use it

- API returns an unexpected status, auth/refresh breaks, server crashes on boot, `/health` fails, or MongoDB connection errors appear.

## Trace an API route

1. Find the mount in `server.js` (e.g. `/api/dio` → `routes/dio.js`).
2. Open the router; identify the handler, its middleware chain (`auth`, `allowRoles(...)`, `scopeGuard()`), and the Mongoose calls.
3. Confirm middleware order: `auth` sets `req.user`; `scopeGuard` then sets `req.scope`; the handler must filter by `req.scope`.
4. Reproduce with curl against a LOCAL server (see auth flow). Watch the terminal — the global error handler logs `[ServerError] ...`.

```bash
grep -rn "router\.\(get\|post\|put\|patch\|delete\)" backend/routes/<domain>.js
```

## Inspect Mongoose models

- Schemas live in `backend/models`. `User.js` hashes passwords in a `pre('save')` hook (bcrypt cost 12) and exposes `comparePassword`, `isLocked`, `incrementLoginAttempts`, `resetLoginAttempts`.
- Check field names match what routes query (e.g. `hospitalId` vs legacy `hospital`; `scopeGuard` falls back across both).
- Verify `ref` targets and `.populate(...)` paths exist (e.g. `auth.js /me` populates `hospital`, `hospitalId`, `specialtyId`).
- Validation/enum failures surface as 500 via the global handler — read the logged Mongoose `ValidationError` for the offending path.

## Test login / auth routes (local only)

Start the backend locally first: `npm --prefix backend run dev` (nodemon).

```bash
# Health
curl -s localhost:5000/health

# Login (use a LOCAL/seeded test account, never a real production credential)
curl -si -c cookies.txt -X POST localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"<local-test-pass>"}'
# -> 200 returns {token, user}; sets httpOnly refreshToken cookie

# Use the access token
curl -s localhost:5000/api/auth/me -H "Authorization: Bearer <token>"

# Silent refresh via cookie
curl -si -b cookies.txt -X POST localhost:5000/api/auth/refresh
```

Interpreting auth failures: `400` missing email/password; `401` bad creds / no token / session mismatch; `403` deactivated (`isActive:false`) or president mutation; `423` brute-force lock (5 fails → 15 min, see `User.incrementLoginAttempts`). Delete `cookies.txt` when done (it is gitignored).

## Check backend startup

```bash
node --check backend/server.js          # syntax only, no DB
npm run check:backend                     # same, via root script
npm --prefix backend run dev              # full boot with nodemon
```

A clean boot logs `MongoDB connected` then `MTMS V2 Server running on port <PORT>`. A `FATAL: Missing required environment variable` line means the local `.env` is incomplete — compare names against `.env.example` (never print values).

## Check /health

`GET /health` is unauthenticated and returns `{status:'ok', timestamp}`. If it fails: the process isn't listening (boot error), wrong port, or the proxy/PM2/Railway isn't routing. Curl it directly on the host first to isolate app vs proxy.

## Diagnose MongoDB connection problems

- Symptom `MongoDB connection failed: ...` then exit. Common causes: bad/space-trimmed `MONGO_URI`, IP not allowlisted (Atlas), wrong DB name, auth failure, or local `mongod` not running on 27017.
- Use the built-in helper (read-only — lists databases and `email/role` of users to confirm you're pointed at the right DB):
  ```bash
  node backend/diagnose.js
  ```
- If users appear under an unexpected database name, the app is connecting to the wrong DB — fix the path segment of `MONGO_URI` in the local `.env`.

## Avoid breaking production data

- NEVER run against the production `MONGO_URI`. Point local debugging at a local or disposable database.
- Do NOT run `seed:*`, `migrate:*`, `reseed:*`, or `resetPassword.js` to "test" — they mutate data and several gate on `DRY_RUN`/`CONFIRM_*` env flags; keep those safe.
- Treat all write/delete endpoints as destructive; reproduce with throwaway records.
- Never read or print `.env` / `backend/.env`.

## Expected output

A diagnosis note: symptom → reproduction (curl/command + observed status/log) → root cause (file:line) → minimal fix → how it was verified locally. No secret values; confirm which (non-production) database was used.
