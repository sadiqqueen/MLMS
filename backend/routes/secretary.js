// backend/routes/secretary.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Distribution   = require('../models/Distribution');

const SECRETARY = ['secretary'];

function getSpecialty(user) {
  return user.specialtyId || null;
}

function getHospital(user) {
  return user.hospitalId || user.hospital || null;
}

// ── TRAINEES ──────────────────────────────────────────────────────────────

// GET /api/secretary/trainees
router.get('/trainees', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = getSpecialty(req.user);
    const query = { role: 'trainee', isActive: { $ne: false } };
    if (specialtyId) query.specialtyId = specialtyId;

    const trainees = await User.find(query)
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: trainees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/secretary/trainees
router.post('/trainees',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_trainee', 'User'),
  async (req, res) => {
    try {
      const specialtyId = getSpecialty(req.user);
      const hospitalId  = getHospital(req.user);
      const data = { ...req.body, role: 'trainee' };
      if (specialtyId) data.specialtyId = specialtyId;
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

// PATCH /api/secretary/trainees/:id
router.patch('/trainees/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_trainee', 'User'),
  async (req, res) => {
    try {
      const { password, role, ...fields } = req.body;
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
    const specialtyId = getSpecialty(req.user);
    const query = { role: 'supervisor', isActive: { $ne: false } };
    if (specialtyId) query.specialtyId = specialtyId;

    const supervisors = await User.find(query)
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
      const specialtyId = getSpecialty(req.user);
      const hospitalId  = getHospital(req.user);
      const data = { ...req.body, role: 'supervisor' };
      if (specialtyId) data.specialtyId = specialtyId;
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
      const { password, role, ...fields } = req.body;
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
    const hospitalId = getHospital(req.user);
    const query = { role: 'program_director', isActive: { $ne: false } };
    if (hospitalId) query.$or = [{ hospitalId }, { hospital: hospitalId }];

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
      const hospitalId = getHospital(req.user);
      const data = { ...req.body, role: 'program_director' };
      if (hospitalId) { data.hospitalId = hospitalId; data.hospital = hospitalId; }

      const user = new User(data);
      await user.save();

      const saved = await User.findById(user._id)
        .select('-password')
        .populate('hospitalId', 'name city');

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
      const hospital = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const query = specialtyId ? { specialtyId } : {};

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
      const dist = await Distribution.findByIdAndUpdate(req.params.id, req.body, { new: true })
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
