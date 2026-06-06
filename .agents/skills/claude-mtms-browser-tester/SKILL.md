Use the claude-mtms-browser-tester skill.

Make only this change to the skill:

In:
.agents/skills/claude-mtms-browser-tester/SKILL.md

Update the credential handling section so Claude Code can use credentials provided directly in the prompt instead of requiring .env.test.

Requirements:
- Keep .env.test as optional, not required.
- Add a section called “Option 1: Credentials sent in the prompt”.
- Add a section called “Option 2: Local .env.test”.
- If credentials are sent in the prompt, use them only for the current test session.
- Do not save prompt-provided credentials to any file.
- Do not create .env.test when credentials are provided in the prompt.
- Do not print passwords.
- Do not include passwords in reports.
- Do not commit credentials.
- Report only role and email.
- Keep the roles exactly as:
  - trainee
  - supervisor
  - secretary
  - program director
  - DIO
  - president
  - super admin
- Do not add normal admin role.
- Do not edit app code.
- Do not edit Playwright tests yet.
- Do not run tests.
- Show me the diff after editing.

Use this credential example format inside the skill:

Credentials for this test session only:

trainee:
email:trainee30@mtms.com
password:

supervisor:
email:sup.obgyn.kadhimain@mtms.com
password:123456

secretary:
email:secretary@mtms.com
password:123456

program director:
email:pd@mtms.com
password:123456

DIO:
email:dio@mtms.com
password:123456

president:
email:president@mtms.com
password:123456

super admin:
email:sadeq@mtms.com
password:123456