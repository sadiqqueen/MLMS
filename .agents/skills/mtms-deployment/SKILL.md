---
name: mtms-deployment
description: Use this skill when deploying MTMS to a VPS, fixing Nginx, PM2, domain, SSL, GitHub pull, build errors, 404 errors, 502 errors, server logs, or production restart.
---

# MTMS Deployment Skill

When working on MTMS deployment:

1. First identify:
   - project path
   - frontend folder
   - backend folder
   - build command
   - run command
   - domain name
   - process manager
   - Nginx config

2. Never guess. Check using commands:
   - pwd
   - ls
   - git remote -v
   - git status
   - pm2 list
   - sudo nginx -t
   - sudo systemctl status nginx

3. For GitHub update:
   - git status
   - git pull origin main
   - npm install if package files changed
   - npm run build for frontend
   - restart backend with PM2 or system service

4. For 404:
   - Check Nginx root path.
   - Check frontend build output.
   - Check React/Vite history fallback.
   - Check API prefix.
   - Check whether route is frontend route or backend route.

5. For 502:
   - Check backend is running.
   - Check PM2 logs.
   - Check backend port.
   - Check Nginx proxy_pass.
   - Check firewall.

6. For SSL:
   - sudo certbot certificates
   - sudo nginx -t
   - sudo systemctl reload nginx

7. Final response must include:
   - Commands used or recommended
   - What each command does
   - Safe test checklist