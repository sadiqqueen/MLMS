---
name: mtms-deployment-vps-railway
description: Deploy the MTMS / MLMS app safely. Use when shipping the backend to Railway or a VPS, building/serving the frontend, configuring Nginx, PM2/systemd, SSL/Certbot, verifying /health, checking environment variables, or rolling back a bad release. Emphasizes not destroying backend/uploads or production data.
---

# MTMS Deployment (VPS + Railway)

Backend: Node/Express, started by `web: node server.js` (`backend/Procfile`) on Railway, or under PM2 as `mlms-backend` on a VPS. Frontend: Vite build (`frontend/dist`, dual entry `landing.html` + `app.html`) served by Nginx on the VPS or by Vercel (`frontend/vercel.json`). Production VPS path: `/var/www/MLMS`; example domain `https://mlmsksb.com`.

## When to use it

- Before/after any deploy, when the prod site is down, or when changing infra (env vars, Nginx, SSL, PM2).

## Pre-deploy checks (always)

```bash
npm run check:backend     # node --check backend/server.js
npm run build:frontend    # vite build must succeed (incl. dev deps)
npm run deploy:check      # both of the above
git status                # ensure no secrets / dist / uploads staged
```
Never deploy with a failing build or a dirty tree containing `.env`, `frontend/dist`, or `backend/uploads`.

## Environment variable checklist (production)

Set on the host/Railway dashboard (values live only there, never in git). Names from `.env.example`:
`MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (REQUIRED in prod — server exits without it), `FRONTEND_URL` (real domain(s), comma-separated; otherwise CORS falls back to localhost), `PORT` (5000), `NODE_ENV=production` (enables `secure` cookies), `TRUST_PROXY=true` (behind Nginx/Railway, so rate limiting + secure cookies see the real client IP/proto). Seed/reset guards (`DRY_RUN`, `CONFIRM_RESEED`, `CONFIRM_RESET_PASSWORD`, `ALLOW_LOCAL_DEMO_SEED`) must stay in their safe (non-destructive) state.

## Railway backend deployment

- Procfile runs `node server.js`. Set all env vars in the Railway service (Variables tab).
- Set `TRUST_PROXY=true` and `NODE_ENV=production`.
- After deploy, hit the public URL `/health` and watch logs for `MongoDB connected`.
- Ensure the Mongo instance allows Railway egress IPs (Atlas allowlist) or use a Railway-hosted DB.

## VPS deployment

Documented flow (see README): the repo ships `scripts/deploy-vps.sh`.
```bash
cd /var/www/MLMS
bash scripts/deploy-vps.sh
# optional overrides:
APP_DIR=/var/www/MLMS PM2_APP_NAME=mlms-backend LIVE_URL=https://mlmsksb.com bash scripts/deploy-vps.sh
```
The script pulls `origin main`, installs root/backend/frontend deps (incl. frontend dev deps so Vite is present), builds `frontend/dist`, clears PM2 logs and restarts `mlms-backend --update-env`, validates + reloads Nginx, checks local `/health`, and prints live bundle refs from `/app.html`. Read the script before running and prefer it over manual steps.

Manual equivalent if needed:
```bash
git pull origin main
npm ci --prefix backend
cd frontend && npm install --include=dev && npm run build && cd ..
pm2 restart mlms-backend --update-env
nginx -t && systemctl reload nginx
curl -s localhost:5000/health
```

## Nginx checks

```bash
nginx -t                          # config syntax must pass before reload
systemctl reload nginx            # apply (reload, not restart, to avoid drops)
```
Confirm the server block: serves `frontend/dist` (root), routes `/api` and `/uploads` to `http://localhost:5000`, has `proxy_set_header X-Forwarded-For`/`X-Forwarded-Proto` (pairs with `TRUST_PROXY=true`), and falls back to `app.html` for SPA routes. Do not let Nginx serve `.env`, `backend/uploads` listing, or dotfiles.

## PM2 / systemd checks

```bash
pm2 list                          # mlms-backend should be 'online'
pm2 logs mlms-backend --lines 100 # recent errors / boot logs
pm2 restart mlms-backend --update-env
pm2 save                          # persist across reboots
```
If systemd is used instead: `systemctl status mlms-backend` and `journalctl -u mlms-backend -n 100`.

## SSL / Certbot checks

```bash
certbot certificates              # expiry + domains (e.g. mlmsksb.com)
certbot renew --dry-run           # verify auto-renewal works
```
Ensure HTTPS redirect is configured and the cert covers all `FRONTEND_URL` hosts. `secure` cookies require HTTPS in prod.

## Build & restart steps (order matters)

1. `npm run deploy:check` locally / on host. 2. Build frontend → `frontend/dist`. 3. Restart backend (`pm2 restart ... --update-env` or redeploy Railway). 4. `nginx -t && systemctl reload nginx` (VPS). 5. Verify `/health` + a real login.

## Healthcheck verification

```bash
curl -s localhost:5000/health                 # on host: app up?
curl -s https://<domain>/health               # through proxy/SSL: edge up?
```
Both must return `{status:'ok'}`. Host-only success but edge failure = Nginx/SSL/Railway routing problem, not the app.

## Rollback instructions

- VPS: `git -C /var/www/MLMS log --oneline -5`, then `git checkout <last-good-sha>` (or `git revert`), rebuild frontend, `pm2 restart mlms-backend --update-env`, re-run `/health`. Keep a note of the previous good SHA before deploying.
- Railway: redeploy the previous successful deployment from the dashboard (Deployments → Redeploy), or push a revert commit.
- After rollback, re-verify `/health` and login.

## Safety rules

- NEVER delete or overwrite `backend/uploads/` — it holds runtime user files and is intentionally not in git. The deploy script preserves it; manual steps must too.
- Do NOT commit `frontend/dist`, `.env`, or `backend/.env`. They are gitignored — keep them that way.
- Do NOT run seeds/migrations against prod as part of a deploy unless explicitly intended and confirmed (they gate on `CONFIRM_*` vars).
- Reload Nginx (not restart) and use `pm2 restart --update-env` so new env vars load without dropping the process.

## Expected output

A deploy report: target (Railway/VPS), pre-deploy check results, env vars confirmed (names only), steps run, `/health` results (host + edge), and a recorded last-good SHA for rollback. If anything failed, the rollback action taken.
