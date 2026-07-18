# MTMS / MLMS — Web App Reference

**Medical Training Management System** (also branded MLMS / MidLearn). A role-based LMS for medical/clinical training programs: hospitals, specialties, trainees, supervisors, rotations, reports, evaluations, certificates, research, consultant memos, event feedback, and training-program initiatives.

- **Frontend:** React 18 + Vite (ESM, no TypeScript), React Router v6, axios, Chart.js, pdfjs, mammoth. Two HTML entry points: a marketing **landing** page and the **app** SPA.
- **Backend:** Node.js + Express 4, MongoDB via Mongoose 8, JWT auth (access token + httpOnly refresh cookie), helmet, CORS allowlist, rate limiting, multer uploads.
- **Deploy:** VPS (Nginx + PM2 `mlms-backend`) and/or Railway; frontend also configured for Vercel.
- **Two training portals ("tracks"):** *Advanced* (default roles) and *Basic* (same roles prefixed `b_`). `req.track` is derived from the acting user's role; data is track-scoped everywhere.

## Roles

`super_admin`, `president`, `dio` (oversees an entire training track across all hospitals), `program_director`, `secretary`, `supervisor`, `trainee`, plus `asg1`/`asg2` (consultant-memo signers) and the Basic-track mirrors `b_president`, `b_dio`, `b_program_director`, `b_secretary`, `b_supervisor`, `b_trainee`. Permission model on the backend: **`auth` → `allowRoles` → `scopeGuard`**. Frontend guards (`ProtectedRoute`, `ROLE_HOME`) are UX-only and mirror the backend.

## Run / build / deploy

| Command | Job |
|---|---|
| `npm run dev` | Run backend + frontend concurrently (dev) |
| `npm run build:frontend` | `npm install` + `vite build` in `frontend/` → `frontend/dist` |
| `npm run check:backend` | `node --check backend/server.js` (syntax gate) |
| `npm run deploy:check` | build frontend + check backend |
| `npm run reseed:professional` / `reseed:basic-training` | Reseed demo data for a track |
| `scripts/deploy-vps.sh` | Pull, install, build, restart PM2, reload Nginx, health-check |

---

## Root & config files

| File | Job |
|---|---|
| `package.json` | Root workspace scripts (dev/build/check/deploy/reseed); ties backend + frontend together via `concurrently` |
| `README.md` | Project readme |
| `AGENTS.md` | Generic AI-agent working rules for this repo (no design changes, protect secrets, etc.) |
| `HANDOFF.md` | Running session handoff / status notes |
| `MTMS.md` | This file — full app reference |
| `railway.json` | Railway deploy config |
| `.env.example` | Placeholder env keys (no secrets) |
| `.gitignore` / `.gitattributes` | Ignore rules (incl. the APK binary) / line-ending rules |
| `index.html`, `logo.png`, `favicon.png` | Legacy/root static assets |
| `scripts/deploy-vps.sh` | One-command VPS deploy (see above) |
| `docs/api-contract.md` | Frontend↔backend API contract reference |
| `docs/event-feedback-schema.md` | Schema notes for the Event Feedback subsystem |
| `docs/task-list.md` | Working task list / backlog |

---

## Backend

### Entry & top-level

| File | Job |
|---|---|
| `backend/server.js` | Express app entry: security middleware (helmet/CORS/rate-limit), Mongo connection, mounts every `/api/*` router, `/health`, static/uploads serving, error handling |
| `backend/Procfile` | Railway/Heroku process definition (`node server.js`) |
| `backend/diagnose.js` | Standalone DB/connection diagnostic script |
| `backend/resetPassword.js` | One-off script to reset a specific user's password |

### Middleware (`backend/middleware/`)

| File | Job |
|---|---|
| `auth.js` | Verifies the JWT access token, loads `req.user` |
| `roles.js` | `allowRoles(...roles)` → middleware that 403s unless `req.user.role` is allowed |
| `scopeGuard.js` | Builds `req.scope` (e.g. hospital/specialty/track) from the user's role to constrain queries |
| `auditLogger.js` | Writes `AuditLog` entries for mutating actions |
| `securityEventLogger.js` | Records `SecurityEvent`s (suspicious/auth events) |
| `honeypot.js` | Honeypot trap routes/fields to flag bots/attackers |
| `rateLimiter.js` | `express-rate-limit` configurations (login, API) |
| `requireInitiativeAccess.js` | Role/allowlist gate for the Training Program Initiatives feature |

