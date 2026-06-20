# Task List — Task 1: Account delete vs deactivate permissions

Status: ⚪ Idle · 🟢 Working · 🟡 Blocked · ✅ Done
Claim convention: `[IN PROGRESS — Name]`. Contract: `docs/api-contract.md`.

## Backend
- 🟢 **Atlas** — Read model schemas; produce exact User-reference field map for cascade check; confirm no User model change needed. _(read-only)_
- 🟢 **Forge** — `backend/routes/adminV2.js`: add hard-delete route #6 (guards + block-if-referenced cascade + audit snapshot); add `deletedAt:null` to reactivate #4.
- 🟢 **Warden** — `backend/routes/users.js`: drop `hasHigherRole`, add self + super_admin floors, add `deactivate_user` audit. `backend/routes/dio.js`: lock reactivate #5 to super_admin, add self-deactivate guard.

## Frontend
- 🟢 **Aria** — `frontend/src/pages/Users.jsx`: status badge, show inactive, deactivate keeps row, reactivate (inactive only), permanent-delete (disabled until inactive, hidden for self, strong confirm, 409 handling). Mirror in card view.
- 🟢 **Nova** — Remove reactivate (state/handler/button/modal) from `DioTrainees.jsx`, `DioSupervisors.jsx`, `DioProgramDirectors.jsx`, `DioSecretaries.jsx`. Keep deactivate + badge + show-inactive.
- 🟢 **Iris** — Reword Delete→Deactivate (modal + toast) in `SecretaryTrainees.jsx`, `SecretarySupervisors.jsx`, `SecretaryProgramDirectors.jsx`.

## Gate (Lead)
- ⚪ Security + contract review of full diff
- ⚪ Verification: `npm run check:backend`, `npm run build:frontend`, API/UI smoke per plan
