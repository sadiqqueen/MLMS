const router         = require('express').Router();
const mongoose       = require('mongoose');
const Rotation       = require('../models/Rotation');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Specialty      = require('../models/Specialty');
const AuditLog       = require('../models/AuditLog');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { trackFilter, trackForRole, coerceRoleToTrack } = require('../utils/track');

const WRITE_ROLES = ['developer', 'odio'];
const READ_ROLES  = ['developer', 'odio', 'program_director'];
const STATUSES    = ['completed', 'current', 'upcoming', 'cancelled'];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

function normalizeRotationData(data) {
  if (data.traineeId && !data.student) data.student = data.traineeId;
  if (data.student && !data.traineeId) data.traineeId = data.student;
  if (data.hospitalId && !data.hospital) data.hospital = data.hospitalId;
  if (data.hospital && !data.hospitalId) data.hospitalId = data.hospital;
  if (data.supervisorId && !data.doctor) data.doctor = data.supervisorId;
  if (data.doctor && !data.supervisorId) data.supervisorId = data.doctor;
  return data;
}

// The DIO is a TRACK-WIDE overseer (no hospital scope): it manages every rotation
// in its own track (req.track) across all hospitals, and never the other track.
// Legacy docs with no `track` field count as 'advanced' — mirrors trackFilter()
// semantics, so never use `track === 'advanced'` equality in a Mongo query.
function rotationInTrack(rotation, track) {
  return track === 'basic' ? rotation?.track === 'basic' : rotation?.track !== 'basic';
}

function ensureDioCanAccessRotation(req, res, rotation) {
  if (req.user.role !== 'odio') return true;
  if (rotationInTrack(rotation, req.track)) return true;
  res.status(403).json({ success: false, message: 'Access denied: rotation belongs to a different track' });
  return false;
}

function dateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function inferStatus(startDate, endDate) {
  const today = dateOnly(new Date());
  const start = dateOnly(new Date(startDate));
  const end = dateOnly(new Date(endDate));
  if (end < today) return 'completed';
  if (start > today) return 'upcoming';
  return 'current';
}

function statusMatchesDates(status, startDate, endDate) {
  if (status === 'cancelled') return true;
  return status === inferStatus(startDate, endDate);
}

async function audit(req, action, targetId, metadata = {}) {
  await AuditLog.create({
    userId: req.user._id,
    action,
    targetId,
    targetModel: 'Rotation',
    metadata,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
  }).catch(err => console.error('[AuditLog] Failed to write rotation audit:', err.message));
}