### Models (`backend/models/`) — Mongoose schemas

| File | Job |
|---|---|
| `User.js` | The single user model for all roles; auth (bcrypt), track sync, lockout, trainee/supervisor fields, hospital/specialty/supervisor refs |
| `Hospital.js` | Hospital + V2 fields; `specialtySettings[]` (per-specialty annual capacity + training duration in years) |
| `Specialty.js` | Specialty (name, hospitalId, secretaryId, report/eval PDF templates, track) |
| `University.js` | University/college records |
| `Rotation.js` | A trainee's rotation/posting (dates, hospital, supervisor, status) |
| `Distribution.js` | Legacy "distribution" (rotation) records kept for compatibility |
| `Report.js` | Trainee reports (weekly/monthly/final) with grading |
| `Evaluation.js` | Workplace-based assessments (WPBA) and other evaluations + scores |
| `Certificate.js` | Issued training certificates (with verification) |
| `Research.js` | Trainee research/publications (approval workflow) |
| `TraineeCourse.js` | Trainee-uploaded courses/certificates (self-reported portfolio) |
| `Country.js` | Country records (name + code); dropdown source that auto-fills country-code fields; managed by Data-entry clerks |
| `Program.js` | Training program (center + specialty + PD, accreditation type/dates, yearly capacity); expiry/status computed in `utils/accreditation.js` |
| `Announcement.js` | Program-Director announcement; posting fans out `Notification`s (category `announcement`) to the program's trainees + trainers |
| `LogBookEntry.js` | Trainee log-book procedure entry (pending → supervisor sign-off/reject) |
| `DataSnapshot.js` | One record per snapshot CSV file (range, relative fileName, size, datasets) written by `jobs/snapshots.js` |
| `AnalysisReport.js` | Analyzer-uploaded PDF/PPTX report for the SG/AS inbox (range, name, fileId, uploader) |
| `ChangeRequest.js` | Queued secretary edits + `capacity_exception` trainee-creation requests awaiting DIO approval |
| `Notification.js` | Per-user notifications (message, read flag, category) |
| `AuditLog.js` | Immutable audit trail of privileged actions |
| `SecurityEvent.js` | Security/auth event log |
| `ConsultantMemo.js` | Consultant memo documents (ASG.1/ASG.2 approval + signing) |
| `ScientificCouncil.js` | Scientific council entities referenced by consultant memos |
| `Initiative.js` | Training-program initiative proposals (multi-stage approval checkpoints) |
| `FeedbackEvent.js` | An admin-hosted event attendees give feedback on (public event code) |
| `FeedbackForm.js` | Editable draft of an Event Feedback form |
| `FeedbackFormVersion.js` | Immutable published snapshot of a feedback form |
| `FeedbackResponse.js` | One anonymous attendee submission |
| `feedbackSchemas.js` | Shared sub-schemas for the Event Feedback subsystem |

### Routes (`backend/routes/`) — mounted under `/api/*` in `server.js`

