# Graph Report - .  (2026-07-09)

## Corpus Check
- 213 files · ~283,316 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1587 nodes · 3129 edges · 87 communities (77 shown, 10 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.72)
- Token cost: 325,151 input · 0 output

## Community Hubs (Navigation)
- Trainee Grades & Evaluations UI
- Project Docs & Landing Page
- UI/UX Design System Generator
- UI/UX Design System Generator
- Specialties & Data-Fix Scripts
- Claude Skills & Agent Routing
- Professional Data Reseed
- App Shell & Auth Context
- DIO/Secretary User Pages
- Backend/Security Skill Docs
- Root package.json / deps
- Basic-Track Reseed
- DIO Backend Route
- Navbar, Users & Roles
- DIO Certificates & Hospitals UI
- Rotations Backend Route
- Admin/President Dashboards UI
- Initiatives UI (Kanban)
- Admin V2 & Audit Log
- Distributions Backend Route
- Users Backend Route
- DIO Assignments UI
- Secretary Backend Route
- Initiatives Backend & Model
- Hospitals/Universities & Roles
- DIO Trainee Detail Page
- Frontend package.json / deps
- Prefs Context & i18n
- President Backend Route
- Consultant Memo Backend
- Secretary/Supervisor Pages
- Certificates Backend Route
- Express Server Bootstrap
- User Model & Migrations
- Frontend API Cache
- Backend package.json / scripts
- Auth & Initiative Access
- Reports Backend & Model
- Icons & Memo Navbar
- Consultant Memo Form UI
- Auth Middleware & Track
- Trainee Route & Scope Guard
- Scientific Councils & Arabic
- Supervisor Backend Route
- Evaluations UI (Dio/Supervisor)
- Dashboard & Core Models
- DIO Managed-User Helpers
- Consultant Memo (All) UI
- DIO Users Page
- Program Director Backend Route
- Rotation Model & Migration
- Evaluations & Notifications Route
- Security Events Model & Script
- Admin Distributions UI
- Secretary Hospitals UI
- Memo Prefs & Print
- Railway Deploy Config
- Security Logger & Honeypot
- President Hospitals UI
- Rate Limiter Middleware
- Error Boundary
- President Secretaries UI
- President Supervisors UI
- President Trainees UI
- Program Director Trainees UI
- Certificate Model & Verify
- President DIOs UI
- Password Reset Script
- Council Select Component
- Chart Palette
- Filename / Content-Disposition Util
- Attachment-Name Fix Script
- Notification Panel
- Certificate Print Page
- Verify Certificate Page
- search.py
- ConsultantMemo.js
- migrate-consultant-memos.js
- search.py
- MTMS Light-theme Logo
- deploy-vps.sh
- diagnose.js
- Arab Board Logo
- vercel.json
- MTMS Favicon

## God Nodes (most connected - your core abstractions)
1. `api` - 47 edges
2. `Navbar()` - 45 edges
3. `useAuth()` - 43 edges
4. `Skeleton()` - 42 edges
5. `Toast()` - 32 edges
6. `MTMS README` - 22 edges
7. `allowRoles()` - 21 edges
8. `usePrefs()` - 21 edges
9. `ViewToggle()` - 19 edges
10. `useBasePath()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Initiatives Design Mockup (Kanban UI)` --semantically_similar_to--> `Bilingual EN/AR + RTL/LTR Toggle`  [INFERRED] [semantically similar]
  initiatives-plan/Initiatives-Design-Mockup.html → frontend/landing.html
- `Portal Login Panel` --semantically_similar_to--> `JWT Auth Middleware`  [INFERRED] [semantically similar]
  index.html → README.md
- `MTMS Marketing Landing Page (index.html)` --semantically_similar_to--> `Public Landing Page (landing.html)`  [INFERRED] [semantically similar]
  index.html → frontend/landing.html
- `Initiatives API (auth -> requireInitiativeAccess)` --semantically_similar_to--> `JWT Auth Middleware`  [INFERRED] [semantically similar]
  initiatives-plan/Initiatives-Plan-Summary.md → README.md
- `Basic Clinical Training Track (Medical Internship)` --semantically_similar_to--> `Clinical Rotations`  [INFERRED] [semantically similar]
  frontend/landing.html → README.md

