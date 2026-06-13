# Training Program Initiatives — Plan Summary
**مبادرات استحداث برامج تدريبية**

A new feature for the MTMS / MLMS system to track the creation of new medical specialties through a 3‑stage approval pipeline, shown as a Kanban board. Built from three source tracking tables (under‑study, foundational, final).

---

## 1. Overview

Each "initiative" is a proposal to create a new training specialty. It moves through three sequential stages, ticking off approval checkpoints along the way. The feature lives inside the existing consultant‑memo area (`/consultant-memo`) and is reachable only by the ASG accounts.

## 2. Access model (ASG‑only)

- The page is enterable **only by the ASG accounts** (e.g. ASG.1 = Jawad Ibrahem, ASG.2).
- Gating is **account‑level, not role‑based**: an allowlist of emails held in an env var `INITIATIVE_ALLOWED_EMAILS` (comma‑separated). No code change is needed to add ASG.3 later.
- `super_admin` is **not** included (deliberate choice).
- The backend computes `permissions.initiatives` (boolean) from the allowlist and returns it on `POST /api/auth/login` and `GET /api/auth/me`.
- Enforcement is layered: the **backend returns 403** for any non‑allowlisted user (the real guarantee), and the **frontend mirrors it** by hiding the nav button and redirecting anyone without `permissions.initiatives` away from the route. Initiative data never renders for a non‑ASG user.

## 3. Data model — `Initiative`

| Field | Type | Notes |
|------|------|------|
| `name` | String (required) | اسم المبادرة |
| `source` | String | مصدر المبادرة |
| `level` | enum `primary` \| `subspecialty` | رئيسي / دقيق |
| `stage` | enum `under_study` \| `foundational` \| `final` | current Kanban column |
| `checkpoints` | object keyed by checkpoint **key** → `{status:'pending'\|'done', date, note}` | labels are NOT stored — the frontend localizes the key to AR/EN |
| `notes` | String | ملاحظات |
| `createdBy` | ObjectId → User | audit |
| timestamps | | createdAt / updatedAt |

Deletes are **soft** (`deletedAt`) to preserve history. Create / stage‑change / delete are written to the existing audit log.

## 4. Stages and their steps (from the three documents)

**Shared fields on every initiative:** name, source, level (رئيسي/دقيق), notes.

### Stage 1 — Under Study (قيد الدراسة)
- `conceptDraft` — اعداد التصور في المجلس العلمي — *Concept drafted in scientific council*
- `execAdvisory` — تنفيذية - استشاري — *Executive / advisory*

### Stage 2 — Foundational (مرحلة أساسية)
- `conceptApproved` — اعتماد التصور - المجلس العلمي — *Concept approved by scientific council*
- `feasibility` — دراسة الجدوى (توفر برامج تدريبية ومتدربين) — *Feasibility study (training programs & trainees available)*
- `sgApproval` — اعتماد الأمين العام — *Secretary‑General approval*
- `execAdvisory` — تنفيذية استشاري — *Executive / advisory*
- `execOffice` — المكتب التنفيذي — *Executive office*

### Stage 3 — Final (مرحلة نهائية)
- `foundingCommittee` — ترشيح اللجنة التأسيسية من المجلس العلمي — *Founding committee nomination*
- `sgApprovalCommittee` — اعتماد الأمين العام واستكمال اللجنة — *SG approval & committee completion*
- `guidePrepared` — اعداد دليل الاختصاص من قبل اللجنة التأسيسية — *Specialty guide prepared by committee*
- `guideApproved` — اعتماد دليل الاختصاص من قبل المجلس العلمي — *Specialty guide approved by scientific council*
- `programAnnounced` — اعلان البرنامج - الأمانة العامة — *Program announcement by General Secretariat*

## 5. API contract

All routes are chained `auth → requireInitiativeAccess` (allowlist; 403 otherwise).

| Method | URL | Body | Purpose |
|------|-----|------|---------|
| GET | `/api/initiatives` | — (optional `?stage=`) | list all |
| POST | `/api/initiatives` | `{name, source, level, stage?}` | create (default stage `under_study`) |
| GET | `/api/initiatives/:id` | — | one |
| PATCH | `/api/initiatives/:id` | `{name?, source?, level?, notes?}` | edit basic fields (whitelisted) |
| PATCH | `/api/initiatives/:id/stage` | `{stage}` | move stage (allowed anytime) |
| PATCH | `/api/initiatives/:id/checkpoint` | `{key, status, date, note}` | update one checkpoint |
| DELETE | `/api/initiatives/:id` | — | soft delete |

Response shape `Initiative`: `{ _id, name, source, level, stage, checkpoints, notes, createdAt, updatedAt }`.
Auth additions: `login` and `me` responses include `permissions: { initiatives: boolean }`.

## 6. UI / UX

**Entry point:** a new nav button in the memos navbar, placed immediately **before** "جميع المذكرات / All memos". Short nav label (المبادرات / Initiatives); the full title "مبادرات استحداث برامج تدريبية" is the panel heading.

**Board (Kanban):** three columns right‑to‑left — قيد الدراسة → مرحلة أساسية → مرحلة نهائية. Each card shows name, source, level chip, and a checkpoint count (e.g. 3/5). Cards move between stages by drag (or a move control). "إضافة مبادرة / Add initiative" creates a new card in Under Study.

**Detail view (on card click):** styled like the existing memo form (teal section bars, attachments). Contains: a stage stepper, "بيانات المبادرة" (name/source/level/date), "خطوات الاعتماد" listing only the current stage's steps with a Done/In‑Progress toggle + auto date + note, move‑stage buttons, "المرفقات" (reusing the existing PDF/Word upload), "ملاحظات", and Save/Cancel.

**Decision (default, easily changed):** moving to the next stage is **allowed anytime** — it is not blocked until all current‑stage steps are Done.

## 7. Internationalisation & theming

- Full **Arabic + English** via the app's existing language toggle (EN/عربي), including RTL/LTR direction flip. Checkpoint **keys** are stored; labels are localized in the UI.
- Full **light + dark** support via the app's existing theme toggle (فاتح/dark). All colours, including the teal, come from existing theme tokens — nothing hardcoded.

## 8. Build & branching

- Work is based on the **`main`** branch (a `feature/initiatives` working branch off main).
- Split by model: **frontend → Claude Code (default model)**, **backend/security/database → Codex (GPT‑5.5)**, sharing the one API contract above; outputs are reviewed/merged against that contract before applying.
- The frontend agent must **inspect and confirm the correct files first, then wait for approval** before writing code.

## 9. Security notes

- No secrets in code: the ASG allowlist lives in `backend/.env` (`INITIATIVE_ALLOWED_EMAILS`), only the empty key goes in `.env.example`.
- Backend is the source of truth for access (403); frontend guard is UX only.
- Audit logging on create / stage‑change / delete.
- Query‑injection safe: request bodies are field‑whitelisted, never spread into Mongo filters.

## 10. Open items / next steps

- Confirm the ASG emails to put in `INITIATIVE_ALLOWED_EMAILS` (set on the server, not committed).
- Decide whether stage advancement should be **blocked until all current‑stage steps are Done** (currently allowed anytime).
- Run the frontend (Claude Code) and backend (Codex) prompts → review/merge against the contract → run the test prompt → deploy.
