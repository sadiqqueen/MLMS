// Shared "track" helpers. The system now has two parallel training portals:
//   • Advanced (the original) — roles: trainee, trainer, program_director,
//     secretary, odio, …
//   • Basic — the same roles prefixed with `b_` (b_trainee, b_trainer, …).
//
// A role starting with `b_` belongs to the Basic track; everything else
// (including all legacy data with no `track` field) is Advanced.
// NOTE: keep this list identical to MIRRORED in frontend/src/config/roles.js.

const MIRRORED = ['trainee', 'trainer', 'program_director', 'secretary', 'odio'];

function isBasicRole(role) {
  return typeof role === 'string' && role.startsWith('b_');
}

// 'b_trainer' → 'trainer'  (Advanced roles pass through unchanged).
function baseRole(role) {
  return isBasicRole(role) ? role.slice(2) : role;
}

function trackForRole(role) {
  return isBasicRole(role) ? 'basic' : 'advanced';
}

// Coerce a base role to its Basic variant when the acting context is Basic, so
// Basic staff can only ever create Basic users (never leak an Advanced account).
function coerceRoleToTrack(role, track) {
  if (track === 'basic' && typeof role === 'string' && !role.startsWith('b_') && MIRRORED.includes(role)) {
    return 'b_' + role;
  }
  return role;
}

// A Mongo filter fragment isolating one track. Advanced = "not basic", which
// also matches legacy documents that have no `track` field yet.
function trackFilter(track) {
  return track === 'basic' ? { track: 'basic' } : { track: { $ne: 'basic' } };
}

module.exports = { MIRRORED, isBasicRole, baseRole, trackForRole, coerceRoleToTrack, trackFilter };
