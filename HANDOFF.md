# MTMS / MLMS — Project Handoff

_Medical Training Management System. Last updated: 2026-07-12._

This is a working handoff for anyone (human or agent) picking up the codebase. It covers the architecture, the two‑portal role model, the subsystems, how to build/test/deploy, the significant recent changes, and the open follow‑ups. Read the **Role & Track model**, the **DIO scope**, and the **Program Director scope** sections first — they drive most of the access‑control logic. The newest work (trainee portfolio, the multi‑stage research‑approval pipeline with signatures, and the secretary→DIO "Promotions" approval queue) is described in **§5c**.

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
- **There is no automated e2e/unit suite** in the repo (`test:e2e:trainee` referenced in older docs/CLAUDE.md does not exist). Verification today =
  - `npm run deploy:check` (build + `node --check`),
  - `MONGO_URI=… JWT_SECRET=… JWT_REFRESH_SECRET=… node -e "require('./backend/server.js')"` — a fast, **DB‑free** sanity check that assembles the whole Express app (mounts every route, `require`s every model) **without** connecting to Mongo (it only connects when run as `require.main`). Dummy env values are fine; this catches route/model syntax + require‑graph errors across the whole tree.
  - `node --check <file>` per changed backend file,
  - a manual login/role‑redirect click‑through,
  - and, for correctness, a **multi‑agent adversarial review** of the diff (this session caught 2 real access‑control bugs — see §10).
- **No local Mongo or Docker is installed in the current dev environment**, so live DB / browser end‑to‑end testing of authed flows could not be run this session. **Never boot the backend against the production DB for a "test."** Use a local/non‑prod Mongo. Never commit `.env` / secrets.

---

## 3. Repo layout

```
backend/
  server.js                 route mounting + global middleware (helmet, rate limits, honeypot, error handler)
  middleware/
    auth.js                 verifies JWT, normalizes b_* → base role, sets req.track, refresh-cookie fallback
    roles.js                allowRoles(...roles) factory (403 on mismatch)
    scopeGuard.js           attaches req.scope per role (data isolation helper)
    auditLogger.js          writes AuditLog entries
    rateLimiter.js, honeypot.js, securityEventLogger.js, requireInitiativeAccess.js
  models/                   Mongoose schemas (User, Hospital, Specialty, Rotation, Distribution,
                            Evaluation, Report, Certificate, Notification, AuditLog, Initiative,
                            ConsultantMemo, ScientificCouncil, SecurityEvent, University,
                            TraineeCourse, Research, ChangeRequest)   ← last three added 2026-07-11/12
  routes/                   auth, users, hospitals, specialties, distributions, rotations, reports,
                            evaluations, notifications, certificates, certificateVerify, dashboard,
                            dio, supervisor, programDirector, secretary, president, trainee, adminV2,
                            consultantMemo, scientificCouncils, initiatives, universities,
                            traineeCourses, research   ← last two added 2026-07-11
  utils/
    track.js                coerceRoleToTrack, trackFilter, trackForRole, baseRole, isBasicRole
    pdScope.js              Program-Director specialty scoping (name-set) + one-PD-per-specialty
    evalScoring.js          shared eval helpers: averageScore, WPBA_FORMS, isWpbaForm, wpbaAlreadyThisMonth
    filename.js             decodeOriginalName / contentDisposition (Arabic-safe uploads)
    applyChangeRequest.js   (NEW) applies an approved secretary ChangeRequest, re-validating refs
  migrations/, seeds/, scripts/ (reseed, fixups — gated by DRY_RUN / CONFIRM_* flags)

frontend/
  landing.html              public marketing/login landing page (served at '/'; NOT a React route)
  public/track-documents/   program PDFs served at /track-documents/*
  public/evaluation-forms/   WPBA form .docx files served at /evaluation-forms/*
  src/
    App.jsx                 ALL routes (advanced + /basic mirror) + RootRedirect + LegacyTraineeRedirect
    config/roles.js         ROLE_HOME, ROLE_LINKS (nav), MIRRORED map, track helpers (single source of truth)
    api/axios.js            axios instance (adds Bearer, handles X-New-Access-Token, refresh, 20s GET cache)
    context/AuthContext.jsx user/session; PrefsContext.jsx  theme/lang
    hooks/useBasePath.js    '' for advanced, '/basic' for b_* roles — prefix all intra-app nav with this
    components/             Navbar, ProtectedRoute, ErrorBoundary, Toast, Skeleton, ViewToggle,
                            SearchableSelect, NotificationPanel, icons.jsx, evaluations/EvalModal.jsx
    data/evalForms.js       WPBA form definitions (Mini-CEX, CBD, DOPS, MSF-360 A–E, ASR, FITER)
    i18n/                   strings + resolver (dict[lang][key] ?? dict.ar[key] ?? key)
    pages/                  one file per screen. Trainee: Timeline, Reports, Grades(=Portfolio),
                            CertificatesCourses, Research, Notifications. Supervisor: SupervisorTrainees,
                            SupervisorReports, SupervisorEvaluations, SupervisorResearch. Secretary:
                            SecretaryTrainees/Supervisors/Hospitals/Research. DIO: DioUsers, DioApprovals,
                            DioTraineeDetail, DioAssignments, DioEvaluations, DioCertificates, … (Dio*),
                            plus President*, ProgramDirector*, Admin*, memo, initiatives

docs/api-contract.md, README.md, AGENTS.md, .claude/ (skills), graphify-out/ (knowledge graph, generated/untracked)
```

