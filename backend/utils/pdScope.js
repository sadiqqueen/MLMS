// backend/utils/pdScope.js
// Program-Director scoping helpers.
//
// A Program Director is tied to ONE specialty and sees EVERY hospital that
// offers that specialty. Because the DB carries duplicate same-named Specialty
// rows (one per hospital), scoping is done by specialty *name* — the set of all
// Specialty _ids that share the PD's specialty name within the PD's track —
// rather than a single Specialty _id. This also makes "one PD per specialty"
// mean one PD per specialty name per track.
const User      = require('../models/User');
const Specialty = require('../models/Specialty');
const { coerceRoleToTrack, trackFilter } = require('./track');

// Resolve the specialty NAME behind a specialtyId, plus every Specialty _id that
// shares that name within `track`. Returns null when there is no usable
// specialty (caller should 403 / treat as "no specialty assigned").
async function specialtyIdsForName(specialtyId, track) {
  if (!specialtyId) return null;
  const base = await Specialty.findById(specialtyId).select('name');
  if (!base || !base.name) return null;
  const rows = await Specialty.find({ name: base.name, ...trackFilter(track) }).select('_id');
  const ids = rows.map(r => r._id);
  // The base row may itself be out of the track filter (defensive): keep it in.
  if (!ids.some(id => String(id) === String(base._id))) ids.push(base._id);
  return { name: base.name, ids };
}

// Mongo fragment matching any user of this specialty across all its per-hospital
// rows, plus legacy docs that only carry the string `specialty` field.
function specialtyUserMatch(info) {
  return { $or: [{ specialtyId: { $in: info.ids } }, { specialty: info.name }] };
}

// Enforce "one Program Director per specialty (by name, per track)".
// Returns the conflicting active PD (or null). Pass excludeId to ignore the PD
// being updated/reactivated.
async function findPdForSpecialty(specialtyId, track, excludeId) {
  const info = await specialtyIdsForName(specialtyId, track);
  if (!info) return null;
  const query = {
    role: coerceRoleToTrack('program_director', track),
    isActive: { $ne: false },
    $or: [{ specialtyId: { $in: info.ids } }, { specialty: info.name }],
  };
  if (excludeId) query._id = { $ne: excludeId };
  return User.findOne(query).select('_id name');
}

module.exports = { specialtyIdsForName, specialtyUserMatch, findPdForSpecialty };
