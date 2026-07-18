# MTMS / MLMS — Project Handoff

_Medical Training Management System. Last updated: 2026-07-13._

This is a working handoff for anyone (human or agent) picking up the codebase. It covers the architecture, the two‑portal role model, the subsystems, how to build/test/deploy, the significant recent changes, and the open follow‑ups. Read the **Role & Track model**, the **DIO scope**, and the **Program Director scope** sections first — they drive most of the access‑control logic.

**This session's work (§8 has the detail):** mobile‑responsive fixes across the DIO list tables + Evaluations stat cards + the landing mobile menu; AMETI branding on the certificate pages; the **Consultant‑Memo approval (اعتماد) → read‑only "Approved memos" flow** (+ ASG.1‑only delete); removal of the Specialties admin page from super_admin; and tweaks to the new **Event Feedback** subsystem (nav translation, mobile preview, and treating activity Title/Date/Facilitators as event metadata rather than attendee questions). The Event Feedback feature itself landed **in a parallel session** (`c9dde6a`) — it is now part of the codebase and is mapped in §6.

---

## 1. What it is

A medical residency/internship training platform with **7 role‑based dashboards**, sensitive medical/training data, and two parallel training portals (Advanced + Basic). Users are trainees, supervisors, program directors, secretaries, DIOs (Designated Institutional Officials), a president, and a super admin, plus two consultant‑memo roles (ASG.1/ASG.2). A super‑admin‑only **Event Feedback** subsystem serves feedback forms to a separate attendee mobile app.

**Stack**
- **Frontend:** React 18 + Vite (JSX), React Router v6, Chart.js, axios. No component framework — plain CSS in `frontend/src/index.css` with CSS variables for theming (light/dark) + i18n (Arabic/English, RTL/LTR).
- **Backend:** Node.js + Express, Mongoose (MongoDB).
- **Auth:** JWT — short‑lived access token (Bearer header) + long‑lived **httpOnly refresh cookie**; auth middleware silently re‑issues access tokens.
- **Deploy:** Backend → Railway (`backend/Procfile`, `railway.json`) or VPS (`scripts/deploy-vps.sh` + PM2 process `mlms-backend` + Nginx). Frontend → Vercel (`frontend/vercel.json`) or served statically. **Live: `https://mlmsksb.com`** (same‑origin: Nginx serves `frontend/dist` and reverse‑proxies `/api` + `/uploads` to the backend on `:5000`; the SPA uses `baseURL: ''` in `api/axios.js`, so nothing points at a separate API host). A push to `main` is **not** live until the VPS redeploys (`scripts/deploy-vps.sh`: git pull → `npm run build` → nginx reload).

---

## 2. Run / build / test

From the repo root:

```bash
npm run dev              # concurrently: backend (nodemon) + frontend (vite)
npm run frontend         # vite dev server only (port 5173, proxies /api + /uploads → :5000)
npm run backend          # backend dev only (port 5000)

npm run build:frontend   # vite production build (installs dev deps first)
npm run check:backend    # node --check backend/server.js (syntax gate)
npm run deploy:check     # build:frontend + check:backend  ← the pre-ship gate
```

