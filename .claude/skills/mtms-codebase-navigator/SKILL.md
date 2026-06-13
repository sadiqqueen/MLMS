---
name: mtms-codebase-navigator
description: Quickly orient inside the MTMS / MLMS medical training LMS. Use at the start of any task to map the React/Vite frontend, the Node/Express/Mongoose backend, where routes/models/middleware/pages/components/API helpers/deployment configs live, and how to inspect the repo without ever opening secret files.
---

# MTMS Codebase Navigator

Medical Training Management System (MTMS, repo name MLMS / `midlearn_LMS`). Manages trainee clinical rotations, evaluations, reports, and certificates across 7 medical roles. React+Vite SPA frontend, Node.js/Express REST API, MongoDB via Mongoose, JWT auth with refresh cookies, role + scope based access control.

## When to use it

- At the start of any feature, bug, audit, or deployment task in this repo.
- When you need to find the file that owns a route, model, page, or config.
- When onboarding another agent or summarizing the architecture.

## Repo map

```
midlearn_LMS/
├── package.json          # root scripts: dev, build:frontend, check:backend, deploy:check, e2e
├── frontend/             # React 18 + Vite SPA  (deploys to Vercel and/or nginx on VPS)
│   ├── landing.html      # public landing page (built to dist/landing.html)
│   ├── vercel.json       # Vercel rewrites: / -> landing.html, /* -> app.html
│   ├── vite.config.js    # dev proxy for /api and /uploads -> localhost:5000
│   └── src/
│       ├── App.jsx           # ALL client routes + ROLE_HOME redirect map
│       ├── main.jsx          # React entry
│       ├── api/axios.js      # axios instance, access-token-in-memory, refresh interceptor
│       ├── context/AuthContext.jsx  # session state, login/logout, silent refresh timer
│       ├── components/       # ProtectedRoute, Navbar, NotificationPanel, Toast, etc.
│       └── pages/            # role-prefixed pages: Dio*, President*, Secretary*, Supervisor*, ProgramDirector*, Admin*, Timeline, Reports, Grades, Profile, VerifyCertificate
├── backend/              # Node.js + Express  (deploys to Railway via Procfile, or PM2 on VPS as mlms-backend)
│   ├── server.js         # app setup: helmet, cors, cookieParser, rate limiters, /health, route mounting, honeypot, error handler
│   ├── Procfile          # web: node server.js  (Railway)
│   ├── routes/           # one file per domain (see Route map below)
│   ├── models/           # Mongoose schemas: User, Hospital, University, Specialty, Certificate, Evaluation, Report, Notification, AuditLog
│   ├── middleware/       # auth, roles, scopeGuard, rateLimiter, honeypot, auditLogger, securityEventLogger
│   ├── migrations/       # migrateLegacyRoles.js, reseedProfessionalData.js
│   ├── seeds/            # specialties.seed.js, superadmin.seed.js, demo_full.seed.js
│   ├── scripts/          # showSecurityEvents.js, deploy-vps.sh
│   ├── diagnose.js       # lists DBs + users(email,role) for connection troubleshooting
│   └── uploads/          # RUNTIME user uploads (gitignored) — served static at /uploads
├── .env / backend/.env   # SECRETS — gitignored, never open or print
└── .env.example          # safe variable-name reference
```

## Route map (backend/server.js)

| Mount | File | Notes |
|-------|------|-------|
| `/health` | server.js | unauthenticated healthcheck `{status:'ok'}` |
| `/api/auth` | routes/auth.js | login, refresh, logout, me, change-password, upload-photo |
| `/api/users` | routes/users.js | |
| `/api/hospitals`, `/api/universities` | routes/hospitals.js, universities.js | |
| `/api/distributions`, `/api/rotations` | routes/distributions.js, rotations.js | |
| `/api/evaluations`, `/api/reports`, `/api/certificates` | matching files | write-rate-limited |
| `/api/certificates/verify` | routes/certificateVerify.js | public certificate verification |
| `/api/dashboard`, `/api/notifications` | matching files | |
| `/api/specialties` | routes/specialties.js | V2 |
| `/api/supervisor`, `/api/program-director`, `/api/secretary`, `/api/dio`, `/api/president`, `/api/trainee` | matching files | role-scoped V2 routes |
| `/api/admin` | routes/adminV2.js | |

## Roles and scoping

Roles (User.role enum): `super_admin`, `dio`, `president`, `program_director`, `secretary`, `supervisor`, `trainee`.
Legacy roles removed: `doctor`, `student`, `professor`, `director`, `admin`. Run `npm --prefix backend run migrate:legacy-roles` against any DB that may still hold old values.

- `middleware/auth.js` — verifies access JWT (Bearer header), falls back to httpOnly refresh cookie, re-issues access token via `X-New-Access-Token` header, enforces deactivation and brute-force lock.
- `middleware/roles.js` — `allowRoles('dio','super_admin')` factory for endpoint role gates.
- `middleware/scopeGuard.js` — sets `req.scope` (e.g. `{hospitalId}`, `{specialtyId}`, `{traineeId}`) so handlers filter queries to the caller's data.
- Frontend mirror: `components/ProtectedRoute.jsx` + `ROLE_HOME` map in `App.jsx`.

## Step-by-step workflow

1. Read `README.md` for the current structure, role table, and deploy notes.
2. Read `backend/server.js` to confirm the live middleware order and route mounts.
3. For a backend domain, open `routes/<domain>.js`, then its `models/<Model>.js`.
4. For a frontend feature, find the route in `App.jsx`, open the matching `pages/<Page>.jsx`, and trace API calls through `api/axios.js`.
5. For auth/permission questions, read `middleware/auth.js`, `middleware/roles.js`, `middleware/scopeGuard.js` together.
6. Use `git ls-files` (not a raw filesystem walk) to enumerate tracked files and avoid runtime junk.

## Safety rules

- NEVER open, cat, read, or print `.env`, `backend/.env`, or `frontend/.env`. Use `.env.example` for variable names only.
- Treat everything under `backend/uploads/` as private user data — do not open, move, or commit it.
- Read-only by default. Do not edit app behavior while navigating.
- Do not run seed/migration/reset scripts to "explore" — several mutate data and require explicit confirm env vars.

## Useful commands

```bash
git ls-files | grep -vE 'node_modules'          # tracked files only
git ls-files backend/routes                       # list route handlers
grep -rn "allowRoles\|scopeGuard" backend/routes  # find permission gates
cat .env.example                                   # safe variable names
```

## Expected output

A short orientation note: the subsystem in scope, the exact files that own it (route → model → middleware, or page → axios), the roles allowed to reach it, and any scope filter that applies — with file paths, no secret values.
