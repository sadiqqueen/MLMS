// backend/utils/councilScope.js
// Scientific-Council scoping for the redesign oversight roles (hoc + central
// secretary). A council owns a set of global Specialty rows (both رئيس/main and
// دقيق/precise types). Legacy per-hospital specialties carry no councilId and are
// therefore never in any council scope.
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
//   secretaryType 'precise' → every council-linked precise specialty
//   secretaryType 'main' (or legacy) → its own council's specialties (both types)
// Returns an array of ObjectIds ([] when a main CS has no council assigned).
async function specialtyIdsForCs(user) {
  if (!user) return [];
  if (user.secretaryType === 'precise') return preciseSpecialtyIds();
  return specialtyIdsForCouncil(user.councilId);
}

module.exports = { specialtyIdsForCouncil, preciseSpecialtyIds, specialtyIdsForCs };
