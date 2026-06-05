---
name: mtms-database
description: Use this skill when working on MTMS database, MongoDB, models, schemas, migrations, seed users, admin password, database connection, saving data, reports, history, or logs.
---

# MTMS Database Skill

When working on MTMS database:

1. First inspect:
   - database connection file
   - models/schemas
   - .env.example
   - routes that save or read data
   - seed scripts if available

2. Never print or expose real database passwords.

3. For connection problems:
   - Check MONGO_URI or database URL.
   - Check server logs.
   - Check network/firewall.
   - Check database name.
   - Check model imports.

4. For data not saving:
   - Check frontend request body.
   - Check backend route.
   - Check controller validation.
   - Check model field names.
   - Check database errors.
   - Check response returned to frontend.

5. For reports/history:
   - Save who did the action.
   - Save role.
   - Save timestamp.
   - Save action type.
   - Save related record ID if available.

6. For users and roles:
   - Do not hardcode production passwords.
   - Use bcrypt or secure password hashing.
   - Keep role names consistent across frontend/backend/database.

7. Final response must include:
   - Model/collection changed
   - Route/controller changed
   - How to verify saved data