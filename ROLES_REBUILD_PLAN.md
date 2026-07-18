# MTMS Roles Rebuild v2 — Implementation Plan (branch `AB`)

> **Status: APPROVED FOR IMPLEMENTATION.** Role model v2 (2026-07-18) — supersedes every v1 role mapping.
> Branch: `AB` (from `main`). Commit per phase; never push unless asked.
> Execution model: **Fable** = planner/advisor/reviewer · **Opus** = coder · **Haiku** = phase reporter.
> Grounded in a full verified code reconnaissance (2026-07-18); every cited file/symbol was checked.

---

## 0. Working rules + REQUIRED SKILLS

Work phase by phase, in order. Each phase: Opus implements → Fable reviews the diff against this plan → fixes → verification block → Haiku report → commit.

### Skills matrix

| Skill | When |
|---|---|
| `mtms-agent-routing` | Start of every coding task (coordinator procedure). |
| `mtms-codebase-navigator` | Orientation at each phase start. |
| `anthropic-skills:coding-backend` | Every backend phase — API/RBAC/error-handling checklists. |
| `mtms-security-auditor` | After the login change (Phase 2), after every new permission gate, full pass in Phase 5. |
| `mtms-backend-debugger` / `mtms-frontend-debugger` | On any route/page failure during a phase. |
| `mtms-testing-checklist` | End of every phase. |
| `web-animation-design` | MANDATORY for any added/changed transition, keyframe, transform, hover/press feedback. |
| `ui-ux-pro-max` | New pages (registry, analyzer, SG suite, log book, announcements). |
| `dataviz` | Before ANY new chart. |
| `verify` | Before each phase's commit — drive the flow in the running app. |
| `code-review` | After each phase's implementation, before commit. |
| `mtms-deployment-vps-railway` | Only when shipping (not during this branch). |

### Ground rules
- New roles are **Advanced-track only**. Basic portal (`b_*` roles, `/basic/*`, and every backend path b_ users hit) must keep working byte-for-byte. `president`, `asg1`, `asg2` untouched.
- Existing internal strings unchanged; v2 adds NEW strings (below). Backend enforces permissions; frontend guards mirror them.
- No secrets printed; data scripts DRY_RUN/CONFIRM-gated (precedent `backend/migrations/reconcileChangeRequestIndexes.js`); contract-first (update `docs/api-contract.md` per phase).

---

## 1. Role model v2 (FINAL)

| Tier | Role (label) | Internal string | Scope / powers | Created by |
|---|---|---|---|---|
| 0 | Developer | `super_admin` (existing) | Full access; Dashboard, System page, Audit log, Users (all types). NO certificates page. | — |
| 1 | Secretary General | `secretary_general` NEW | View-only: dashboard, centers, DIOs, Sub-DIOs, specialties, programs, PDs, Sub-PDs, trainees + analysis-reports inbox. | Developer |
| 2 | Assistant Secretary | `assistant_secretary` NEW | Identical view set to SG (separate role). | Developer |
| 3 | Data analyzer | `data_analyzer` NEW | Creates Data-entry clerks + Central secretaries; snapshots (weekly/monthly/yearly) → download → upload PDF/PPTX report to SG+AS inbox; filterable dashboard (country/city/specialty). NO registry creation. | Developer |
| 4 | Data entry clerk | `data_entry` NEW | **Global, unscoped.** Adds countries, training centers, DIO+ODIO+Sub-DIO accounts, specialties, programs, PD+Sub-PD accounts. | Data analyzer |
| 5 | Central secretary | `central_secretary` NEW | **Global (all countries, all specialties).** Adds trainees (**trainer OPTIONAL**, research trainer optional → defaults to program PD); adds trainer accounts as needed; edits via ODIO-approved ChangeRequest. | Data analyzer |
| 6a | DIO | `dio_view` NEW | View-only over his center subset (country + multi-select subset) + **issue & view certificates** (only write). | Data entry clerk |
| 6b | ODIO | `dio` (existing) | View + EDIT (no add/delete) trainees/trainers in his DIO's center set; approves change requests; issues certificates. | Data entry clerk |
| 6c | Sub-DIO | `sub_dio` NEW | View-only placeholder mirroring DIO reads (linked to a DIO via `dioId`). Powers TBD. | Data entry clerk |
| 7a | PD | `program_director` (existing) | One program. View trainees/trainers (drill-down), dashboard + program card, announcements (board+notification), FINAL-report grading, evaluates trainees AND trainers (different forms; trainer form pending), research where research trainer. | Data entry clerk |
| 7b | Sub-PD | `sub_pd` NEW | View-only placeholder mirroring PD reads (linked via `pdId`, carries same `specialtyId`/`programId`). Powers TBD. | Data entry clerk |
| 8a | Trainer | `supervisor` (existing) | Per v1 spec: his trainees, weekly+monthly report grading, WPBA evaluations, log-book sign-off, research-trainer duties, announcements (read). | Central secretary |
| 8b | Trainee | `trainee` (existing) | Per v1 spec: timeline, weekly/monthly/final reports, Log Book, portfolio, certificates & courses, announcements (read), research. | Central secretary |
| — | `president`, `asg1`, `asg2`, `secretary`, all `b_*` | existing | UNTOUCHED. Old `secretary` remains for the Basic track (and legacy advanced accounts keep working as today); the new flow uses `central_secretary`. `routes/secretary.js` is NOT modified. | — |