## Import Cycles
- 4-file cycle: `frontend/src/components/memo/MemoPrefs.jsx -> frontend/src/context/PrefsContext.jsx -> frontend/src/i18n/index.js -> frontend/src/i18n/strings/memo.js -> frontend/src/components/memo/MemoPrefs.jsx`

## Hyperedges (group relationships)
- **Codex-Driven Backend Work Loop (pre-review, route, post-review)** — _agents_skills_claude_codex_prompt_reviewer_skill, _agents_skills_mtms_agent_routing_skill, _agents_skills_claude_codex_work_reviewer_skill, _agents_skills_mtms_agent_routing_skill_codex_gpt_5_5 [INFERRED 0.80]
- **MTMS Defensive Security Hardening** — _agents_skills_mtms_security_audit_honeypot_skill, _agents_skills_mtms_security_debug_skill, _agents_skills_mtms_security_audit_honeypot_skill_rate_limiting, _agents_skills_mtms_agent_routing_skill_secret_protection [INFERRED 0.75]
- **Full-Stack Split (frontend, backend, database) Against One API Contract** — _agents_skills_mtms_frontend_skill, _agents_skills_mtms_backend_api_skill, _agents_skills_mtms_database_skill, _agents_skills_mtms_agent_routing_skill_model_routing_rules [INFERRED 0.75]
- **MTMS RBAC + scope data-isolation enforcement** — _claude_skills_mtms_codebase_navigator_skill_permission_chain, _claude_skills_mtms_codebase_navigator_skill_roles_enum, _claude_skills_mtms_security_auditor_skill_rbac_scope, _claude_skills_mtms_frontend_debugger_skill_role_home [INFERRED 0.85]
- **Coworker multi-agent coordination workflow** — _claude_skills_mtms_agent_routing_skill_coworker_coordinator, _claude_skills_mtms_agent_routing_skill_claude_code_fable_5, _claude_skills_mtms_agent_routing_skill_codex_gpt_5_5, _claude_skills_mtms_codex_claude_workflow_skill [INFERRED 0.85]
- **MTMS pre-deploy verification gate** — _claude_skills_mtms_deployment_vps_railway_skill_deploy_check, _claude_skills_mtms_testing_checklist_skill_scripts, _claude_skills_mtms_testing_checklist_skill_role_redirect_test, _claude_skills_mtms_backend_debugger_skill_health [INFERRED 0.85]
- **Account lifecycle: deactivate -> reactivate -> hard delete** — docs_api_contract_deactivate_user, docs_api_contract_reactivate, docs_api_contract_hard_delete, docs_api_contract_lifecycle [EXTRACTED 1.00]
- **Initiatives 3-stage approval pipeline (Kanban)** — initiatives_plan_initiatives_plan_summary_stage_under_study, initiatives_plan_initiatives_plan_summary_stage_foundational, initiatives_plan_initiatives_plan_summary_stage_final, initiatives_plan_initiatives_plan_summary_kanban_board [EXTRACTED 1.00]
- **Seven role-based dashboards** — readme_super_admin, readme_dio, readme_president, readme_program_director, readme_secretary, readme_supervisor, readme_trainee [EXTRACTED 1.00]

## Communities (87 total, 10 thin omitted)

### Community 0 - "Trainee Grades & Evaluations UI"
Cohesion: 0.05
Nodes (63): fmtDate(), gridCell, LABEL_STYLE, MONTH_LABEL, safeText(), StructuredForm(), IconCheck(), IconClock() (+55 more)

### Community 1 - "Project Docs & Landing Page"
Cohesion: 0.06
Nodes (56): MTMS Project Instructions for Codex (AGENTS.md), API Contract: Account Delete vs Deactivate, DELETE /api/admin/users/:id (Admin Deactivate), Hard-delete Cascade / Reassign, DELETE /api/users/:id (Deactivate, soft), DELETE /api/dio/<role>/:id (DIO Deactivate), DELETE /api/admin/users/:id/permanent (Hard Delete), Account Lifecycle (Active -> Inactive -> Delete) (+48 more)

