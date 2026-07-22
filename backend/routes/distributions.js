const router         = require('express').Router();
const mongoose       = require('mongoose');
const Distribution   = require('../models/Distribution');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Specialty      = require('../models/Specialty');
const AuditLog       = require('../models/AuditLog');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const READ_ROLES  = ['developer', 'odio'];
const WRITE_ROLES = ['developer', 'odio'];
const STATUSES    = ['active', 'inactive'];

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
  if (data.doctor && !data.supervisorId) data.supervisorId = data.doctor;
  if (data.supervisorId && !data.doctor) data.doctor = data.supervisorId;
  if (data.hospital && !data.hospitalId) data.hospitalId = data.hospital;
  if (data.hospitalId && !data.hospital) data.hospital = data.hospitalId;
  return data;
}

function getHospital(user) {
  const hospital = user.hospitalId || user.hospital || null;
  return hospital?._id || hospital;
}

function sameId(a, b) {
  if (!a || !b) return false;
  const left = a?._id || a;
  const right = b?._id || b;
  return left.toString() === right.toString();
}

function hospitalCondition(hospitalId) {
  return { $or: [{ hospitalId }, { hospital: hospitalId }] };
}

function addAnd(query, condition) {
  if (!condition) return;
  query.$and = [...(query.$and || []), condition];
}

function belongsToHospital(doc, hospitalId) {
  return sameId(doc?.hospitalId, hospitalId) || sameId(doc?.hospital, hospitalId);
}

function getDioHospitalOrFail(req, res) {
  if (req.user.role !== 'odio') return null;
  const hospitalId = getHospital(req.user);
  if (!hospitalId) {
    res.status(403).json({ success: false, message: 'DIO account is not assigned to a hospital' });
    return false;
  }
  return hospitalId;
}

