---
name: mtms-backend-api
description: Use this skill when working on MTMS backend, API routes, authentication, role permissions, Express, Node.js, controllers, middleware, validation, uploads, or server errors.
---

# MTMS Backend/API Skill

When working on MTMS backend/API:

1. First inspect:
   - backend folder structure
   - package.json
   - server entry file
   - routes
   - controllers
   - middleware
   - models
   - .env.example if available

2. Never expose real .env secrets.

3. For auth problems, check:
   - login route
   - JWT/session logic
   - password hashing
   - user model
   - role field
   - frontend token storage
   - middleware permissions

4. For API bugs, check:
   - route path
   - HTTP method
   - request body names
   - controller function
   - database query
   - returned JSON shape
   - frontend usage

5. For role bugs, verify:
   - admin permissions
   - DIO permissions
   - president permissions
   - trainee permissions
   - supervisor permissions
   - program director permissions
   - secretary permissions

6. When creating a new API:
   - Add route
   - Add controller
   - Add validation
   - Add auth middleware if needed
   - Return consistent JSON:
     { "success": true, "data": ... }
     or
     { "success": false, "message": "..." }

7. Final response must include:
   - API route changed or created
   - Files changed
   - How to test with browser/Postman/curl