- **Backend boot** needs `backend/.env` with at least `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (see `REQUIRED_ENV` in `backend/server.js`). Health check: `GET /health`.
- **There is no automated e2e/unit suite** in the repo (`test:e2e:trainee` referenced in older docs/CLAUDE.md does not exist). Verification today =
  - `npm run deploy:check` (build + `node --check`),
  - `node --check <file>` per changed backend file (also catches syntax in required models/routes — `check:backend` only parses `server.js` itself),
  - a manual login/role‑redirect click‑through,
  - and, for larger work, a multi‑agent adversarial review of the diff.
- **No local Mongo or Docker is installed in the current dev environment**, so live DB / browser end‑to‑end testing of authed flows could not be run this session. **Never boot the backend against the production DB for a "test."** Use a local/non‑prod Mongo. Never commit `.env` / secrets.
- **Browser testing "on the web":** no MCP needs building — a Chrome‑automation tool already exists in the agent environment, and the app is live at `mlmsksb.com`. Point a browser at the live URL to exercise flows **read‑only** (real medical data — no create/edit/delete on prod).

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
                            (rateLimiter now also exports efReadLimiter / efSubmitLimiter for Event Feedback)
  models/                   Mongoose schemas (User, Hospital, Specialty, Rotation, Distribution,
                            Evaluation, Report, Certificate, Notification, AuditLog, Initiative,
                            ConsultantMemo, ScientificCouncil, SecurityEvent, University,
                            TraineeCourse, Research, ChangeRequest,
                            FeedbackForm, FeedbackFormVersion, FeedbackEvent, FeedbackResponse)  ← last 4 = Event Feedback
  routes/                   auth, users, hospitals, specialties, distributions, rotations, reports,
                            evaluations, notifications, certificates, certificateVerify, dashboard,
                            dio, supervisor, programDirector, secretary, president, trainee, adminV2,
                            consultantMemo, scientificCouncils, initiatives, universities,
                            traineeCourses, research, eventFeedback, eventFeedbackPublic
  utils/
    track.js                coerceRoleToTrack, trackFilter, trackForRole, baseRole, isBasicRole
    pdScope.js              Program-Director specialty scoping (name-set) + one-PD-per-specialty
    evalScoring.js          shared eval helpers: averageScore, WPBA_FORMS, isWpbaForm, wpbaAlreadyThisMonth
    filename.js             decodeOriginalName / contentDisposition (Arabic-safe uploads)
    applyChangeRequest.js   applies an approved secretary ChangeRequest, re-validating refs
    feedbackValidateResponse.js, eventCode.js   ← Event Feedback (server-side response validation, public code gen)
  seeds/feedback.seed.js    seeds+publishes the AMETI "Activity Evaluation" form (idempotent, run via reseed script)
  migrations/, seeds/, scripts/ (reseed, fixups — gated by DRY_RUN / CONFIRM_* flags)

frontend/
  landing.html              public marketing/login landing page (served at '/'; NOT a React route)
  public/                   logo.png (MTMS), ameti-logo.jpeg (AMETI cert branding), arab-board-logo.png,
                            track-documents/*, evaluation-forms/*.docx
  src/
    App.jsx                 ALL routes (advanced + /basic mirror) + RootRedirect + LegacyTraineeRedirect
    config/roles.js         ROLE_HOME, ROLE_LINKS (nav), MIRRORED map, track helpers (single source of truth)
    api/axios.js            axios instance (baseURL:'' same-origin; Bearer, X-New-Access-Token, refresh, 20s GET cache)
    context/AuthContext.jsx user/session; PrefsContext.jsx  theme/lang (+ the memo/global t() dictionary)
    hooks/useBasePath.js    '' for advanced, '/basic' for b_* roles — prefix all intra-app nav with this
    components/             Navbar, ProtectedRoute, ErrorBoundary, Toast, Skeleton, ViewToggle,
                            SearchableSelect, NotificationPanel, icons.jsx, evaluations/EvalModal.jsx,
                            memo/* (MemoNavbar, MemoPrint, MemoUi, MemoPrefs…), eventFeedback/* (FormBuilder, Responses)
    data/evalForms.js       WPBA form definitions (Mini-CEX, CBD, DOPS, MSF-360 A–E, ASR, FITER)
    i18n/                   strings + resolver (dict[lang][key] ?? dict.ar[key] ?? key)
    pages/                  one file per screen. Trainee: Timeline, Reports, Grades(=Portfolio),
                            CertificatesCourses, Research, Notifications. Supervisor / Secretary / DIO
                            (Dio*), President*, ProgramDirector*, Admin*. Memo: ConsultantMemo,
                            ConsultantMemoAll, ConsultantMemoApproved. Admin: EventFeedback.
                            (AdminSpecialties.jsx still exists but is now unreferenced — see §9.)

docs/api-contract.md + event-feedback-schema.md, README.md, AGENTS.md, .claude/ (skills), graphify-out/ (knowledge graph, generated/untracked)
```

---

## 4. Role & Track model (read this)

**Roles** (`User.role` enum): `trainee, supervisor, program_director, secretary, dio, president, super_admin, asg1, asg2` — plus the **Basic‑track mirrors** `b_trainee, b_supervisor, b_program_director, b_secretary, b_dio, b_president`.

**Two portals / tracks.** There is one Advanced portal and one Basic‑Training portal. **The Basic portal reuses the exact same page components** under a `/basic/*` URL prefix — there is *no* duplicated UI. What differs is only the URL and the role.

How the mirroring works end‑to‑end:
- **auth.js** normalizes a `b_*` role to its base (`b_dio` → `dio`) for all downstream role checks, and sets **`req.track`** (`'basic'` or `'advanced'`). So every `req.user.role === 'dio'` check also fires for a `b_dio`; the *track* difference lives in `req.track`.
- **`utils/track.js`** — `coerceRoleToTrack(role, track)` turns a base role into its track‑correct DB role; `trackFilter(track)` is a Mongo fragment (`{track:'basic'}` or `{track:{$ne:'basic'}}` — the latter also matches legacy docs with no `track`). `User`, `Hospital`, `Specialty`, `Rotation`, `Certificate`, `Evaluation`, `TraineeCourse`, `Research`, `ChangeRequest` all carry a `track` field.
- **Frontend** — `config/roles.js` builds `ROLE_LINKS['b_dio']` by prefixing `/basic` onto the advanced DIO links (the `MIRRORED` map). `useBasePath()` returns `''` or `'/basic'`; **all intra‑app navigation must prefix it** or a `b_*` user gets bounced to the Advanced portal.
- **App.jsx** — every `/dio/*` route has an exact `/basic/dio/*` twin (same for the other roles). When you add a role route, add its `/basic` twin **and** the `nav.<baseRole>.<key>` string in **both** `ar` and `en`.