### Community 2 - "UI/UX Design System Generator"
Cohesion: 0.06
Nodes (40): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+32 more)

### Community 3 - "UI/UX Design System Generator"
Cohesion: 0.06
Nodes (40): BM25, detect_domain(), _load_csv(), Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query, Load CSV and return list of dicts, Core search function using BM25 (+32 more)

### Community 4 - "Specialties & Data-Fix Scripts"
Cohesion: 0.06
Nodes (41): dryTag(), DUMMY_TRAINEE_PATTERNS, fixDummyTrainees(), fixFutureDistributions(), fixPDSpecialties(), info(), log(), main() (+33 more)

### Community 5 - "Claude Skills & Agent Routing"
Cohesion: 0.06
Nodes (48): fable-advisor agent (read-only senior architect advisor), Claude Fable 5 system-prompt reference document, Claude behavior & safety/refusal rules, Memory system & persistent artifact storage, Web search & copyright compliance, Tool definitions & parameter schemas, Fable 5 Reference skill, MTMS Agent Routing (Coordinator) skill (+40 more)

### Community 6 - "Professional Data Reseed"
Cohesion: 0.09
Nodes (42): actions, addMonths(), buildProfessionalData(), cancelOldRotations(), Certificate, countPlanned(), deactivateOldDistributions(), deactivateOldHospitals() (+34 more)

### Community 7 - "App Shell & Auth Context"
Cohesion: 0.10
Nodes (28): setAccessToken(), toSafeUser(), App(), RootRedirect(), IconDelete, ProfileDropdown(), ProtectedRoute(), ROLE_HOME (+20 more)

### Community 8 - "DIO/Secretary User Pages"
Cohesion: 0.08
Nodes (22): IconBan(), IconEdit, IconPencil(), IconPrint, SearchableSelect(), ViewToggle(), asArray(), Certificates() (+14 more)

### Community 9 - "Backend/Security Skill Docs"
Cohesion: 0.06
Nodes (40): Claude Codex Prompt Reviewer Skill, Claude Codex Work Reviewer Skill, Claude MTMS Browser Tester Skill, Test Credential Handling (prompt vs .env.test), Playwright Browser Testing, MTMS Agent Routing (Coordinator), Single API Contract, auth -> allowRoles -> scopeGuard Middleware Chain (+32 more)

### Community 10 - "Root package.json / deps"
Cohesion: 0.05
Nodes (38): author, bugs, url, dependencies, @anthropic-ai/sdk, bcryptjs, cookie-parser, cors (+30 more)

### Community 11 - "Basic-Track Reseed"
Cohesion: 0.10
Nodes (35): actions, addMonths(), BASIC_USER_EMAILS, buildBasicData(), Certificate, deactivateStaleBasicUsers(), Distribution, Evaluation (+27 more)

### Community 12 - "DIO Backend Route"
Cohesion: 0.07
Nodes (26): { allowRoles }, auditLog, auth, belongsToHospital(), Certificate, { coerceRoleToTrack, trackFilter, trackForRole }, DIO, DIO_ROLE_ROUTE (+18 more)

### Community 13 - "Navbar, Users & Roles"
Cohesion: 0.10
Nodes (25): IconLock(), IconPassword, IconUnlock(), notifLink(), ADVANCED_HOME, ADVANCED_LINKS, basePathForRole(), baseRole() (+17 more)

### Community 14 - "DIO Certificates & Hospitals UI"
Cohesion: 0.11
Nodes (18): Toast(), useBasePath(), AdminSpecialties(), EVAL_TYPES, PDF_TYPES, CERT_TYPES, DioCertificates(), EMPTY_FORM (+10 more)

### Community 15 - "Rotations Backend Route"
Cohesion: 0.10
Nodes (23): { allowRoles }, AuditLog, auth, belongsToHospital(), dateOnly(), ensureDioCanAccessRotation(), getDioHospitalOrFail(), getHospital() (+15 more)

### Community 16 - "Admin/President Dashboards UI"
Cohesion: 0.12
Nodes (23): api, Skeleton(), AdminDashboard(), DONUT_COLORS, fmtDate(), STAT_CARDS, textValue(), ACTION_COLORS (+15 more)

