# MTMS / MLMS — Project Handoff

_Medical Training Management System. Last updated: 2026-07-10._

This is a working handoff for anyone (human or agent) picking up the codebase. It covers the architecture, the two‑portal role model, the subsystems, how to build/test/deploy, the significant recent changes, and the open follow‑ups. Read the **Role & Track model**, the **DIO scope**, and the **Program Director scope** sections first — they drive most of the access‑control logic.

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
- **There is no automated e2e/unit suite** in the repo (`test:e2e:trainee` referenced in older docs does not exist). Verification today =
  - `npm run deploy:check` (build + `node --check`),
  - `node -e "require('./backend/server.js')"` — a fast, **DB‑free** sanity check that assembles the whole Express app (mounts every route) **without** connecting to Mongo (it only connects when run as `require.main`),
  - a manual login/role‑redirect click‑through,
  - and, for pure logic, a throwaway **mock‑based node script** that stubs the Mongoose models via `require.cache` to assert query shapes (used this session to verify `utils/pdScope.js` — 10/10). This pattern is a good cheap substitute for real route tests when no DB is available.
- **No local Mongo or Docker is installed in the current dev environment**, so live DB / browser end‑to‑end testing of authed flows could not be run this session. **Never boot the backend against the production DB for a "test."** Use a local/non‑prod Mongo. Never commit `.env` / secrets.

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
  utils/
    track.js                coerceRoleToTrack, trackFilter, trackForRole, baseRole, isBasicRole
    pdScope.js              (NEW) Program-Director specialty scoping (name-set) + one-PD-per-specialty
    evalScoring.js          (NEW) shared eval helpers: averageScore, WPBA_FORMS, isWpbaForm, wpbaAlreadyThisMonth
  migrations/, seeds/, scripts/ (reseed, fixups — gated by DRY_RUN / CONFIRM_* flags)

