// backend/routes/adminV2.js
// Super admin only — system-wide access to all data
const router         = require('express').Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Distribution   = require('../models/Distribution');
const Certificate    = require('../models/Certificate');
const AuditLog       = require('../models/AuditLog');
const Specialty      = require('../models/Specialty');

const ADMIN = ['super_admin'];

// ── STATS ─────────────────────────────────────────────────────────────────

// GET /api/admin/stats — system-wide statistics
router.get('/stats', auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    const [users, hospitals, specialties, activeRotations, certificates, trainees, supervisors] =
      await Promise.all([
        User.countDocuments({ isActive: { $ne: false } }),
        Hospital.countDocuments({ isActive: { $ne: false } }),
        Specialty.countDocuments({ isActive: { $ne: false } }),
        Distribution.countDocuments({ status: 'active' }),
        Certificate.countDocuments({ revokedAt: null }),
        User.countDocuments({ role: 'trainee',    isActive: { $ne: false } }),
        User.countDocuments({ role: 'supervisor', isActive: { $ne: false } })
      ]);

    res.json({ success: true, data: { users, hospitals, specialties, activeRotations, certificates, trainees, supervisors } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── USERS ─────────────────────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    const { role, hospital, search, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(Math.max(1, Number(limit) || 50), 500);
    const query = {};
    if (role) query.role = role;
    if (hospital) query.$or = [{ hospitalId: hospital }, { hospital }];
    if (search) {
      const rx = new RegExp(escapeRegex(search.slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('hospitalId',  'name city')
        .populate('hospital',    'name city')
        .populate('specialtyId', 'name')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      User.countDocuments(query)
    ]);

    res.json({ success: true, data: users, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/users — create any user with any role
router.post('/users',
  auth,
  allowRoles(...ADMIN),
  auditLog('create_user', 'User'),
  async (req, res) => {
    try {
      const user = new User(req.body);
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

// PATCH /api/admin/users/:id
router.patch('/users/:id',
  auth,
  allowRoles(...ADMIN),
  auditLog('update_user', 'User'),
  async (req, res) => {
    try {
      const { password, ...fields } = req.body;
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

// DELETE /api/admin/users/:id — soft delete (sets isActive: false)
router.delete('/users/:id',
  auth,
  allowRoles(...ADMIN),
  auditLog('deactivate_user', 'User'),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      ).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ success: true, message: 'User deactivated', data: user });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/admin/users/:id/reactivate
router.patch('/users/:id/reactivate',
  auth,
  allowRoles(...ADMIN),
  auditLog('reactivate_user', 'User'),
  async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: true, loginAttempts: 0, lockUntil: null },
        { new: true }
      ).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── HOSPITALS ─────────────────────────────────────────────────────────────

// GET /api/admin/hospitals
router.get('/hospitals', auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .populate('dioId',       'name email')
      .populate('presidentId', 'name email')
      .sort({ name: 1 });
    res.json({ success: true, data: hospitals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/hospitals
router.post('/hospitals',
  auth,
  allowRoles(...ADMIN),
  auditLog('create_hospital', 'Hospital'),
  async (req, res) => {
    try {
      const hospital = await Hospital.create(req.body);
      res.status(201).json({ success: true, data: hospital });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/admin/hospitals/:id
router.patch('/hospitals/:id',
  auth,
  allowRoles(...ADMIN),
  auditLog('update_hospital', 'Hospital'),
  async (req, res) => {
    try {
      const hospital = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .populate('dioId',       'name email')
        .populate('presidentId', 'name email');
      if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
      res.json({ success: true, data: hospital });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/admin/hospitals/:id — soft delete
router.delete('/hospitals/:id',
  auth,
  allowRoles(...ADMIN),
  auditLog('deactivate_hospital', 'Hospital'),
  async (req, res) => {
    try {
      const hospital = await Hospital.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
      res.json({ success: true, message: 'Hospital deactivated', data: hospital });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── SPECIALTIES ───────────────────────────────────────────────────────────

// GET /api/admin/specialties
router.get('/specialties', auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    const specialties = await Specialty.find()
      .populate('hospitalId',  'name city')
      .populate('secretaryId', 'name email')
      .sort({ name: 1 });
    res.json({ success: true, data: specialties });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/specialties
router.post('/specialties',
  auth,
  allowRoles(...ADMIN),
  auditLog('create_specialty', 'Specialty'),
  async (req, res) => {
    try {
      const specialty = await Specialty.create(req.body);
      res.status(201).json({ success: true, data: specialty });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/admin/specialties/:id
router.patch('/specialties/:id',
  auth,
  allowRoles(...ADMIN),
  auditLog('update_specialty', 'Specialty'),
  async (req, res) => {
    try {
      const specialty = await Specialty.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .populate('hospitalId',  'name city')
        .populate('secretaryId', 'name email');
      if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
      res.json({ success: true, data: specialty });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── DISTRIBUTIONS ─────────────────────────────────────────────────────────

// GET /api/admin/distributions
router.get('/distributions', auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    const { hospital, specialty, status, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(Math.max(1, Number(limit) || 50), 500);
    const query = {};
    if (status)    query.status     = status;
    if (hospital)  query.$or        = [{ hospitalId: hospital }, { hospital }];
    if (specialty) query.specialtyId = specialty;

    const [distributions, total] = await Promise.all([
      Distribution.find(query)
        .populate('traineeId',   'name email initials photoUrl')
        .populate('supervisorId','name specialty initials')
        .populate('specialtyId', 'name')
        .populate('hospitalId',  'name city')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      Distribution.countDocuments(query)
    ]);

    res.json({ success: true, data: distributions, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── CERTIFICATES ──────────────────────────────────────────────────────────

// GET /api/admin/certificates
router.get('/certificates', auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    const { revoked, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(Math.max(1, Number(limit) || 50), 500);
    const query = {};
    if (revoked === 'true')  query.revokedAt = { $ne: null };
    if (revoked === 'false') query.revokedAt = null;

    const [certs, total] = await Promise.all([
      Certificate.find(query)
        .populate('student',   'name initials photoUrl studentId')
        .populate('traineeId', 'name initials photoUrl studentId')
        .populate('hospital',  'name city')
        .populate('issuedBy',  'name')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      Certificate.countDocuments(query)
    ]);

    res.json({ success: true, data: certs, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── AUDIT LOGS ────────────────────────────────────────────────────────────

// GET /api/admin/audit-log  (also aliased as /audit-logs for backwards compat)
router.get(['/audit-log', '/audit-logs'], auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    const { userId, action, page = 1, limit = 100 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(Math.max(1, Number(limit) || 100), 500);
    const query = {};
    if (userId) query.userId = userId;
    if (action) query.action = new RegExp(escapeRegex(action.slice(0, 50)), 'i');

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber),
      AuditLog.countDocuments(query)
    ]);

    res.json({ success: true, data: logs, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
