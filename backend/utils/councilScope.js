// backend/utils/councilScope.js
// Scientific-Council scoping for the redesign oversight roles (hoc + central
// secretary). A council owns a set of global Specialty rows (both رئيس/main and
// دقيق/precise types). Legacy per-hospital specialties carry no councilId and are
// therefore never in any council scope.
const mongoose  = require('mongoose');
const Specialty = require('../models/Specialty');

// All specialty _ids under one council (main + precise). Empty when councilId is
// falsy or the council owns no specialties yet.
async function specialtyIdsForCouncil(councilId) {
  if (!councilId) return [];
  const rows = await Specialty.find({ councilId }).select('_id');
  return rows.map(r => r._id);
}

// Every council-linked precise specialty across all councils (the single
// precise-type central secretary's scope).
async function preciseSpecialtyIds() {
  const rows = await Specialty.find({ type: 'precise', councilId: { $ne: null } }).select('_id');
  return rows.map(r => r._id);
}

// Resolve the specialty-id scope for a central secretary user:
//   specialtyIds set (new model) → exactly that explicit specialty set
//   secretaryType 'precise' (legacy) → every council-linked precise specialty
//   secretaryType 'main' (legacy)    → its own council's specialties (both types)
// Returns an array of ObjectIds ([] when a main CS has no council assigned).
async function specialtyIdsForCs(user) {
  if (!user) return [];
  // New model takes precedence: an explicit list of specialties chosen at
  // creation. Falsy entries are filtered defensively.
  if (Array.isArray(user.specialtyIds) && user.specialtyIds.length) {
    return user.specialtyIds.filter(Boolean);
  }
  if (user.secretaryType === 'precise') return preciseSpecialtyIds();
  return specialtyIdsForCouncil(user.councilId);
}

// Validate a client-supplied specialty-id list for a central secretary (used by
// both the analyzer and developer CS-create/edit paths). Returns
// { value: ObjectId[] } on success or { error } on failure: de-dupes, drops
// malformed ids, and requires ≥1. Each id must reference an ACTIVE Specialty —
// except ids already assigned to the account (opts.allowInactiveIds), which are
// kept even if the specialty was deactivated after assignment, so a stale scope
// entry never blocks an otherwise-valid edit.
async function validateSpecialtyIds(input, { allowInactiveIds = [] } = {}) {
  const ids = Array.isArray(input)
    ? [...new Set(input.map(String))].filter(id => mongoose.isValidObjectId(id))
    : [];
  if (!ids.length) return { error: 'Select at least one specialty' };
  const found = await Specialty.find({ _id: { $in: ids } }).select('_id isActive');
  const byId = new Map(found.map(s => [String(s._id), s]));
  const allow = new Set(allowInactiveIds.map(String));
  for (const id of ids) {
    const s = byId.get(id);
    if (!s) return { error: 'One or more specialties were not found' };
    if (s.isActive === false && !allow.has(id)) return { error: 'One or more specialties are inactive' };
  }
  return { value: ids.map(id => byId.get(id)._id) };
}

module.exports = { specialtyIdsForCouncil, preciseSpecialtyIds, specialtyIdsForCs, validateSpecialtyIds };
