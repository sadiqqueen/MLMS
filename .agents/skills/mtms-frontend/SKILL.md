---
name: mtms-frontend
description: Use this skill when working on MTMS frontend pages, UI design, dashboard layout, buttons, forms, tables, modals, logos, CSS, React, HTML, JavaScript, or responsive design.
---

# MTMS Frontend Skill

When working on the MTMS frontend:

1. First inspect:
   - frontend folder structure
   - package.json
   - routes/pages/components
   - CSS files
   - existing design system

2. Do not change the design unless the user asks.

3. Preserve:
   - colors
   - spacing
   - logos
   - role-specific pages
   - dashboard layout
   - button style
   - table style
   - modal style

4. When fixing a frontend bug:
   - Check browser console errors.
   - Check API URL.
   - Check request method.
   - Check auth token.
   - Check response shape.
   - Check component state.

5. When editing forms:
   - Keep validation clear.
   - Keep required fields.
   - Make submit buttons show loading when useful.
   - Show success and error messages.

6. When editing dashboards:
   - Do not break role-based access.
   - Keep admin, DIO, president, trainee, supervisor, program director, and secretary views separated if they exist.

7. Final response must include:
   - Files changed
   - What changed
   - How to test in browser