### Community 17 - "Initiatives UI (Kanban)"
Cohesion: 0.14
Nodes (26): IconArchive(), IconRestore(), CHECKPOINT_LABELS, checkpointLabel(), INIT_STRINGS, LEVEL_LABELS, levelLabel(), LEVELS (+18 more)

### Community 18 - "Admin V2 & Audit Log"
Cohesion: 0.07
Nodes (23): AuditLog, auditLogSchema, mongoose, retentionDays, ADMIN, { allowRoles }, auditLog, auth (+15 more)

### Community 19 - "Distributions Backend Route"
Cohesion: 0.10
Nodes (20): { allowRoles }, AuditLog, auth, belongsToHospital(), Distribution, ensureDioCanAccessDistribution(), getDioHospitalOrFail(), getHospital() (+12 more)

### Community 20 - "Users Backend Route"
Cohesion: 0.08
Nodes (26): ADMIN_EDITABLE, ALLOWED_CREATE_FIELDS, { allowRoles }, auditLog, auth, bcrypt, blockCrossTrackWrite(), { coerceRoleToTrack, trackForRole, baseRole } (+18 more)

### Community 21 - "DIO Assignments UI"
Cohesion: 0.12
Nodes (22): Navbar(), DioAssignments(), TABS, DioDistributions(), DistModal(), DistributionsPanel(), getId(), safeArr() (+14 more)

### Community 22 - "Secretary Backend Route"
Cohesion: 0.09
Nodes (19): { allowRoles }, auditLog, auth, { coerceRoleToTrack, trackFilter }, CREATE_USER_FIELDS, dateOnly(), getHospital(), getSecretaryHospitalIds() (+11 more)

### Community 23 - "Initiatives Backend & Model"
Cohesion: 0.12
Nodes (19): attachmentFileSchema, checkpointSchema, initiativeSchema, mongoose, {
  STAGES,
  LEVELS,
  CHECKPOINT_STATUSES,
  ALL_CHECKPOINT_KEYS,
}, auditLog, auth, Initiative (+11 more)

### Community 24 - "Hospitals/Universities & Roles"
Cohesion: 0.09
Nodes (15): allowRoles(), mongoose, universitySchema, { allowRoles }, auth, Hospital, HOSPITAL_FIELDS, MANAGERS (+7 more)

### Community 25 - "DIO Trainee Detail Page"
Cohesion: 0.14
Nodes (18): IconBack(), IconPrinter(), CertificatesTable(), DioTraineeDetail(), EVAL_TYPES, EvaluationsTable(), fmtDate(), GRADE_OPTIONS (+10 more)

### Community 26 - "Frontend package.json / deps"
Cohesion: 0.10
Nodes (20): dependencies, axios, chart.js, mammoth, pdfjs-dist, react, react-chartjs-2, react-dom (+12 more)

### Community 27 - "Prefs Context & i18n"
Cohesion: 0.11
Nodes (8): PrefsContext, PrefsProvider(), readLang(), readTheme(), AREAS, dict, nav, NOTE: the ASG.1 / ASG.2 consultant-memo link keeps its own dynamic label

### Community 28 - "President Backend Route"
Cohesion: 0.13
Nodes (19): activeRoleQuery(), { allowRoles }, auth, Certificate, Distribution, Evaluation, Hospital, listHospitals() (+11 more)

### Community 29 - "Consultant Memo Backend"
Cohesion: 0.11
Nodes (15): { allowRoles }, ASG, attachDir, attachStorage, auth, ConsultantMemo, crypto, { decodeOriginalName } (+7 more)

### Community 30 - "Secretary/Supervisor Pages"
Cohesion: 0.19
Nodes (16): usePrefs(), ConfirmDelete(), fmtDate(), RotationModal(), SecretaryTrainees(), STRINGS, tr(), TraineeModal() (+8 more)

### Community 31 - "Certificates Backend Route"
Cohesion: 0.14
Nodes (15): { allowRoles }, AuditLog, auth, CERT_READ, CERT_WRITE, Certificate, ensureCertificateScope(), formatCertificateForPrint() (+7 more)

### Community 32 - "Express Server Bootstrap"
Cohesion: 0.12
Nodes (16): writeLimiter, app, auth, { contentDisposition }, cookieParser, cors, crypto, express (+8 more)