---

## 4. Role & Track model (read this)

**Roles** (`User.role` enum): `trainee, supervisor, program_director, secretary, dio, president, super_admin, asg1, asg2` — plus the **Basic‑track mirrors** `b_trainee, b_supervisor, b_program_director, b_secretary, b_dio, b_president`.

**Two portals / tracks.** There is one Advanced portal and one Basic‑Training portal. **The Basic portal reuses the exact same page components** under a `/basic/*` URL prefix — there is *no* duplicated UI. What differs is only the URL and the role.

How the mirroring works end‑to‑end:
- **auth.js** normalizes a `b_*` role to its base (`b_dio` → `dio`) for all downstream role checks, and sets **`req.track`** (`'basic'` or `'advanced'`). So every `req.user.role === 'dio'` check also fires for a `b_dio`; the *track* difference lives in `req.track`.
- **`utils/track.js`** — `coerceRoleToTrack(role, track)` turns a base role into its track‑correct DB role (`coerceRoleToTrack('trainee','basic') === 'b_trainee'`); `trackFilter(track)` is a Mongo fragment (`{track:'basic'}` or `{track:{$ne:'basic'}}` — the latter also matches legacy docs with no `track`). `User`, `Hospital`, `Specialty`, `Rotation`, `Certificate`, `Evaluation`, and the new `TraineeCourse`/`Research`/`ChangeRequest` all carry a `track` field.
- **Frontend** — `config/roles.js` builds `ROLE_LINKS['b_dio']` by prefixing `/basic` onto the advanced DIO links (the `MIRRORED` map). `useBasePath()` returns `''` or `'/basic'`; **all intra‑app navigation must prefix it** or a `b_*` user gets bounced to the Advanced portal.
- **App.jsx** — every `/dio/*` route has an exact `/basic/dio/*` twin (same for the other roles). When you add a role route, add its `/basic` twin **and** the `nav.<baseRole>.<key>` string in **both** `ar` and `en`.

**RBAC chain (backend is the real guard):** `auth → allowRoles(...) → scopeGuard()`. Frontend `ProtectedRoute` + `ROLE_HOME` (in `config/roles.js`) mirror it but are **UX only** — never rely on them for security.

`ROLE_HOME`: super_admin→`/admin/dashboard`, dio→`/dio/dashboard`, secretary→`/secretary/trainees`, supervisor→`/supervisor/trainees`, program_director→`/program-director/trainees`, president→`/president/trainees`, trainee→`/timeline`, asg1/asg2→`/consultant-memo` (b_* = `/basic` + the same).

---

## 5. The DIO scope model — HOSPITAL → TRACK

