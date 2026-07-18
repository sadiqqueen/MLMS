// backend/utils/centerScope.js
// Resolve the set of training-center (Hospital) ids a center-scoped advanced
// user may act within. A dio_view carries its own assignedCenterIds; an ODIO
// (role 'dio') or Sub-DIO (role 'sub_dio') resolves the set THROUGH its linked
// dio_view via dioId. Any other role is not center-scoped (returns null).
const User = require('../models/User');

// Returns an array of ObjectId strings, or null when the role is not
// center-scoped. An empty array means "center-scoped but no centers".
async function resolveCenterSet(user) {
  if (!user) return null;
  if (user.role === 'dio_view') {
    return (user.assignedCenterIds || []).map(id => String(id._id || id));
  }
  if (user.role === 'dio' || user.role === 'sub_dio') {
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

module.exports = { resolveCenterSet, inCenterSet };