| File | Job |
|---|---|
| `auth.js` | Login, token refresh, logout, password change (JWT + httpOnly refresh cookie) |
| `users.js` | Generic user CRUD/lookup |
| `adminV2.js` | Super-admin, system-wide access to all data |
| `president.js` | President dashboards/management (track-wide oversight) |
| `dio.js` | DIO management: users, hospitals, capacity settings + secretary assignment, change-request approvals, certificates, stats |
| `programDirector.js` | Program Director: their specialty's trainees, supervisors, evaluations, reports |
| `secretary.js` | Secretary: create/edit trainees & supervisors (edits queued as ChangeRequests), hospitals, rotations, capacity requests |
| `supervisor.js` | Supervisor: their trainees, reports, evaluations, research |
| `trainee.js` | Trainee: own profile, reports, rotations, timeline, notifications |
| `hospitals.js` | Hospital CRUD/listing |
| `specialties.js` | Specialty CRUD (mounted at `/api/specialties`) |
| `universities.js` | University CRUD |
| `rotations.js` | Rotation (posting) management |
| `distributions.js` | Legacy distribution endpoints (compat with rotations) |
| `reports.js` | Report submission + grading |
| `evaluations.js` | Evaluation/WPBA submission + scoring |
| `certificates.js` | Certificate issuing/listing/revoking |
| `certificateVerify.js` | **Public** certificate verification (no auth) |
| `research.js` | Trainee research/publications + approval routing |
| `traineeCourses.js` | Trainee-uploaded courses/certificates |
| `consultantMemo.js` | Consultant memo lifecycle (create → ASG approve → sign) |
| `scientificCouncils.js` | Scientific council lookup/management |
| `initiatives.js` | Training Program Initiatives API (gated by `requireInitiativeAccess`) |
| `dashboard.js` | Aggregated dashboard statistics |
| `notifications.js` | List/mark-read notifications |
| `eventFeedback.js` | **Authenticated** admin API for Event Feedback (single admin) |
| `eventFeedbackPublic.js` | **Public** attendee endpoints, gated only by a valid event code |
| `countries.js` | Country dropdown source (GET any-auth) + CRUD (`data_entry`, `super_admin`) |
| `registry.js` | Data-entry clerk registry: centers, specialties, DIO/ODIO/Sub-DIO + PD/Sub-PD account creation (global, unscoped) |
| `programs.js` | Program CRUD (70-per-center cap, one-program-per-PD) + scoped listing + PD candidates |
| `analyzer.js` | Data Analyzer: filterable stats, clerk/central-secretary accounts, data snapshots (list/download/run), analysis-report upload → SG/AS inbox |
| `centralSecretary.js` | Central Secretary: global trainee/trainer creation (trainer optional, capacity hard-block); edits queued as ChangeRequests to the ODIO |
| `sg.js` | Secretary General + Assistant Secretary: strictly read-only oversight suite + analysis-report inbox downloads |
| `dioView.js` | DIO/Sub-DIO/ODIO read-only oversight scoped to the caller's training-center set (`utils/centerScope.js`) |
| `announcements.js` | Program announcements board + fan-out (PD composes; role-scoped reads) |
| `logbook.js` | Trainee log-book entries + supervisor review/sign-off |

### Utils (`backend/utils/`)

