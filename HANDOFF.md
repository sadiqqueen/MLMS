# MTMS / MLMS — Project Handoff

_Medical Training Management System. Last updated: 2026-07-09._

This is a working handoff for anyone (human or agent) picking up the codebase. It covers the architecture, the two‑portal role model, the subsystems, how to build/test/deploy, the significant recent changes, and the open follow‑ups. Read the **Role & Track model** and **DIO scope** sections first — they drive most of the access‑control logic.

---

## 1. What it is

A medical residency/internship training platform with **7 role‑based dashboards**, sensitive medical/training data, and two parallel training portals (Advanced + Basic). Users are trainees, supervisors, program directors, secretaries, DIOs (Designated Institutional Officials), a president, and a super admin, plus two consultant‑memo roles (ASG.1/ASG.2).

**Stack**
- **Frontend:** React 18 + Vite (JSX), React Router v6, Chart.js, axios. No component framework — plain CSS in `frontend/src/index.css` with CSS variables for theming (light/dark) + i18n (Arabic/English, RTL/LTR).
- **Backend:** Node.js + Express, Mongoose (MongoDB).
- **Auth:** JWT — short‑lived access token (Bearer header) + long‑lived **httpOnly refresh cookie**; auth middleware silently re‑issues access tokens.
- **Deploy:** Backend → Railway (`backend/Procfile`, `railway.json`) or VPS (`scripts/deploy-vps.sh` + PM2 process `mlms-backend` + Nginx). Frontend → Vercel (`frontend/vercel.json`) or served statically.

---

## 2. Run / build / test

From the repo root:

```bash
npm run dev              # concurrently: backend (nodemon) + frontend (vite)
npm run frontend         # vite dev server only
npm run backend          # backend dev only

npm run build:frontend   # vite production build (installs dev deps first)
npm run check:backend    # node --check backend/server.js (syntax gate)
npm run deploy:check     # build:frontend + check:backend  ← the pre-ship gate
```

- **Backend boot** needs `backend/.env` with at least `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (see `REQUIRED_ENV` in `backend/server.js`). Health check: `GET /health`.
- **There is no automated e2e/unit suite** in the repo right now (`test:e2e:trainee` referenced in older docs does not exist). Verification today = `deploy:check` + `node --check` on changed routes + a manual login/role‑redirect click‑through. A fast, DB‑free sanity check used throughout recent work: `node -e "require('./backend/server.js')"` — this assembles the whole Express app (mounts every route) **without** connecting to Mongo (it only connects when run as `require.main`).
- **Never boot the backend against the production DB for a "test."** Use a local/non‑prod Mongo. Never commit `.env` / secrets.

---

## 3. Repo layout

```
backend/
  server.js                 route mounting + global middleware (helmet-ish, rate limits, honeypot, error handler)
  middleware/
    auth.js                 verifies JWT, normalizes b_* → base role, sets req.track, refresh-cookie fallback
    roles.js                allowRoles(...roles) factory (403 on mismatch)
    scopeGuard.js           attaches req.scope per role (data isolation helper)
    auditLogger.js          writes AuditLog entries
    rateLimiter.js, honeypot.js, securityEventLogger.js, requireInitiativeAccess.js
  models/                   Mongoose schemas (User, Hospital, Specialty, Rotation, Distribution,
                            Evaluation, Report, Certificate, Notification, AuditLog, Initiative,
                            ConsultantMemo, ScientificCouncil, SecurityEvent, University)
  routes/                   auth, users, hospitals, specialties, distributions, rotations, reports,
                            evaluations, notifications, certificates, certificateVerify, dashboard,
                            dio, supervisor, programDirector, secretary, president, trainee, adminV2,
                            consultantMemo, scientificCouncils, initiatives, universities
  utils/track.js            coerceRoleToTrack, trackFilter, trackForRole, baseRole, isBasicRole
  migrations/, seeds/, scripts/ (reseed, fixups — gated by DRY_RUN / CONFIRM_* flags)

frontend/src/
  App.jsx                   ALL routes (advanced + /basic mirror) + RootRedirect
  config/roles.js           ROLE_HOME, ROLE_LINKS (nav), track helpers (single source of truth)
  api/axios.js              axios instance (adds Bearer, handles X-New-Access-Token, refresh)
  context/AuthContext.jsx   user/session; PrefsContext.jsx  theme/lang
  hooks/useBasePath.js      '' for advanced, '/basic' for b_* roles — prefix all intra-app nav with this
  components/               Navbar, ProtectedRoute, ErrorBoundary, Toast, Skeleton, ViewToggle,
                            SearchableSelect, icons.jsx (shared inline-SVG icon set),
                            evaluations/EvalModal.jsx + evalStrings.js (shared WPBA modal)
  data/evalForms.js         WPBA form definitions (Mini-CEX, CBD, DOPS, MSF-360 A–E, ASR, FITER)
  i18n/                     strings + resolver (dict[lang][key] ?? dict.ar[key] ?? key)
  pages/                    one file per screen (Dio*, Secretary*, Supervisor*, President*,
                            ProgramDirector*, Admin*, trainee Timeline/Reports/Grades, memo, initiatives)