frontend/
  landing.html              public marketing/login landing page (served at '/'; NOT a React route)
  public/track-documents/   program PDFs served at /track-documents/* (Medical_Internship_Program.pdf, Specialty_Training_Guide_General_Model_EN.pdf)
  public/evaluation-forms/   WPBA form .docx files served at /evaluation-forms/*
  src/
    App.jsx                 ALL routes (advanced + /basic mirror) + RootRedirect
    config/roles.js         ROLE_HOME, ROLE_LINKS (nav), MIRRORED map, track helpers (single source of truth)
    api/axios.js            axios instance (adds Bearer, handles X-New-Access-Token, refresh, 20s GET cache)
    context/AuthContext.jsx user/session; PrefsContext.jsx  theme/lang
    hooks/useBasePath.js    '' for advanced, '/basic' for b_* roles — prefix all intra-app nav with this
    components/             Navbar, ProtectedRoute, ErrorBoundary, Toast, Skeleton, ViewToggle,
                            SearchableSelect, icons.jsx (shared inline-SVG icon set),
                            evaluations/EvalModal.jsx + evalStrings.js (shared WPBA modal)
    data/evalForms.js       WPBA form definitions (Mini-CEX, CBD, DOPS, MSF-360 A–E, ASR, FITER)
    i18n/                   strings + resolver (dict[lang][key] ?? dict.ar[key] ?? key)
    pages/                  one file per screen (Dio*, Secretary*, Supervisor*, President*,
                            ProgramDirector*, Admin*, trainee Timeline/Reports/Grades, memo, initiatives)

docs/api-contract.md, README.md, AGENTS.md, .claude/ (skills), graphify-out/ (knowledge graph, generated/untracked)
```

---

## 4. Role & Track model (read this)

**Roles** (`User.role` enum): `trainee, supervisor, program_director, secretary, dio, president, super_admin, asg1, asg2` — plus the **Basic‑track mirrors** `b_trainee, b_supervisor, b_program_director, b_secretary, b_dio, b_president`.

**Two portals / tracks.** There is one Advanced portal and one Basic‑Training portal. **The Basic portal reuses the exact same page components** under a `/basic/*` URL prefix — there is *no* duplicated UI. What differs is only the URL and the role.

How the mirroring works end‑to‑end:
- **auth.js** normalizes a `b_*` role to its base (`b_dio` → `dio`) for all downstream role checks, and sets **`req.track`** (`'basic'` or `'advanced'`). So every `req.user.role === 'dio'` check also fires for a `b_dio`; the *track* difference lives in `req.track`.
- **`utils/track.js`** — `coerceRoleToTrack(role, track)` turns a base role into its track‑correct DB role (`coerceRoleToTrack('trainee','basic') === 'b_trainee'`); `trackFilter(track)` is a Mongo fragment (`{track:'basic'}` or `{track:{$ne:'basic'}}` — the latter also matches legacy docs with no `track`). `User`, `Hospital`, `Specialty`, `Rotation`, `Certificate`, `Evaluation` all carry an indexed `track` field.
- **Frontend** — `config/roles.js` builds `ROLE_LINKS['b_dio']` by prefixing `/basic` onto the advanced DIO links (the `MIRRORED` map). `useBasePath()` returns `''` or `'/basic'`; **all intra‑app navigation must prefix it** or a `b_*` user gets bounced to the Advanced portal.
- **App.jsx** — every `/dio/*` route has an exact `/basic/dio/*` twin (same for the other roles). When you add a role route, add its `/basic` twin.

**RBAC chain (backend is the real guard):** `auth → allowRoles(...) → scopeGuard()`. Frontend `ProtectedRoute` + `ROLE_HOME` (in `config/roles.js`) mirror it but are **UX only** — never rely on them for security.

`ROLE_HOME`: super_admin→`/admin/dashboard`, dio→`/dio/dashboard`, secretary→`/secretary/trainees`, supervisor→`/supervisor/trainees`, program_director→`/program-director/trainees`, president→`/president/trainees`, trainee→`/timeline`, asg1/asg2→`/consultant-memo` (b_* = `/basic` + the same).

---

## 5. The DIO scope model — HOSPITAL → TRACK

The DIO is a **track‑wide overseer**: an advanced `dio` sees/manages/evaluates **every advanced‑track** user and record across **all hospitals**; a `b_dio` does the same within the Basic track. This was an explicit product decision.

What that means in `backend/routes/dio.js`:
- All list endpoints (`/trainees`, `/supervisors`, `/program-directors`, `/secretaries`, `/presidents`) query `role: coerceRoleToTrack(<role>, req.track)` with **no hospital filter**.
- Evaluations, trainee details, report grading, dashboard `/stats`, and certificates are all **track‑scoped** (`trackFilter(req.track)` for Rotation/Certificate; coerced role for users).
- Create/update/delete match the target by the **coerced role**, which is what enforces track isolation (a DIO can only touch users in its own track).
- The `president` shows on the DIO **Users** page as **view‑only** (no edit/deactivate/create).

There are dead helper functions left in `dio.js` from the old hospital model (`getDioHospitalOrFail`, `ensureDioCanAccessHospitalDoc`, `hospitalCondition`, `belongsToHospital`, `getHospital`, `addAnd`) — no longer called; safe to remove in a cleanup.

**Cross‑route track isolation:** the *shared* write routes block a DIO acting on the other track — `/api/hospitals` PUT/PATCH/DELETE and `/api/specialties` PATCH/upload (`ensureHospitalInTrack` / `ensureSpecialtyInTrack`), `/api/users` update/lock/delete (`blockCrossTrackWrite` + `hasHigherRole` compares **base** roles so `b_president` isn't rank 0), and `validateUserReferences` rejects a cross‑track `specialtyId`. **As of 2026‑07‑10** the `/api/specialties` *list* (GET) is also track‑filtered for every non‑`super_admin` caller (see §9).

---

## 5b. The Program Director scope model — HOSPITAL → SPECIALTY (2026‑07‑10)

Historically the Program Director was **hospital‑scoped** (one PD per hospital). As of this session the PD is **specialty‑scoped**: **each specialty has exactly one PD**, and a PD oversees that specialty across **every hospital that offers it** (an explicit product decision — "he can see all the hospitals that have his specialty").

Because the DB carries **duplicate same‑named `Specialty` rows** (one per hospital — see §9), scoping is done by specialty **NAME**, not a single `Specialty._id`:

- **`backend/utils/pdScope.js`** (new):
  - `specialtyIdsForName(specialtyId, track)` → `{ name, ids }` — every `Specialty._id` sharing the PD's specialty name within the track.
  - `specialtyUserMatch(info)` → Mongo fragment `{$or:[{specialtyId:{$in:ids}},{specialty:name}]}` (matches users across all per‑hospital rows, plus legacy string‑only docs).
  - `findPdForSpecialty(specialtyId, track, excludeId)` → enforces **one PD per specialty name per track**.
- **`backend/routes/programDirector.js`** — all list endpoints (`/trainees`, `/supervisors`, `/reports`, `/evaluations`) scope by the specialty name‑set; **403 "Program Director has no specialty assigned"** when the PD has none; the trainee‑role queries are now `coerceRoleToTrack('trainee', req.track)` (this also **fixed a latent bug** where `b_program_director` read Advanced‑track data). Report‑grade ownership is specialty‑checked.
- **`scopeGuard.js`** — `program_director` → `req.scope = { specialtyId }`.
- **Assignment + uniqueness** enforced on all three PD write paths: `dio.js` (create/update/reactivate — PD create now requires `specialtyId`, no longer requires a hospital), `secretary.js` (`POST /program-directors` stamps the secretary's own `specialtyId`), and generic `users.js` (create/update). A duplicate assignment returns **409**.
- **Frontend** — the DIO assigns a PD's specialty from **two** places: the standalone **DioProgramDirectors** management page (create/edit modal, Specialty selector replaces the Hospital selector) and the new **Assignments → Program Directors** tab (inline selector, see §6). The PD's own Trainees/Supervisors/Reports/Evaluations pages are already specialty‑oriented and need no data change.
- **Seeds** — `reseedProfessionalData.js` / `reseedBasicTrainingData.js` now give each seeded PD a distinct `specialtyId` (was `null`).

> Existing PDs seeded/created before this change have `specialtyId: null` and will hit the 403 until a DIO assigns them a specialty (now easy from the Assignments tab). See §9.

---

## 6. Subsystems (map)

- **Auth & tracks** — `middleware/auth.js`, `utils/track.js`, `config/roles.js`, `context/AuthContext.jsx`, `api/axios.js`.
- **Users management** — `routes/users.js` (generic, admin), `routes/dio.js` + `routes/secretary.js` (role‑scoped CRUD), pages `DioUsers.jsx`, `Users.jsx`, the various `*Trainees/*Supervisors` pages.
- **Program Directors** — specialty‑scoped (§5b). `routes/programDirector.js`, `utils/pdScope.js`; pages `ProgramDirectorTrainees/Supervisors/Reports/Evaluations.jsx`. Assignment UI in `DioProgramDirectors.jsx` (full management) and `DioAssignPds.jsx` (inline `ProgramDirectorsPanel` used by the Assignments tab).
- **Hospitals & specialties** — `routes/hospitals.js`, `routes/specialties.js`; pages `DioHospitals.jsx`, `DioHospitalDetail.jsx`, `SecretaryHospitals.jsx`, `HospitalsUniversities.jsx` (admin). `Specialty` has `hospitalId` + `secretaryId` + `track`. **GET `/api/specialties` is track‑filtered for non‑`super_admin`.**
- **Rotations & distributions** — `routes/rotations.js`, `routes/distributions.js`; `Rotation` = a trainee's placement over time, `Distribution` = a supervisor↔hospital/specialty assignment. DIO UI merged into `DioAssignments.jsx` (tabs: **Distribution / Rotation / Program Directors**).
- **Evaluations (WPBA)** — `data/evalForms.js` defines Mini‑CEX, CBD, DOPS, **MSF‑360 (A–E)**, Academic Supervisor Report, FITER (rating scale + domains). Shared UI in `components/evaluations/EvalModal.jsx`. Shared scoring/cap helpers in `utils/evalScoring.js`. Supervisors submit → finalize (`/api/supervisor/evaluations`); **the DIO and the PD both evaluate trainees *and* supervisors**, finalized‑on‑create:
  - DIO: `/api/dio/{trainees,supervisors}/:id/evaluations`, list via `/api/dio/evaluations` (author‑scoped, both subject types).
  - PD (2026‑07‑10): `/api/program-director/{trainees,supervisors}/:id/evaluations` **scoped to the PD's specialty**, list via `/api/program-director/evaluations` (author‑scoped, both subject types). UI: `ProgramDirectorEvaluations.jsx` (Trainees|Supervisors toggle) reusing `EvalModal`.
  - The `Evaluation` model uses `student`/`traineeId` plus `evaluateeId`/`evaluateeRole` ('trainee'|'supervisor') so supervisor‑subject evals never pollute trainee queries (`traineeId` left null). `evaluatorRole`/`createdByRole` are free strings (`'dio'`, `'program_director'`, `'supervisor'`, `'super_admin'`). WPBA forms are capped at one per evaluator per subject per calendar month.
- **Reports & grading** — `routes/reports.js`, `Report` model (weekly/monthly/final). Supervisors grade weekly/monthly; program directors grade final (specialty‑scoped); the DIO can grade/override any in its track.
- **Certificates** — `routes/certificates.js` + DIO cert endpoints + `routes/certificateVerify.js` (public `GET /api/certificates/verify/:code`). Pages `DioCertificates.jsx`, `CertificatePrint.jsx`, `VerifyCertificate.jsx`.
- **Consultant Memo** — ASG.1/ASG.2 only. `routes/consultantMemo.js`, `ConsultantMemo` model, UI under `components/memo/` + `ConsultantMemo*.jsx`. Own AR/EN toggle (`cm-lang`).
- **Initiatives** — ASG‑gated 3‑stage Kanban approval pipeline. `routes/initiatives.js`, `Initiative` model, `Initiatives.jsx`, `middleware/requireInitiativeAccess.js`.
- **Scientific Councils** — `routes/scientificCouncils.js` + Arabic normalization util.
- **Landing page** — `frontend/landing.html` (static, served at `/`, outside React). Its **Training Tracks** section pairs each track card with its program PDF (Basic doc on the left, Advanced doc on the right; each stacks under its card ≤1024px). PDFs live in `frontend/public/track-documents/`.
- **Dashboards** — one per role; DIO dashboard is track‑scoped stats + charts.
- **Security** — `rateLimiter.js`, `honeypot.js`, `securityEventLogger.js` + `SecurityEvent` model, `AuditLog` (write‑method logging), `adminV2.js` audit endpoints.

---

## 7. Backend conventions

- **Route module shape:** `router.<verb>(path, auth, allowRoles(...ROLES), [auditLog(...)], handler)`. Roles are lists of constants at the top of each file.
- **Scoping:** prefer `coerceRoleToTrack(role, req.track)` for any user role query and `trackFilter(req.track)` for `Hospital`/`Specialty`/`Rotation`/`Certificate`. For Program‑Director data use `utils/pdScope.js`. `super_admin` bypasses scoping.
- **Field allow‑lists:** every create/update `pick(body, ALLOWED_FIELDS)` — never spread `req.body` into a model.
- **Responses:** mostly `{ success: true, data }`; some legacy endpoints return the bare object/array. Frontend defensively reads `res.data?.data || res.data`.
- **Legacy dual fields:** several refs exist under two names (`hospitalId`/`hospital`, `supervisorId`/`doctor`, `traineeId`/`student`, `specialtyId`/`specialty`) — handlers accept/populate both. Keep writing both when you add data.
- **Audit + notify:** mutations write an `AuditLog` entry and often a `Notification` to the affected user.
- **Shared helpers over duplication:** eval scoring/WPBA logic now lives once in `utils/evalScoring.js` (imported by `dio.js` and `programDirector.js`) — don't re‑introduce local copies.

## Frontend conventions

- Pages render `<Navbar/>` + `<main className="admin-main">`. Reuse `admin-card`, `admin-toolbar`, `admin-table`, `filter-tabs`, `btn-purple/outline/red`, `btn-action` (+`.view/.edit/.delete/.revoke/.print`), stat cards, `management-card-grid`, `ViewToggle`, `SearchableSelect`, `Toast`, `Skeleton (Sk)`.
- **Tabbed pages** (e.g. `DioAssignments.jsx`) render only the active panel, keyed by tab for a crossfade. Each tab body is a named `…Panel` export that renders its own card **without** a `Navbar`/`main` (the container provides those) — see `DioAssignPds.jsx`'s `ProgramDirectorsPanel`.
- **Motion** follows the `web-animation-design` rules: `transform`/`opacity` only, <300 ms, ease‑out entrances; a global `@media (prefers-reduced-motion: reduce)` in `index.css` neutralizes all of it. New nav labels need entries in **both** `ar` and `en` in `i18n/strings/nav.js` (keyed `nav.<baseRole>.<key>`; the `MIRRORED` map reuses them for `b_*`).
- Brand: primary `#1B1464`, accent `#FF6B35`, link `#185FA5`, specialty chip `#EEEDFE`/`#3C3489`.

---

## 8. Change history (newest → oldest)

All on `main`, pushed.

### Session 2026‑07‑10

| Commit | Change |
|--------|--------|
| `e07eb61` | **PD evaluations page + DIO PD‑to‑specialty assignment tab.** New `ProgramDirectorEvaluations.jsx` (evaluate trainees *and* supervisors, reuses `EvalModal`), backend `POST /api/program-director/{trainees,supervisors}/:id/evaluations` (specialty‑scoped) + author‑scoped `GET /evaluations`; new `utils/evalScoring.js` (shared WPBA helpers, `dio.js` refactored to use it); new `DioAssignPds.jsx` `ProgramDirectorsPanel` as a 3rd **Assignments** tab (inline specialty assign, surfaces the 409). Fixed a confirmed bug: `GET /api/specialties` now **track‑filters for non‑super_admin** (a DIO could otherwise be offered an other‑track specialty and the assign PATCH would 400). |
| `d4c78f0` | **Program Director → specialty‑scoped** (was hospital‑scoped). New `utils/pdScope.js` (name‑set scope + one‑PD‑per‑specialty); rewrote `programDirector.js`; `scopeGuard.js` → `{specialtyId}`; assignment + 409 uniqueness on `dio.js`/`secretary.js`/`users.js`; DIO PD form assigns a Specialty (not a Hospital); seeds give each PD a specialty. Also fixed `b_program_director` reading Advanced data (missing role coercion). |
| `2a259cc` | **Landing page: program documents in Training Tracks.** Basic doc (`Medical_Internship_Program.pdf`) left of its card, Advanced doc (`Specialty_Training_Guide_General_Model_EN.pdf`) right of its card; each stacks under its card ≤1024px. PDFs in `frontend/public/track-documents/` with View/Download (AR/EN). |

### Earlier (prior session)

| Commit | Change |
|--------|--------|
| `41144ae` | Added this HANDOFF.md |
| `8bdb97e` | Removed the "Basic Training" navbar badge |
| `7e6db97` | Fixed **secretary** endpoints for the Basic track (coerce role queries by `req.track`) |
| `c52e00c` | De‑duplicate specialties per hospital in the DIO views (key by name) |
| `747a28b` | Per‑hospital **detail page** for the DIO (`/dio/hospitals/:id`) |
| `7a2b653` | DIO + secretary can add/edit hospitals (track‑scoped); cross‑track write guards |
| `26f1bdf` | DIO **Hospitals** overview page |
| `2d3735d` | **DIO became a track‑wide overseer** (hospital→track scoping) + president view‑only on Users |
| `4e978d3` | DIO dashboard overhaul (merged Users, Assignments tabs, DIO Evaluations, shared `EvalModal`) |

Earlier still: `43d5dcb`/`a9891a7` made the WPBA forms interactive (incl. MSF‑360 A–E, FITER); `6dbc584` introduced the parallel Basic‑Training portal and the `b_*` roles.

---

## 9. Known issues & follow‑ups

- **Existing PDs have no specialty → 403.** Any Program Director created before 2026‑07‑10 has `specialtyId: null` and will get **403 "Program Director has no specialty assigned"** on every PD page (and won't appear specialty‑scoped) until a DIO assigns them a specialty via **Assignments → Program Directors** (or the DioProgramDirectors edit modal). A safe `DRY_RUN`‑gated backfill script that assigns one distinct specialty per PD is a good next task. Fresh seeds already handle this.
- **Duplicate `Specialty` records** exist in the DB (multiple same‑named specialties per hospital, from seeding). The DIO UI de‑dupes them **by name for display**; PD scoping is deliberately **name‑based** so it works despite the duplicates. A `DRY_RUN`‑first cleanup (report → delete only on `CONFIRM_*`, keeping the row that has a secretary/assignments) remains a good next task.
- **`/api/specialties` list is now track‑filtered for non‑`super_admin`.** This also fixed a latent leak (a `b_dio`/`b_secretary` previously saw Advanced specialties in dropdowns). If a non‑admin page ever legitimately needs cross‑track specialties, it must special‑case that — the default is now own‑track only.
- **Dead code** in `dio.js` — the old hospital‑scope helpers (§5) are unused; remove in a cleanup pass.
- **No test suite / no local DB.** There is no automated e2e, and the current environment has **no local Mongo or Docker**, so live authed flows (PD evaluate, DIO assign) were verified structurally (build + assembly + mock‑based logic tests + a multi‑agent adversarial review) but **not** end‑to‑end against a database. Adding Playwright login/role‑redirect smoke tests + a few backend route tests against a throwaway Mongo is the highest‑value next investment.
- **`hospitals`/`specialties` write routes** are shared with `super_admin`; any *new* shared endpoint that admits `dio`/`program_director` must add the same track / specialty guards.
- **`getSecretaryHospitalIds`** matches hospitals by specialty‑name; it is track‑filtered but the name‑match is inherently fuzzy — prefer the `Specialty.hospitalId` link where possible.

---

## 10. Errors & warnings seen this session

None of these block build or deploy; they are recorded so the next person isn't surprised.

- **Vite build warning (persistent, benign):** `Some chunks are larger than 500 kB after minification` — the app JS bundle is ~1.47 MB (~387 kB gzip). It builds fine; if you want to silence/fix it, code‑split with dynamic `import()` or raise `build.chunkSizeWarningLimit` in `frontend/vite.config.js`.
- **Git line‑ending warnings (Windows, benign):** `LF will be replaced by CRLF the next time Git touches it` on staged files. Cosmetic; no `.gitattributes` is enforced. Adding one (`* text=auto eol=lf`) would silence it if desired.
- **Adversarial review — 1 confirmed bug, fixed:** the `GET /api/specialties` track leak described above was caught by the review and fixed in `e07eb61`. The other two review dimensions (backend correctness/security, routing/nav) found nothing that survived verification.
- **Live DB / browser E2E not run:** see §9 — no local Mongo/Docker; production DB must not be used for tests.
- **Untracked in the working tree (intentional, not committed):** `graphify-out/` (~3 MB generated knowledge graph — candidate for `.gitignore`) and the two root‑level source PDFs `Medical_Internship_Program.pdf` / `Specialty_Training_Guide_General_Model_EN.pdf` (the served copies live in `frontend/public/track-documents/`).

---

## 11. Safety rules (do not violate)

- Never print, commit, or expose secrets from `.env` / `backend/.env` (Mongo URI, JWT secrets, cookies, tokens). If found, report only the path and say it must be rotated.
- No destructive DB changes without explicit approval. Seed/migration/fixup scripts are gated behind `DRY_RUN` / `CONFIRM_*` — keep them safe.
- Don't remove existing features or rename files/routes/roles/DB fields unless the task requires it.
- The backend enforces permissions; frontend guards mirror it for UX only.
- Treat all medical/user data as sensitive — privacy, access control, auditability first.

---

## 12. The knowledge graph (optional, for orientation)

`graphify-out/` holds a generated knowledge graph of the repo (run: `/graphify .`): `graph.html` (interactive), `graph.json` (GraphRAG‑ready), `GRAPH_REPORT.md` (communities, god nodes, hyperedges, suggested questions). It's a navigational aid, not source — it can be regenerated (`--update`), is currently untracked, and is a candidate for `.gitignore`. "God nodes" (most‑connected): `api` (axios), `Navbar()`, `useAuth()`, `Skeleton()`, `Toast()`, `allowRoles()`, `usePrefs()`, `ViewToggle()`, `useBasePath()` — start there to understand the cross‑cutting structure, and note `allowRoles()` is the RBAC chokepoint bridging nearly every backend route.