**RBAC chain (backend is the real guard):** `auth → allowRoles(...) → scopeGuard()`. Frontend `ProtectedRoute` + `ROLE_HOME` (in `config/roles.js`) mirror it but are **UX only** — never rely on them for security.

`ROLE_HOME`: super_admin→`/admin/dashboard`, dio→`/dio/dashboard`, secretary→`/secretary/trainees`, supervisor→`/supervisor/trainees`, program_director→`/program-director/trainees`, president→`/president/trainees`, trainee→`/timeline`, asg1/asg2→`/consultant-memo` (b_* = `/basic` + the same).

---

## 5. The DIO scope model — HOSPITAL → TRACK

The DIO is a **track‑wide overseer**: an advanced `dio` sees/manages/evaluates **every advanced‑track** user and record across **all hospitals**; a `b_dio` does the same within the Basic track.

What that means in `backend/routes/dio.js`:
- All list endpoints (`/trainees`, `/supervisors`, `/program-directors`, `/secretaries`, `/presidents`) query `role: coerceRoleToTrack(<role>, req.track)` with **no hospital filter**.
- Evaluations, trainee details, report grading, dashboard `/stats`, certificates, and the change‑request (Promotions) endpoints are all **track‑scoped** (`trackFilter(req.track)`; coerced role for users).
- Create/update/delete match the target by the **coerced role**, which enforces track isolation.
- The `president` shows on the DIO **Users** page as **view‑only**.

**DIO Users is the single management surface.** The DIO reaches trainees through **`/dio/users`** (`DioUsers.jsx`, which lists trainees + supervisors + PDs + secretaries + presidents). The trainee **card** lives at **`/dio/users/:id`** (`DioTraineeDetail.jsx`); the legacy `/dio/trainees` routes are kept only as backward‑compat redirects (`LegacyTraineeRedirect` in `App.jsx`). A supervisor's card (read‑only modal in `DioUsers`) lists that supervisor's assigned trainees (from `GET /api/dio/supervisors/trainees-map`) and lets the DIO drill into a trainee card in the same panel.

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

## 5c. Trainee assignment, portfolio & the research‑approval pipeline

An established subsystem cluster. Four related features:

### (a) Required trainee assignment + separate research supervisor
- A trainee **must** be assigned a **clinical supervisor** (`User.supervisorId`), a **hospital**, and a **specialty**. Enforced on create by `dio.js` and `secretary.js` (a secretary must pick a supervisor **in the secretary's specialty**). Edits may **change** the supervisor but never **clear** it.
- A trainee may also have a separate **research supervisor** (`User.researchSupervisorId`, optional). Research routing prefers it and falls back to the clinical/rotation supervisor (`research.js resolveSupervisorId`). The research supervisor counts as "assigned" (`getAssignedTraineeIds`).

### (b) Trainee portfolio pages
- **Certificates & Courses** (`/certificates-courses`, `CertificatesCourses.jsx`) — trainee self‑uploads (model `TraineeCourse` + `routes/traineeCourses.js`; multer under `backend/uploads/trainee-courses`). Surfaced read‑only on the Supervisor/PD/DIO trainee cards.
- **Researches & Publications** (`/research`, `Research.jsx`) — submit → approval pipeline → **Publications** with per‑item **Public/Private**.
- **PD Notifications** (`/notifications`, `Notifications.jsx`) — filters `Notification.category === 'program_director'`.
- The trainee navbar label is **"Portfolio"** (route stays `/grades`).

### (c) Multi‑stage research approval with a typed signature
`Research` status machine:

```
pending ──research supervisor Approve & Sign──▶ supervisor_approved
        ──secretary Forward──▶ forwarded_dio ──DIO Final‑approve──▶ approved (= published)
        └── rejected (terminal; rejectedAtStage = supervisor|secretary|dio)
```

- **Signature = typed name + identity + server timestamp** (no image). On approve, `research.js` records `signedBy`/`signedByName`/`signatureName`/`signedAt` on the doc + writes an `AuditLog` (`research_sign_approve`). Each transition guards on current status (`if (doc.status !== expected) return 4xx`). The authoritative record lives on the Research doc (the AuditLog has a 180‑day TTL).
- Endpoints (`routes/research.js`): `POST /`, `GET /mine`, `PATCH /:id/visibility` (only when `approved`), `DELETE /:id`; `PATCH /:id/approve|/forward|/final-approve|/reject`; `GET /queue`, `GET /supervisor`, `GET /trainee/:traineeId` (PD/DIO/president see approved+public only; the supervisor sees all their trainee's).
- **Visibility:** a private publication → trainee + current supervisor only; public → adds PDs and DIOs.
- Frontend: `SupervisorResearch.jsx` (sees & signs), `SecretaryResearch.jsx` (forwards), the "Research" tab of `DioApprovals.jsx` (final‑approve), `Research.jsx` (trainee stepper).

### (d) Secretary account edits → DIO "Promotions" approval (queued)
- A secretary editing a **trainee/supervisor account** does not write — it becomes a pending `ChangeRequest` (secretary `PATCH /trainees|/supervisors` → **`202 { pending:true }`**). Creates and deactivations still apply immediately.
- The DIO reviews in **`DioApprovals.jsx`** (nav **"Promotions"**, `/dio/approvals`, "Account Changes" tab): field‑by‑field diff with Approve/Reject. Approving runs `utils/applyChangeRequest.js` (re‑validates refs, applies only allow‑listed fields).
- **One pending request per account** — partial‑unique index on `ChangeRequest` (`{targetId}` where `status:'pending'`) → E11000 surfaces as 409. `DioApprovals` is one page, two tabs (Account Changes + Research) under the single "Promotions" link.

**Access‑control notes (backend‑enforced):** `getAssignedTraineeIds` keys off `supervisorId` + `researchSupervisorId` + current/upcoming rotations + non‑inactive distributions — a former/deactivated supervisor loses access. The change‑request path folds the legacy `supervisor` alias into `supervisorId` and specialty‑validates it.

---

## 6. Subsystems (map)

- **Auth & tracks** — `middleware/auth.js`, `utils/track.js`, `config/roles.js`, `context/AuthContext.jsx`, `api/axios.js`.
- **Users management** — `routes/users.js` (generic, admin), `routes/dio.js` + `routes/secretary.js` (role‑scoped CRUD; secretary account **edits** queue via `ChangeRequest` — §5c(d)); pages `DioUsers.jsx`, `Users.jsx`, the `*Trainees/*Supervisors` pages.
- **Trainee portfolio & research** — §5c.
- **Promotions (secretary‑edit approval)** — §5c(d).
- **Program Directors** — specialty‑scoped (§5b). `routes/programDirector.js`, `utils/pdScope.js`; pages `ProgramDirector*.jsx`; assignment UI in `DioProgramDirectors.jsx` + `DioAssignPds.jsx`.
- **Hospitals & specialties** — `routes/hospitals.js`, `routes/specialties.js`; pages `DioHospitals.jsx`, `DioHospitalDetail.jsx`, `SecretaryHospitals.jsx`. `GET /api/specialties` is track‑filtered for non‑`super_admin`. **The super_admin Specialties admin page was removed this session** (nav link + `/admin/specialties` route + import all gone); `AdminSpecialties.jsx` is now an orphaned component (see §9). The specialties **API** is untouched.
- **Rotations & distributions** — `routes/rotations.js`, `routes/distributions.js`; DIO UI in `DioAssignments.jsx` (tabs Distribution / Rotation / Program Directors, panels from `DioDistributions`/`DioRotations`/`DioAssignPds`).
- **Evaluations (WPBA)** — `data/evalForms.js`, `components/evaluations/EvalModal.jsx`, `utils/evalScoring.js`. DIO and PD evaluate trainees *and* supervisors (finalized‑on‑create); `Evaluation` uses `evaluateeId`/`evaluateeRole`.
- **Reports & grading** — `routes/reports.js`, `Report` model.
- **Certificates** — `routes/certificates.js` + DIO cert endpoints + `routes/certificateVerify.js` (public verify). The printable/verify pages (`CertificatePrint.jsx`, `VerifyCertificate.jsx`) are **AMETI‑branded** (`/ameti-logo.jpeg` on a white chip; title/footer read "AMETI — Academy of Medical Education and Training in Iraq"). Distinct from the trainee‑uploaded `TraineeCourse`.
- **Consultant Memo** — ASG.1/ASG.2 only (`routes/consultantMemo.js`, `/consultant-memo`, `/consultant-memo/all`). Memos have a **`saved | draft | approved`** status. **Approval (اعتماد):** when all main sections are filled the builder shows an اعتماد button; `POST /:id/approve` (terminal‑state query guard — only a `saved` memo; re‑validates completeness **server‑side**; sets `approvedBy`/`approvedAt`; writes an `AuditLog`) permanently locks the memo. Approved memos → `PUT`/`DELETE` reject with **409** (and a `status:'approved'` body on PUT/POST is rejected 400 so the field whitelist can't self‑approve); they leave the editable list and show read‑only on **`/consultant-memo/approved`** (`ConsultantMemoApproved.jsx`, reuses `MemoPrint`). **Only role `asg1`** may delete an approved memo (`DELETE /:id` role‑gated + `AuditLog`; everyone else keeps the 409). No un‑approve. Mirrors the ChangeRequest/Certificate immutability precedents.
- **Event Feedback (super_admin)** — server‑controlled feedback forms + a public mobile API for event attendees (added by a parallel session, `c9dde6a`; modified this session). Models: `FeedbackForm` (editable draft "head", `status draft|published|unpublished|archived`, `fields[]`), `FeedbackFormVersion` (immutable published snapshot, `{formId,version}` unique), `FeedbackEvent` (**admin‑set per event: `title`/`date`/`location`/`facilitators[]`**, public `code`, `open|closed`, `formId`), `FeedbackResponse`. Field schema in `feedbackSchemas.js` (`FIELD_TYPES`: short_text/long_text/date/single_choice/multi_choice/yes_no/rating/email/section_header; sub‑schemas option/rating/showIf; **no per‑field read‑only/value flag**). Routes: `routes/eventFeedback.js` (`/api/event-feedback`, `auth + allowRoles('super_admin')` — form CRUD/publish/versions/attachment upload, event CRUD, analytics) and `routes/eventFeedbackPublic.js` (`/api/event-feedback/public`, **unauthenticated**, gated only by a valid open event `code` + `efReadLimiter`/`efSubmitLimiter` + honeypot — app `GET`s the published form + event metadata, `POST`s responses validated server‑side by `feedbackValidateResponse.js`: "the mobile client is never trusted", unknown keys stripped, required enforced, values type‑coerced). Frontend: `EventFeedback.jsx` (event selector, share/QR, NewEventModal) + `components/eventFeedback/{FormBuilder,Responses}.jsx` (nav "Event Feedback" / تقييم الفعاليات). **Activity Title/Date/Facilitator(s) are event metadata (admin‑set in the web dialog, read‑only in the app), not attendee questions** (§8, §9).
- **Notifications** — `Notification` model (with `category`), `routes/notifications.js`, `NotificationPanel.jsx` bell.
- **Landing page** — `frontend/landing.html` (static, served at `/`).
- **Security** — `rateLimiter.js`, `honeypot.js`, `securityEventLogger.js` + `SecurityEvent`, `AuditLog`, `adminV2.js`.

---

## 7. Backend conventions

- **Route module shape:** `router.<verb>(path, auth, allowRoles(...ROLES), [auditLog(...)], handler)`.
- **Scoping:** `coerceRoleToTrack(role, req.track)` for user role queries; `trackFilter(req.track)` for `Hospital`/`Specialty`/`Rotation`/`Certificate`/`ChangeRequest`; `utils/pdScope.js` for PD data. `super_admin` bypasses scoping.
- **Field allow‑lists:** every create/update `pick(body, ALLOWED_FIELDS)` — never spread `req.body`. **Watch the whitelist for status/lock fields:** the consultant‑memo `PUT`/`POST` reject a `status:'approved'` body precisely because `status` is in the pick list — an approve‑then‑lock transition must go through its dedicated endpoint, not a generic update.
- **Immutability / terminal states:** there is no generic hook; the idiom is an explicit `if (doc.status === <terminal>) return 409` at the top of each mutation handler, plus (for the transition itself) a **terminal‑state query guard** — `findOneAndUpdate({ _id, status: <expected> }, …)` so the change is atomic/single‑shot. Precedents: `ChangeRequest` (`dio.js`), `Research` (`research.js`), `Certificate` (immutability by *absence* of an edit endpoint + a flag), and now Consultant‑Memo approval (`consultantMemo.js`).
- **Uploads:** multer disk storage into a per‑feature subfolder under `backend/uploads/…`; store the `/uploads/…` path on the model; validate **extension AND mimetype**; `/uploads` is auth‑gated globally. Use `utils/filename.js` for Arabic‑safe names.
- **Responses:** mostly `{ success: true, data }`; frontend reads `res.data?.data || res.data`. Queued secretary edits return `202 { pending:true }`. Event‑feedback admin routes return the raw doc; the public app route returns `{ data: { event, form } }`.
- **Audit + notify:** mutations write an `AuditLog` entry and often a `Notification`. New audit actions this session: `asg_approve_consultant_memo`, `asg1_delete_approved_consultant_memo`.

## Frontend conventions

- Pages render `<Navbar/>` + `<main className="admin-main">` (or `"main"` for trainee pages). Reuse `admin-card`, `admin-toolbar`, `admin-table`, `filter-tabs`, `btn-purple/outline/red`, `btn-action`, stat cards, `management-card-grid`, `ViewToggle`, `SearchableSelect`, `Toast`, `Skeleton (Sk)`, `badge`.
- **Responsive tables (new pattern this session):** a wide `.admin-table` overflows on phones. The opt‑in **`.admin-table--stack`** modifier (in `index.css`) reflows each row into a labeled card at **≤768px** — add the class to the `<table>` and a `data-label="…"` to every data `<td>` (matching the `<th>`); wrap multi‑line cells (name+email) in a single `<div>`; the `#` cell (no `data-label`) is hidden; it's RTL‑ and dark‑mode‑safe via logical properties + theme vars. Applied to `DioCertificates`, `DioUsers`, `DioDistributions`, `DioRotations`, `DioAssignPds`. **Stat‑card rows** stack via `gridTemplateColumns: repeat(auto-fit, minmax(min(220px,100%),1fr))` (Dio/Supervisor/ProgramDirector `*Evaluations.jsx`). For a hardcoded inline 2‑col grid that must stack (e.g. the Event‑Feedback FormBuilder), use `repeat(auto-fit, minmax(min(100%,360px),1fr))`.
- **Tabbed pages** (`DioAssignments.jsx`, `DioApprovals.jsx`) render only the active panel.
- **Motion** follows `web-animation-design`: `transform`/`opacity` only, <300 ms; global `prefers-reduced-motion` reset in `index.css`.
- **i18n:** new nav labels need **both** `ar` and `en` in `i18n/strings/nav.js` (keyed `nav.<baseRole>.<key>`) **and** the link in `config/roles.js` must carry a `key` — a link with only a `label` never translates (this session's Event‑Feedback nav fix). Memo strings live in `components/memo/MemoPrefs.jsx`'s `STRINGS` table (merged into the global `t()`).
- Brand: MTMS primary `#1B1464`, accent `#FF6B35`. AMETI (certs): orange `#F0892B` / blue `#4C94D8`.

---

## 8. Change history

### v2 Roles Rebuild — branch `AB` (2026‑07‑18), Phases 1–5 — NOT on `main`; do not push without owner sign‑off

A full role‑model v2 rebuild (see `ROLES_REBUILD_PLAN.md`) landed on branch `AB` across five phases. Summary:

- **Phase 1 — role model.** 8 new role enum strings (`secretary_general, assistant_secretary, data_analyzer, data_entry, central_secretary, dio_view, sub_dio, sub_pd`); central `ROLE_LABELS`/`roleLabel`/`READ_ONLY_ROLES` in `config/roles.js`; landing‑page cleanup. Renamed labels: super_admin→"Developer", dio→"ODIO", supervisor→"Trainer".
- **Phase 2 — registry + login.** New models `Country`, `Program`, Hospital/User extensions (`idNumber`, `countryId`, `programId`, `assignedCenterIds`, `dioId`, `pdId`); `User.email` made optional + sparse‑unique (`migrations/relaxEmailIndex.js`); login accepts email OR ID number; `routes/countries.js`, `registry.js`, `programs.js` + `/registry/*` pages; `utils/accreditation.js`.
- **Phase 3 — people flows.** `routes/analyzer.js` (staff creation) + `/analyzer/*`; `routes/centralSecretary.js` (trainer‑optional trainee/trainer creation, capacity hard‑block, edits queued as ChangeRequests to the ODIO) + `/central/*`; `utils/trainingYear.js` + computed year in mappers; ODIO lockdown + center‑set guards (`utils/centerScope.js`).
- **Phase 4 — role pages.** `routes/dioView.js` + `/dio-view/*` suite (certificates reuse the existing `/api/dio/certificates` paths); Announcements (model/route/board); Log Book (model/route + `utils/assignedTrainees.js`); `routes/sg.js` + `/sg/*` read‑only suite; PD dashboard/program pages + Sub‑PD GET grants.
- **Phase 5 — data ops + hardening.** `utils/csv.js` (extracted from `eventFeedback.js`, byte‑identical); `jobs/snapshots.js` + `models/DataSnapshot` + `node-cron` schedules (opt‑in `SNAPSHOTS_ENABLED`); analyzer snapshot list/download/run + analysis‑report upload → SG/AS inbox (`models/AnalysisReport`, `/analyzer/exports`, `/sg/reports`); Developer System page (`GET /api/admin/system` + `/admin/system`); removed the super_admin `/admin/certificates` page (route/nav/page — certificates still exist for DIO/DIO‑view/PD/president + public verify); `scripts/assertExportSafety.js` (`npm run check:exports`); the only new dependency is `node-cron` (backend).

**Pending / at‑deploy items:**
- Run `migrations/relaxEmailIndex.js` (DRY_RUN → CONFIRM) **before/at deploy** so ID‑number‑only accounts work without an email.
- `SNAPSHOTS_ENABLED` is opt‑in — enable it on exactly one persistent instance (PM2 fork / a durable disk).
- **Legacy advanced `dio` accounts without a `dioId`/center set lose write access** under the new ODIO lockdown until recreated via the registry (DIO → ODIO). Basic `b_dio` untouched.
- **Trainer‑evaluation form criteria still pending from the owner** — `SUPERVISOR_EVAL_FORMS` stays `[]` (feature dormant until populated). Sub‑DIO / Sub‑PD exact powers also TBD (view‑only placeholders).
- **No automated test suite** (`test:e2e:trainee` is fictional). Verification = `npm run build:frontend` + `npm run check:backend` + `npm run check:exports` + `node --check` per backend file + manual click‑throughs.

### Prior session (2026‑07‑12 / 2026‑07‑13)

All on `main`, pushed. Newest → oldest. (Prior sessions are in `git log` and earlier HANDOFF revisions; the immediately previous session — 2026‑07‑11/12 trainee portfolio + research pipeline + secretary "Promotions" — is now folded into §5c as established architecture.)

| Commit | Change |
|--------|--------|
| `872819a` | **Event Feedback — activity Title/Date/Facilitator(s) are event‑set, not attendee questions.** Removed the duplicate `title`/`date`/`facilitator` questions from the seed form's Activity‑details section (kept location/participant/linked); the FormBuilder App preview now shows a read‑only "Event details · set per event" header. Rationale: the event already stores admin‑set title/date/location/facilitators and already ships them to the app. |
| `8b8f774` | **Event Feedback — nav translation + mobile preview fix.** The super_admin "Event Feedback" link now has `key:'event_feedback'` + AR/EN nav strings (shows تقييم الفعاليات). FormBuilder's 2‑column inline grid now stacks on phones (`repeat(auto-fit, minmax(min(100%,360px),1fr))`) and the rating‑emoji row can shrink (`minWidth:0`), so the emojis no longer spill outside the App‑preview card. |
| `90e3bee` | **Removed the Specialties admin page from super_admin** — dropped the sidebar link (`config/roles.js`) and the `/admin/specialties` route + import (`App.jsx`). It was super_admin‑only, so it's fully unrouted. `AdminSpecialties.jsx` left on disk, unreferenced (§9). |
| `35b2f14` | **ASG.1 can delete an approved consultant memo.** Backend `DELETE /:id` allows deleting an `approved` memo only when `req.user.role === 'asg1'` (others keep the 409) + writes an `AuditLog`. Frontend: a red Delete button on each Approved‑page card for ASG.1 only, behind the existing "Delete permanently?" confirm. |
| `af8813e` | **Consultant‑Memo approval (اعتماد) + read‑only "Approved memos" page.** Model: status enum gains `approved`, + `approvedBy`/`approvedAt`. Routes: `POST /:id/approve` (terminal‑state guard, server‑side completeness → 422, AuditLog); `PUT`/`DELETE` lock approved memos (409); `status:'approved'` body rejected (400); default list excludes approved, `?status=approved` feeds the new page. Frontend: `isCompleteForm` gate + button + confirm modal in `ConsultantMemo.jsx` (flushes autosave, then approves + navigates; opening an approved memo redirects to read‑only); new `ConsultantMemoApproved.jsx` (reuses `MemoPrint`); `MemoNavbar` entry; `/consultant-memo/approved` route; AR/EN `STRINGS`. |
| `c9dde6a` | **Event Feedback subsystem — added by a PARALLEL session** (server‑controlled evaluation forms + mobile API). Mapped in §6. Included here because this session's `8b8f774`/`872819a` build on it. Not this session's authorship. |
| `9bad733` | **Landing mobile menu — Portal Login button now shows.** CSS specificity bug: the mobile breakpoint's `.btn-login{display:none}` hid it and `.nav-mobile .btn-login` never restored `display`. Added `display:block` (markup was already present). |
| `8db082b` | **DIO Assignments tables responsive** (all 3 tabs). Applied `.admin-table--stack` + `data-label`s to `DioDistributions`, `DioRotations` (9 cols), `DioAssignPds`; wrapped the Supervisor/Trainee name+subtitle cells. |
| `b3149f2` | **DIO Users List view responsive** — `.admin-table--stack` + `data-label`s on `DioUsers.jsx`. |
| `f274994` | **Evaluations stat cards responsive** — the fixed `repeat(3,1fr)` grid overflowed on phones; changed to `repeat(auto-fit, minmax(min(220px,100%),1fr))` in `DioEvaluations`, `SupervisorEvaluations`, `ProgramDirectorEvaluations` (live grid + loading skeleton). |
| `e96d9c4` | **DIO certificate List view responsive** — introduced the opt‑in `.admin-table--stack` CSS pattern in `index.css` and applied it (class + `data-label`s) to `DioCertificates.jsx`. |
| `cb88fd4` | **Certificates rebranded to AMETI.** Swapped the MTMS logo → `/ameti-logo.jpeg` and rewrote the org title/footer to AMETI on `CertificatePrint.jsx` + `VerifyCertificate.jsx` (logo on a white chip; `mixBlendMode:multiply` on the printable page); dropped the theme‑based logo variant on the verify page. Scope limited to the certificate pages — global `logo.png` (navbar/landing/reports) unchanged. |

---

## 9. Known issues & follow‑ups

- **Event Feedback — the live seed form still has the 3 activity questions.** The seed trim (`872819a`) only affects **newly created** forms; the existing published "Activity Evaluation" form already contains the `title`/`date`/`facilitator` questions and the seed is idempotent (won't re‑run). To fix the live form, an admin must **delete those 3 questions in the FormBuilder and Re‑publish** (or reseed a fresh form). No production‑DB access from the dev env.
- **Event Feedback — the attendee mobile app is a separate repo.** The public API already returns `event.title/date/facilitators`, but the app must render them as a read‑only header for the "not editable in the app" behaviour to fully land. That side is the app team's.
- **Event Feedback has no per‑field read‑only/admin‑value flag.** If per‑question (not event‑level) locking is ever wanted, add a `readOnly`/`adminValue` to `feedbackSchemas.js` **and** teach `feedbackValidateResponse.js` to inject the admin value instead of trusting `answers[fieldId]` (today every stored answer comes from the untrusted client). The event‑metadata route avoids this.
- **`AdminSpecialties.jsx` is now orphaned** (route + nav removed, import dropped). If the page won't return, delete the component in a cleanup; if it might, keep it.
- **Responsive tables — only 5 are done.** `.admin-table--stack` is on the DIO certificate/users/assignments tables; other wide list tables still overflow on mobile (admin `Users.jsx`, `DioSupervisors/ProgramDirectors/Secretaries`, `President*`, `Secretary*`, `Research`, `AuditLog`, `Grades`). Same class + `data-label`s is a good batch follow‑up.
- **Consultant‑memo approval is irreversible by design** (no un‑approve); ASG.1 delete is the only escape. Confirm this matches the product owner's intent.
- **Existing PDs have no specialty → 403** (§5b) — a `DRY_RUN`‑gated backfill remains a good next task. **Duplicate `Specialty` records** exist (name‑based PD scoping works around this). **Legacy trainees without a supervisor** — create requires one but pre‑existing docs aren't backfilled.
- **Uploads directory persistence.** `backend/uploads/*` are created at runtime; on Railway's ephemeral FS uploaded files (trainee courses, research, consultant‑memo attachments, feedback‑form attachments) don't survive redeploys. Use a volume/object store.
- **No test suite / no local DB.** No automated e2e; the current env has no local Mongo/Docker, so authed + live flows were verified structurally (build + `node --check` + static review), **not** end‑to‑end. Playwright login/role‑redirect smoke tests against a throwaway Mongo remain the highest‑value next investment.
- **Dead hospital‑era helpers in `dio.js`** — unused; remove in a cleanup pass.

---

## 10. Errors & warnings seen this session

None block build or deploy; recorded so the next person isn't surprised.

- **A parallel session was working in the same repo/working tree.** The Event Feedback feature (models, routes, `server.js`, `roles.js`, `App.jsx`, new pages) appeared uncommitted mid‑session, then landed as `c9dde6a`. Every commit this session was **scoped to only its own files** — where a shared file (`App.jsx`, `roles.js`) was dirty with the other session's hunks, only this session's hunks were staged (via `git apply --cached` of a hand‑built patch, which never touches the working tree). Net: no work was lost or cross‑committed; `main` stayed build‑consistent. **If you see unfamiliar uncommitted changes, assume a parallel agent and stage only your own files.**
- **Vite build warning (persistent, benign):** `Some chunks are larger than 500 kB after minification` — app JS ≈ 1.53 MB (~398 kB gzip). Code‑split with dynamic `import()` or raise `build.chunkSizeWarningLimit` to silence.
- **Git line‑ending warnings (Windows, benign):** `LF will be replaced by CRLF`. Add a `.gitattributes` (`* text=auto eol=lf`) to silence.
- **Live DB / browser E2E not run:** no local Mongo/Docker; production DB must not be used for tests. Everything this session was verified via `deploy:check` + static/build review. Live flows show only after a VPS redeploy.
- **Untracked in the working tree (intentional, not committed):** `graphify-out/` (generated knowledge graph — candidate for `.gitignore`), `new-logo/` (the source AMETI image; the served copy is `frontend/public/ameti-logo.jpeg`), and the two root‑level source PDFs `Medical_Internship_Program.pdf` / `Specialty_Training_Guide_General_Model_EN.pdf` (served copies in `frontend/public/track-documents/`). Feature commits are deliberately scoped to `backend/` + `frontend/` to exclude these.

---

## 11. Safety rules (do not violate)

- Never print, commit, or expose secrets from `.env` / `backend/.env` (Mongo URI, JWT secrets, cookies, tokens). If found, report only the path and say it must be rotated.
- No destructive DB changes without explicit approval. Seed/migration/fixup scripts are gated behind `DRY_RUN` / `CONFIRM_*` — keep them safe.
- Don't remove existing features or rename files/routes/roles/DB fields unless the task requires it.
- The backend enforces permissions; frontend guards mirror it for UX only.
- Treat all medical/user data as sensitive — privacy, access control, auditability first. When a parallel session's uncommitted work is in the tree, stage only your own files.

---

## 12. The knowledge graph (optional, for orientation)

`graphify-out/` holds a generated knowledge graph of the repo (run: `/graphify .`): `graph.html` (interactive), `graph.json` (GraphRAG‑ready), `GRAPH_REPORT.md` (communities, god nodes, suggested questions). Navigational aid, not source; regenerate with `--update`; currently untracked (candidate for `.gitignore`). "God nodes" (most‑connected): `api` (axios), `Navbar()`, `useAuth()`, `Skeleton()`, `Toast()`, `allowRoles()`, `usePrefs()`, `ViewToggle()`, `useBasePath()` — `allowRoles()` is the RBAC chokepoint bridging nearly every backend route.