docs/api-contract.md, README.md, AGENTS.md, .claude/ (skills), graphify-out/ (knowledge graph, generated)
```

---

## 4. Role & Track model (read this)

**Roles** (`User.role` enum): `trainee, supervisor, program_director, secretary, dio, president, super_admin, asg1, asg2` — plus the **Basic‑track mirrors** `b_trainee, b_supervisor, b_program_director, b_secretary, b_dio, b_president`.

**Two portals / tracks.** There is one Advanced portal and one Basic‑Training portal. **The Basic portal reuses the exact same page components** under a `/basic/*` URL prefix — there is *no* duplicated UI. What differs is only the URL and the role.

How the mirroring works end‑to‑end:
- **auth.js** normalizes a `b_*` role to its base (`b_dio` → `dio`) for all downstream role checks, and sets **`req.track`** (`'basic'` or `'advanced'`). So every `req.user.role === 'dio'` check also fires for a `b_dio`; the *track* difference lives in `req.track`.
- **`utils/track.js`** — `coerceRoleToTrack(role, track)` turns a base role into its track‑correct DB role (`coerceRoleToTrack('trainee','basic') === 'b_trainee'`); `trackFilter(track)` is a Mongo fragment (`{track:'basic'}` or `{track:{$ne:'basic'}}` — the latter also matches legacy docs with no `track`). `User`, `Hospital`, `Specialty`, `Rotation`, `Certificate`, `Evaluation` all carry an indexed `track` field.
- **Frontend** — `config/roles.js` builds `ROLE_LINKS['b_dio']` by prefixing `/basic` onto the advanced DIO links (the `MIRRORED` map). `useBasePath()` returns `''` or `'/basic'`; **all intra‑app navigation must prefix it** or a `b_*` user gets bounced to the Advanced portal.
- **App.jsx** — every `/dio/*` route has an exact `/basic/dio/*` twin (same for the other roles). When you add a DIO route, add its `/basic` twin.

**RBAC chain (backend is the real guard):** `auth → allowRoles(...) → scopeGuard()`. Frontend `ProtectedRoute` + `ROLE_HOME` (in `config/roles.js`) mirror it but are **UX only** — never rely on them for security.

`ROLE_HOME`: super_admin→`/admin/dashboard`, dio→`/dio/dashboard`, secretary→`/secretary/trainees`, supervisor→`/supervisor/trainees`, program_director→`/program-director/trainees`, president→`/president/trainees`, trainee→`/timeline`, asg1/asg2→`/consultant-memo` (b_* = `/basic` + the same).

---

## 5. The DIO scope model — HOSPITAL → TRACK (major recent change)

Historically the DIO was **hospital‑scoped** (saw only its own hospital's users/records). As of this session the DIO is a **track‑wide overseer**: an advanced `dio` sees/manages/evaluates **every advanced‑track** user and record across **all hospitals**; a `b_dio` does the same within the Basic track. This was an explicit product decision.

What that means in `backend/routes/dio.js`:
- All list endpoints (`/trainees`, `/supervisors`, `/program-directors`, `/secretaries`, `/presidents`) query `role: coerceRoleToTrack(<role>, req.track)` with **no hospital filter**.
- Evaluations, trainee details, report grading, dashboard `/stats`, and certificates are all **track‑scoped** (`trackFilter(req.track)` for Rotation/Certificate; coerced role for users).
- Create/update/delete match the target by the **coerced role**, which is what enforces track isolation (a DIO can only touch users in its own track).
- The `president` shows on the DIO **Users** page as **view‑only** (no edit/deactivate/create).

There are dead helper functions left in `dio.js` from the old hospital model (`getDioHospitalOrFail`, `ensureDioCanAccessHospitalDoc`, `hospitalCondition`, `belongsToHospital`, `getHospital`, `addAnd`) — they are no longer called and can be removed in a cleanup.

**Cross‑route track isolation** (hardened this session): the *shared* write routes now block a DIO acting on the other track — `/api/hospitals` PUT/PATCH/DELETE and `/api/specialties` PATCH/upload (`ensureHospitalInTrack` / `ensureSpecialtyInTrack`), `/api/users` update/lock/delete (`blockCrossTrackWrite` + `hasHigherRole` compares **base** roles so `b_president` isn't rank 0), and `validateUserReferences` rejects a cross‑track `specialtyId`.

---

## 6. Subsystems (map)

Derived from the code and the graphify knowledge graph (`graphify-out/GRAPH_REPORT.md`). "God nodes" (most‑connected): `api` (axios), `Navbar()`, `useAuth()`, `Skeleton()`, `Toast()`, `allowRoles()`, `usePrefs()`, `ViewToggle()`, `useBasePath()`.

- **Auth & tracks** — `middleware/auth.js`, `utils/track.js`, `config/roles.js`, `context/AuthContext.jsx`, `api/axios.js`.
- **Users management** — `routes/users.js` (generic, admin), `routes/dio.js` + `routes/secretary.js` (role‑scoped CRUD), pages `DioUsers.jsx`, `Users.jsx`, the various `*Trainees/*Supervisors` pages.
- **Hospitals & specialties** — `routes/hospitals.js`, `routes/specialties.js`; pages `DioHospitals.jsx` (list + management), `DioHospitalDetail.jsx` (per‑hospital page), `SecretaryHospitals.jsx`, `HospitalsUniversities.jsx` (admin). `Specialty` has `hospitalId` + `secretaryId`.
- **Rotations & distributions** — `routes/rotations.js`, `routes/distributions.js`; `Rotation` = a trainee's placement over time, `Distribution` = a supervisor↔hospital/specialty assignment. DIO UI merged into `DioAssignments.jsx` (tabs: Distribution / Rotation).
- **Evaluations (WPBA)** — `data/evalForms.js` defines Mini‑CEX, CBD, DOPS, **MSF‑360 (parts A–E)**, Academic Supervisor Report, FITER (each with a rating scale + domains). Shared UI in `components/evaluations/EvalModal.jsx`. Supervisors submit → finalize (`/api/supervisor/evaluations`); the **DIO evaluates both trainees and supervisors**, finalized‑on‑create (`/api/dio/{trainees,supervisors}/:id/evaluations`, list via `/api/dio/evaluations`). The `Evaluation` model uses `student`/`traineeId` plus new `evaluateeId`/`evaluateeRole` to support supervisor‑subject evals without polluting trainee queries.
- **Reports & grading** — `routes/reports.js`, `Report` model (weekly/monthly/final). Supervisors grade weekly/monthly; program directors grade final; the DIO can grade/override any in its track (`/api/dio/reports/:id/grade`).
- **Certificates** — `routes/certificates.js` + DIO cert endpoints + `routes/certificateVerify.js` (public `GET /api/certificates/verify/:code`, `verifyCode` on the model). Pages `DioCertificates.jsx`, `CertificatePrint.jsx`, `VerifyCertificate.jsx`.
- **Consultant Memo** — ASG.1/ASG.2 only. `routes/consultantMemo.js`, `ConsultantMemo` model, memo UI under `components/memo/` + `ConsultantMemo*.jsx`. Has its own AR/EN toggle (`cm-lang`).
- **Initiatives** — ASG‑gated 3‑stage Kanban approval pipeline. `routes/initiatives.js`, `Initiative` model, `Initiatives.jsx`, `middleware/requireInitiativeAccess.js`.
- **Scientific Councils** — `routes/scientificCouncils.js` + Arabic normalization util.
- **Dashboards** — one per role; DIO dashboard is track‑scoped stats + charts.
- **Security** — `rateLimiter.js` (login/refresh/global limiters), `honeypot.js`, `securityEventLogger.js` + `SecurityEvent` model, `AuditLog` (write‑method logging), `adminV2.js` audit endpoints.

---

## 7. Backend conventions

- **Route module shape:** `router.<verb>(path, auth, allowRoles(...ROLES), [auditLog(...)], handler)`. Roles are lists of constants at the top of each file.
- **Scoping:** prefer `coerceRoleToTrack(role, req.track)` for any user role query and `trackFilter(req.track)` for `Hospital`/`Specialty`/`Rotation`/`Certificate`. `super_admin` bypasses scoping.
- **Field allow‑lists:** every create/update `pick(body, ALLOWED_FIELDS)` — never spread `req.body` into a model.
- **Responses:** mostly `{ success: true, data }`; some legacy endpoints return the bare object/array. Frontend defensively reads `res.data?.data || res.data`.
- **Legacy dual fields:** several refs exist under two names (`hospitalId`/`hospital`, `supervisorId`/`doctor`, `traineeId`/`student`, `specialtyId`/`specialty`) — handlers accept/populate both. Keep writing both when you add data.
- **Audit + notify:** mutations write an `AuditLog` entry and often a `Notification` to the affected user.

## Frontend conventions

- Pages render `<Navbar/>` + `<main className="admin-main">`. Reuse `admin-card`, `admin-toolbar`, `admin-table`, `filter-tabs`, `btn-purple/outline/red`, `btn-action` (+`.view/.edit/.delete/.revoke/.print`), stat cards, `management-card-grid`, `ViewToggle`, `SearchableSelect`, `Toast`, `Skeleton (Sk)`.
- **Motion** follows the `web-animation-design` rules: `transform`/`opacity` only, <300 ms, ease‑out entrances; a global `@media (prefers-reduced-motion: reduce)` in `index.css` neutralizes all of it. New nav labels need entries in **both** `ar` and `en` in `i18n/strings/nav.js`.
- Brand: primary `#1B1464`, accent `#FF6B35`, link `#185FA5`, specialty chip `#EEEDFE`/`#3C3489`.

---

## 8. What changed this session (newest → oldest)

All on `main`, pushed:

| Commit | Change |
|--------|--------|
| `8bdb97e` | Removed the "Basic Training" navbar badge |
| `7e6db97` | Fixed the **secretary** endpoints for the Basic track (coerce role queries by `req.track`; track‑filter the specialty‑name hospital scope) |
| `c52e00c` | De‑duplicate specialties per hospital in the DIO views (key by name, not DB id) |
| `747a28b` | Per‑hospital **detail page** for the DIO (`/dio/hospitals/:id`, adds trainees) |
| `7a2b653` | DIO + secretary can **add/edit hospitals** (track‑scoped); secretary `POST /api/secretary/hospitals`; hospital/specialty create now stamps `track`; cross‑track write guards |
| `26f1bdf` | DIO **Hospitals** overview page (+ nav item) |
| `2d3735d` | **DIO became a track‑wide overseer** (hospital→track scoping across dio.js) + president view‑only on Users |
| `837e373` | (superseded by 2d3735d) first pass scoping DIO `/api/users` access |
| `4e978d3` | **DIO dashboard overhaul** — merged Users page (search + hospital/specialty/role filters), merged Assignments (Distribution+Rotation tabs), DIO Evaluations (trainees + supervisors) via extracted shared `EvalModal`, Certificates header/icons/filters, dashboard 4+3 stat grid |

Earlier context still relevant: `43d5dcb`/`a9891a7` made the WPBA evaluation forms interactive (incl. MSF‑360 A–E, FITER); `6dbc584` introduced the parallel Basic‑Training portal and the `b_*` roles.

---

## 9. Known issues & follow‑ups

- **Duplicate `Specialty` records** exist in the DB (multiple same‑named specialties per hospital, from seeding). The DIO UI now de‑dupes them **by name for display only** — the underlying rows remain. A safe, `DRY_RUN`‑first cleanup script (report → delete only on a `CONFIRM_*` flag, keeping the row that has a secretary/assignments) is a good next task.
- **Basic‑track data must be tagged `track:'basic'`** for a `b_dio`/`b_secretary` to see it. Items created through the Basic portal are now tagged correctly, but anything seeded as Advanced won't appear for Basic users. If Basic pages look empty, check the `track` field on the seed data.
- **Dead code** in `dio.js` — the old hospital‑scope helpers (§5) are unused; remove in a cleanup pass.
- **No test suite.** Consider adding Playwright login/role‑redirect smoke tests and a couple of backend route tests against a throwaway Mongo.
- **`hospitals`/`specialties` write routes** are shared with `super_admin`; the DIO track guards were added this session, but any *new* shared endpoint that admits `dio` must add the same track check.
- **`getSecretaryHospitalIds`** matches hospitals by specialty‑name; it is now track‑filtered, but the name‑match is inherently fuzzy — prefer the `Specialty.hospitalId` link where possible.

---

## 10. Safety rules (do not violate)

- Never print, commit, or expose secrets from `.env` / `backend/.env` (Mongo URI, JWT secrets, cookies, tokens). If found, report only the path and say it must be rotated.
- No destructive DB changes without explicit approval. Seed/migration/fixup scripts are gated behind `DRY_RUN` / `CONFIRM_*` — keep them safe.
- Don't remove existing features or rename files/routes/roles/DB fields unless the task requires it.
- The backend enforces permissions; frontend guards mirror it for UX only.
- Treat all medical/user data as sensitive — privacy, access control, auditability first.

---

## 11. The knowledge graph (optional, for orientation)

`graphify-out/` holds a generated knowledge graph of the repo (run: `/graphify .`): `graph.html` (interactive), `graph.json` (GraphRAG‑ready), `GRAPH_REPORT.md` (communities, god nodes, hyperedges, suggested questions). It's a navigational aid, not source — it can be regenerated (`--update`) and is a candidate for `.gitignore` (≈3 MB of generated artifacts).

---

_Questions the graph flags as most revealing: why `allowRoles()` bridges nearly every backend route (it's the RBAC chokepoint), and why `api`/`Skeleton()`/`Navbar()` bridge every dashboard (shared shell). Start there to understand the cross‑cutting structure._
