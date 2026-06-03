const router         = require('express').Router();
const mongoose       = require('mongoose');
const Rotation       = require('../models/Rotation');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const AuditLog       = require('../models/AuditLog');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const STAFF = ['super_admin', 'dio'];
const READ_STAFF = ['super_admin', 'program_director', 'dio'];
const STATUSES = ['completed', 'current', 'upcoming', 'cancelled'];

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
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

async function validateRotationPayload(data, res, { creating = false, existingId = null } = {}) {
  const required = creating ? ['student', 'hospital', 'startDate', 'endDate'] : [];
  const missing = required.filter(k => !data[k]);
  if (missing.length) {
    res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
    return false;
  }

  for (const field of ['student', 'hospital', 'doctor']) {
    if (data[field] && !isValidObjectId(data[field])) {
      res.status(400).json({ success: false, message: `Invalid ${field}` });
      return false;
    }
  }

  if (data.status && !STATUSES.includes(data.status)) {
    res.status(400).json({ success: false, message: 'Invalid rotation status' });
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

  if (data.student) {
    const trainee = await User.findOne({ _id: data.student, role: 'trainee', isActive: { $ne: false } });
    if (!trainee) {
      res.status(400).json({ success: false, message: 'Trainee not found or inactive' });
      return false;
    }
  }

  if (data.hospital) {
    const hospital = await Hospital.findOne({ _id: data.hospital, isActive: { $ne: false } });
    if (!hospital) {
      res.status(400).json({ success: false, message: 'Hospital not found or inactive' });
      return false;
    }
  }

  if (data.doctor) {
    const supervisor = await User.findOne({ _id: data.doctor, role: 'supervisor', isActive: { $ne: false } });
    if (!supervisor) {
      res.status(400).json({ success: false, message: 'Supervisor not found or inactive' });
      return false;
    }
  }

  if (creating && data.student && data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const overlapping = await Rotation.findOne({
      student: data.student,
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

  return true;
}

function populateRotation(query) {
  return query
    .populate('student', 'name email initials photoUrl year studentId')
    .populate('hospital', 'name city')
    .populate('doctor', 'name specialty initials photoUrl');
}

// GET /api/rotations — all rotations (staff)
router.get('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.student) {
      if (!isValidObjectId(req.query.student)) return res.status(400).json({ success: false, message: 'Invalid student id' });
      query.student = req.query.student;
    }
    if (req.query.hospital) {
      if (!isValidObjectId(req.query.hospital)) return res.status(400).json({ success: false, message: 'Invalid hospital id' });
      query.hospital = req.query.hospital;
    }
    const rotations = await populateRotation(Rotation.find(query)).sort({ createdAt: -1 });
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/rotations/doctor/:doctorId — rotations supervised by a specific doctor
router.get('/doctor/:doctorId', auth, async (req, res) => {
  try {
    const isOwner = req.params.doctorId === req.user._id.toString();
    const isStaff = READ_STAFF.includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const rotations = await Rotation.find({ doctor: req.params.doctorId })
      .populate('student',  'name email initials photoUrl year studentId')
      .populate('hospital', 'name city')
      .sort({ startDate: -1 });
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/rotations/student/:id — all rotations for one student (sorted oldest → newest)
router.get('/student/:id', auth, async (req, res) => {
  try {
    const isOwner = req.params.id === req.user._id.toString();
    const isStaff = READ_STAFF.includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const rotations = await Rotation.find({ student: req.params.id })
      .populate('hospital', 'name address department city')
      .populate('doctor',   'name specialty department initials')
      .sort({ startDate: 1 });   // 1 = ascending (oldest first)
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/rotations/current/:studentId — the student's active rotation (status = 'current')
router.get('/current/:studentId', auth, async (req, res) => {
  try {
    const isOwner = req.params.studentId === req.user._id.toString();
    const isStaff = READ_STAFF.includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const rotation = await Rotation.findOne({ student: req.params.studentId, status: 'current' })
      .populate('hospital', 'name address department')
      .populate('doctor',   'name department initials');
    res.json(rotation || null);  // return null if no current rotation
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rotations — create a new rotation
router.post('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const ALLOWED_CREATE = ['student', 'hospital', 'doctor', 'startDate', 'endDate',
                            'status', 'weeklyAvg', 'monthlyAvg', 'finalGrade'];
    const data = pick(req.body, ALLOWED_CREATE);
    if (!(await validateRotationPayload(data, res, { creating: true }))) return;

    const rotation = await Rotation.create(data);
    await audit(req, 'create_rotation', rotation._id, { student: rotation.student, hospital: rotation.hospital, status: rotation.status });
    const populated = await populateRotation(Rotation.findById(rotation._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/rotations/:id
router.delete('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid rotation id' });
    const rotation = await Rotation.findById(req.params.id);
    if (!rotation) return res.status(404).json({ success: false, message: 'Rotation not found' });

    const linkedCount = await Promise.all([
      Report.countDocuments({ rotation: rotation._id }),
      Evaluation.countDocuments({ rotationId: rotation._id })
    ]).then(([reports, evaluations]) => reports + evaluations);

    if (linkedCount > 0) {
      rotation.status = 'cancelled';
      await rotation.save();
      await audit(req, 'cancel_rotation', rotation._id, { linkedCount });
      return res.json({ success: true, message: 'Rotation cancelled because linked records exist', data: rotation });
    }

    await rotation.deleteOne();
    await audit(req, 'delete_rotation', rotation._id, { linkedCount: 0 });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/rotations/:id — update a rotation (e.g. add final grade)
router.put('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid rotation id' });
    const UPDATE_ALLOWED = ['student', 'hospital', 'doctor', 'startDate', 'endDate',
                            'status', 'weeklyAvg', 'monthlyAvg', 'finalGrade'];
    const updates = pick(req.body, UPDATE_ALLOWED);
    if (!(await validateRotationPayload(updates, res, { existingId: req.params.id }))) return;

    const existing = await Rotation.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Rotation not found' });
    const mergedStudent = updates.student || existing.student;
    const mergedStart = updates.startDate ? new Date(updates.startDate) : existing.startDate;
    const mergedEnd = updates.endDate ? new Date(updates.endDate) : existing.endDate;
    if (mergedStudent && mergedStart && mergedEnd && updates.status !== 'cancelled') {
      const overlapping = await Rotation.findOne({
        _id: { $ne: req.params.id },
        student: mergedStudent,
        status: { $ne: 'cancelled' },
        startDate: { $lt: mergedEnd },
        endDate: { $gt: mergedStart }
      });
      if (overlapping) {
        return res.status(409).json({ success: false, message: 'Trainee already has an overlapping rotation' });
      }
    }

    const rotation = await populateRotation(Rotation.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }));
    if (!rotation) return res.status(404).json({ message: 'Rotation not found' });
    await audit(req, updates.status === 'cancelled' ? 'cancel_rotation' : 'update_rotation', rotation._id, { fields: Object.keys(updates), status: rotation.status });
    res.json(rotation);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
