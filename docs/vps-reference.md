# VPS Reference — MTMS/MLMS (mlmsksb.com)

> Snapshot from a full server inspection on **2026-07-14**. No secret values here — only names, paths, permissions. Update this file when the server config changes.

## 1. System

- **Host:** Hostinger KVM VPS (Monarx agent present)
- **OS:** Ubuntu 24.04.4 LTS (Noble), kernel 6.8.0-111-generic x86_64
- **CPU:** 2 vCPU — AMD EPYC 9354P
- **RAM:** 7.8 GiB (no swap configured)
- **Disk:** /dev/sda1 96 GB (5.2 GB used at snapshot)
- **Timezone:** UTC

## 2. Runtime

- **Node:** v22.22.2 (`/usr/bin/node`, apt via NodeSource — no nvm)
- **npm:** 10.9.7
- **PM2:** 7.0.1 at `/usr/local/bin/pm2`

## 3. Application

- **Path:** `/var/www/MLMS` (owned `root:root`)
- **Branch:** `main`
- **Env files:**
  - `backend/.env` — keys: `NODE_ENV`, `PORT`, `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`
  - `backend/.env.railway-backup`, `backend/.env.preauth-backup` — plaintext secret backups on disk (see Issues)
  - Live `.env` has **no `ANTHROPIC_API_KEY`** → memo-translation endpoint returns 503 by design

## 4. PM2

- **Process:** `mlms-backend` — id 0, fork mode, runs as **root**, script `/var/www/MLMS/backend/server.js`, cwd `/var/www/MLMS/backend`
- **Logs:** `/root/.pm2/logs/mlms-backend-{out,error}.log`
- **Dump:** `/root/.pm2/dump.pm2` (pm2 save run)
- ⚠️ **No boot persistence** — no `pm2 startup` systemd unit; app will NOT auto-restart after reboot

## 5. Nginx

- **Site:** `/etc/nginx/sites-available/mlms` (enabled via symlink; `default` disabled)
- **server_name:** `mlmsksb.com`, `www.mlmsksb.com`
- **HTTP→HTTPS:** 301 redirect on port 80 ✅
- **TLS:** Let's Encrypt, `/etc/letsencrypt/live/mlmsksb.com/` — auto-renew working (cert expiry was 2026-08-15 at snapshot)
- **Proxy → `127.0.0.1:5000`:** `/api/`, `/health`, `/uploads/`, plus a scanner-bait regex block (`.env`, `.git`, `wp-admin`, `phpmyadmin`, `backup`, …) routed intentionally to the backend **honeypot middleware**. Other dotfiles → 404 (except `.well-known`)
- **Static:** `root /var/www/MLMS/frontend/dist`; `/` → `landing.html`, SPA fallback → `app.html`
- ⚠️ `client_max_body_size` not set (1 MB default vs 5 MB app upload limit → 413 on 1–5 MB uploads)
- ⚠️ `gzip_types` commented out (only text/html compressed); `server_tokens off` commented out (version leak)

## 6. Domain / Network

- **Domain:** mlmsksb.com + www
- **Public ports:** 22 (sshd), 80/443 (nginx). UFW active: default deny incoming, allow 22/80/443 only
- **Localhost-only:** mongod 27017, monarx-agent 65529, systemd-resolved 53
- ⚠️ Backend node listens on `0.0.0.0:5000` — shielded only by UFW
- **fail2ban:** not installed

## 7. MongoDB

- **Local** (not Atlas), v8.0.26, bind `127.0.0.1` ✅, `authorization: enabled` ✅
- **Data:** `/var/lib/mongodb` (~458 MB at snapshot)

## 8. Deploy

- **Script:** `/var/www/MLMS/scripts/deploy-vps.sh`
- **Flow:** `git pull origin main` (skippable) → `npm install` → frontend `npm install --include=dev` + `npm run build` → `pm2 flush` → `pm2 restart mlms-backend --update-env` → `nginx -t` → `systemctl reload nginx` → poll `http://127.0.0.1:5000/health` (30×2s) → check public `/health` + `/app.html`
- **Frontend:** served directly by nginx from `frontend/dist` (not proxied)

## 9. Cron / Backups

- **Root crontab:** `0 3 * * * /root/mongo-backup.sh >> /root/db-backups/backup.log 2>&1`
- **Backup:** `mongodump --gzip --archive` (URI read from `backend/.env`) → `/root/db-backups/mlms-<timestamp>.archive.gz`, 14-day retention, running successfully daily
- ⚠️ Backups stored **only on the same server** — no off-site copy
- **Timers/cron.d:** certbot, logrotate, apt-daily, sysstat, fwupd, dpkg-db-backup, docker-image-prune, monarx-update, e2scrub_all

## 10. Uploads

- **Path:** `/var/www/MLMS/backend/uploads` (root:root, 755)
- **Subdirs:** `photos/`, `consultant-memos/`, `feedback-attachments/`, `research/`, `trainee-courses/`
- Served via nginx → backend `/uploads/` route, gated behind auth

## 11. Security posture

- **SSH:** port 22, `PermitRootLogin yes` ⚠️, `PasswordAuthentication yes` ⚠️, pubkey auth on, empty passwords off
- **Unattended-upgrades:** active ✅
- **Extras:** Monarx agent, UFW
- Everything (app, uploads, PM2, backups) runs/owned as **root** — no service account

## 12. Other services

`docker` (running, zero containers — unused), `monarx-agent`, `mongod`, `nginx`, `ssh`

---

## ⚠️ Open issues (as of 2026-07-14)

### High

1. `backend/.env` world-readable (755) with `JWT_SECRET`, `MONGO_URI`, plaintext `SUPERADMIN_PASSWORD` → `chmod 600`
2. Plaintext secret backups `backend/.env.railway-backup`, `backend/.env.preauth-backup` (755) → delete or `chmod 600` + move off-box
3. SSH: root login + password auth allowed, no fail2ban → key-only auth, `PermitRootLogin prohibit-password`/`no`, install fail2ban
4. No PM2 boot persistence → `pm2 startup systemd` + `pm2 save` **before** the pending reboot

### Medium

5. Missing `client_max_body_size` (1–5 MB uploads fail with 413) → add `client_max_body_size 6m;`
6. Backend binds `0.0.0.0:5000` → bind `127.0.0.1`
7. Backups single-location → add off-site copy
8. Reboot pending since Jul 3 + 33 package updates queued → maintenance reboot after fixing #4
9. All processes run as root → consider dedicated service user

### Low

10. Docker daemon unused → remove
11. Enable `gzip_types` + `server_tokens off`
12. No swap → add small swapfile
13. Info: no `ANTHROPIC_API_KEY` in live `.env` (translation 503 is expected)