Display labels: ONE map `ROLE_LABELS {en, ar}` in `frontend/src/config/roles.js` (Arabic titles: ask owner if unsure). Renamed labels for existing strings: `super_admin`→"Developer", `dio`→"ODIO", `supervisor`→"Trainer".

**8 new enum strings**: `secretary_general, assistant_secretary, data_analyzer, data_entry, central_secretary, dio_view, sub_dio, sub_pd`.

---

## 2. Verified codebase facts (do not re-derive; full recon 2026-07-18)

### Already true — less work than it looks
- `Report.type` enum `['weekly','monthly','final']` EXISTS; grading split already enforced (`routes/supervisor.js` weekly+monthly only, final→403; `routes/programDirector.js` grades final only).
- Secretary-edit→approval EXISTS end-to-end: `PATCH /api/secretary/*` queues `ChangeRequest` (202) → `PATCH /api/dio/change-requests/:id/approve|reject` → `utils/applyChangeRequest.js`. v2 reuses the pattern from the NEW central-secretary routes; approver = ODIO of the trainee's center.
- Trainer(supervisor)-evaluation plumbing EXISTS: `POST /api/dio/supervisors/:id/evaluations` + `POST /api/program-director/supervisors/:id/evaluations` (`evaluateeRole:'supervisor'`); frontend `SUPERVISOR_EVAL_FORMS` in `frontend/src/data/evalForms.js` is `[]` — populating it activates the feature (criteria pending from owner).
- "Promotions" nav item is actually the change-request approvals page (`DioApprovals.jsx` — CR tabs + research tab). Nothing to delete: relabel to "Approvals"; make `User.year` computed for advanced trainees.

### Constraints — more care than it looks
- **Login is in `frontend/landing.html`** (`handleLogin` ~2123, posts `{email,password}`), with a drifted ROLE_HOME duplicate (~2005: `president:'/president/trainees'`, no b_*) and a `safeUser` duplicate. THREE ROLE_HOME definitions to sync: `config/roles.js`, `landing.html`, `NotFound.jsx:8`.
- **`User.email` is required+unique** → make optional + `unique sparse` + migration `backend/migrations/relaxEmailIndex.js` (DRY_RUN/CONFIRM; IndexOptionsConflict precedent).
- **No scheduler lib** — add `node-cron` (only new backend dep). **No CSV util** — extract `csvCell`+BOM/CRLF from `routes/eventFeedback.js` (~60, 407–429) into `backend/utils/csv.js`.
- **`test:e2e:trainee` is fictional**; no test framework exists. Verification = `npm run deploy:check` + `node --check` per changed backend file + manual click-throughs (say so honestly).
- **Uploads served behind auth globally** (`app.use('/uploads', auth, express.static(...))`) — no per-file ownership; don't weaken.
- **Track idioms**: after `auth`, `req.user.role` is ALWAYS the base role (`b_*` normalized), portal in `req.track`; query users via `coerceRoleToTrack`, other collections via `trackFilter` (never `track:'advanced'` equality). New role strings pass through `utils/track.js` untouched (verified — only `b_` prefix is special-cased).
- **Legacy/V2 duality**: `Rotation` REQUIRES legacy `student`+`hospital` (set both on create); `Report` uses `student`; `Research`/`TraineeCourse` use `trainee`; `Certificate`/`Evaluation` carry both.
- **Frontend idioms**: axios 20s GET cache (mutations flush; `{cache:false}` opt-out; blobs never cached); unwrap `r.data?.data || r.data`; local toast pattern; i18n falls back Arabic→raw key — every ROLE_LINKS role needs `nav.<role>.*` ar+en keys; missing ROLE_HOME ⇒ redirect loop; `notifLink` (Navbar) routes notifications by message-text regex — new messages need routable keywords + notifLink entries.
- **`Users.jsx` submits multipart and OMITS empty fields; `DioUsers.jsx` submits JSON with explicit nulls** — two contracts, keep each internally consistent.
- CSP `connect-src 'self'`; same-origin `/api` only. E11000 handlers currently assume email — with `idNumber_1` added, inspect `err.keyPattern` to report the right duplicate.
- CR concurrency: approve/reject use findOne-then-save (NOT race-safe) — for new flows needing atomicity use `findOneAndUpdate` with the status filter. `viewChangeRequest` (strips `changes.password`) is MANDATORY on any CR-returning endpoint.
- Printing: `.modal` is the general printable surface; other valid paths: `.certificate-print-area`, ConsultantMemo print CSS, `utils/printEvaluation.js`.
- Docs conventions: new files → row in `MTMS.md`; session → `HANDOFF.md` change history; API → `docs/api-contract.md`.

