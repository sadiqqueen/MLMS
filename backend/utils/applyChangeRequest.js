// Applies an approved secretary ChangeRequest to its target account, re-running
// the same reference validation the secretary route enforced at request time
// (state may have drifted between request and approval).
const User = require('../models/User');
const { coerceRoleToTrack } = require('./track');
const { applyRegistryChange } = require('./registryChanges');

// Confirm a supervisor id is still an active supervisor in the request's
// specialty/track (state may have drifted since the request was made).
async function assertSupervisorInSpecialty(id, cr, label) {
  const sup = await User.findOne({
    _id: id,
    role: coerceRoleToTrack('trainer', cr.track),
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

  // Redesign registry edits/deletes are applied by the dedicated registry engine
  // (Hospital/Program/Country and every account role): the central secretary's
  // requests are reviewed by the Data Analyzer, the data-entry clerk's by Head AD.
  // The legacy DIO-reviewed trainee/supervisor path below is unchanged.
  if (cr.reviewerRole === 'data_analyzer' || cr.reviewerRole === 'head_ad') {
    return applyRegistryChange(cr);
  }

  const targetRole = cr.routeKey === 'supervisors' ? 'trainer' : 'trainee';
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

  // A trainee must keep a supervisor — never let an approval clear it. In the
  // Advanced track a trainee's trainer is optional (v2), so this rule applies
  // only to Basic-track requests.
  if (cr.track === 'basic'
      && cr.routeKey === 'trainees'
      && ('supervisorId' in fields || 'supervisor' in fields)
      && !fields.supervisorId && !fields.supervisor) {
    const err = new Error('A trainee must have a supervisor');
    err.status = 400;
    throw err;
  }

  // Re-validate supervisor references. Basic-track keeps the original
  // specialty-membership rule (unchanged). Advanced-track scopes trainers PER
  // PROGRAM (v2): a program-based trainee's trainer must be in the trainee's
  // program, while a legacy advanced trainee (no programId) keeps the original
  // specialty-membership check that predates the Phase-3 relaxation.
  const supRole = coerceRoleToTrack('trainer', cr.track);
  if (cr.track === 'basic') {
    for (const key of ['supervisorId', 'researchSupervisorId']) {
      if (fields[key]) {
        const sup = await User.findOne({
          _id: fields[key],
          role: supRole,
          specialtyId: cr.specialtyId,
          isActive: { $ne: false },
        }).select('_id');
        if (!sup) {
          const label = key === 'supervisorId' ? 'Supervisor' : 'Research supervisor';
          const err = new Error(`${label} is no longer valid in this specialty`);
          err.status = 400;
          throw err;
        }
        // Keep the legacy alias in sync with the validated value (never the raw input).
        if (key === 'supervisorId') fields.supervisor = fields.supervisorId;
      }
    }
  } else {
    const pdRole = coerceRoleToTrack('program_director', cr.track);
    const targetProgramId = target.programId || null;

    // supervisorId (the trainer): an active supervisor of this track. For a
    // program-based target, the trainer must share the trainee's program; for a
    // legacy target (no programId), fall back to the original specialty check.
    if (fields.supervisorId) {
      const sup = await User.findOne({
        _id: fields.supervisorId,
        role: supRole,
        isActive: { $ne: false },
      }).select('programId specialtyId');
      if (!sup) {
        const err = new Error('Supervisor is no longer valid');
        err.status = 400;
        throw err;
      }
      if (targetProgramId) {
        if (String(sup.programId || '') !== String(targetProgramId)) {
          const err = new Error("Selected trainer is not in the trainee's program");
          err.status = 400;
          throw err;
        }
      } else if (String(sup.specialtyId || '') !== String(cr.specialtyId || '')) {
        const err = new Error('Supervisor is no longer valid in this specialty');
        err.status = 400;
        throw err;
      }
      fields.supervisor = fields.supervisorId;
    }

    // researchSupervisorId: an active supervisor OR program_director of this
    // track. A supervisor choice must share a program-based trainee's program; a
    // program_director needs no program check.
    if (fields.researchSupervisorId) {
      const rs = await User.findOne({
        _id: fields.researchSupervisorId,
        role: { $in: [supRole, pdRole] },
        isActive: { $ne: false },
      }).select('role programId');
      if (!rs) {
        const err = new Error('Research supervisor is no longer valid');
        err.status = 400;
        throw err;
      }
      if (rs.role === supRole && targetProgramId
          && String(rs.programId || '') !== String(targetProgramId)) {
        const err = new Error("Selected trainer is not in the trainee's program");
        err.status = 400;
        throw err;
      }
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