The DIO is a **track‑wide overseer**: an advanced `dio` sees/manages/evaluates **every advanced‑track** user and record across **all hospitals**; a `b_dio` does the same within the Basic track.

What that means in `backend/routes/dio.js`:
- All list endpoints (`/trainees`, `/supervisors`, `/program-directors`, `/secretaries`, `/presidents`) query `role: coerceRoleToTrack(<role>, req.track)` with **no hospital filter**.
- Evaluations, trainee details, report grading, dashboard `/stats`, certificates, and the new **change‑request (Promotions)** endpoints are all **track‑scoped** (`trackFilter(req.track)`; coerced role for users).
- Create/update/delete match the target by the **coerced role**, which enforces track isolation.
- The `president` shows on the DIO **Users** page as **view‑only**.

**DIO Users is the single management surface (2026‑07‑11).** The old `/dio/trainees` list page was removed; the DIO reaches trainees through **`/dio/users`** (`DioUsers.jsx`, which lists trainees + supervisors + PDs + secretaries + presidents). The trainee **card** now lives at **`/dio/users/:id`** (`DioTraineeDetail.jsx`); the legacy `/dio/trainees` and `/dio/trainees/:id` routes are kept only as backward‑compat redirects (`LegacyTraineeRedirect` in `App.jsx`). A **supervisor's card** (the read‑only modal in `DioUsers`) now lists that supervisor's **assigned trainees** and lets the DIO click one to view the trainee's card **in the same panel** (data from `GET /api/dio/supervisors/trainees-map`).

Note: several dead hospital‑era helpers remain in `dio.js` (`getDioHospitalOrFail`, `ensureDioCanAccessHospitalDoc`, `hospitalCondition`, `belongsToHospital`, `getHospital`, `addAnd`) — unused, safe to remove in a cleanup.

---

## 5b. The Program Director scope model — HOSPITAL → SPECIALTY

The PD is **specialty‑scoped**: **each specialty has exactly one PD**, and a PD oversees that specialty across **every hospital that offers it**. Because the DB carries **duplicate same‑named `Specialty` rows** (one per hospital — see §9), scoping is by specialty **NAME**, not a single `_id`:

- **`backend/utils/pdScope.js`**: `specialtyIdsForName(specialtyId, track)` → `{name, ids}`; `specialtyUserMatch(info)` → `{$or:[{specialtyId:{$in:ids}},{specialty:name}]}`; `findPdForSpecialty(...)` enforces one PD per specialty name per track.
- **`backend/routes/programDirector.js`** — all list endpoints scope by the specialty name‑set; **403** when the PD has no specialty; trainee queries use `coerceRoleToTrack('trainee', req.track)`.
- **`scopeGuard.js`** — `program_director` → `req.scope = { specialtyId }`.
- Uniqueness (409) enforced on all PD write paths (`dio.js`, `secretary.js`, `users.js`). The DIO assigns a PD's specialty from **DioProgramDirectors** and the **Assignments → Program Directors** tab.

> PDs created before the specialty change have `specialtyId: null` and hit the 403 until a DIO assigns a specialty. See §9.

---

## 5c. Trainee assignment, portfolio & the research‑approval pipeline (2026‑07‑11/12)

This is the newest subsystem cluster. Four related features:

### (a) Required trainee assignment + separate research supervisor
- A trainee **must** be assigned a **clinical supervisor** (`User.supervisorId`), a **hospital**, and a **specialty**. Enforced on create by both `dio.js` (`requiredFieldsForRole('trainee')` now includes `supervisorId`) and `secretary.js` (must be a supervisor **in the secretary's specialty**). Edits may **change** the supervisor but never **clear** it.
- A trainee may also have a separate **research supervisor** (`User.researchSupervisorId`, optional). Research routing prefers it and falls back to the clinical/rotation supervisor (`research.js resolveSupervisorId`). The research supervisor counts as "assigned" (`getAssignedTraineeIds`) so they can review that trainee's research even if not the rotation supervisor.
- Forms: `DioUsers.jsx` (Supervisor* + Research Supervisor searchable selects, filtered by chosen hospital/specialty) and `SecretaryTrainees.jsx`.

### (b) Trainee portfolio pages
- **Certificates & Courses** (`/certificates-courses`, `CertificatesCourses.jsx`) — the trainee self‑uploads courses/certificates. Backend: `TraineeCourse` model + `routes/traineeCourses.js` (trainee upload/list/delete own; staff read by `traineeId`). Multer under `backend/uploads/trainee-courses`. Surfaced (read‑only) on the Supervisor/PD/DIO trainee cards.
- **Researches & Publications** (`/research`, `Research.jsx`) — submit research → approval pipeline (below) → **Publications**, where the trainee sets each publication **Public** or **Private**.
- **PD Notifications** (`/notifications`, `Notifications.jsx`) — shows notifications from Program Directors. `Notification` gained an optional **`category`** field; PD→trainee notices are tagged `category:'program_director'` and the page filters on it (with a message‑text fallback for legacy notices).
- The trainee navbar label **"Grades" was renamed to "Portfolio"** (label + i18n only; the route stays `/grades`).

### (c) Multi‑stage research approval with a typed signature
`Research` model status machine:

```
pending ──research supervisor Approve & Sign──▶ supervisor_approved
        ──secretary Forward──▶ forwarded_dio ──DIO Final‑approve──▶ approved (= published)
        └── rejected (terminal; rejectedAtStage = supervisor|secretary|dio)
```

- **Signature = typed name + identity + server timestamp** (no image). On approve, `research.js` records on the doc: `signedBy` (the JWT user id — not client‑supplied), `signedByName` (name snapshot), `signatureName` (the typed text), `signedAt` (server clock); it also writes an `AuditLog` row (`research_sign_approve`). Everywhere the research appears it renders a "/s/ <name>" cursive block with "Signed by … · <date>". The authoritative record lives on the Research doc (the AuditLog has a 180‑day TTL).
- Endpoints (`routes/research.js`): `POST /` (submit), `GET /mine`, `PATCH /:id/visibility` (only when `approved`), `DELETE /:id`; `PATCH /:id/approve` (supervisor sign), `/:id/forward` (secretary), `/:id/final-approve` (DIO), `/:id/reject` (stage‑aware), `GET /queue` (role‑switched pending items), `GET /supervisor` (all research for the supervisor's trainees), `GET /trainee/:traineeId` (staff view; PD/DIO/president see **approved + public only**, the supervisor sees all their trainee's, incl. private).
- **Visibility rule:** a **private** publication is visible to the trainee and their (current) supervisor only; **public** adds PDs and DIOs.
- Frontend surfaces:
  - **`SupervisorResearch.jsx`** (`/supervisor/research`, nav "Research") — the dedicated place a supervisor **sees & signs**: an "Awaiting your signature" section (Approve & Sign modal with a live "/s/" preview / Reject) + a read‑only history of all their trainees' research with status chips.
  - **`SecretaryResearch.jsx`** (`/secretary/research`, nav "Research") — the secretary forwards signed research to the DIO (or rejects).
  - **`DioApprovals.jsx`** "Research" tab — the DIO final‑approves (publishes) or rejects.
  - **`Research.jsx`** (trainee) — a 4‑step progress stepper (Supervisor → Secretary → DIO → Published) + public/private toggle on publications.
  - The Supervisor/PD/DIO **trainee cards** also show that trainee's publications.

### (d) Secretary account edits → DIO "Promotions" approval (queued)
- When a secretary edits a **trainee or supervisor account**, the change is **not applied**; it becomes a pending `ChangeRequest` (secretary `PATCH /trainees|/supervisors` respond **`202 { pending:true }`** instead of writing). **Only account edits** queue — creates and deactivations still apply immediately (deactivation goes through `DELETE /api/users/:id`, outside `secretary.js`).
- The DIO reviews them in **`DioApprovals.jsx`** (nav **"Promotions"**, `/dio/approvals`), "Account Changes" tab: a field‑by‑field diff (resolved names) with Approve / Reject. Approving runs `utils/applyChangeRequest.js`, which **re‑validates** references (supervisor still in the specialty; a trainee can't be left supervisor‑less) and applies only the allow‑listed fields via `findByIdAndUpdate`. Endpoints: `dio.js` `GET/PATCH .../change-requests` (track‑scoped, audit‑logged); `secretary.js` `GET /change-requests` + `PATCH .../cancel`.
- **One pending request per account** — enforced by a partial‑unique index on `ChangeRequest` (`{targetId}` where `status:'pending'`) with an app‑level pre‑check; the E11000 surfaces as a 409.
- `DioApprovals` is one page with two tabs (**Account Changes** + **Research**) under the single "Promotions" nav link.

**Access‑control notes for this cluster** (all backend‑enforced):
- `getAssignedTraineeIds` (research) keys off `supervisorId` + `researchSupervisorId` + **current/upcoming** rotations + **non‑inactive** distributions — a former/completed/deactivated supervisor loses access to a trainee's private publications and approval authority.
- The change‑request path folds the legacy `supervisor` alias into `supervisorId` and specialty‑validates it, so a secretary can't smuggle an arbitrary out‑of‑specialty supervisor into an account.

---

## 6. Subsystems (map)

- **Auth & tracks** — `middleware/auth.js`, `utils/track.js`, `config/roles.js`, `context/AuthContext.jsx`, `api/axios.js`.
- **Users management** — `routes/users.js` (generic, admin), `routes/dio.js` + `routes/secretary.js` (role‑scoped CRUD; secretary account **edits** now queue via `ChangeRequest` — §5c(d)), pages `DioUsers.jsx` (unified DIO users + supervisor→trainees panel), `Users.jsx`, the `*Trainees/*Supervisors` pages.
- **Trainee portfolio & research** — §5c. Models `TraineeCourse`, `Research`; routes `traineeCourses.js`, `research.js`; pages `CertificatesCourses.jsx`, `Research.jsx`, `Notifications.jsx`, `SupervisorResearch.jsx`, `SecretaryResearch.jsx`, and the Research tab of `DioApprovals.jsx`.
- **Promotions (secretary‑edit approval)** — §5c(d). `ChangeRequest` model, `utils/applyChangeRequest.js`, `dio.js` change‑request endpoints, `DioApprovals.jsx`.
- **Program Directors** — specialty‑scoped (§5b). `routes/programDirector.js`, `utils/pdScope.js`; pages `ProgramDirectorTrainees/Supervisors/Reports/Evaluations.jsx`. Assignment UI in `DioProgramDirectors.jsx` + `DioAssignPds.jsx` (`ProgramDirectorsPanel`).
- **Hospitals & specialties** — `routes/hospitals.js`, `routes/specialties.js`; pages `DioHospitals.jsx`, `DioHospitalDetail.jsx`, `SecretaryHospitals.jsx`, `HospitalsUniversities.jsx`. **GET `/api/specialties` is track‑filtered for non‑`super_admin`.**
- **Rotations & distributions** — `routes/rotations.js`, `routes/distributions.js`; DIO UI in `DioAssignments.jsx` (tabs Distribution / Rotation / Program Directors).
- **Evaluations (WPBA)** — `data/evalForms.js`, `components/evaluations/EvalModal.jsx`, `utils/evalScoring.js`. DIO and PD both evaluate trainees *and* supervisors (finalized‑on‑create). `Evaluation` uses `evaluateeId`/`evaluateeRole` so supervisor‑subject evals never pollute trainee queries.
- **Reports & grading** — `routes/reports.js`, `Report` model (weekly/monthly/final).
- **Certificates** — `routes/certificates.js` + DIO cert endpoints + `routes/certificateVerify.js` (public verify). Distinct from the trainee‑uploaded `TraineeCourse`.
- **Consultant Memo / Initiatives / Scientific Councils** — ASG‑gated subsystems, unchanged.
- **Notifications** — `Notification` model (now with `category`), `routes/notifications.js`, `NotificationPanel.jsx` bell; the Navbar `notifLink` heuristic routes a click to the right page per role (extended for research/promotions).
- **Landing page** — `frontend/landing.html` (static, served at `/`).
- **Security** — `rateLimiter.js`, `honeypot.js`, `securityEventLogger.js` + `SecurityEvent`, `AuditLog`, `adminV2.js`.

---

## 7. Backend conventions

- **Route module shape:** `router.<verb>(path, auth, allowRoles(...ROLES), [auditLog(...)], handler)`.
- **Scoping:** `coerceRoleToTrack(role, req.track)` for user role queries; `trackFilter(req.track)` for `Hospital`/`Specialty`/`Rotation`/`Certificate`/`ChangeRequest`; `utils/pdScope.js` for PD data. `super_admin` bypasses scoping.
- **Field allow‑lists:** every create/update `pick(body, ALLOWED_FIELDS)` — never spread `req.body`. The secretary→ChangeRequest path only stores allow‑listed fields, and `applyChangeRequest` re‑validates refs before writing.
- **Uploads:** multer disk storage into a per‑feature subfolder under `backend/uploads/…`; store the `/uploads/…` path string on the model; validate **extension AND mimetype**; `/uploads` is auth‑gated globally (`server.js`). Use `utils/filename.js` for Arabic‑safe original names.
- **Responses:** mostly `{ success: true, data }`; frontend reads `res.data?.data || res.data`. Queued secretary edits return **`202 { success:true, pending:true, data:changeRequest }`**.
- **Legacy dual fields:** `hospitalId`/`hospital`, `supervisorId`/`doctor`/`supervisor`, `traineeId`/`student`, `specialtyId`/`specialty` — accept/populate/keep writing both.
- **Audit + notify:** mutations write an `AuditLog` entry and often a `Notification` (with `category`) to the affected user(s).

## Frontend conventions

- Pages render `<Navbar/>` + `<main className="admin-main">` (or `"main"` for trainee pages). Reuse `admin-card`, `admin-toolbar`, `admin-table`, `filter-tabs`, `btn-purple/outline/red`, `btn-action`, stat cards, `management-card-grid`, `ViewToggle`, `SearchableSelect`, `Toast`, `Skeleton (Sk)`, `card`/`card-title`, `badge`.
- **Tabbed pages** (`DioAssignments.jsx`, `DioApprovals.jsx`) render only the active panel.
- **Motion** follows `web-animation-design`: `transform`/`opacity` only, <300 ms; global `prefers-reduced-motion` reset in `index.css`. New nav labels need **both** `ar` and `en` in `i18n/strings/nav.js` (keyed `nav.<baseRole>.<key>`).
- Brand: primary `#1B1464`, accent `#FF6B35`, link `#185FA5`, specialty chip `#EEEDFE`/`#3C3489`.

---

## 8. Change history (newest → oldest)

All on `main`, pushed.

### Session 2026‑07‑11 / 2026‑07‑12 — trainee portfolio, research pipeline, secretary approvals

| Commit | Change |
|--------|--------|
| `0325ea1` | **Dedicated Supervisor "Research" page** (`SupervisorResearch.jsx`, nav "Research"): "Awaiting your signature" (Approve & Sign / Reject) + read‑only history of all the supervisor's trainees' research. Backend `GET /api/research/supervisor`. Removed the redundant sign queue from `SupervisorTrainees.jsx`. |
| `2269b32` | **Access‑control hardening (adversarial‑review fixes):** research `getAssignedTraineeIds` excludes deactivated distributions (former supervisor loses access to private publications); the legacy `supervisor` alias is folded into `supervisorId` and specialty‑validated in the change‑request path; `ChangeRequest` partial‑unique index (one pending per account) + E11000→409. |
| `e630057` | **Secretary account edits → DIO "Promotions" approval (queued).** New `ChangeRequest` model + `utils/applyChangeRequest.js`; secretary `PATCH /trainees|/supervisors` queue a pending request (`202 pending`) instead of writing; DIO `GET/approve/reject /change-requests` (track‑scoped, audit‑logged, validated applier); `DioApprovals.jsx` "Account Changes" tab; secretary "sent for approval" UX. Creates/deactivations stay immediate. |
| `7bb332d` | **Multi‑stage research approval with typed supervisor signature.** `Research` statuses `pending → supervisor_approved → forwarded_dio → approved/rejected`; endpoints approve(sign)/forward/final‑approve/stage‑reject/`/queue`; typed‑name signature (`signedBy`/`signedByName`/`signatureName`/`signedAt` + AuditLog); notifications to trainee/secretaries/DIOs. Frontend: `SupervisorTrainees` sign modal, new `SecretaryResearch.jsx`, new `DioApprovals.jsx` (nav "Promotions", Research tab), `Research.jsx` stepper. |
| `ee8638c` | **Trainee supervisor assignments.** Trainee create **requires** `supervisorId`; new optional `User.researchSupervisorId` (research routes to it first); DIO + secretary forms + validation; research supervisor counts as "assigned". |
| `632309a` | **DIO supervisor card lists assigned trainees** (from `/api/dio/supervisors/trainees-map`); clicking one swaps the same panel to the trainee's card with a Back button (`DioUsers.jsx`). |
| `b7f2f35` | **Trainee portfolio pages:** Certificates & Courses (`TraineeCourse` + `traineeCourses.js`, surfaced on staff trainee cards); Researches & Publications (first version) with public/private visibility; **"Grades" → "Portfolio"** nav rename; **PD Notifications** page (+ `Notification.category`); **DIO trainee card moved to `/dio/users/:id`** (old `/dio/trainees` routes redirect; `DioTrainees.jsx` removed). |

### Session 2026‑07‑10 — Program Director specialty scoping

| Commit | Change |
|--------|--------|
| `a570358` | Fix DIO access‑denied on trainee card: scope rotations by track not hospital. |
| `e996aec` | Navbar overlap, DIO certificate access, dark‑theme visibility, supervisor/trainee cards, evaluations cleanup. |
| `e07eb61` | **PD evaluations page + DIO PD‑to‑specialty assignment tab.** New `ProgramDirectorEvaluations.jsx`; `POST /api/program-director/{trainees,supervisors}/:id/evaluations` (specialty‑scoped); new `utils/evalScoring.js`; `DioAssignPds.jsx` `ProgramDirectorsPanel`. Fixed: `GET /api/specialties` now track‑filters for non‑super_admin. |
| `d4c78f0` | **Program Director → specialty‑scoped** (was hospital‑scoped). New `utils/pdScope.js`; rewrote `programDirector.js`; assignment + 409 uniqueness; fixed `b_program_director` reading Advanced data. |

### Earlier

`2a259cc` landing‑page program documents · `41144ae` added HANDOFF.md · `8bdb97e` removed Basic badge · `7e6db97` fixed secretary Basic‑track queries · `c52e00c` de‑dup specialties per hospital · `747a28b` DIO hospital detail page · `7a2b653` DIO/secretary add‑hospital + cross‑track guards · `26f1bdf` DIO Hospitals page · `2d3735d` DIO became a track‑wide overseer + president view‑only · `4e978d3` DIO dashboard overhaul. Earlier still: `43d5dcb`/`a9891a7` interactive WPBA forms; `6dbc584` introduced the Basic‑Training portal and `b_*` roles.

---

## 9. Known issues & follow‑ups

- **Existing PDs have no specialty → 403** (§5b). Any PD created before the specialty change has `specialtyId: null` and gets 403 on every PD page until a DIO assigns a specialty. A `DRY_RUN`‑gated backfill script is a good next task.
- **Duplicate `Specialty` records** exist (multiple same‑named rows per hospital). PD scoping is deliberately name‑based to work around this; a `DRY_RUN`‑first cleanup remains a good next task.
- **Legacy trainees without a supervisor.** F1 requires a supervisor at **create** and blocks **clearing** on edit, but does not retroactively force one onto pre‑existing trainees — editing such a trainee will require choosing a supervisor before save. A one‑time report of supervisor‑less trainees would help.
- **Signature audit vs. retention.** The authoritative signature lives permanently on the `Research` doc; the `AuditLog` copy expires at the 180‑day TTL. If long‑term signature auditing is needed, exclude `research_sign_approve` from the TTL or raise `AUDIT_LOG_RETENTION_DAYS`.
- **Secretary‑edit `hospitalId` is not scope‑re‑validated at apply time** (a review dimension flagged, verdict = not‑a‑bug because the DIO reviews/approves the diff). If you later want hard enforcement, re‑validate the target hospital against the request's specialty/track in `applyChangeRequest`.
- **Uploads directory persistence.** `backend/uploads/{trainee-courses,research}` are created at runtime; on Railway's ephemeral FS uploaded files don't survive redeploys — the same caveat that already applies to other `/uploads` content. Use a volume/object store for durability.
- **No test suite / no local DB.** No automated e2e; the current environment has no local Mongo/Docker, so authed flows were verified structurally (build + assembly + adversarial review), **not** end‑to‑end. Playwright login/role‑redirect smoke tests + a few backend route tests against a throwaway Mongo remain the highest‑value next investment.
- **`/api/specialties` list is track‑filtered for non‑`super_admin`** — a page needing cross‑track specialties must special‑case it.
- **Dead hospital‑era helpers in `dio.js`** — unused; remove in a cleanup pass.
- **DIO "Promotions" naming.** The panel is labelled "Promotions" (en) / "الموافقات" (ar) with two tabs (Account Changes + Research). Confirm the naming with the product owner; splitting into two nav items is trivial if preferred.

---

## 10. Errors & warnings seen this session

None block build or deploy; recorded so the next person isn't surprised.

- **Adversarial review — 3 findings, all resolved.** Two confirmed access‑control bugs were **fixed** in `2269b32`: (1) a former/deactivated supervisor could still read a trainee's private publications and retain approval authority (distribution status now filtered); (2) the legacy `supervisor` alias could inject an arbitrary out‑of‑specialty supervisor via the change‑request path (now folded into `supervisorId` and validated). A third (low) non‑atomic pending‑request guard was hardened with a partial‑unique index. A separate `hospitalId` finding was reviewed and judged not‑a‑bug (gated by DIO approval).
- **Vite build warning (persistent, benign):** `Some chunks are larger than 500 kB after minification` — app JS ≈ 1.53 MB (~398 kB gzip). Code‑split with dynamic `import()` or raise `build.chunkSizeWarningLimit` to silence.
- **Git line‑ending warnings (Windows, benign):** `LF will be replaced by CRLF`. Cosmetic; add a `.gitattributes` (`* text=auto eol=lf`) to silence.
- **Live DB / browser E2E not run:** see §9 — no local Mongo/Docker; production DB must not be used for tests.
- **Untracked in the working tree (intentional, not committed):** `graphify-out/` (generated knowledge graph — candidate for `.gitignore`) and the two root‑level source PDFs `Medical_Internship_Program.pdf` / `Specialty_Training_Guide_General_Model_EN.pdf` (served copies live in `frontend/public/track-documents/`). Feature commits are deliberately scoped to `backend/` + `frontend/` to exclude these.

---

## 11. Safety rules (do not violate)

- Never print, commit, or expose secrets from `.env` / `backend/.env` (Mongo URI, JWT secrets, cookies, tokens). If found, report only the path and say it must be rotated.
- No destructive DB changes without explicit approval. Seed/migration/fixup scripts are gated behind `DRY_RUN` / `CONFIRM_*` — keep them safe.
- Don't remove existing features or rename files/routes/roles/DB fields unless the task requires it.
- The backend enforces permissions; frontend guards mirror it for UX only.
- Treat all medical/user data as sensitive — privacy, access control, auditability first.

---

## 12. The knowledge graph (optional, for orientation)

`graphify-out/` holds a generated knowledge graph of the repo (run: `/graphify .`): `graph.html` (interactive), `graph.json` (GraphRAG‑ready), `GRAPH_REPORT.md` (communities, god nodes, suggested questions). Navigational aid, not source; regenerate with `--update`; currently untracked (candidate for `.gitignore`). "God nodes" (most‑connected): `api` (axios), `Navbar()`, `useAuth()`, `Skeleton()`, `Toast()`, `allowRoles()`, `usePrefs()`, `ViewToggle()`, `useBasePath()` — `allowRoles()` is the RBAC chokepoint bridging nearly every backend route.