async function validateRotationPayload(data, res, { creating = false, existingId = null, existing = null, req = null } = {}) {
  normalizeRotationData(data);
  const isDio = req?.user?.role === 'odio';

  const required = creating ? ['traineeId', 'hospitalId', 'startDate', 'endDate'] : [];
  const missing = required.filter(k => !data[k]);
  if (missing.length) {
    res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
    return false;
  }

  for (const field of ['traineeId', 'student', 'hospitalId', 'hospital', 'supervisorId', 'doctor', 'specialtyId']) {
    if (data[field] && !isValidObjectId(data[field])) {
      res.status(400).json({ success: false, message: `Invalid ${field}` });
      return false;
    }
  }

  if (data.status && !STATUSES.includes(data.status)) {
    res.status(400).json({ success: false, message: 'Invalid rotation status' });
    return false;
  }

  const merged = {
    traineeId: data.traineeId || existing?.traineeId || existing?.student,
    hospitalId: data.hospitalId || existing?.hospitalId || existing?.hospital,
    supervisorId: data.supervisorId || existing?.supervisorId || existing?.doctor,
    specialtyId: data.specialtyId || existing?.specialtyId,
    startDate: data.startDate || existing?.startDate,
    endDate: data.endDate || existing?.endDate,
    status: data.status || existing?.status
  };
  if (!merged.status && (creating || data.startDate || data.endDate) && merged.startDate && merged.endDate) {
    data.status = inferStatus(merged.startDate, merged.endDate);
  }
  merged.status = data.status || merged.status;

  if (data.startDate || data.endDate || data.status || creating) {
    const start = merged.startDate ? new Date(merged.startDate) : null;
    const end = merged.endDate ? new Date(merged.endDate) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
      return false;
    }
    if (end <= start) {
      res.status(400).json({ success: false, message: 'endDate must be after startDate' });
      return false;
    }
    if (!statusMatchesDates(merged.status, start, end)) {
      res.status(400).json({ success: false, message: `${merged.status} status does not match startDate/endDate` });
      return false;
    }
  }

  if (data.traineeId) {
    const trainee = await User.findOne({
      _id: data.traineeId,
      role: isDio ? coerceRoleToTrack('trainee', req.track) : 'trainee',
      isActive: { $ne: false },
    });
    if (!trainee) {
      res.status(400).json({ success: false, message: 'Trainee not found or inactive' });
      return false;
    }
    // track is server-derived from the referenced trainee (never client-set), so a
    // b_dio-created rotation lands in the Basic track instead of the schema default.
    data.track = trackForRole(trainee.role);
  }

  if (data.hospitalId) {
    const hospital = await Hospital.findOne({ _id: data.hospitalId, isActive: { $ne: false } });
    if (!hospital) {
      res.status(400).json({ success: false, message: 'Hospital not found or inactive' });
      return false;
    }
    if (isDio && (hospital.track || 'advanced') !== req.track) {
      res.status(403).json({ success: false, message: 'Hospital belongs to a different track' });
      return false;
    }
  }

  if (data.supervisorId) {
    const supervisor = await User.findOne({
      _id: data.supervisorId,
      role: isDio ? coerceRoleToTrack('trainer', req.track) : 'trainer',
      isActive: { $ne: false },
    });
    if (!supervisor) {
      res.status(400).json({ success: false, message: 'Supervisor not found or inactive' });
      return false;
    }
  }

  if (data.specialtyId) {
    const specialty = await Specialty.findOne({ _id: data.specialtyId, isActive: { $ne: false } });
    if (!specialty) {
      res.status(400).json({ success: false, message: 'Specialty not found or inactive' });
      return false;
    }
    if (isDio && (specialty.track || 'advanced') !== req.track) {
      res.status(403).json({ success: false, message: 'Specialty belongs to a different track' });
      return false;
    }
  }

  if (merged.traineeId && merged.startDate && merged.endDate && merged.status !== 'cancelled') {
    const start = new Date(merged.startDate);
    const end = new Date(merged.endDate);
    const overlapping = await Rotation.findOne({
      $or: [{ traineeId: merged.traineeId }, { student: merged.traineeId }],
      status: { $ne: 'cancelled' },
      ...(existingId ? { _id: { $ne: existingId } } : {}),
      startDate: { $lt: end },
      endDate: { $gt: start }
    });
    if (overlapping) {
      res.status(409).json({ success: false, message: 'Trainee already has an overlapping rotation' });
      return false;
    }
  }

  if (merged.traineeId && merged.status === 'current') {
    const current = await Rotation.findOne({
      $or: [{ traineeId: merged.traineeId }, { student: merged.traineeId }],
      status: 'current',
      ...(existingId ? { _id: { $ne: existingId } } : {})
    });
    if (current) {
      res.status(409).json({ success: false, message: 'Trainee already has a current rotation' });
      return false;
    }
  }

  return true;
}

function populateRotation(query) {
  return query
    .populate('traineeId', 'name email initials photoUrl year studentId')
    .populate('student', 'name email initials photoUrl year studentId')
    .populate('hospitalId', 'name city')
    .populate('hospital', 'name city')
    .populate('supervisorId', 'name specialty initials photoUrl')
    .populate('doctor', 'name specialty initials photoUrl')
    .populate('specialtyId', 'name');
}

