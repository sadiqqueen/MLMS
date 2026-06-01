// backend/routes/secretary.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Distribution   = require('../models/Distribution');

const SECRETARY = ['secretary', 'admin'];
const CREATE_USER_FIELDS = ['name', 'email', 'password', 'phone', 'gender', 'city',
  'department', 'specialty', 'year', 'studentId', 'enrolledSince',
  'hospitalId', 'hospital', 'specialtyId', 'supervisorId', 'supervisor', 'photoUrl'];
const UPDATE_USER_FIELDS = ['name', 'phone', 'gender', 'city', 'department',
  'specialty', 'year', 'studentId', 'enrolledSince', 'hospitalId',
  'hospital', 'supervisorId', 'supervisor', 'photoUrl', 'isActive'];
const HOSPITAL_UPDATE_FIELDS = ['name', 'city', 'governorate', 'address', 'phone', 'email'];
const DISTRIBUTION_UPDATE_FIELDS = ['startDate', 'endDate', 'durationWeeks', 'status', 'supervisorId'];

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

function getSecretaryQuery(req) {
  return { specialtyId: req.user.specialtyId };
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
      role: { $in: ['trainee', 'student'] },
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
      data.role = 'trainee';
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
      role: { $in: ['supervisor', 'doctor'] },
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
      data.role = 'supervisor';
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
    const specialtyId = getSpecialty(req.user);
    const hospitalId  = getHospital(req.user);
    const scope = [];
    if (specialtyId) scope.push({ specialtyId });
    if (hospitalId) scope.push({ hospitalId }, { hospital: hospitalId });

    const query = {
      role: { $in: ['program_director', 'director'] },
      isActive: { $ne: false }
    };
    if (scope.length) query.$or = scope;

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
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const hospitalId = req.body.hospitalId || req.body.hospital || getHospital(req.user);
      const data = pick(req.body, CREATE_USER_FIELDS);
      data.role = 'program_director';
      data.specialtyId = specialtyId;
      data.specialty = req.user.specialty || data.specialty || '';
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
    const hospitalId = getHospital(req.user);
    const query = hospitalId ? { _id: hospitalId } : {};
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
      const hospitalId = getHospital(req.user);
      if (hospitalId && req.params.id !== hospitalId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied: hospital belongs to another scope' });
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
// Create a rotation assignment for a trainee
router.post('/distributions',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_distribution', 'Distribution'),
  async (req, res) => {
    try {
      const specialtyId = getSpecialty(req.user);
      const hospitalId  = getHospital(req.user);
      const { traineeId, supervisorId, startDate, endDate, durationWeeks } = req.body;

      if (!traineeId || !supervisorId) {
        return res.status(400).json({ message: 'traineeId and supervisorId are required' });
      }

      if (!specialtyId) {
        return res.status(403).json({ success: false, message: 'Secretary has no specialty assigned' });
      }

      const trainee = await User.findOne({
        _id: traineeId,
        role: { $in: ['trainee', 'student'] },
        ...getSecretaryQuery(req),
        isActive: { $ne: false }
      });
      if (!trainee) {
        return res.status(403).json({ success: false, message: 'Trainee is not in secretary specialty' });
      }

      const supervisor = await User.findOne({
        _id: supervisorId,
        role: { $in: ['supervisor', 'doctor'] },
        ...getSecretaryQuery(req),
        isActive: { $ne: false }
      });
      if (!supervisor) {
        return res.status(403).json({ success: false, message: 'Supervisor is not in secretary specialty' });
      }

      const dist = await Distribution.create({
        traineeId,
        supervisorId,
        student:       traineeId,    // legacy compatibility
        doctor:        supervisorId, // legacy compatibility
        specialtyId:   specialtyId   || null,
        hospitalId:    hospitalId    || null,
        hospital:      hospitalId    || null, // legacy
        startDate,
        endDate,
        durationWeeks: durationWeeks || null,
        status:        'active',
        createdBy:     req.user._id
      });

      const populated = await Distribution.findById(dist._id)
        .populate('traineeId',   'name email initials photoUrl')
        .populate('supervisorId','name specialty initials')
        .populate('specialtyId', 'name')
        .populate('hospitalId',  'name city');

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// GET /api/secretary/distributions
router.get('/distributions', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = getSpecialty(req.user);
    const query = specialtyId ? { specialtyId } : { _id: null };

    const distributions = await Distribution.find(query)
      .populate('traineeId',   'name email initials photoUrl')
      .populate('supervisorId','name specialty initials')
      .populate('specialtyId', 'name')
      .populate('hospitalId',  'name city')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: distributions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/secretary/distributions/:id
router.patch('/distributions/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_distribution', 'Distribution'),
  async (req, res) => {
    try {
      const specialtyId = getSpecialty(req.user);
      const existing = await Distribution.findOne({ _id: req.params.id, specialtyId });
      if (!existing) return res.status(404).json({ success: false, message: 'Distribution not found in secretary specialty' });

      const updates = pick(req.body, DISTRIBUTION_UPDATE_FIELDS);
      if (updates.supervisorId) {
        const supervisor = await User.findOne({
          _id: updates.supervisorId,
          role: { $in: ['supervisor', 'doctor'] },
          ...getSecretaryQuery(req),
          isActive: { $ne: false }
        });
        if (!supervisor) {
          return res.status(403).json({ success: false, message: 'Supervisor is not in secretary specialty' });
        }
      }

      const dist = await Distribution.findByIdAndUpdate(req.params.id, updates, { new: true })
        .populate('traineeId',   'name email initials photoUrl')
        .populate('supervisorId','name specialty initials')
        .populate('specialtyId', 'name')
        .populate('hospitalId',  'name city');
      if (!dist) return res.status(404).json({ message: 'Distribution not found' });
      res.json({ success: true, data: dist });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
