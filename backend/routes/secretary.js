// backend/routes/secretary.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { coerceRoleToTrack } = require('../utils/track');
const auditLog       = require('../middleware/auditLogger');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Rotation       = require('../models/Rotation');
const Specialty      = require('../models/Specialty');

const SECRETARY = ['secretary'];
const CREATE_USER_FIELDS = ['name', 'email', 'password', 'phone', 'gender', 'city',
  'department', 'specialty', 'year', 'studentId', 'enrolledSince',
  'hospitalId', 'hospital', 'specialtyId', 'supervisorId', 'supervisor', 'photoUrl'];
const UPDATE_USER_FIELDS = ['name', 'phone', 'gender', 'city', 'department',
  'specialty', 'year', 'studentId', 'enrolledSince', 'hospitalId',
  'hospital', 'supervisorId', 'supervisor', 'photoUrl', 'isActive'];
const HOSPITAL_UPDATE_FIELDS = ['name', 'city', 'governorate', 'address', 'phone', 'email'];
const ROTATION_UPDATE_FIELDS = ['startDate', 'endDate', 'status', 'supervisorId'];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

function getSpecialty(user) {
  return user.specialtyId || null;
}

function getHospital(user) {
  return user.hospitalId || user.hospital || null;
}

// Resolve every hospital ID a secretary may see/edit, derived ONLY from their
// own assigned hospital + their specialty (name match + specialty.hospitalId).
async function getSecretaryHospitalIds(req) {
  const ids = new Set();
  const own = getHospital(req.user);
  if (own) ids.add(own.toString());
  if (req.user.specialtyId) {
    const spec = await Specialty.findById(req.user.specialtyId).select('name hospitalId');
    if (spec && spec.hospitalId) ids.add(spec.hospitalId.toString());
    if (spec && spec.name) {
      const matches = await Hospital.find({ specialties: spec.name }).select('_id');
      matches.forEach(h => ids.add(h._id.toString()));
    }
  }
  return [...ids];
}

function getSecretaryQuery(req) {
  return { specialtyId: req.user.specialtyId };
}

function dateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function inferRotationStatus(startDate, endDate) {
  const today = dateOnly(new Date());
  const start = dateOnly(new Date(startDate));
  const end = dateOnly(new Date(endDate));
  if (end < today) return 'completed';
  if (start > today) return 'upcoming';
  return 'current';
}

function populateRotation(query) {
  return query
    .populate('traineeId', 'name email initials photoUrl studentId')
    .populate('student', 'name email initials photoUrl studentId')
    .populate('supervisorId', 'name specialty initials')
    .populate('doctor', 'name specialty initials')
    .populate('specialtyId', 'name')
    .populate('hospitalId', 'name city')
    .populate('hospital', 'name city');
}

async function validateRotationDates({ traineeId, startDate, endDate, existingId = null }, res) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
    return false;
  }
  if (end <= start) {
    res.status(400).json({ success: false, message: 'endDate must be after startDate' });
    return false;
  }

  const overlap = await Rotation.findOne({
    $or: [{ traineeId }, { student: traineeId }],
    status: { $ne: 'cancelled' },
    ...(existingId ? { _id: { $ne: existingId } } : {}),
    startDate: { $lt: end },
    endDate: { $gt: start }
  });
  if (overlap) {
    res.status(409).json({ success: false, message: 'Trainee already has an overlapping rotation' });
    return false;
  }
  return true;
}

function requireSecretarySpecialty(req, res) {
  if (!req.user.specialtyId) {
    res.status(403).json({ success: false, message: 'Secretary has no specialty assigned' });
    return null;
  }
  return req.user.specialtyId;
}

// ── TRAINEES ──────────────────────────────────────────────────────────────