### Community 33 - "User Model & Migrations"
Cohesion: 0.12
Nodes (11): mongoose, ROLE_MIGRATIONS, User, bcrypt, mongoose, userSchema, readline, rl (+3 more)

### Community 34 - "Frontend API Cache"
Cohesion: 0.24
Nodes (15): baseAdapter, cacheKey(), cachingAdapter(), isCacheableGet(), emit(), emitAll(), fetchDeduped(), invalidate() (+7 more)

### Community 35 - "Backend package.json / scripts"
Cohesion: 0.12
Nodes (16): description, devDependencies, concurrently, name, scripts, backend, build:backend-check, build:frontend (+8 more)

### Community 36 - "Auth & Initiative Access"
Cohesion: 0.14
Nodes (13): ASG_ROLES, hasInitiativeAccess(), requireInitiativeAccess(), auth, { hasInitiativeAccess }, jwt, { loginLimiter, refreshLimiter }, multer (+5 more)

### Community 37 - "Reports Backend & Model"
Cohesion: 0.12
Nodes (14): mongoose, reportSchema, { allowRoles }, auth, Distribution, mongoose, multer, Notification (+6 more)

### Community 38 - "Icons & Memo Navbar"
Cohesion: 0.19
Nodes (12): IconBoard(), IconChevron, IconFolder(), IconMoon(), IconPlus(), IconPower(), IconSun(), stroke (+4 more)

### Community 39 - "Consultant Memo Form UI"
Cohesion: 0.23
Nodes (13): IconPaperclip(), IconSave(), AutoTextarea(), ConsultantMemo(), DT_KEYS, EMPTY, fromMemo(), isEmptyForm() (+5 more)

### Community 40 - "Auth Middleware & Track"
Cohesion: 0.19
Nodes (12): attachTrack(), { baseRole, trackForRole }, jwt, User, ensureDioCanAccessReport(), auth, Notification, router (+4 more)

### Community 41 - "Trainee Route & Scope Guard"
Cohesion: 0.13
Nodes (11): distributionSchema, mongoose, { allowRoles }, auth, Distribution, Evaluation, Report, Rotation (+3 more)

### Community 42 - "Scientific Councils & Arabic"
Cohesion: 0.18
Nodes (12): mongoose, { normalizeArabic }, scientificCouncilSchema, { allowRoles }, ASG, auth, DEFAULT_COUNCILS, ensureSeeded() (+4 more)

### Community 43 - "Supervisor Backend Route"
Cohesion: 0.14
Nodes (14): { allowRoles }, auditLog, auth, Distribution, Evaluation, getAssignedTraineeIds(), isAssignedTrainee(), mongoose (+6 more)

### Community 44 - "Evaluations UI (Dio/Supervisor)"
Cohesion: 0.30
Nodes (12): Avatar(), baseEvalType(), EvalModal(), evalSubjectId(), evalType(), isThisMonth(), safeArr(), EVAL_STRINGS (+4 more)

### Community 45 - "Dashboard & Core Models"
Cohesion: 0.14
Nodes (11): evaluationSchema, mongoose, hospitalSchema, mongoose, { allowRoles }, auth, Distribution, Evaluation (+3 more)

### Community 46 - "DIO Managed-User Helpers"
Cohesion: 0.26
Nodes (14): createManagedUser(), isValidObjectId(), normalizeUserPayload(), pick(), populateManagedUser(), registerManagedUserRoutes(), requiredFieldsForRole(), requiredMissing() (+6 more)

### Community 47 - "Consultant Memo (All) UI"
Cohesion: 0.22
Nodes (10): IconCopy(), buildAttachmentPreviews(), PDFJS_ASSETS, MemoModal(), MemoToasts(), useMemoToasts(), fmtDateTime(), ConsultantMemoAll() (+2 more)

### Community 48 - "DIO Users Page"
Cohesion: 0.26
Nodes (12): CREATABLE_ROLES, DioUsers(), hospitalIdOf(), hospitalName(), ROLE_META, ROLE_ORDER, roleFields(), specialtyIdOf() (+4 more)