---

## 3. Data model changes

### NEW `backend/models/Country.js`
`{ name (req, trim, unique), code (req, uppercase, trim, unique), isActive (true), createdBy → User }` + timestamps. Managed by Data entry clerks; read by everyone (auto-fills country-code fields).

### NEW `backend/models/Program.js`
```
name req trim · trainingCenterId →Hospital req idx · specialtyId →Specialty req idx
programDirectorId →User null idx · accreditationType enum ['partly','fully'] req   // partly=2y, fully=6y
accreditationGrantDate Date req · accreditationNumber '' · accreditationWithdrawn false
yearlyCapacity Number min 0 req · trainingStartDate Date req · renewalApplicationDate null
isActive true · createdBy →User · timestamps
```
Route-enforced rules: **max 70 active programs per center** (409 + count); **one active program per PD** (analogous to `findPdForSpecialty` in `utils/pdScope.js` — which stays untouched for legacy routes). Expiry NEVER stored: `grant + (partly?2:6)y` via NEW `backend/utils/accreditation.js` → `accreditationStatus(...)` = `'green' | 'yellow'(<1y) | 'red' | 'black'(withdrawn overrides)`; expose computed `accreditationExpiry`+`accreditationStatus` in route mappers (codebase has no virtuals convention).

### EXTENDED `backend/models/Hospital.js` (UI label "Training Center"; keep every existing field)
Add: `countryId →Country null idx · accreditationNumber '' · accreditationGrantDate null · accreditationExpiry null · accreditationWithdrawn false`. `dioId` now points at a `dio_view` user in the new flow. Do NOT touch `specialtySettings` (Basic capacity flow depends on it).

### EXTENDED `backend/models/User.js`
1. Enum: + the 8 new strings (§1). No `track.js`/hook changes needed (verified pass-through).
2. New fields:
```
idNumber  String unique sparse trim idx        // login identifier
countryId →Country null idx                     // trainees/trainers/DIOs/ODIOs/Sub-DIOs
programId →Program null idx                     // trainees + trainers (one program each)
assignedCenterIds [→Hospital] default []        // dio_view: his center subset
dioId →User null                                // ODIO + Sub-DIO → their dio_view user (centers resolve THROUGH the DIO)
pdId  →User null                                // Sub-PD → his program_director (scope mirrors PD)
```
3. **email optional** + sparse unique + `migrations/relaxEmailIndex.js`. Capacity-exception CR flow keeps email REQUIRED and stays Basic/legacy-only (its dedup index keys on `changes.email`; advanced flow gets a hard block with NO exception request) — do not touch ChangeRequest indexes.
4. **Training year computed** (Phase 3): advanced trainees with `programId` → `trainingYear = clamp(1 + floor(yearsSince(program.trainingStartDate)), 1..6)` via NEW `utils/trainingYear.js`, injected in route mappers; stored `year` stays for Basic. Nothing writes `year` in new flows.
5. `researchSupervisorId` (existing) = research trainer; default to program's PD at trainee creation when absent.

### NEW `backend/models/Announcement.js`
`{ programId →Program req idx, authorId →User req, title req trim, body req }` + timestamps. Create fans out `Notification` (category `'announcement'`) to the program's active trainees+trainers (local helper, `notifyTrackDios` pattern); extend `notifLink` for it.

### NEW `backend/models/LogBookEntry.js`
`{ traineeId req idx, programId null idx, date req, procedureType req trim, notes '', status enum ['pending','signed_off','rejected'] default pending idx, reviewedBy null, reviewedAt null, reviewNote '' }` + timestamps.

### NEW `backend/models/DataSnapshot.js`
`{ range enum ['weekly','monthly','yearly'] req idx, fileName req, generatedAt now, sizeBytes 0, datasets [String] }` + timestamps. Files under `backend/uploads/snapshots/`.

### NEW `backend/models/AnalysisReport.js`
`{ range enum req idx, name req (decodeOriginalName), url req (/uploads/analysis-reports/<fileId>), fileId req, mimeType '', sizeBytes 0, uploadedBy →User req }` + timestamps.