router.get('/', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const query = {};
    // DIO = track-wide: own track across all hospitals (top-level `track` key,
    // safe to merge alongside the status / trainee-$or / hospital-$and below).
    if (req.user.role === 'odio') Object.assign(query, trackFilter(req.track));
    if (req.query.status) query.status = req.query.status;
    if (req.query.traineeId || req.query.student) {
      const id = req.query.traineeId || req.query.student;
      if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid trainee id' });
      query.$or = [{ traineeId: id }, { student: id }];
    }
    if (req.query.hospitalId || req.query.hospital) {
      const id = req.query.hospitalId || req.query.hospital;
      if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid hospital id' });
      query.$and = [...(query.$and || []), { $or: [{ hospitalId: id }, { hospital: id }] }];
    }
    const rotations = await populateRotation(Rotation.find(query)).sort({ startDate: 1 });
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/doctor/:doctorId', auth, async (req, res) => {
  try {
    const isOwner = req.params.doctorId === req.user._id.toString();
    const isStaff = READ_ROLES.includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const rotations = await populateRotation(Rotation.find({
      $or: [{ doctor: req.params.doctorId }, { supervisorId: req.params.doctorId }],
      ...(req.user.role === 'odio' ? trackFilter(req.track) : {}),
    })).sort({ startDate: -1 });
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/student/:id', auth, async (req, res) => {
  try {
    const isOwner = req.params.id === req.user._id.toString();
    const isStaff = READ_ROLES.includes(req.user.role) || req.user.role === 'trainer';
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const rotations = await populateRotation(Rotation.find({
      $or: [{ traineeId: req.params.id }, { student: req.params.id }],
      ...(req.user.role === 'odio' ? trackFilter(req.track) : {}),
    })).sort({ startDate: 1 });
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/current/:studentId', auth, async (req, res) => {
  try {
    const isOwner = req.params.studentId === req.user._id.toString();
    const isStaff = READ_ROLES.includes(req.user.role) || req.user.role === 'trainer';
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const rotation = await populateRotation(Rotation.findOne({
      $or: [{ traineeId: req.params.studentId }, { student: req.params.studentId }],
      status: 'current'
    }));
    if (rotation && !ensureDioCanAccessRotation(req, res, rotation)) return;
    res.json(rotation || null);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    const ALLOWED_CREATE = ['traineeId', 'student', 'hospitalId', 'hospital', 'supervisorId', 'doctor',
                            'specialtyId', 'startDate', 'endDate', 'status', 'weeklyAvg', 'monthlyAvg', 'finalGrade'];
    const data = normalizeRotationData(pick(req.body, ALLOWED_CREATE));
    if (!data.status && data.startDate && data.endDate) data.status = inferStatus(data.startDate, data.endDate);
    if (!(await validateRotationPayload(data, res, { creating: true, req }))) return;

    const rotation = await Rotation.create(data);
    await audit(req, 'create_rotation', rotation._id, { traineeId: rotation.traineeId, hospitalId: rotation.hospitalId, status: rotation.status });
    const populated = await populateRotation(Rotation.findById(rotation._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/:id', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid rotation id' });
    const existing = await Rotation.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Rotation not found' });
    if (!ensureDioCanAccessRotation(req, res, existing)) return;
    const rotation = await Rotation.findByIdAndUpdate(req.params.id, { status: 'cancelled' }, { new: true, runValidators: true });
    await audit(req, 'cancel_rotation', rotation._id, { status: 'cancelled' });
    const populated = await populateRotation(Rotation.findById(rotation._id));
    res.json({ success: true, message: 'Rotation cancelled', data: populated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid rotation id' });
    const existing = await Rotation.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Rotation not found' });
    if (!ensureDioCanAccessRotation(req, res, existing)) return;

    const UPDATE_ALLOWED = ['traineeId', 'student', 'hospitalId', 'hospital', 'supervisorId', 'doctor',
                            'specialtyId', 'startDate', 'endDate', 'status', 'weeklyAvg', 'monthlyAvg', 'finalGrade'];
    const updates = normalizeRotationData(pick(req.body, UPDATE_ALLOWED));
    const mergedStart = updates.startDate || existing.startDate;
    const mergedEnd = updates.endDate || existing.endDate;
    if (!updates.status && (updates.startDate || updates.endDate)) updates.status = inferStatus(mergedStart, mergedEnd);
    if (!(await validateRotationPayload(updates, res, { existingId: req.params.id, existing, req }))) return;

    const rotation = await populateRotation(Rotation.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }));
    await audit(req, updates.status === 'cancelled' ? 'cancel_rotation' : 'update_rotation', rotation._id, {
      fields: Object.keys(updates),
      status: rotation.status
    });
    res.json(rotation);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