### Community 49 - "Program Director Backend Route"
Cohesion: 0.15
Nodes (11): { allowRoles }, auditLog, auth, Distribution, Evaluation, Notification, PD, Report (+3 more)

### Community 50 - "Rotation Model & Migration"
Cohesion: 0.21
Nodes (10): AuditLog, Distribution, inferStatus(), main(), mongoose, normalizeId(), Rotation, writeAudit() (+2 more)

### Community 51 - "Evaluations & Notifications Route"
Cohesion: 0.17
Nodes (10): mongoose, notificationSchema, { allowRoles }, auth, CAN_SUBMIT, Evaluation, Notification, router (+2 more)

### Community 52 - "Security Events Model & Script"
Cohesion: 0.24
Nodes (10): mongoose, retentionDays, securityEventSchema, main(), mongoose, parseLimit(), readArg(), sanitizeText() (+2 more)

### Community 53 - "Admin Distributions UI"
Cohesion: 0.33
Nodes (9): DistModal(), Distributions(), getData(), getId(), getStatusClass(), ROWS_OPT, safeArr(), STATUS_OPTS (+1 more)

### Community 54 - "Secretary Hospitals UI"
Cohesion: 0.31
Nodes (8): hospitalIdOf(), idOf(), initialsFor(), PersonList(), safeArr(), SecretaryHospitals(), specialtyName(), unwrapList()

### Community 55 - "Memo Prefs & Print"
Cohesion: 0.31
Nodes (7): APP_NAV_LABEL, MemoPrefsProvider(), NOTE: state now lives in the GLOBAL PrefsContext. This module is a thin, STRINGS, MemoPrint(), textBody(), fmtDate()

### Community 56 - "Railway Deploy Config"
Cohesion: 0.20
Nodes (9): build, builder, deploy, healthcheckPath, healthcheckTimeout, restartPolicyMaxRetries, restartPolicyType, startCommand (+1 more)

### Community 57 - "Security Logger & Honeypot"
Cohesion: 0.36
Nodes (7): { logSecurityEvent }, SUSPICIOUS_PATTERNS, safeIp(), safeMetadata(), SecurityEvent, securityEventFromRequest(), truncate()

### Community 58 - "President Hospitals UI"
Cohesion: 0.53
Nodes (8): firstLabel(), getProgramDirector(), getSpecialty(), HospitalModal(), label(), PresidentHospitals(), renderValue(), safeArr()

### Community 59 - "Rate Limiter Middleware"
Cohesion: 0.29
Nodes (7): globalLimiter, loginLimiter, { logSecurityEvent }, rateLimit, rateLimitHandler(), refreshLimiter, logSecurityEvent()

### Community 60 - "Error Boundary"
Cohesion: 0.29
Nodes (3): ErrorBoundary, readLang(), STRINGS

### Community 61 - "President Secretaries UI"
Cohesion: 0.54
Nodes (7): DetailModal(), firstLabel(), getHospital(), getSpecialty(), label(), PresidentSecretaries(), renderValue()

### Community 62 - "President Supervisors UI"
Cohesion: 0.54
Nodes (7): DetailModal(), firstLabel(), getHospital(), getSpecialty(), label(), PresidentSupervisors(), renderValue()

### Community 63 - "President Trainees UI"
Cohesion: 0.54
Nodes (7): DetailModal(), firstLabel(), getHospital(), getSpecialty(), label(), PresidentTrainees(), renderValue()

### Community 64 - "Program Director Trainees UI"
Cohesion: 0.54
Nodes (7): fmtDate(), getHospitalName(), getSpecialtyName(), getStatusStyle(), ProgramDirectorTrainees(), TraineeModal(), weeksBetween()

### Community 65 - "Certificate Model & Verify"
Cohesion: 0.29
Nodes (5): certificateSchema, mongoose, { v4: uuidv4 }, Certificate, router

### Community 66 - "President DIOs UI"
Cohesion: 0.62
Nodes (6): DetailModal(), firstLabel(), getHospital(), label(), PresidentDios(), renderValue()

### Community 67 - "Password Reset Script"
Cohesion: 0.33
Nodes (5): bcrypt, mongoose, path, ROLES, User

