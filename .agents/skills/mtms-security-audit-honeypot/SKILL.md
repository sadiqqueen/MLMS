---
name: mtms-security-audit-honeypot
description: Use this skill when checking MTMS for security issues, login abuse, spam attacks, rate limiting, server crashes, suspicious requests, honeypots, fake admin traps, bot detection, Nginx hardening, API protection, or defensive penetration testing on this authorized project.
---

# MTMS Security Audit and Honeypot Skill

This skill is only for authorized defensive security testing on the MTMS web application.

## Main goal

Improve the security of MTMS by checking:

- Authentication weaknesses
- Role-based access control mistakes
- API protection
- Spam or repeated request abuse
- Server crash risks
- Public file exposure
- Nginx misconfiguration
- Database exposure
- Unsafe uploads
- Missing rate limits
- Suspicious bot activity
- Honeypot traps and logging

## Safety rules

- Do not steal secrets, passwords, tokens, private keys, or database data.
- Do not provide destructive attack steps.
- Do not perform real denial-of-service attacks.
- Use safe local or controlled testing only.
- Never test websites or servers that are not owned or authorized by the user.
- Never print `.env` secrets.
- Never commit secrets to GitHub.

## First inspection checklist

Before making changes, inspect:

- Project structure
- Backend entry file
- Auth routes
- Middleware
- User model
- Role permissions
- API routes
- Nginx config if available
- PM2 or server run method
- Environment variable usage
- Upload folders
- Static folders
- Frontend API calls

Useful commands:

```bash
pwd
ls
git status
npm run
pm2 list
sudo nginx -t
sudo tail -n 100 /var/log/nginx/access.log
sudo tail -n 100 /var/log/nginx/error.log