### UNCHANGED
Report, Evaluation, ChangeRequest (+applyChangeRequest — ONE relaxation: the "trainee must keep a supervisor" rule applies only when `cr.track === 'basic'`; advanced trainees may have no trainer), Certificate, Notification, Research, TraineeCourse, Rotation, Distribution, AuditLog, feedback models, ScientificCouncil, Initiative, ConsultantMemo, University, SecurityEvent. **`routes/secretary.js` is NOT modified in v2** (Basic + legacy advanced secretaries keep today's behavior).

---

## 4. Backend API contract (new/changed; all `auth` → `allowRoles` → in-handler scoping; audits per write — `writeAudit`-style with sanitized metadata when context matters; multer-in-handler error callback for uploads)

### Changed `backend/routes/auth.js`
- `POST /login`: accept `{identifier, password}` (+ legacy `{email,password}`): `User.findOne({$or:[{email:id.toLowerCase()},{idNumber:id}]})`. Lockout/tokens/cookie unchanged.
- Read-only self-service gate: `/me` + `/upload-photo` deny `['president','dio_view','sub_dio','sub_pd','secretary_general','assistant_secretary']`; **`/change-password` stays president-only-denied (unchanged)** — every new role can change its own admin-set password.

### Changed `backend/routes/users.js`
- `ROLE_RANK` add: `data_entry: 45, central_secretary: 45, sub_pd: 55, sub_dio: 60, dio_view: 65, data_analyzer: 85, assistant_secretary: 88, secretary_general: 90`.
- `HIDDEN_FROM_NON_ADMIN` add: `'secretary_general','assistant_secretary','data_analyzer'`.
- No additions to `READ_STAFF`/`WRITE_STAFF`.

### NEW `backend/routes/countries.js` → `/api/countries`
GET `/` any-auth (dropdown source). POST/PATCH/DELETE(soft) `data_entry, super_admin` + audit.

### NEW `backend/routes/registry.js` → `/api/registry` — ALL `allowRoles('data_entry','super_admin')` (global, unscoped)
| Endpoint | Notes |
|---|---|
| GET/POST/PATCH `/centers(/:id)` | Training-center CRUD (accreditation fields + countryId; status computed in mapper) |
| GET/POST/PATCH `/specialties(/:id)` | specialty CRUD (advanced) |
| POST `/dios` | create `dio_view`: `{name, idNumber, password, email?, countryId, assignedCenterIds[]}` — centers must belong to countryId (multi-select subset) |
| POST `/dios/:id/odio` · POST `/dios/:id/sub-dio` | create the DIO's ODIO (`role:'dio'`) / Sub-DIO (`role:'sub_dio'`), both with `dioId` link; PATCH `/dios/:id` updates `assignedCenterIds` |
| POST `/pds` | create `program_director` (`specialtyId` req) |
| POST `/pds/:id/sub-pd` | create `sub_pd` with `pdId` link + copied `specialtyId`/`programId` |
| GET `/users?role=&countryId=&specialtyId=&search=` | the clerk's view of accounts he manages (DIO/ODIO/Sub-DIO/PD/Sub-PD only) |
E11000 handling: inspect `err.keyPattern` (email vs idNumber).

### NEW `backend/routes/programs.js` → `/api/programs`
| Endpoint | Roles | Notes |
|---|---|---|
| GET `/?centerId=&specialtyId=&countryId=` | `data_entry, data_analyzer, super_admin, central_secretary, dio, dio_view, sub_dio, secretary_general, assistant_secretary, program_director, sub_pd` | scoped: dio/dio_view/sub_dio → center set; program_director/sub_pd → own program; others global |
| POST `/` | `data_entry, super_admin` | 70-cap; one-program-per-PD; PD must be a `program_director` of the program's specialty; audit |
| PATCH `/:id` · DELETE `/:id` (soft) | `data_entry, super_admin` | v2: the clerk both adds AND maintains registry data; audit |
| GET `/pd-candidates?specialtyId=` | `data_entry, super_admin` | searchable PD dropdown, filtered to specialty, excluding PDs already directing a program |

### NEW `backend/routes/analyzer.js` → `/api/analyzer` — ALL `allowRoles('data_analyzer','super_admin')`
| Endpoint | Notes |
|---|---|
| GET `/stats?countryId=&city=&specialtyId=` | filterable dashboard aggregates |
| POST `/staff` | create `data_entry` or `central_secretary` accounts (`{name, idNumber, password, email?, role}`) |
| GET `/staff` · PATCH `/staff/:id` | list/edit his clerks + central secretaries (rank rules apply) |
| GET `/snapshots` · GET `/snapshots/:id/download` | DataSnapshot list + `res.download` stream from `uploads/snapshots/` |
| POST `/snapshots/run` | on-demand snapshot for a range (testing/first-run) |
| POST `/analysis-reports` · GET `/analysis-reports` | multer upload (NEW `uploads/analysis-reports/`, 15MB, ext+mime pdf/ppt/pptx, decodeOriginalName, in-handler error cb) → AnalysisReport; notify all SG+AS users (category `'reports'`); list own |

### NEW `backend/routes/sg.js` → `/api/sg` — ALL `allowRoles('secretary_general','assistant_secretary','super_admin')`, read-only
GET `/stats`, `/centers`, `/dios` (incl. Sub-DIOs), `/specialties`, `/programs`, `/pds` (incl. Sub-PDs), `/trainees`, `/analysis-reports` (+ `/:id/download` via `res.download`). Excludes tier-0/3 accounts from user lists.

### NEW `backend/routes/dioView.js` → `/api/dio-view` — GETs `allowRoles('dio_view','sub_dio','dio','super_admin')`
Center-set resolution via NEW `backend/utils/centerScope.js`: `dio_view` → own `assignedCenterIds`; `dio`/`sub_dio` → their `dioId` user's set; empty → 403. GET `/stats`, `/centers` (+programs per center), `/program-directors`, `/trainees`, `/trainers` — filtered by center set (`programId → Program.trainingCenterId ∈ set` plus legacy `hospitalId ∈ set`).
**Certificates (corrected design)**: keep `/api/dio/certificates` paths — add `'dio_view'` to GET (list), POST (issue), and `GET /api/dio/trainees?search=` allowRoles in `routes/dio.js`; `sub_dio` gets the GET only; NOT revoke/delete. **Center-set filter** on those GET/POST when track==='advanced' and caller is dio_view/sub_dio or an ODIO with `dioId` (Basic `b_dio` keeps track behavior). Add `'dio_view','sub_dio'` to the `/dio/certificates/:id/print` guard in App.jsx; hide revoke/delete in UI for both.

### Changed `backend/routes/dio.js` (ODIO powers + lockdown; Basic untouched)
- POST managed-user creation: 403 when `req.track==='advanced'` && role `dio` ("Creation moved to the registry"); DELETE likewise (edit-only). Basic + super_admin unchanged.
- PATCH managed-user: when advanced && role `dio`, verify target ∈ caller's center set (`utils/centerScope.js`), 403 otherwise.
- CR approve/reject: same center-set guard on the target.
- Keep everything else (stats, reads, evaluations, certificates, CRs) — that IS the ODIO feature set.

### NEW `backend/routes/centralSecretary.js` → `/api/central` — ALL `allowRoles('central_secretary','super_admin')` (global: all countries/specialties)
| Endpoint | Notes |
|---|---|
| GET `/programs?search=&specialtyId=&countryId=` | program picker (global) |
| POST `/trainees` | `{name, idNumber, password, email?, city, programId, supervisorId? (OPTIONAL — must belong to the program when given), researchSupervisorId? (default = program's PD)}`. Server derives `hospitalId` ← `Program.trainingCenterId`, `countryId` ← center's countryId, `specialtyId` ← program's. **Capacity hard block** vs `Program.yearlyCapacity` (current-year active trainees on that programId; 409 + count; NO exception request). Audit + rank rules. |
| POST `/trainers` | same shape minus supervisor fields; `programId` req (one program per trainer) |
| GET `/trainees` · GET `/trainers` | global lists with search/filters |
| PATCH `/trainees/:id` · PATCH `/trainers/:id` | NOT applied — queued as ChangeRequest (reuse `queueChangeRequest`-style helpers COPIED into this file or extracted; `viewChangeRequest` mandatory) targeting the ODIO of the person's center; 202 `{pending:true}`; notify that ODIO |
| GET `/change-requests` · PATCH `/change-requests/:id/cancel` | own requests |
Trainer-optional ripple: relax "trainee must keep supervisor" in `utils/applyChangeRequest.js` for `cr.track==='advanced'` only.

### NEW `backend/routes/announcements.js` → `/api/announcements`
POST `/` `program_director` (own program; fan-out + audit) · GET `/?programId=` PD/sub_pd (own program), trainee/supervisor (own programId), dio_view/dio/sub_dio (center set), secretary_general/assistant_secretary/data_analyzer/super_admin (all) · DELETE `/:id` author PD or super_admin.

### NEW `backend/routes/logbook.js` → `/api/logbook`
First EXTRACT `getAssignedTraineeIds` from `routes/supervisor.js` (file-local) into NEW `backend/utils/assignedTrainees.js` (behavior-identical, keep `role:'trainee'` query; leave the research.js duplicate alone), import in both. Then: GET `/mine` · POST `/` · DELETE `/:id` (pending only) — `trainee`; GET `/review` — `supervisor` (his trainees, via the util); PATCH `/:id/review` — `supervisor` `{status:'signed_off'|'rejected', reviewNote}` + Notification + audit.

### Changed `backend/routes/programDirector.js` (PD + Sub-PD)
- Add `'sub_pd'` to the GET endpoints' allowRoles only (trainees, supervisors, reports GET, evaluations GET) — scope resolves via the sub_pd's own copied `specialtyId` (same `requirePdSpecialty` path). Mutations stay PD-only.
- NEW GET `/stats` (PD + sub_pd): program counts for the dashboard page.

### NEW snapshot job `backend/jobs/snapshots.js` (+ dep `node-cron`)
Registered from `server.js` only when `require.main === module` && `process.env.SNAPSHOTS_ENABLED === 'true'` (PM2 fork = single instance; Railway may lack persistent disk — hence the flag; document in `.env.example`). Cron: weekly Mon 03:30, monthly 1st 04:00, yearly Jan 1 04:30 (after the VPS 03:00 mongodump). Dataset whitelist → `.find().lean()` → flatten (ObjectId/Date→string) → per-dataset CSV via `utils/csv.js` into `uploads/snapshots/<range>-<ISOdate>/` + DataSnapshot doc. **Whitelist**: User (minus `password/loginAttempts/lockUntil/__v`), Hospital, Specialty, Country, Program, Rotation, Distribution, Report, Evaluation, Research, Certificate, TraineeCourse, Announcement, LogBookEntry, Notification, AuditLog. **NEVER**: ChangeRequest (bcrypt hashes in `changes`), SecurityEvent, FeedbackResponse `meta.ipHash`.

### `server.js` mounts
Add `/api/countries`, `/api/registry`, `/api/programs`, `/api/analyzer`, `/api/sg`, `/api/dio-view`, `/api/central`, `/api/announcements`, `/api/logbook` — standard pattern, no public routes, nothing moves relative to the `/uploads` auth-static line.

---

## 5. Frontend plan

### 5a. Role plumbing (Phase 1)
- `config/roles.js`: `ROLE_LABELS {en,ar}` for every role (Developer / Secretary General / Assistant Secretary / Data Analyzer / Data Entry / Central Secretary / DIO / ODIO / Sub-DIO / Program Director / Sub-PD / Trainer / Trainee / + president, ASG.1, ASG.2, legacy secretary label unchanged) + `roleLabel(role, lang)` (with "Basic " prefixing) + `READ_ONLY_ROLES = ['president','dio_view','sub_dio','sub_pd','secretary_general','assistant_secretary']`.
- Refactor the six duplicated label spots to the central helper: `Users.jsx` (drop local ROLE_DISPLAY/roleLabel), `DioUsers.jsx` (ROLE_META keeps api/icon/badge only), `Profile.jsx`, `components/memo/MemoNavbar.jsx`, `DioTraineeDetail.jsx`, and `NotFound.jsx` (drop its local ROLE_HOME, import canonical).
- **ROLE_HOME is PHASED** (a target that doesn't exist yet = login lands on 404; sync all THREE copies incl. landing.html — fix its drifted `president` entry to `/president/dashboard` while there):
  - Phase 1 temporaries: `dio_view: '/president/dashboard'` (+ add `'dio_view'` to the seven `/president/*` route guards, `PRESIDENT=['president','dio_view']` in `routes/president.js`, `'dio_view'` on `/api/dio/stats`); all 7 other new roles → `'/profile'` (add all 8 to the `/profile` allowlist).
  - Finals when pages ship: Phase 2 → `data_entry: '/registry/centers'`; Phase 3 → `central_secretary: '/central/trainees'`, `data_analyzer: '/analyzer/dashboard'`; Phase 4 → `dio_view: '/dio-view/dashboard'`, `sub_dio: '/dio-view/dashboard'`, `secretary_general: '/sg/dashboard'`, `assistant_secretary: '/sg/dashboard'`, `sub_pd: '/program-director/dashboard'`.
- ROLE_LINKS + `nav.<role>.*` ar+en keys are added **in the phase where each role's pages ship** (raw-key fallback otherwise). Phase 1 only relabels `nav.dio.approvals` "Promotions"→"Approvals".
- `Users.jsx` (Developer): add the 8 roles to `ROLES`; `ROLE_FIELDS`: `secretary_general/assistant_secretary/data_analyzer: ['phone']`, `data_entry/central_secretary: ['phone']`, `dio_view: ['countryId','phone']` (center multi-select lives in the registry UI, not here), `sub_dio/sub_pd: ['phone']` (linking happens in registry UI); ROLE_BADGE entries; Track toggle stays inert for non-BASIC_CAPABLE (verified behavior).
- `landing.html`: `handleLogin` sends `{identifier, password}` (label "Email or ID number"); sync ROLE_HOME + safeUser duplicates.

### 5b. New pages (reuse the §6 kit; bilingual local `STRINGS {ar,en}` + `usePrefs()`; skeleton-first; toast pattern; defensive unwrapping; `web-animation-design` for any motion)
| Route | Roles | Page | Built from |
|---|---|---|---|
| `/registry/centers` (+ `/registry/centers/:id`) | data_entry (+super_admin) | Centers list + center card: accreditation chip 🟢🟡🔴⚫, programs table `X / 70`, "Add program" modal (**center accreditation number displayed read-only**; PD via SearchableSelect fed by `/api/programs/pd-candidates`) | `.management-card-grid` + `.admin-card/.admin-table/.admin-modal`; filter patterns from `DioCertificates` |
| `/registry/countries` · `/registry/specialties` | data_entry | CRUD lists | `HospitalsUniversities`/`Certificates` admin patterns |
| `/registry/dios` | data_entry | Create DIO (country → center multi-select checkboxes) + his ODIO + Sub-DIO(s); list pairs | `DioUsers` modal patterns |
| `/registry/pds` | data_entry | Create PD (+ Sub-PD) with specialty select; list | `Users.jsx` patterns (JSON+nulls contract) |
| `/analyzer/dashboard` | data_analyzer | Filterable stats (country/city/specialty) — `dataviz` skill | `AdminDashboard` structure; ChartJS.register per file |
| `/analyzer/staff` | data_analyzer | Create/list/edit clerks + central secretaries | `Users.jsx` patterns |
| `/analyzer/exports` | data_analyzer | Snapshots list + blob downloads (Responses.jsx `exportCsv` pattern, `responseType:'blob'`), "Run now", analysis-report upload (range + PDF/PPTX) + upload list | Responses.jsx + ConsultantMemo upload |
| `/sg/dashboard` + `/sg/{centers,dios,specialties,programs,pds,trainees,reports}` | secretary_general, assistant_secretary | View-only suite + reports inbox (download via `res.download` route) | dashboards + admin-table patterns |
| `/central/trainees` · `/central/trainers` | central_secretary | Add/list trainees & trainers: program SearchableSelect (global), PD auto-shown, **country + code auto-filled read-only** (derived from program's center), city input, **trainer optional** picker filtered to the program's trainers, research-trainer optional "(defaults to PD)", idNumber req, email optional; 202-pending toast for edits (CR flow) | `SecretaryTrainees` anatomy (new file, do not modify the original) |
| `/dio-view/dashboard` + `/dio-view/{centers,program-directors,trainees,trainers,certificates}` | dio_view, sub_dio (certificates: issue button hidden for sub_dio) | DIO suite; certificates = `DioCertificates.jsx` reused AS-IS endpoint-wise per §4 corrected design, revoke/delete hidden, print guard updated | `DioDashboard` + president list pages |
| `/program-director/dashboard` · `/program-director/program` | program_director, sub_pd | NEW PD dashboard (stats via `/api/program-director/stats`) + program card (accreditation chip, capacity usage, dates) | `DioDashboard` stat patterns + `.admin-card` |
| `/announcements` | trainee, supervisor, program_director (composer for PD only), sub_pd | Board + composer; **ROLE_LINKS + `nav.trainee.announcements` / `nav.supervisor.announcements` / `nav.program_director.announcements` ar+en keys added same phase** | card list + `.admin-modal` |
| `/logbook` · `/supervisor/logbook` | trainee / supervisor | Entry form+list with status chips / review queue with sign-off/reject | `CertificatesCourses` / `SupervisorReports` anatomy |
| `/admin/system` | super_admin | System page: country cards → that country's centers + users (new `GET /api/admin/system` in adminV2.js) | `.management-card-grid` drill-down |
- Also Phase 4: verify the PD trainers-list → trainer's-trainees drill-down exists in `ProgramDirectorSupervisors.jsx`; add if missing. Phase 5: REMOVE `/admin/certificates` route + nav link + `Certificates.jsx` (feature stays for dio/dio_view/PD/president + public verify). Display computed `trainingYear` wherever `year` shows today (Timeline/Grades/detail pages untouched otherwise).

---

## 6. Reuse library (verified — copy, don't reinvent)
1. **CSV**: `csvCell` + literal U+FEFF BOM + CRLF + always-quoted → extract to `utils/csv.js`; blob download via `api.get(url,{responseType:'blob'})` → objectURL → `<a download>` (Responses.jsx).
2. **Uploads**: multer diskStorage `Date.now()-random+ext`; ext+mime filter; `upload.single('file')(req,res,err=>…)`; `decodeOriginalName`; `?dl=` + `contentDisposition`.
3. **Approval flow**: ChangeRequest queue → approve/reject → `applyChangeRequest`; `viewChangeRequest` mandatory; findOne-then-save is NOT race-safe (use findOneAndUpdate for new atomic needs).
4. **Notifications**: direct `Notification.create({user,message,category}).catch(()=>{})`; fan-out via local Promise.all helper; wording must match `notifLink` regexes (extend for `announcement`/`reports` + new role homes).
5. **Audit**: `writeAudit`-style direct create + `sanitizeAuditMetadata` when metadata matters; `auditLog(action)` middleware otherwise.
6. **Scoping**: base-role normalization + `coerceRoleToTrack`/`trackFilter`; NEW `utils/centerScope.js` for DIO/ODIO/Sub-DIO; NEW `utils/assignedTrainees.js` for trainer-scoped reads.
7. **UI kit**: `Sk`, `ViewToggle`, `SearchableSelect`, `icons.jsx`, `.admin-card/.admin-table/.admin-modal/.filter-tabs/.stat-cards-grid/.management-card-grid/.badge`; ChartJS.register per file; print surfaces per §2.
8. **Computed helpers**: `utils/accreditation.js` + `utils/trainingYear.js` — single source, used by every mapper returning centers/programs/trainees.

---

## 7. Phases (each: Opus implements → Fable reviews → verify → Haiku report → commit)

### Phase 1 — Foundation
1. `git checkout -b AB`.
2. landing.html: remove `#evaluation-forms` section (~1371–1444), nav links (~1182, ~1208), `'evaluation-forms'` from sectionIds (~2242), `openDocx` (~2232–2236, grep callers first). LEAVE `#mobile-app` + all `.docx`.
3. Backend: User enum +8; users.js ranks/hidden; auth.js read-only gate (per §4 — change-password untouched).
4. Frontend: §5a plumbing with Phase-1 temporaries; central labels + six-spot refactor; "Approvals" relabel; Users.jsx creation support.
5. Verify (§8) + commit `Phase 1 — v2 role skeleton + landing cleanup`.

### Phase 2 — Registry + login
1. Models: Country, Program, Hospital ext, User ext (idNumber/countryId/programId/assignedCenterIds/dioId/pdId), email sparse + migration, `utils/accreditation.js`.
2. Login: backend identifier support + landing.html form/payload; regression email login.
3. Routes: countries.js, registry.js, programs.js + mounts.
4. Pages: `/registry/*` suite; finalize `data_entry` ROLE_HOME + links + nav keys.
5. Verify (incl. `mtms-security-auditor` on login + registry gates) + commit.

### Phase 3 — People flows
1. analyzer.js staff-creation half + `/analyzer/staff` page; finalize `data_analyzer` home (dashboard can stub to stats-lite until Phase 5 exports land — dashboard page ships now with `/api/analyzer/stats`).
2. centralSecretary.js + `/central/*` pages (trainer optional; capacity hard block; CR edits → ODIO w/ center routing; applyChangeRequest advanced relaxation).
3. `utils/trainingYear.js` + computed year in mappers + UI display swap.
4. dio.js ODIO lockdown + center-set PATCH/CR guards (`utils/centerScope.js`).
5. Verify + commit.

### Phase 4 — Role pages
1. dioView.js + `/dio-view/*` suite; certificates per corrected design; Sub-DIO read access; finalize dio_view/sub_dio homes+links+nav keys; drop Phase-1 president-route grants for dio_view.
2. Announcements (model/routes/board/composer/fan-out/notifLink) + ROLE_LINKS/nav keys for trainee+supervisor+PD.
3. Log Book (extract `utils/assignedTrainees.js` first; model/routes/two pages + links/keys).
4. sg.js + `/sg/*` suite (inbox stub until Phase 5) ; finalize SG/AS homes+links+keys.
5. PD: `/api/program-director/stats` + dashboard + program pages; sub_pd GET grants; drill-down check; `SUPERVISOR_EVAL_FORMS` stays `[]` until owner supplies criteria.
6. Verify + commit.

### Phase 5 — Data ops + hardening
1. `node-cron` + `jobs/snapshots.js` + `utils/csv.js` extraction (refactor eventFeedback export to import it, behavior-identical) + DataSnapshot + run endpoint + `SNAPSHOTS_ENABLED` in `.env.example`.
2. AnalysisReport upload + SG inbox downloads + `/analyzer/exports` page.
3. Developer System page (`/admin/system` + `GET /api/admin/system`); remove `/admin/certificates` (route, nav, page file).
4. Sensitive-data assertion script (`backend/scripts/assertExportSafety.js`): no password/loginAttempts/lockUntil/ChangeRequest/SecurityEvent/ipHash in any snapshot output.
5. Full `mtms-security-auditor` + `mtms-testing-checklist`; docs: MTMS.md rows, HANDOFF.md change history, docs/api-contract.md, README roles table.
6. Verify + final commit.

---

## 8. Verification (every phase — honest)
No automated suite exists (`test:e2e:trainee` is fictional). Per phase:
1. `npm run deploy:check` + `node --check` per changed backend file.
2. Backend boot (local `MONGO_URI`+`JWT_SECRET`; dotenv cwd = `backend/`) + `GET /health` 200. Local data only.
3. Manual smoke per touched role: login (email AND idNumber after Phase 2) → correct home, no redirect loops, no raw `nav.*` keys (EN + AR, RTL intact).
4. Permission negatives: view-only roles 403 on writes; clerk-only registry writes; central secretary 409 at capacity; ODIO 403 create/delete + out-of-center edits; sub-roles read-only; non-privileged 403 on every new mount.
5. Regression: one `b_*` full click-through; president/asg1/asg2; email login; existing secretary→DIO approval round-trip; `routes/secretary.js` untouched by diff.
6. Data safety: no forbidden columns in CSVs; `viewChangeRequest` on every CR endpoint.
7. `git diff --stat` review before each commit.

## 9. Open items (owner)
- Sub-DIO exact powers (placeholder view-only now) · Sub-PD exact powers (same) · Assistant-Secretary divergence (none for now) · **Trainer-evaluation form criteria** (needed to populate `SUPERVISOR_EVAL_FORMS`).