### Community 68 - "Council Select Component"
Cohesion: 0.53
Nodes (4): IconCaret(), normalizeArabic(), searchNormalizeArabic(), CouncilSelect()

### Community 69 - "Chart Palette"
Cohesion: 0.33
Nodes (4): CATEGORY_COLORS_DARK, CATEGORY_COLORS_LIGHT, DARK, LIGHT

### Community 70 - "Filename / Content-Disposition Util"
Cohesion: 0.40
Nodes (4): contentDisposition(), decodeOriginalName(), RFC-5987, RFC-6266

### Community 72 - "Notification Panel"
Cohesion: 0.67
Nodes (3): IconTrash(), NotificationPanel(), timeAgo()

### Community 73 - "Certificate Print Page"
Cohesion: 0.83
Nodes (3): CertificatePrint(), fmtDate(), textValue()

### Community 74 - "Verify Certificate Page"
Cohesion: 0.83
Nodes (3): fmt(), textValue(), VerifyCertificate()

### Community 79 - "MTMS Light-theme Logo"
Cohesion: 1.00
Nodes (3): MTMS Light-theme Logo, MTMS App Logo, MTMS App Logo

## Knowledge Gaps
- **571 isolated node(s):** `mongoose`, `AuditLog`, `jwt`, `User`, `{ baseRole, trackForRole }` (+566 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `allowRoles()` connect `Hospitals/Universities & Roles` to `Specialties & Data-Fix Scripts`, `Reports Backend & Model`, `Trainee Route & Scope Guard`, `Scientific Councils & Arabic`, `Supervisor Backend Route`, `DIO Backend Route`, `Dashboard & Core Models`, `DIO Managed-User Helpers`, `Rotations Backend Route`, `Program Director Backend Route`, `Admin V2 & Audit Log`, `Distributions Backend Route`, `Evaluations & Notifications Route`, `Users Backend Route`, `Secretary Backend Route`, `President Backend Route`, `Consultant Memo Backend`, `Certificates Backend Route`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `api` connect `Admin/President Dashboards UI` to `Trainee Grades & Evaluations UI`, `App Shell & Auth Context`, `DIO/Secretary User Pages`, `Navbar, Users & Roles`, `DIO Certificates & Hospitals UI`, `Initiatives UI (Kanban)`, `DIO Assignments UI`, `DIO Trainee Detail Page`, `Secretary/Supervisor Pages`, `Icons & Memo Navbar`, `Consultant Memo Form UI`, `Evaluations UI (Dio/Supervisor)`, `Consultant Memo (All) UI`, `DIO Users Page`, `Admin Distributions UI`, `Secretary Hospitals UI`, `President Hospitals UI`, `President Secretaries UI`, `President Supervisors UI`, `President Trainees UI`, `Program Director Trainees UI`, `President DIOs UI`, `Certificate Print Page`, `Verify Certificate Page`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `Skeleton()` connect `Admin/President Dashboards UI` to `Trainee Grades & Evaluations UI`, `App Shell & Auth Context`, `DIO/Secretary User Pages`, `Navbar, Users & Roles`, `DIO Certificates & Hospitals UI`, `Initiatives UI (Kanban)`, `DIO Assignments UI`, `DIO Trainee Detail Page`, `Secretary/Supervisor Pages`, `Evaluations UI (Dio/Supervisor)`, `Consultant Memo (All) UI`, `DIO Users Page`, `Admin Distributions UI`, `Secretary Hospitals UI`, `President Hospitals UI`, `President Secretaries UI`, `President Supervisors UI`, `President Trainees UI`, `Program Director Trainees UI`, `President DIOs UI`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `BM25 ranking algorithm for text search`, `Lowercase, split, remove punctuation, filter short words`, `Build BM25 index from documents` to the rest of the system?**
  _628 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Trainee Grades & Evaluations UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05153153153153153 - nodes in this community are weakly interconnected._
- **Should `Project Docs & Landing Page` be split into smaller, more focused modules?**
  _Cohesion score 0.05649350649350649 - nodes in this community are weakly interconnected._
- **Should `UI/UX Design System Generator` be split into smaller, more focused modules?**
  _Cohesion score 0.05520614954577219 - nodes in this community are weakly interconnected._