| File | Job |
|---|---|
| `track.js` | Advanced/Basic track helpers (`coerceRoleToTrack`, `trackFilter`, `baseRole`) |
| `pdScope.js` | Program-Director scoping helpers (resolve a PD's specialty scope) |
| `capacity.js` | Per-hospital-per-specialty capacity math (`computeCapacityUsage`, `maxExtraFor`) |
| `applyChangeRequest.js` | Applies an approved ChangeRequest (edit account, or create a capacity-exception trainee), re-validating references |
| `evalScoring.js` | Evaluation scoring / WPBA helpers |
| `arabic.js` | Arabic-insensitive normalization for name matching/dedup |
| `filename.js` | Safe handling of user-supplied upload filenames |
| `eventCode.js` | Generates short human-enterable public event codes |
| `feedbackValidateResponse.js` | Server-side validation of a feedback submission against a published form |
| `initiativeCheckpoints.js` | Canonical approval-checkpoint keys per initiative stage |
| `accreditation.js` | Computed accreditation expiry + traffic-light status (green/yellow/red/black) for programs & centers |
| `trainingYear.js` | Computed training year for advanced trainees (clamped from the program's start date) |
| `centerScope.js` | Resolve a DIO/ODIO/Sub-DIO caller's training-center set for scoped reads |
| `assignedTrainees.js` | Resolve a supervisor's assigned trainee ids (extracted from `routes/supervisor.js`) |
| `csv.js` | Shared CSV helpers (`csvCell`, `buildCsv`) — UTF-8 BOM + CRLF + always-quoted cells |

### Migrations / seeds / scripts

| File | Job |
|---|---|
| `migrations/migrateLegacyRoles.js` | Map legacy role names → V2 roles |
| `migrations/refactorDistributionRotationMeaning.js` | Reconcile Distribution vs Rotation semantics |
| `migrations/fixDataRealism.js` | Clean up/realism-fix seeded data |
| `migrations/reseedProfessionalData.js` / `reseedBasicTrainingData.js` | Reseed a full demo dataset for Advanced / Basic track |
| `migrations/reconcileChangeRequestIndexes.js` | Drop/rebuild the ChangeRequest partial-unique indexes after the capacity feature (DRY_RUN-gated) |
| `migrations/relaxEmailIndex.js` | Make `User.email` sparse-unique so accounts can log in by ID number without an email (DRY_RUN/CONFIRM-gated) |
| `jobs/snapshots.js` | Scheduled weekly/monthly/yearly data-export job (whitelisted collections → per-dataset CSV under `uploads/snapshots/`); opt-in via `SNAPSHOTS_ENABLED` |
| `scripts/assertExportSafety.js` | Build guard (`npm run check:exports`): fails if the snapshot whitelist would leak ChangeRequest/SecurityEvent/Feedback* or User credentials |
| `seeds/specialties.seed.js` | Seed specialties |
| `seeds/superadmin.seed.js` | Seed the super-admin account |
| `seeds/feedback.seed.js` | Seed + publish the AMETI CPD Activity Evaluation feedback form |
| `scripts/showSecurityEvents.js` | Print recent security events |
| `scripts/resetRolePasswords.js` | Bulk-reset passwords for selected roles |
| `scripts/migrate-consultant-memos.js` | One-off consultant-memo document migration |
| `scripts/fix-attachment-names.js` | One-off repair of mojibake attachment filenames |

---

## Frontend (`frontend/`)

### Entry & HTML

| File | Job |
|---|---|
| `frontend/app.html` | SPA entry HTML (the logged-in app) |
| `frontend/landing.html` | Public marketing landing page (tracks, evaluation forms, "Get the Mobile App" section) |
| `frontend/vite.config.js` | Vite build config (multi-page: app + landing) |
| `frontend/vercel.json` | Vercel rewrites (`/` → landing, everything else → app) |
| `frontend/public/` | Static assets: logos, evaluation-form docs, track-documents PDFs, `app/` (CPD APK + form + install guide), pdfjs |
| `src/main.jsx` | React root render + providers |
| `src/App.jsx` | Route table for every role + `ROLE_HOME` redirect map |

### Core plumbing (`src/api`, `src/context`, `src/hooks`, `src/config`)

| File | Job |
|---|---|
| `api/axios.js` | Axios instance: base URL, credentials, JWT header, 401 refresh-and-retry flow |
| `api/cache.js` | Lightweight stale-while-revalidate in-memory cache for GETs |
| `context/AuthContext.jsx` | Auth state (current user, login/logout, refresh) |
| `context/PrefsContext.jsx` | UI prefs: language (EN/AR + RTL) and light/dark theme |
| `hooks/useBasePath.js` | Resolves the role/track base path for routing (e.g. `/basic/...`) |
| `hooks/useCachedGet.js` | Hook wrapping `api/cache.js` for cached GETs |
| `config/roles.js` | Central role → home-route / routing config, shared by `App.jsx` and `ProtectedRoute` |

### Shared components (`src/components/`)

| File | Job |
|---|---|
| `ProtectedRoute.jsx` | Client route guard (redirects by role; UX mirror of backend) |
| `Navbar.jsx` | Top navigation (role-aware links, language/theme toggles) |
| `ProfileDropdown.jsx` | User menu (profile, logout) |
| `NotificationPanel.jsx` | Notification bell + dropdown feed |
| `Toast.jsx` | Floating toast notifications |
| `Skeleton.jsx` | Loading skeleton placeholder |
| `SearchableSelect.jsx` | Searchable dropdown used across forms |
| `ViewToggle.jsx` | Grid/list (or similar) view switcher |
| `AccreditationBadge.jsx` | Traffic-light accreditation chip (green/yellow/red/black) for programs & centers |
| `ReportModal.jsx` | Modal for viewing/grading a report |
| `ErrorBoundary.jsx` | Catches render errors, shows a fallback |
| `icons.jsx` | Single source of truth for inline SVG icons |
| `evaluations/EvalModal.jsx` | Evaluation (WPBA) form modal |
| `evaluations/evalStrings.js` | Bilingual strings for evaluations |
| `eventFeedback/FormBuilder.jsx` | Admin builder for Event Feedback forms |
| `eventFeedback/Responses.jsx` | View/aggregate feedback responses |
| `memo/MemoNavbar.jsx` | Navbar for the consultant-memo area |
| `memo/MemoUi.jsx` | Shared UI pieces for memos |
| `memo/MemoPrint.jsx` | Printable memo layout |
| `memo/MemoPrefs.jsx` | Memo view preferences |
| `memo/CouncilSelect.jsx` | Scientific-council picker (Arabic-insensitive search) |
| `memo/attachmentPreviews.js` | Render/preview memo attachments |
| `memo/arabic.js` | Arabic normalization (mirrors backend `utils/arabic.js`) |
| `memo/useInitiativeAccess.js` | Hook exposing the user's initiative access |
| `memo/initiativeStrings.js` | Localized strings for the Initiatives feature |

### Pages (`src/pages/`)

**Shared / auth / misc**

| File | Job |
|---|---|
| `Profile.jsx` | Current user's profile |
| `Notifications.jsx` | Full notifications page |
| `Timeline.jsx` | Trainee/activity timeline |
| `NotFound.jsx` | 404 page |
| `VerifyCertificate.jsx` | Public certificate verification page |
| `CertificatePrint.jsx` | Printable certificate layout |

**Admin (super_admin)**

| File | Job |
|---|---|
| `AdminDashboard.jsx` | Super-admin dashboard/overview |
| `AdminSpecialties.jsx` | Manage specialties |
| `Users.jsx` | Manage all users |
| `HospitalsUniversities.jsx` | Manage hospitals & universities |
| `Distributions.jsx` | Manage rotations/distributions |
| `Reports.jsx` | All reports |
| `AdminSystem.jsx` | Developer system overview: country cards → their centers + user counts (`GET /api/admin/system`) |
| `AuditLog.jsx` | Audit trail viewer |

**President**

| File | Job |
|---|---|
| `PresidentDios.jsx` | Manage DIOs |
| `PresidentProgramDirectors.jsx` | View/manage program directors |
| `PresidentSecretaries.jsx` | View/manage secretaries |
| `PresidentSupervisors.jsx` | View/manage supervisors |
| `PresidentTrainees.jsx` | View trainees |
| `PresidentHospitals.jsx` | View hospitals |

**DIO**

| File | Job |
|---|---|
| `DioDashboard.jsx` | DIO dashboard/stats |
| `DioUsers.jsx` | Manage users in the track |
| `DioHospitals.jsx` | Hospital cards: specialties, staff, **Capacity & Secretary settings** panel |
| `DioHospitalDetail.jsx` | Single-hospital detail + capacity/secretary editing |
| `DioProgramDirectors.jsx` | Manage program directors |
| `DioAssignPds.jsx` | Assign PDs to specialties |
| `DioSecretaries.jsx` | Manage secretaries |
| `DioSupervisors.jsx` | Manage supervisors |
| `DioTraineeDetail.jsx` | Single trainee detail |
| `DioAssignments.jsx` / `DioDistributions.jsx` / `DioRotations.jsx` | Rotation/assignment management |
| `DioEvaluations.jsx` | Evaluations oversight |
| `DioCertificates.jsx` | Certificate issuing/oversight |
| `DioApprovals.jsx` | Approve/reject secretary change-requests, capacity requests, and research |

**Program Director**

| File | Job |
|---|---|
| `ProgramDirectorTrainees.jsx` | Their specialty's trainees |
| `ProgramDirectorSupervisors.jsx` | Their supervisors |
| `ProgramDirectorEvaluations.jsx` | Evaluations |
| `ProgramDirectorReports.jsx` | Reports |

**Secretary**

| File | Job |
|---|---|
| `SecretaryTrainees.jsx` | Add/edit trainees (edits queued for DIO), assign rotations, capacity-request flow |
| `SecretarySupervisors.jsx` | Add/edit supervisors (edits queued) |
| `SecretaryHospitals.jsx` | Hospital info (read-only capacity/duration for their specialty) |
| `SecretaryResearch.jsx` | Forward/manage trainee research |

**Supervisor**

| File | Job |
|---|---|
| `SupervisorTrainees.jsx` | Their assigned trainees |
| `SupervisorEvaluations.jsx` | Perform WPBA evaluations |
| `SupervisorReports.jsx` | Grade trainee reports |
| `SupervisorResearch.jsx` | Review trainee research |

**Trainee & shared academic**

| File | Job |
|---|---|
| `Grades.jsx` | Trainee grades overview |
| `Research.jsx` | Trainee research/publications |
| `CertificatesCourses.jsx` | Trainee certificates & self-reported courses |

**Consultant memos & initiatives & feedback**

| File | Job |
|---|---|
| `ConsultantMemo.jsx` | Create/edit a consultant memo |
| `ConsultantMemoAll.jsx` | All memos list |
| `ConsultantMemoApproved.jsx` | Approved/signed memos |
| `Initiatives.jsx` | Training Program Initiatives board (staged approval) |
| `EventFeedback.jsx` | Admin Event Feedback management (build forms, view responses) |

**V2 role suites (Registry / Analyzer / Central / DIO-view / SG / PD / shared)**

| File | Job |
|---|---|
| `RegistryCenters.jsx` / `RegistryCenterDetail.jsx` | Data-entry: training-center list + card (accreditation chip, programs `X / 70`, add-program modal) |
| `RegistryCountries.jsx` / `RegistrySpecialties.jsx` | Data-entry: country + specialty CRUD |
| `RegistryDios.jsx` | Data-entry: create DIO (country → center multi-select) + ODIO + Sub-DIO; list |
| `RegistryPds.jsx` | Data-entry: create PD (+ Sub-PD) with specialty; list |
| `AnalyzerDashboard.jsx` | Data Analyzer: filterable stats (country/city/specialty) |
| `AnalyzerStaff.jsx` | Data Analyzer: create/list/edit Data-entry clerks + Central secretaries |
| `AnalyzerExports.jsx` | Data Analyzer: snapshot list + blob download, run-now, analysis-report upload + own list |
| `CentralTrainees.jsx` / `CentralTrainers.jsx` | Central Secretary: global trainee/trainer add + list (trainer optional; capacity block; CR edits) |
| `DioViewDashboard.jsx` / `DioViewCenters.jsx` / `DioViewPds.jsx` / `DioViewTrainees.jsx` / `DioViewTrainers.jsx` | DIO/Sub-DIO read-only suite scoped to the center set (certificates reuse `DioCertificates.jsx`) |
| `SgDashboard.jsx` / `SgCenters.jsx` / `SgDios.jsx` / `SgSpecialties.jsx` / `SgPrograms.jsx` / `SgPds.jsx` / `SgTrainees.jsx` | Secretary General + Assistant Secretary read-only oversight suite |
| `SgReports.jsx` | SG/AS analysis-report inbox (blob downloads) |
| `ProgramDirectorDashboard.jsx` / `ProgramDirectorProgram.jsx` | PD + Sub-PD dashboard (stats) + program card (accreditation, capacity, dates) |
| `Announcements.jsx` | Program announcements board + PD composer (trainee/supervisor/PD/Sub-PD) |
| `LogBook.jsx` / `SupervisorLogBook.jsx` | Trainee log-book entry form + list / supervisor review queue |

### i18n, data, theme, utils

| File | Job |
|---|---|
| `i18n/index.js` | Central translation dictionary + lookup |
| `i18n/strings/*.js` | Per-area string bundles (`common`, `nav`, `admin`, `dio`, `president`, `secretary`, `supervisor`, `program_director`, `trainee`, `profile`, `verify`, `memo`, `initiatives`) |
| `data/evalForms.js` | Definitions of the three WPBA forms (CBD/DOPS/Mini-CEX etc.) |
| `theme/palette.js` | Per-theme chart/category colors for Chart.js dashboards |
| `utils/printEvaluation.js` | Generate a printable, docx-style completed evaluation |

---

## Key flows (quick map)

- **Auth:** `POST /api/auth/login` → access token (in memory) + httpOnly refresh cookie; `axios.js` auto-refreshes on 401. Role → landing via `config/roles.js` `ROLE_HOME`.
- **Secretary edits are queued:** editing a trainee/supervisor creates a `ChangeRequest` (status `pending`) → DIO approves in `DioApprovals` → `applyChangeRequest` applies it. Creates within capacity happen immediately.
- **Capacity:** DIO sets `Hospital.specialtySettings[{ specialtyId, annualCapacity, trainingDurationYears }]` + assigns a secretary per specialty (`DioHospitals` panel → `PATCH /api/dio/hospitals/:id/specialty-settings` and `/specialty-secretary`). Over-capacity trainee creation becomes a `capacity_exception` ChangeRequest.
- **Track isolation:** every query is filtered by `trackFilter(req.track)` / `coerceRoleToTrack`, keeping Advanced and Basic portals separate.
- **Public surfaces:** certificate verification (`/api/certificateVerify`) and the Event Feedback attendee API (`/api/eventFeedbackPublic`) require no login.
