---
name: mtms-security-debug
description: Use this skill when checking MTMS security, suspicious requests, login attempts, .git access, admin protection, server logs, authentication bugs, permissions, or vulnerability review.
---

# MTMS Security and Debug Skill

When checking MTMS security/debugging:

1. Do not expose secrets, passwords, tokens, or private keys.

2. For suspicious requests:
   - Identify the requested path.
   - Check if it reached frontend, backend, or Nginx.
   - Check status code.
   - Explain whether it is a bot scan or real app issue.

3. For .git requests:
   - Ensure Nginx blocks hidden files:
     location ~ /\. { deny all; }
   - Check that .git is not publicly served.

4. For login/security:
   - Check rate limiting if available.
   - Check password hashing.
   - Check auth middleware.
   - Check role-based access.
   - Check token expiration.
   - Check CORS settings.

5. For logs:
   - Use safe commands.
   - Do not paste secrets.
   - Summarize suspicious IP behavior.

6. Recommended checks:
   - sudo nginx -t
   - sudo tail -n 100 /var/log/nginx/access.log
   - sudo tail -n 100 /var/log/nginx/error.log
   - pm2 logs --lines 100

7. Final response must include:
   - Risk level
   - What happened
   - What to fix
   - Safe commands