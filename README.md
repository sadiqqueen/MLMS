# MTMS

Medical Training Management System for managing trainee clinical rotations, evaluations, reports, and certificates.

---

## Project Structure

```
midlearn_LMS/
├── frontend/          # React + Vite SPA
│   ├── src/
│   │   ├── pages/         # Route-level page components
│   │   ├── components/    # Shared UI components
│   │   ├── api/           # Axios instance and API helpers
│   │   └── context/       # AuthContext user session
│   ├── public/            # Static assets
│   ├── landing.html       # Public landing page
│   ├── vite.config.js
│   └── package.json
│
├── backend/           # Node.js + Express REST API
│   ├── routes/            # Express route handlers
│   ├── models/            # Mongoose schemas
│   ├── middleware/        # Auth, scope, audit, and role middleware
│   ├── migrations/        # Database migration scripts
│   ├── uploads/           # Runtime uploaded files
│   ├── server.js
│   └── package.json
│
├── .gitignore
├── package.json
└── README.md
```

---

## Roles

Advanced-track hierarchy (v2). The Basic portal (`b_*` roles under `/basic/*`) and `president` / `asg1` / `asg2` are unchanged.

| Role (label) | Internal string | Home Page | Capabilities |
|------|------|-----------|--------------|
| Developer | `super_admin` | /admin/dashboard | Full access: dashboard, users, hospitals, System page, event feedback, audit logs |
| Secretary General | `secretary_general` | /sg/dashboard | Read-only oversight (centers, DIOs, specialties, programs, PDs, trainees) + analysis-report inbox |
| Assistant Secretary | `assistant_secretary` | /sg/dashboard | Same read-only view set as the Secretary General |
| Data Analyzer | `data_analyzer` | /analyzer/dashboard | Filterable stats; **creates countries, specialties + sub-specialties**, Data-entry + Central-secretary accounts; data snapshots + PDF/PPTX report upload |
| Data Entry | `data_entry` | /registry/centers | Registry: training centers + programs; DIO/Sub-DIO + PD/Sub-PD accounts (PD/Sub-PD carry a specialty). Countries & specialties belong to the Analyzer; ODIO is created by the DIO |
| Central Secretary | `central_secretary` | /central/trainees | Global: add trainees (trainer optional) + trainers; edits queued for ODIO approval |
| DIO | `dio_view` | /dio-view/dashboard | View-only over an assigned center subset + issues/views certificates |
| ODIO | `dio` | /dio/dashboard | View + edit trainees/trainers in the DIO's center set; approves change requests; issues certificates |
| Sub-DIO | `sub_dio` | /dio-view/dashboard | View-only, mirrors the DIO's reads (linked via `dioId`) |
| Program Director | `program_director` | /program-director/trainees | One program: trainees/trainers, dashboard, announcements, final-report grading, evaluations, research |
| Sub-PD | `sub_pd` | /program-director/dashboard | View-only, mirrors the PD's reads (linked via `pdId`) |
| Trainer | `supervisor` | /supervisor/trainees | Assigned trainees, weekly/monthly report grading, WPBA evaluations, log-book sign-off, research |
| Trainee | `trainee` | /timeline | Timeline, reports, log book, portfolio, certificates & courses, announcements, research |
| President | `president` | /president/dashboard | Read-only hospital/program oversight (unchanged) |
| ASG.1 / ASG.2 | `asg1` / `asg2` | /consultant-memo | Consultant memos + initiatives (unchanged) |

Legacy roles removed from active code: `doctor`, `student`, `professor`, `director`, and `admin`. The old `secretary` role remains for the Basic track and legacy accounts.
Run `npm --prefix backend run migrate:legacy-roles` before deploying the tightened enum to a database that may still contain old role values. The v2 rebuild also adds `migrations/relaxEmailIndex.js` (make `User.email` sparse-unique so accounts can log in by ID number) — run it at deploy.

---

## Local Development

### Prerequisites

- Node.js 18+
- MongoDB running locally on port 27017

### Setup

```bash
npm run install:all
npm run dev
```

Or start individually:

```bash
npm run frontend
npm run backend
```

The Vite frontend proxies `/api` and `/uploads` requests to the local backend during development. The public landing page source is `frontend/landing.html`; the React portal entry is generated as `frontend/dist/app.html` during builds.

Useful local checks:

```bash
npm run build:frontend
npm run check:backend
npm run deploy:check
```

---

## Deployment

### VPS Layout

The production application lives at:

```bash
/var/www/MLMS
```

Nginx serves `frontend/dist`. Do not commit `frontend/dist`; it is generated on the VPS from source during deployment:

- `frontend/landing.html` builds into `frontend/dist/landing.html`
- the React portal builds into `frontend/dist/app.html`

The backend runs under PM2 as:

```bash
mlms-backend
```

### Required Server Files

Create and maintain `backend/.env` manually on the VPS. It must not be committed.

```bash
MONGO_URI=mongodb://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=https://your-production-domain
PORT=5000
```

The `backend/uploads` directory contains runtime server data. Do not commit it and do not delete it during deployment.

### Deploy From The VPS

Run:

```bash
cd /var/www/MLMS
bash scripts/deploy-vps.sh
```

The script:

- pulls `origin main`
- installs root, backend, and frontend dependencies
- includes frontend dev dependencies so Vite is available on clean servers
- builds `frontend/dist`
- clears PM2 logs and restarts `mlms-backend` with `--update-env`
- validates and reloads nginx
- checks the local backend `/health` endpoint
- prints the live bundle references from `/app.html`

Optional overrides:

```bash
APP_DIR=/var/www/MLMS PM2_APP_NAME=mlms-backend LIVE_URL=https://mlmsksb.com bash scripts/deploy-vps.sh
```

---

## Key Files

- `frontend/src/App.jsx` — client-side routes
- `frontend/src/context/AuthContext.jsx` — auth state and login/logout
- `backend/server.js` — Express app setup and route mounting
- `backend/models/User.js` — User schema with active role enum
- `backend/middleware/auth.js` — JWT verification middleware
