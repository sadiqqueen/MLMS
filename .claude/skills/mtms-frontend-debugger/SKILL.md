---
name: mtms-frontend-debugger
description: Debug the MTMS / MLMS React + Vite frontend. Use when a page won't load, a role lands on the wrong dashboard, API calls 401/redirect to login, the auth context is empty, notifications don't show, the layout breaks on mobile, or the Vite build fails. Covers route inspection, axios/fetch tracing, auth context checks, role redirects, and safe UI fixes.
---

# MTMS Frontend Debugger

React 18 SPA built with Vite 8, routed by `react-router-dom` v6. Entry `src/main.jsx` → `src/App.jsx`. Session lives in `src/context/AuthContext.jsx`; all API traffic goes through `src/api/axios.js`. In dev, Vite proxies `/api` and `/uploads` to `localhost:5000`.

## When to use it

- Blank/broken page, wrong-dashboard redirect, login loop, missing data, notification UI issues, mobile layout bugs, or build/lint errors.

## Route inspection

- All routes are declared in `src/App.jsx`, each wrapped in `<ProtectedRoute allowedRoles={[...]}>`.
- `ROLE_HOME` (in both `App.jsx` and `components/ProtectedRoute.jsx`) maps each role to its landing route. The two copies must agree — a mismatch causes redirect loops.
- Unknown paths redirect to `/`; `RootRedirect` sends a logged-in user to `ROLE_HOME[role]`.
- To debug a wrong-page issue: confirm `user.role`, then trace `ProtectedRoute` — if `allowedRoles` excludes the role it redirects to that role's home; if `user` is null it redirects to `/`.

## API calls through axios/fetch

- Use the shared instance: `import api from '../api/axios'`. It sets `withCredentials:true`, attaches the in-memory access token as `Authorization: Bearer`, and reads `X-New-Access-Token` to silently rotate.
- On `401` (non-auth endpoints) the interceptor calls `/api/auth/refresh` once (`_retry`), then retries; if refresh fails it clears state and redirects to `/`. A login loop usually means refresh is failing (expired/missing cookie, CORS blocking credentials, or backend down).
- `AuthContext` also uses raw `fetch('/api/auth/refresh', {credentials:'include'})` on mount and on a 14-minute timer. If requests 404/blocked, check the Vite proxy (dev) or that the API origin matches `FRONTEND_URL`/CORS (prod).
- In the browser: Network tab → confirm `Authorization` header present, response status, and whether the refresh cookie is sent. Console shows React errors.

## Auth context checks

- `useAuth()` exposes `{user, token, login, logout, loading, updateToken}`.
- `loading` is true until the initial refresh resolves — components must guard on it (`ProtectedRoute` renders "Loading…").
- `user` is a sanitized "safe user" (no token). If `user` is unexpectedly null after login, verify `login(token,user)` was called and the refresh on mount returned `{token,user}`.

## Role dashboard redirects

- After login, expected landings: super_admin→`/admin/dashboard`, dio→`/dio/dashboard`, secretary→`/secretary/trainees`, supervisor→`/supervisor/trainees`, program_director→`/program-director/trainees`, president→`/president/trainees`, trainee→`/timeline`.
- Wrong landing → check the role string from the API matches the enum exactly (legacy values like `admin`/`student` are no longer mapped and fall through to `/`).

## Notification UI checks

- `components/NotificationPanel.jsx` fetches from `/api/notifications` via `api`. If empty/stuck: confirm the request succeeds (200, not 401), the response shape matches what the component renders, and the panel's open/unread state updates. A silent 401 here often means the session expired — see the axios refresh flow.

## Mobile responsiveness checks

- Verify layout at ~375px (mobile), 768px (tablet), 1280px (desktop) using browser device emulation.
- Check `Navbar`, dashboards, and tables for overflow/clipping; tables of trainees/reports are the usual offenders. Prefer CSS-only fixes (wrap/scroll containers) over structural JSX changes.

## Build errors

```bash
npm run build:frontend       # root: installs dev deps + vite build
cd frontend && npm run build # direct
cd frontend && npm run dev   # reproduce with HMR + clearer stack traces
```
- Common causes: a bad/case-wrong import path (Linux build servers are case-sensitive — e.g. `Timeline` vs `timeline`), a missing export, or JSX syntax errors. Read the first Vite/rollup error; later errors usually cascade from it.
- Remember the dual-entry build: `landing.html`→`dist/landing.html`, React portal→`dist/app.html` (see `vercel.json`). Don't break either entry.

## Safe UI fixes

- Change presentation, not auth/role logic, unless that IS the bug. If you touch `ROLE_HOME`, update BOTH copies.
- Don't store tokens or sensitive data in `localStorage` (only the safe-user object belongs there).
- Keep API calls on the shared `api` instance so the refresh/interceptor behavior is preserved.
- After any change, rebuild (`npm run build:frontend`) before declaring done.

## Expected output

A diagnosis note: symptom → where it lives (`App.jsx` route / `pages/<Page>.jsx` / `api/axios.js` / `AuthContext.jsx`) → root cause → minimal safe fix (with viewport/build verification) → confirmation the build passes.
