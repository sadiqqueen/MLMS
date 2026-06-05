# MTMS Project Instructions for Codex

## Project name
MTMS web application.

## Main rules
- Do not change the UI design unless I explicitly ask.
- Do not rename files, routes, APIs, roles, or database fields unless required.
- Always inspect the existing project structure before editing.
- Always explain which files were changed and why.
- When fixing bugs, find the real cause first instead of rewriting everything.
- When giving code, give complete working code when I ask for full code.
- Never expose secrets from .env files.
- Never delete important project files without asking.

## Web app rules
- Keep frontend and backend connected correctly.
- Check API route names before changing frontend fetch/axios calls.
- Check authentication and role permissions when editing dashboard pages.
- Keep MTMS branding colors consistent.
- Make responsive layouts where possible.

## Deployment rules
- For VPS/Linux deployment, give commands step by step.
- Before restarting services, check the current process manager.
- If PM2 is used, run pm2 list before guessing app names.
- For Nginx changes, always test with sudo nginx -t before restart.
- For SSL, use certbot safely and avoid breaking existing certificates.

## Done means
- No syntax errors.
- The app can run.
- Explain how to test the change.
- Mention any files that need environment variables.