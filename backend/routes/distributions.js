const router         = require('express').Router();
const mongoose       = require('mongoose');
const Distribution   = require('../models/Distribution');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Specialty      = require('../models/Specialty');
const AuditLog       = require('../models/AuditLog');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const STAFF = ['super_admin', 'secretary', 'dio'];
const STATUSES = ['upcoming', 'active', 'completed', 'cancelled'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeDistributionData(data) {
  if (data.traineeId && !data.student) data.student = data.traineeId;
  if (data.student && !data.traineeId) data.traineeId = data.student;
  if (data.supervisorId && !data.doctor) data.doctor = data.supervisorId;
  if (data.doctor && !data.supervisorId) data.supervisorId = data.doctor;
  if (data.hospitalId && !data.hospital) data.hospital = data.hospitalId;
  if (data.hospital && !data.hospitalId) data.hospitalId = data.hospital;
  return data;
}

async function audit(req, action, targetId, metadata = {}) {
  await AuditLog.create({
    userId: req.user._id,
    action,
    targetId,
    targetModel: 'Distribution',
    metadata,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
  }).catch(err => console.error('[AuditLog] Failed to write distribution audit:', err.message));
}

async function validateDistributionPayload(data, res, { creating = false, existingId = null } = {}) {
  normalizeDistributionData(data);
  const required = creating ? ['traineeId', 'supervisorId', 'specialtyId', 'hospitalId'] : [];
  const missing = required.filter(k => !data[k]);
  if (missing.length) {
    res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
    return false;
  }

  for (const field of ['traineeId', 'student', 'supervisorId', 'doctor', 'specialtyId', 'hospitalId', 'hospital']) {
    if (data[field] && !isValidObjectId(data[field])) {
      res.status(400).json({ success: false, message: `Invalid ${field}` });
      return false;
    }
  }

  if (data.status && !STATUSES.includes(data.status)) {
    res.status(400).json({ success: false, message: 'Invalid distribution status' });
    return false;
  }

  if (data.startDate || data.endDate) {
    const start = data.startDate ? new Date(data.startDate) : null;
    const end = data.endDate ? new Date(data.endDate) : null;
    if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
      res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
      return false;
    }
    if (start && end && end <= start) {
      res.status(400).json({ success: false, message: 'endDate must be after startDate' });
      return false;
    }
  }

  if (data.traineeId) {
    const trainee = await User.findOne({ _id: data.traineeId, role: 'trainee', isActive: { $ne: false } });
    if (!trainee) {
      res.status(400).json({ success: false, message: 'Trainee not found or inactive' });
      return false;
    }
  }

  if (data.supervisorId) {
    const supervisor = await User.findOne({ _id: data.supervisorId, role: 'supervisor', isActive: { $ne: false } });
    if (!supervisor) {
      res.status(400).json({ success: false, message: 'Supervisor not found or inactive' });
      return false;
    }
  }

  if (data.hospitalId) {
    const hospital = await Hospital.findOne({ _id: data.hospitalId, isActive: { $ne: false } });
    if (!hospital) {
      res.status(400).json({ success: false, message: 'Hospital not found or inactive' });
      return false;
    }
  }

  if (data.specialtyId) {
    const specialty = await Specialty.findOne({ _id: data.specialtyId, isActive: { $ne: false } });
    if (!specialty) {
      res.status(400).json({ success: false, message: 'Specialty not found or inactive' });
      return false;
    }
    if (!data.specialty) data.specialty = specialty.name;
  }

  if (creating && data.traineeId && ['active', 'upcoming'].includes(data.status || 'active')) {
    const duplicate = await Distribution.findOne({
      traineeId: data.traineeId,
      status: { $in: ['active'] },
      ...(existingId ? { _id: { $ne: existingId } } : {})
    });
    if (duplicate) {
      res.status(409).json({ success: false, message: 'Trainee already has an active distribution' });
      return false;
    }
  }

  return true;
}

function populateDistribution(query) {
  return query
    .populate('traineeId', 'name email studentId photoUrl initials')
    .populate('supervisorId', 'name specialty photoUrl initials')
    .populate('specialtyId', 'name')
    .populate('hospitalId', 'name city')
    .populate('doctor', 'name specialty photoUrl initials')
    .populate('hospital', 'name city');
}

// GET /api/distributions — supports ?hospital= ?specialty= ?status= filters
router.get('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const query = {};
    const and = [];
    if (req.query.hospital) {
      const hospitalMatch = [{ hospital: req.query.hospital }];
      if (mongoose.Types.ObjectId.isValid(req.query.hospital)) {
        hospitalMatch.push({ hospitalId: req.query.hospital });
      }
      and.push({ $or: hospitalMatch });
    }
    if (req.query.specialty) {
      const safeSpecialty = new RegExp(escapeRegex(req.query.specialty.slice(0, 100)), 'i');
      const specialtyMatch = [{ specialty: safeSpecialty }];
      if (mongoose.Types.ObjectId.isValid(req.query.specialty)) {
        specialtyMatch.push({ specialtyId: req.query.specialty });
      }
      and.push({ $or: specialtyMatch });
    }
    if (req.query.status)    query.status     = req.query.status;
    if (and.length) query.$and = and;

    const distributions = await Distribution.find(query)
      .populate('traineeId', 'name email studentId photoUrl initials')
      .populate('supervisorId', 'name specialty photoUrl initials')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name city')
      .populate('doctor',   'name specialty photoUrl initials')
      .populate('hospital', 'name city')
      .sort({ createdAt: -1 });
    res.json(distributions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const ALLOWED = ['traineeId', 'supervisorId', 'specialtyId', 'hospitalId',
                     'startDate', 'endDate', 'durationWeeks', 'status',
                     'student', 'doctor', 'hospital', 'specialty'];
    const data = pick(req.body, ALLOWED);
    data.createdBy = req.user._id;
    data.status = data.status || 'active';
    if (!(await validateDistributionPayload(data, res, { creating: true }))) return;

    const dist      = await Distribution.create(data);
    await audit(req, 'create_distribution', dist._id, { status: dist.status, traineeId: dist.traineeId });
    const populated = await populateDistribution(Distribution.findById(dist._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid distribution id' });
    const UPDATE_ALLOWED = ['startDate', 'endDate', 'durationWeeks', 'status',
                            'supervisorId', 'specialtyId', 'hospitalId',
                            'doctor', 'hospital', 'specialty'];
    const updates = pick(req.body, UPDATE_ALLOWED);
    if (!(await validateDistributionPayload(updates, res, { existingId: req.params.id }))) return;

    const dist = await populateDistribution(Distribution.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }));
    if (!dist) return res.status(404).json({ message: 'Distribution not found' });
    await audit(req, updates.status === 'cancelled' ? 'cancel_distribution' : 'update_distribution', dist._id, { fields: Object.keys(updates), status: dist.status });
    res.json(dist);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid distribution id' });
    const dist = await Distribution.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    if (!dist) return res.status(404).json({ message: 'Distribution not found' });
    await audit(req, 'cancel_distribution', dist._id, { status: 'cancelled' });
    res.json({ message: 'Distribution cancelled', data: dist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
