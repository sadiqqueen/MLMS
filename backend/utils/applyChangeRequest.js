// Applies an approved secretary ChangeRequest to its target account, re-running
// the same reference validation the secretary route enforced at request time
// (state may have drifted between request and approval).
const User = require('../models/User');
const { coerceRoleToTrack } = require('./track');

// Confirm a supervisor id is still an active supervisor in the request's
// specialty/track (state may have drifted since the request was made).
async function assertSupervisorInSpecialty(id, cr, label) {
  const sup = await User.findOne({
    _id: id,
    role: coerceRoleToTrack('supervisor', cr.track),
    specialtyId: cr.specialtyId,
    isActive: { $ne: false },
  }).select('_id');
  if (!sup) {
    const err = new Error(`${label} is no longer valid in this specialty`);
    err.status = 400;
    throw err;
  }
}

// Approving a capacity_exception CREATES the trainee (targetId is null — no
// account existed yet), re-validating references exactly like POST /trainees.
// The stored password is already bcrypt-hashed (User pre-save skips re-hashing).
async function createTraineeFromCapacityRequest(cr) {
  const data = { ...(cr.changes || {}) };
  // Trust the request's own scope, not whatever was in the raw payload.
  data.role = coerceRoleToTrack('trainee', cr.track);
  data.specialtyId = cr.specialtyId;

  if (data.supervisor && !data.supervisorId) data.supervisorId = data.supervisor;
  if (!data.supervisorId) {
    const err = new Error('A trainee must have a supervisor');
    err.status = 400;
    throw err;
  }
  await assertSupervisorInSpecialty(data.supervisorId, cr, 'Supervisor');
  data.supervisor = data.supervisorId;
  if (data.researchSupervisorId) {
    await assertSupervisorInSpecialty(data.researchSupervisorId, cr, 'Research supervisor');
  }

  try {
    const user = new User(data);
    await user.save();
    return User.findById(user._id)
      .select('-password')
      .populate('hospitalId', 'name city')
      .populate('specialtyId', 'name')
      .populate('supervisorId', 'name email')
      .populate('researchSupervisorId', 'name email');
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('A user with this email already exists');
      err.status = 409;
      throw err;
    }
    throw e;
  }
}

async function applyChangeRequest(cr) {
  if (cr.requestType === 'capacity_exception') {
    return createTraineeFromCapacityRequest(cr);
  }

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