// GET /api/secretary/trainees
router.get('/trainees', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = requireSecretarySpecialty(req, res);
    if (!specialtyId) return;

    const trainees = await User.find({
      role: 'trainee',
      specialtyId,
      isActive: { $ne: false }
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .populate('supervisorId', 'name email')
      .sort({ name: 1 });

    res.json({ success: true, data: trainees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/secretary/trainees
router.post('/trainees',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_trainee', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const hospitalId  = req.body.hospitalId || req.body.hospital || getHospital(req.user);
      const data = pick(req.body, CREATE_USER_FIELDS);
      data.role = coerceRoleToTrack('trainee', req.track);
      data.specialtyId = specialtyId;
      data.specialty = req.user.specialty || data.specialty || '';
      if (hospitalId)  { data.hospitalId = hospitalId; data.hospital = hospitalId; }

      const user = new User(data);
      await user.save();

      const saved = await User.findById(user._id)
        .select('-password')
        .populate('hospitalId',  'name city')
        .populate('specialtyId', 'name')
        .populate('supervisorId', 'name email');

      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists' });
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/secretary/trainees/:id
router.patch('/trainees/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_trainee', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const fields = pick(req.body, UPDATE_USER_FIELDS);
      const existing = await User.findOne({ _id: req.params.id, specialtyId });
      if (!existing) return res.status(404).json({ success: false, message: 'User not found in secretary specialty' });
      delete fields.specialtyId;
      const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true })
        .select('-password')
        .populate('hospitalId',  'name city')
        .populate('specialtyId', 'name');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── SUPERVISORS ───────────────────────────────────────────────────────────

// GET /api/secretary/supervisors
router.get('/supervisors', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = requireSecretarySpecialty(req, res);
    if (!specialtyId) return;

    const supervisors = await User.find({
      role: 'supervisor',
      specialtyId,
      isActive: { $ne: false }
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/secretary/supervisors
router.post('/supervisors',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_supervisor', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const hospitalId  = req.body.hospitalId || req.body.hospital || getHospital(req.user);
      const data = pick(req.body, CREATE_USER_FIELDS);
      data.role = coerceRoleToTrack('supervisor', req.track);
      data.specialtyId = specialtyId;
      data.specialty = req.user.specialty || data.specialty || '';
      if (hospitalId)  { data.hospitalId = hospitalId; data.hospital = hospitalId; }

      const user = new User(data);
      await user.save();

      const saved = await User.findById(user._id)
        .select('-password')
        .populate('hospitalId',  'name city')
        .populate('specialtyId', 'name');

      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ message: 'Email already exists' });
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/secretary/supervisors/:id
router.patch('/supervisors/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_supervisor', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const fields = pick(req.body, UPDATE_USER_FIELDS);
      const existing = await User.findOne({ _id: req.params.id, specialtyId });
      if (!existing) return res.status(404).json({ success: false, message: 'User not found in secretary specialty' });
      delete fields.specialtyId;
      const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true })
        .select('-password')
        .populate('hospitalId',  'name city')
        .populate('specialtyId', 'name');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── PROGRAM DIRECTORS ─────────────────────────────────────────────────────

// GET /api/secretary/program-directors
router.get('/program-directors', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const ids = await getSecretaryHospitalIds(req);

    const query = {
      role: 'program_director',
      isActive: { $ne: false }
    };
    if (ids.length) query.$or = [{ hospitalId: { $in: ids } }, { hospital: { $in: ids } }];
    else query._id = null;

    const pds = await User.find(query)
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: pds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/secretary/program-directors
router.post('/program-directors',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_program_director', 'User'),
  async (req, res) => {
    try {
      const hospitalId = req.body.hospitalId || req.body.hospital || getHospital(req.user);
      if (!hospitalId) {
        return res.status(400).json({ success: false, message: 'hospitalId is required for Program Director' });
      }
      const data = pick(req.body, CREATE_USER_FIELDS);
      data.role = coerceRoleToTrack('program_director', req.track);
      delete data.specialtyId;
      delete data.specialty;
      if (hospitalId) { data.hospitalId = hospitalId; data.hospital = hospitalId; }

      const user = new User(data);
      await user.save();

      const saved = await User.findById(user._id)
        .select('-password')
        .populate('hospitalId', 'name city')
        .populate('specialtyId', 'name');

      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ message: 'Email already exists' });
      res.status(500).json({ message: err.message });
    }
  }
);

// ── HOSPITALS ─────────────────────────────────────────────────────────────

// GET /api/secretary/hospitals
router.get('/hospitals', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const ids = await getSecretaryHospitalIds(req);
    const query = ids.length ? { _id: { $in: ids } } : { _id: null };
    const hospitals = await Hospital.find(query).sort({ name: 1 });
    res.json({ success: true, data: hospitals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/secretary/hospitals/:id
router.patch('/hospitals/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_hospital', 'Hospital'),
  async (req, res) => {
    try {
      const ids = await getSecretaryHospitalIds(req);
      if (!ids.length || !ids.includes(req.params.id.toString())) {
        return res.status(403).json({ success: false, message: 'Access denied: hospital not in your specialty scope' });
      }

      const updates = pick(req.body, HOSPITAL_UPDATE_FIELDS);
      const hospital = await Hospital.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
      res.json({ success: true, data: hospital });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── DISTRIBUTIONS ─────────────────────────────────────────────────────────

// POST /api/secretary/distributions
// Compatibility URL: creates a Rotation assignment for a trainee.
router.post('/distributions',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_rotation', 'Rotation'),
  async (req, res) => {
    try {
      const specialtyId = getSpecialty(req.user);
      const hospitalId  = getHospital(req.user);
      const { traineeId, supervisorId, startDate, endDate } = req.body;

      if (!traineeId || !supervisorId || !startDate || !endDate) {
        return res.status(400).json({ message: 'traineeId, supervisorId, startDate, and endDate are required' });
      }

      if (!specialtyId) {
        return res.status(403).json({ success: false, message: 'Secretary has no specialty assigned' });
      }

      const trainee = await User.findOne({
        _id: traineeId,
        role: 'trainee',
        ...getSecretaryQuery(req),
        isActive: { $ne: false }
      });
      if (!trainee) {
        return res.status(403).json({ success: false, message: 'Trainee is not in secretary specialty' });
      }

      const supervisor = await User.findOne({
        _id: supervisorId,
        role: 'supervisor',
        ...getSecretaryQuery(req),
        isActive: { $ne: false }
      });
      if (!supervisor) {
        return res.status(403).json({ success: false, message: 'Supervisor is not in secretary specialty' });
      }

      if (!(await validateRotationDates({ traineeId, startDate, endDate }, res))) return;

      const rotation = await Rotation.create({
        traineeId,
        student:       traineeId,
        supervisorId,
        doctor:        supervisorId, // legacy compatibility
        specialtyId:   specialtyId   || null,
        hospitalId:    hospitalId    || null,
        hospital:      hospitalId    || null, // legacy
        startDate,
        endDate,
        status:        inferRotationStatus(startDate, endDate)
      });

      const populated = await populateRotation(Rotation.findById(rotation._id));

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// GET /api/secretary/distributions
// Compatibility URL: returns Rotation records in the secretary specialty.
router.get('/distributions', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = getSpecialty(req.user);
    const query = specialtyId ? { specialtyId } : { _id: null };

    const distributions = await populateRotation(Rotation.find(query)).sort({ createdAt: -1 });

    res.json({ success: true, data: distributions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/secretary/distributions/:id
router.patch('/distributions/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_rotation', 'Rotation'),
  async (req, res) => {
    try {
      const specialtyId = getSpecialty(req.user);
      const existing = await Rotation.findOne({ _id: req.params.id, specialtyId });
      if (!existing) return res.status(404).json({ success: false, message: 'Rotation not found in secretary specialty' });

      const updates = pick(req.body, ROTATION_UPDATE_FIELDS);
      if (updates.supervisorId) {
        const supervisor = await User.findOne({
          _id: updates.supervisorId,
          role: 'supervisor',
          ...getSecretaryQuery(req),
          isActive: { $ne: false }
        });
        if (!supervisor) {
          return res.status(403).json({ success: false, message: 'Supervisor is not in secretary specialty' });
        }
        updates.doctor = updates.supervisorId;
      }

      const startDate = updates.startDate || existing.startDate;
      const endDate = updates.endDate || existing.endDate;
      const traineeId = existing.traineeId || existing.student;
      if (updates.startDate || updates.endDate) {
        if (!(await validateRotationDates({ traineeId, startDate, endDate, existingId: req.params.id }, res))) return;
        if (!updates.status) updates.status = inferRotationStatus(startDate, endDate);
      }

      const dist = await populateRotation(Rotation.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }));
      if (!dist) return res.status(404).json({ message: 'Rotation not found' });
      res.json({ success: true, data: dist });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
