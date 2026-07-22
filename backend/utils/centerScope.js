// backend/utils/centerScope.js
// Resolve the set of training-center (Hospital) ids a center-scoped advanced
// user may act within. A DIO (role 'dio') carries its own assignedCenterIds; an
// ODIO (role 'odio') or Sub-DIO (role 'sub_dio') resolves the set THROUGH its
// linked DIO via dioId. Any other role is not center-scoped (returns null).
const User = require('../models/User');
const Program = require('../models/Program');

// Returns an array of ObjectId strings, or null when the role is not
// center-scoped. An empty array means "center-scoped but no centers".
async function resolveCenterSet(user) {
  if (!user) return null;
  if (user.role === 'dio') {
    return (user.assignedCenterIds || []).map(id => String(id._id || id));
  }
  if (user.role === 'odio' || user.role === 'sub_dio') {
    if (!user.dioId) return [];
    const parent = await User.findById(user.dioId).select('assignedCenterIds');
    if (!parent) return [];
    return (parent.assignedCenterIds || []).map(id => String(id._id || id));
  }
  return null;
}

// String-compare a hospital id against a resolved center set. A null/undefined
// hospitalId is never in any set.
function inCenterSet(set, hospitalId) {
  if (!Array.isArray(set) || hospitalId === null || hospitalId === undefined) return false;
  return set.includes(String(hospitalId._id || hospitalId));
}

// The advanced trainee ids belonging to a set of training centers — matched
// directly by hospitalId, or indirectly through a program whose trainingCenterId
// is in the set. Returns an array of ObjectIds (empty for a null/empty set), so
// callers can filter certificates/records by student/traineeId ∈ result.
async function traineeIdsForCenterSet(set) {
  if (!Array.isArray(set) || set.length === 0) return [];
  const programs = await Program.find({ trainingCenterId: { $in: set } }).select('_id');
  const programIds = programs.map(p => p._id);
  const or = [{ hospitalId: { $in: set } }];
  if (programIds.length) or.push({ programId: { $in: programIds } });
  const trainees = await User.find({ role: 'trainee', $or: or }).select('_id');
  return trainees.map(t => t._id);
}

module.exports = { resolveCenterSet, inCenterSet, traineeIdsForCenterSet };
