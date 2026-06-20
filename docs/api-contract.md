# API Contract — Task 1: Account delete (hard) vs deactivate (soft)

> Single source of truth for this feature. Frontend consumes ONLY these shapes. No agent invents endpoints.

## Lifecycle
`Active` → **Deactivate** (soft, reversible) → `Inactive` → **Reactivate** (super_admin) back to Active, OR **Hard Delete** (super_admin, permanent — only when already Inactive).

## Endpoints

### 1. Deactivate (soft) — shared staff path
`DELETE /api/users/:id`
- Roles: `secretary, dio, program_director, super_admin`
- Drops the old `hasHigherRole` rank wall. Floors: cannot deactivate self (403); a non-super_admin cannot deactivate a super_admin (403).
- 404 if target missing or already inactive.
- Effect: `isActive:false, deletedAt:<now>`. Audit `deactivate_user`.
- Response 200: `{ message: 'User deactivated', user }`

### 2. Deactivate (soft) — per-role DIO path
`DELETE /api/dio/<role>/:id` (`<role>` ∈ trainees|supervisors|program-directors|secretaries)
- Roles: `dio, super_admin`. Self-guard added.
- Effect: `isActive:false, deletedAt:<now>`. Audit `dio_deactivate_<role>`.
- Response 200: `{ success, message, data }`

### 3. Deactivate (soft) — admin path
`DELETE /api/admin/users/:id`
- Roles: `super_admin`. Self + last-super_admin guard.
- Effect: `isActive:false`. Audit `deactivate_user`.

### 4. Reactivate — super_admin ONLY (canonical)
`PATCH /api/admin/users/:id/reactivate`
- Roles: `super_admin`
- Effect: `isActive:true, deletedAt:null, loginAttempts:0, lockUntil:null`. Audit `reactivate_user`.
- Response 200: `{ success, data }`

### 5. Reactivate — DIO paths LOCKED to super_admin
`PATCH /api/dio/<role>/:id/reactivate`
- Roles: **`super_admin`** (was dio+super_admin). DIO calls now → 403.

### 6. Hard delete (permanent) — NEW, super_admin ONLY
`DELETE /api/admin/users/:id/permanent`
- Roles: `super_admin`
- Preconditions (in order):
  1. target exists — else **404**
  2. `target.isActive === false` — else **409** `{ message: 'Account must be deactivated before permanent deletion' }`
  3. target is not the caller — else **403** `{ message: 'You cannot delete your own account' }`
  4. if `target.role === 'super_admin'` and total super_admins ≤ 1 — else **409** `{ message: 'Cannot delete the last super_admin' }`
- Optional body `{ reassignTo: <supervisorId> }` — when deleting a supervisor, move their trainees to this replacement instead of deleting the rotations. Invalid/inactive/self → **400**.
- Cascade on success (no block-if-referenced):
  - If `reassignTo` given: **reassign** the user's Rotations/Distributions (supervisor refs) and hospital roster/assigned-doctor slot to the replacement; still delete any records the user owned as a trainee.
  - Else: **delete** the user's Rotations + Distributions ("durations").
  - Always: **delete** Notifications; **detach** Specialty (`secretaryId`) and Hospital leadership (`dioId`/`presidentId`/`programDirector`).
  - **Preserve** Evaluations, Reports, Certificates, ConsultantMemos (may reference a now-deleted user).
  - Write `hard_delete_user` audit with `{name,email,role,deletedCounts}` snapshot BEFORE `User.findByIdAndDelete`.
- Response 200: `{ success:true, message:'User permanently deleted', data:{ _id, deletedCounts:{ rotations, distributions, reassignedRotations, reassignedDistributions, notifications } } }`

## Notes
- No `User` model change (`isActive`,`deletedAt` already exist). Auth already 403s deactivated users at login/refresh/every request.
- `/permanent` suffix is deliberate — NEVER a `?hard=true` flag on the soft DELETE.
- `GET /api/users` already returns inactive users → super_admin page renders them; no list change.
