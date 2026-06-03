#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/MLMS}"
PM2_APP_NAME="${PM2_APP_NAME:-mlms-backend}"
LOCAL_HEALTH_URL="${LOCAL_HEALTH_URL:-http://127.0.0.1:5000/health}"
LIVE_URL="${LIVE_URL:-https://mlmsksb.com}"
SKIP_PULL="${SKIP_PULL:-0}"

step() {
  printf "\n==> %s\n" "$1"
}

step "Entering application directory: ${APP_DIR}"
cd "$APP_DIR"

if [ "$SKIP_PULL" != "1" ]; then
  step "Pulling latest main branch"
  git pull origin main
else
  step "Skipping git pull because SKIP_PULL=1"
fi

step "Installing root dependencies"
npm install

step "Installing backend dependencies"
cd "$APP_DIR/backend"
npm install

step "Installing frontend dependencies including dev dependencies"
cd "$APP_DIR/frontend"
npm install --include=dev

step "Building frontend/dist"
npm run build

step "Returning to application directory"
cd "$APP_DIR"

step "Clearing PM2 logs for ${PM2_APP_NAME}"
pm2 flush "$PM2_APP_NAME" || true

step "Restarting backend with updated environment"
pm2 restart "$PM2_APP_NAME" --update-env

step "Testing nginx configuration"
sudo nginx -t

step "Reloading nginx"
sudo systemctl reload nginx

step "Waiting for backend health endpoint"
for i in {1..30}; do
  if curl -fsS "$LOCAL_HEALTH_URL" >/dev/null; then
    echo "Backend health OK"
    break
  fi

  echo "Backend not ready yet... retry $i/30"
  sleep 2

  if [ "$i" -eq 30 ]; then
    echo "Backend health check failed"
    echo "Recent PM2 logs:"
    pm2 logs "$PM2_APP_NAME" --lines 40 --nostream
    exit 1
  fi
done

step "Checking public health endpoint"
curl -fsS "${LIVE_URL%/}/health"
printf "\n"

step "Checking public app.html"
curl -fsSL "${LIVE_URL%/}/app.html" >/dev/null
echo "Public app.html OK"

step "Deployment completed"