function ensureDioCanAccessDistribution(req, res, distribution) {
  const hospitalId = getDioHospitalOrFail(req, res);
  if (hospitalId === false) return false;
  if (!hospitalId) return true;
  if (belongsToHospital(distribution, hospitalId)) return true;
  res.status(403).json({ success: false, message: 'Access denied: distribution belongs to a different hospital' });
  return false;
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

async function validateDistributionPayload(data, res, { creating = false, existingId = null, req = null } = {}) {
  normalizeDistributionData(data);
  const dioHospitalId = req ? getDioHospitalOrFail(req, res) : null;
  if (dioHospitalId === false) return false;
  if (dioHospitalId && data.hospitalId && !sameId(data.hospitalId, dioHospitalId)) {
    res.status(403).json({ success: false, message: 'DIO users can only manage their assigned hospital' });
    return false;
  }

  const required = creating ? ['supervisorId', 'hospitalId', 'specialtyId'] : [];
  const missing = required.filter(k => !data[k]);
  if (missing.length) {
    res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
    return false;
  }

  for (const field of ['supervisorId', 'doctor', 'hospitalId', 'hospital', 'specialtyId']) {
    if (data[field] && !isValidObjectId(data[field])) {
      res.status(400).json({ success: false, message: `Invalid ${field}` });
      return false;
    }
  }

  if (data.status && !STATUSES.includes(data.status)) {
    res.status(400).json({ success: false, message: 'Invalid distribution status' });
    return false;
  }

  if (data.supervisorId) {
    const supervisor = await User.findOne({ _id: data.supervisorId, role: 'trainer', isActive: { $ne: false } });
    if (!supervisor) {
      res.status(400).json({ success: false, message: 'Supervisor not found or inactive' });
      return false;
    }
    if (dioHospitalId && !belongsToHospital(supervisor, dioHospitalId)) {
      res.status(403).json({ success: false, message: 'Supervisor belongs to a different hospital' });
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
    if (dioHospitalId && specialty.hospitalId && !sameId(specialty.hospitalId, dioHospitalId)) {
      res.status(403).json({ success: false, message: 'Specialty belongs to a different hospital' });
      return false;
    }
    if (!data.specialty) data.specialty = specialty.name;
  }

  if (data.supervisorId && (creating || data.status === 'active')) {
    const duplicate = await Distribution.findOne({
      supervisorId: data.supervisorId,
      status: 'active',
      ...(existingId ? { _id: { $ne: existingId } } : {})
    });
    if (duplicate) {
      res.status(409).json({
        success: false,
        message: 'Supervisor already has an active distribution. Deactivate it before creating another.'
      });
      return false;
    }
  }

  return true;
}

function populateDistribution(query) {
  return query
    .populate('supervisorId', 'name email specialty photoUrl initials')
    .populate('specialtyId', 'name nameEn')
    .populate('hospitalId', 'name city')
    .populate('doctor', 'name email specialty photoUrl initials')
    .populate('hospital', 'name city')
    .populate('traineeId', 'name email studentId photoUrl initials')
    .populate('student', 'name email studentId photoUrl initials');
}

// GET /api/distributions - supervisor placement list
router.get('/', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const query = {};
    const and = [];
    const dioHospitalId = getDioHospitalOrFail(req, res);
    if (dioHospitalId === false) return;
    if (dioHospitalId) and.push(hospitalCondition(dioHospitalId));

    if (req.query.hospital) {
      const hospitalMatch = [{ hospital: req.query.hospital }];
      if (isValidObjectId(req.query.hospital)) hospitalMatch.push({ hospitalId: req.query.hospital });
      and.push({ $or: hospitalMatch });
    }

    if (req.query.specialty) {
      const safeSpecialty = new RegExp(escapeRegex(req.query.specialty.slice(0, 100)), 'i');
      const specialtyMatch = [{ specialty: safeSpecialty }];
      if (isValidObjectId(req.query.specialty)) specialtyMatch.push({ specialtyId: req.query.specialty });
      and.push({ $or: specialtyMatch });
    }

    if (req.query.supervisorId) {
      if (!isValidObjectId(req.query.supervisorId)) return res.status(400).json({ success: false, message: 'Invalid supervisorId' });
      query.supervisorId = req.query.supervisorId;
    }

    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) return res.status(400).json({ success: false, message: 'Invalid distribution status' });
      query.status = req.query.status;
    }

    if (and.length) query.$and = and;

    const distributions = await populateDistribution(Distribution.find(query)).sort({ createdAt: -1 });
    res.json(distributions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    const ALLOWED = ['supervisorId', 'specialtyId', 'hospitalId', 'status', 'doctor', 'hospital', 'specialty'];
    const data = pick(req.body, ALLOWED);
    data.createdBy = req.user._id;
    data.status = data.status || 'active';
    if (!(await validateDistributionPayload(data, res, { creating: true, req }))) return;

    const dist = await Distribution.create(data);
    await audit(req, 'create_distribution', dist._id, {
      supervisorId: dist.supervisorId,
      hospitalId: dist.hospitalId,
      specialtyId: dist.specialtyId,
      status: dist.status
    });
    const populated = await populateDistribution(Distribution.findById(dist._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid distribution id' });
    const existing = await Distribution.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Distribution not found' });
    if (!ensureDioCanAccessDistribution(req, res, existing)) return;

    const UPDATE_ALLOWED = ['supervisorId', 'specialtyId', 'hospitalId', 'status', 'doctor', 'hospital', 'specialty'];
    const updates = pick(req.body, UPDATE_ALLOWED);
    if (updates.status === 'active' && !updates.supervisorId && !updates.doctor) {
      updates.supervisorId = existing.supervisorId || existing.doctor;
    }
    if (!(await validateDistributionPayload(updates, res, { existingId: req.params.id, req }))) return;

    const dist = await populateDistribution(Distribution.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }));
    await audit(req, updates.status === 'inactive' ? 'deactivate_distribution' : 'update_distribution', dist._id, {
      fields: Object.keys(updates),
      status: dist.status
    });
    res.json(dist);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid distribution id' });
    const existing = await Distribution.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Distribution not found' });
    if (!ensureDioCanAccessDistribution(req, res, existing)) return;
    const dist = await Distribution.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true, runValidators: true });
    await audit(req, 'deactivate_distribution', dist._id, { status: 'inactive' });
    res.json({ success: true, message: 'Distribution deactivated', data: dist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/reactivate', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid distribution id' });
    const existing = await Distribution.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Distribution not found' });
    if (!ensureDioCanAccessDistribution(req, res, existing)) return;
    if (!(await validateDistributionPayload({ supervisorId: existing.supervisorId, hospitalId: existing.hospitalId || existing.hospital, status: 'active' }, res, { existingId: req.params.id, req }))) return;

    existing.status = 'active';
    await existing.save();
    await audit(req, 'reactivate_distribution', existing._id, { status: 'active' });
    const populated = await populateDistribution(Distribution.findById(existing._id));
    res.json({ success: true, message: 'Distribution reactivated', data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
