#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/MLMS}"
PM2_APP_NAME="${PM2_APP_NAME:-mlms-backend}"
LOCAL_HEALTH_URL="${LOCAL_HEALTH_URL:-http://localhost:5000/health}"
LIVE_URL="${LIVE_URL:-https://mlmsksb.com}"

step() {
  printf '\n==> %s\n' "$1"
}

step "Entering application directory: ${APP_DIR}"
cd "$APP_DIR"

step "Pulling latest main branch"
git pull origin main

step "Installing root dependencies"
npm install

step "Installing backend dependencies"
(cd backend && npm install)

step "Installing frontend dependencies, including Vite dev dependencies"
(cd frontend && npm install --include=dev)

step "Building frontend/dist from frontend sources"
(cd frontend && npm run build)

step "Clearing PM2 logs for ${PM2_APP_NAME}"
pm2 flush "$PM2_APP_NAME" || true

step "Restarting backend with updated environment"
pm2 restart "$PM2_APP_NAME" --update-env

step "Testing nginx configuration"
sudo nginx -t

step "Reloading nginx"
sudo systemctl reload nginx

step "Checking backend health endpoint"
curl -fsS "$LOCAL_HEALTH_URL"
printf '\n'

step "Showing live app bundle references from /app.html"
curl -fsSL "${LIVE_URL%/}/app.html" | grep -Eo 'assets/[^"]+\.(js|css)' | sort -u

step "Deployment completed"
