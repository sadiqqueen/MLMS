# MidLearn LMS

A Medical Learning Management System for managing trainee clinical rotations, evaluations, reports, and certificates.

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

The frontend proxies `/api` and `/uploads` requests to the local backend during development.

---

## Deployment

Set backend environment variables in the server environment:

```bash
MONGO_URI=mongodb://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
FRONTEND_URL=https://your-production-domain
PORT=5000
```

Build the frontend during deployment instead of committing `frontend/dist`.

---

## Key Files

- `frontend/src/App.jsx` — client-side routes
- `frontend/src/context/AuthContext.jsx` — auth state and login/logout
- `backend/server.js` — Express app setup and route mounting
- `backend/models/User.js` — User schema with active role enum
- `backend/middleware/auth.js` — JWT verification middleware
