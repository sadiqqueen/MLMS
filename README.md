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

| Role | Home Page | Capabilities |
|------|-----------|--------------|
| super_admin | /admin/dashboard | System-wide administration, users, hospitals, specialties, certificates, audit logs |
| dio | /dio/dashboard | Hospital-scoped DIO dashboard, trainees, supervisors, program directors, secretaries, certificates |
| president | /president/trainees | Read-only hospital/program oversight |
| program_director | /program-director/trainees | Hospital-scoped trainees, supervisors, final reports, evaluations |
| secretary | /secretary/trainees | Specialty-scoped trainee, supervisor, program director, hospital, and distribution management |
| supervisor | /supervisor/trainees | Assigned trainees, reports, evaluations |
| trainee | /timeline | Timeline, report submission, grades, profile |

Legacy roles removed from active code: `doctor`, `student`, `professor`, `director`, and `admin`.
Run `npm --prefix backend run migrate:legacy-roles` before deploying the tightened enum to a database that may still contain old role values.

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
