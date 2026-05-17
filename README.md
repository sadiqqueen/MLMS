# MidLearn LMS

A Medical Learning Management System for managing student clinical rotations, evaluations, reports, and certificates.

---

## Project Structure

```
midlearn_LMS/
├── frontend/          # React + Vite SPA
│   ├── src/
│   │   ├── pages/         # Route-level page components
│   │   ├── components/    # Shared UI components (Navbar, Sidebar, etc.)
│   │   ├── api/           # Axios instance and API helpers
│   │   ├── context/       # AuthContext (user session)
│   │   └── data/          # Static data (specialties list, etc.)
│   ├── public/            # Static assets (logo, icons)
│   ├── app.html           # React SPA entry point
│   ├── landing.html       # Public landing page
│   ├── vite.config.js
│   ├── vercel.json        # Vercel MPA rewrites
│   └── package.json
│
├── backend/           # Node.js + Express REST API
│   ├── routes/            # Express route handlers
│   ├── models/            # Mongoose schemas
│   ├── middleware/        # Auth (JWT) and role-guard middleware
│   ├── uploads/           # Uploaded files (PDFs, etc.)
│   ├── server.js          # App entry point
│   └── package.json
│
├── .gitignore
├── package.json       # Root scripts for running both together
└── README.md
```

---

## Roles

| Role        | Home Page              | Capabilities                                      |
|-------------|------------------------|---------------------------------------------------|
| super_admin | /admin/dashboard       | Full access, certificates, user management        |
| admin       | /admin/students        | Students, distributions, hospitals, universities  |
| professor   | /admin/dashboard       | Dashboard, students, distributions                |
| doctor      | /doctor/students       | View assigned students, submit evaluations        |
| student     | /timeline              | View timeline, reports, grades, profile           |
| director    | /director/dashboard    | Director dashboard, doctor management, certificates |

---

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB running locally on port 27017

### Setup

```bash
# Install all dependencies (root + frontend + backend)
npm run install:all

# Start both frontend and backend together
npm run dev

# Or start individually
npm run frontend   # Vite dev server on http://localhost:5173
npm run backend    # Express API on http://localhost:5000
```

The frontend proxies `/api` and `/uploads` requests to `http://localhost:5000` during development.

---

## Deployment

| Service  | What it serves    | Root Directory | Notes                              |
|----------|-------------------|----------------|------------------------------------|
| Vercel   | frontend/         | `frontend`     | Set Root Directory in project settings |
| Railway  | backend/          | `backend`      | Set Root Directory in project settings |

### Environment variables

**Backend (Railway dashboard):**
```
MONGO_URI=mongodb://...
JWT_SECRET=...
PORT=5000
```

**Frontend:** No runtime env vars needed — the API base URL is set in `frontend/src/api/axios.js`.

---

## Key Files

- [frontend/src/App.jsx](frontend/src/App.jsx) — All client-side routes
- [frontend/src/context/AuthContext.jsx](frontend/src/context/AuthContext.jsx) — Auth state and login/logout
- [backend/server.js](backend/server.js) — Express app setup and route mounting
- [backend/models/User.js](backend/models/User.js) — User schema with role enum
- [backend/middleware/auth.js](backend/middleware/auth.js) — JWT verification middleware
