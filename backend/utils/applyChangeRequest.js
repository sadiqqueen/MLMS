// Applies an approved secretary ChangeRequest to its target account, re-running
// the same reference validation the secretary route enforced at request time
// (state may have drifted between request and approval).
const User = require('../models/User');
const { coerceRoleToTrack } = require('./track');

async function applyChangeRequest(cr) {
  const targetRole = cr.routeKey === 'supervisors' ? 'supervisor' : 'trainee';
  const target = await User.findOne({
    _id: cr.targetId,
    role: coerceRoleToTrack(targetRole, cr.track),
    specialtyId: cr.specialtyId,
  });
  if (!target) {
    const err = new Error('Target account no longer exists in this specialty');
    err.status = 409;
    throw err;
  }

  const fields = { ...(cr.changes || {}) };

  // Fold the legacy `supervisor` alias into supervisorId so it always goes
  // through validation below — it must never be persisted unchecked.
  if (fields.supervisor && !fields.supervisorId) fields.supervisorId = fields.supervisor;

  // A trainee must keep a supervisor — never let an approval clear it.
  if (cr.routeKey === 'trainees'
      && ('supervisorId' in fields || 'supervisor' in fields)
      && !fields.supervisorId && !fields.supervisor) {
    const err = new Error('A trainee must have a supervisor');
    err.status = 400;
    throw err;
  }

  // Re-validate supervisor references still belong to the request's specialty.
  for (const key of ['supervisorId', 'researchSupervisorId']) {
    if (fields[key]) {
      const sup = await User.findOne({
        _id: fields[key],
        role: coerceRoleToTrack('supervisor', cr.track),
        specialtyId: cr.specialtyId,
        isActive: { $ne: false },
      }).select('_id');
      if (!sup) {
        const err = new Error(`${key === 'supervisorId' ? 'Supervisor' : 'Research supervisor'} is no longer valid in this specialty`);
        err.status = 400;
        throw err;
      }
      // Keep the legacy alias in sync with the validated value (never the raw input).
      if (key === 'supervisorId') fields.supervisor = fields.supervisorId;
    }
  }

  const updated = await User.findByIdAndUpdate(cr.targetId, fields, { new: true })
    .select('-password')
    .populate('hospitalId', 'name city')
    .populate('specialtyId', 'name')
    .populate('supervisorId', 'name email')
    .populate('researchSupervisorId', 'name email');
  return updated;
}

module.exports = { applyChangeRequest };
