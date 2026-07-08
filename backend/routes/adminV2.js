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
const Rotation       = require('../models/Rotation');
const Certificate    = require('../models/Certificate');
const AuditLog       = require('../models/AuditLog');
const Specialty      = require('../models/Specialty');
const Evaluation     = require('../models/Evaluation');
const Report         = require('../models/Report');
const ConsultantMemo = require('../models/ConsultantMemo');
const Notification   = require('../models/Notification');

const ADMIN = ['super_admin'];
const USER_CREATE_FIELDS = ['name', 'email', 'password', 'role', 'phone', 'gender',
  'city', 'department', 'specialty', 'year', 'studentId', 'enrolledSince',
  'hospitalId', 'hospital', 'specialtyId', 'supervisorId', 'supervisor',
  'isActive', 'locked', 'lockUntil'];
const USER_UPDATE_FIELDS = ['name', 'email', 'role', 'phone', 'gender',
  'city', 'department', 'specialty', 'year', 'studentId', 'enrolledSince',
  'hospitalId', 'hospital', 'specialtyId', 'supervisorId', 'supervisor',
  'isActive', 'locked', 'lockUntil', 'loginAttempts'];
const HOSPITAL_FIELDS = ['name', 'city', 'address', 'specialties', 'assignedDoctor',
  'governorate', 'dioId', 'presidentId', 'programDirector', 'supervisors',
  'phone', 'email', 'isActive'];
const SPECIALTY_FIELDS = ['name', 'hospitalId', 'secretaryId', 'weeklyReportPdf',
  'monthlyReportPdf', 'finalReportPdf', 'evaluationPdf1', 'evaluationPdf2',
  'evaluationPdf3', 'evaluationPdf4', 'evaluationPdf5', 'isActive'];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

// ── STATS ─────────────────────────────────────────────────────────────────

// GET /api/admin/stats — system-wide statistics
router.get('/stats', auth, allowRoles(...ADMIN), async (req, res) => {
  try {
    // Optional track filter: basic | advanced | all (default all).
    const { track } = req.query;
    const tf = track === 'basic' ? { track: 'basic' }
             : track === 'advanced' ? { track: { $ne: 'basic' } }
             : {};

    const [users, hospitals, specialties, activeRotations, certificates, trainees, supervisors] =
      await Promise.all([
        User.countDocuments({ isActive: { $ne: false }, ...tf }),
        Hospital.countDocuments({ isActive: { $ne: false }, ...tf }),
        Specialty.countDocuments({ isActive: { $ne: false }, ...tf }),
        Rotation.countDocuments({ status: 'current', ...tf }),
        Certificate.countDocuments({ revokedAt: null, ...tf }),
        User.countDocuments({ role: 'trainee',    isActive: { $ne: false }, ...tf }),
        User.countDocuments({ role: 'supervisor', isActive: { $ne: false }, ...tf })
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
    const { role, hospital, search, track, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(Math.max(1, Number(limit) || 50), 500);
    const query = {};
    if (role) query.role = role;
    // Track filter: basic → basic only; advanced → not-basic (incl. legacy); else all.
    if (track === 'basic') query.track = 'basic';
    else if (track === 'advanced') query.track = { $ne: 'basic' };
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
      const user = new User(pick(req.body, USER_CREATE_FIELDS));
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
      const fields = pick(req.body, USER_UPDATE_FIELDS);
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
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ message: 'User not found' });

      const callerId = String(req.user._id || req.user.id);
      if (String(target._id) === callerId) {
        return res.status(403).json({ message: 'You cannot deactivate your own account' });
      }
      if (target.role === 'super_admin') {
        const activeSupers = await User.countDocuments({ role: 'super_admin', isActive: { $ne: false } });
        if (activeSupers <= 1) {
          return res.status(409).json({ message: 'Cannot deactivate the last super_admin' });
        }
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: false, deletedAt: new Date() },
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
        { isActive: true, deletedAt: null, loginAttempts: 0, lockUntil: null },
        { new: true }
      ).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/admin/users/:id/permanent — hard delete (super_admin ONLY)
// The ONLY place in the codebase allowed to permanently remove a User.
router.delete('/users/:id/permanent',
  auth,
  allowRoles(...ADMIN),
  async (req, res) => {
    try {
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ message: 'User not found' });

      if (target.isActive !== false) {
        return res.status(409).json({ message: 'Account must be deactivated before permanent deletion' });
      }

      const callerId = String(req.user._id || req.user.id);
      if (String(target._id) === callerId) {
        return res.status(403).json({ message: 'You cannot delete your own account' });
      }

      if (target.role === 'super_admin') {
        const count = await User.countDocuments({ role: 'super_admin' });
        if (count <= 1) return res.status(409).json({ message: 'Cannot delete the last super_admin' });
      }

      // Cascade policy: deleting a user removes their scheduling data (rotations +
      // distributions/"durations") and notifications, and PRESERVES academic records
      // (evaluations, reports, certificates, memos). Optionally, a replacement
      // supervisor (reassignTo) can take over this user's trainees instead of those
      // rotations being lost. Org-structure refs are replaced/detached so nothing dangles.
      const userId = req.params.id;
      const { reassignTo } = req.body || {};

      let reassignedRotations = 0;
      let reassignedDistributions = 0;
      let deletedRotations = 0;
      let deletedDistributions = 0;

      if (reassignTo) {
        const newSup = await User.findById(reassignTo);
        if (!newSup || newSup.isActive === false || String(newSup._id) === String(userId)) {
          return res.status(400).json({ message: 'Invalid replacement supervisor selected' });
        }
        // Move this user's supervised rotations/distributions to the replacement (keep trainee records).
        const [r1, r2, d1, d2] = await Promise.all([
          Rotation.updateMany({ supervisorId: userId },     { $set: { supervisorId: reassignTo } }),
          Rotation.updateMany({ doctor: userId },           { $set: { doctor: reassignTo } }),
          Distribution.updateMany({ supervisorId: userId }, { $set: { supervisorId: reassignTo } }),
          Distribution.updateMany({ doctor: userId },       { $set: { doctor: reassignTo } })
        ]);
        reassignedRotations = (r1.modifiedCount || 0) + (r2.modifiedCount || 0);
        reassignedDistributions = (d1.modifiedCount || 0) + (d2.modifiedCount || 0);
        // Delete only records the user owned as a trainee (none for a supervisor).
        const [dr, dd] = await Promise.all([
          Rotation.deleteMany({ $or: [{ traineeId: userId }, { student: userId }] }),
          Distribution.deleteMany({ $or: [{ traineeId: userId }, { student: userId }] })
        ]);
        deletedRotations = dr.deletedCount;
        deletedDistributions = dd.deletedCount;
        // Replace this user in hospital rosters / assigned-doctor with the replacement.
        await Promise.all([
          Hospital.updateMany({ supervisors: userId },    { $set: { 'supervisors.$': reassignTo } }),
          Hospital.updateMany({ assignedDoctor: userId }, { $set: { assignedDoctor: reassignTo } })
        ]);
      } else {
        // No replacement chosen: delete this user's rotations + distributions outright.
        const [dr, dd] = await Promise.all([
          Rotation.deleteMany({ $or: [
            { traineeId: userId }, { supervisorId: userId }, { student: userId }, { doctor: userId }
          ] }),
          Distribution.deleteMany({ $or: [
            { traineeId: userId }, { supervisorId: userId }, { createdBy: userId },
            { student: userId }, { doctor: userId }
          ] })
        ]);
        deletedRotations = dr.deletedCount;
        deletedDistributions = dd.deletedCount;
        // Detach this user from hospital supervisor slots.
        await Promise.all([
          Hospital.updateMany({ supervisors: userId },    { $pull: { supervisors: userId } }),
          Hospital.updateMany({ assignedDoctor: userId }, { $set:  { assignedDoctor: null } })
        ]);
      }

      // Always: remove notifications and detach leadership / specialty-secretary references.
      const delNotif = await Notification.deleteMany({ user: userId });
      await Promise.all([
        Hospital.updateMany({ dioId: userId },           { $set: { dioId: null } }),
        Hospital.updateMany({ presidentId: userId },     { $set: { presidentId: null } }),
        Hospital.updateMany({ programDirector: userId }, { $set: { programDirector: null } }),
        Specialty.updateMany({ secretaryId: userId },    { $set: { secretaryId: null } })
      ]);

      const deletedCounts = {
        rotations: deletedRotations,
        distributions: deletedDistributions,
        reassignedRotations,
        reassignedDistributions,
        notifications: delNotif.deletedCount
      };

      // Snapshot BEFORE deletion so the audit record survives the hard delete.
      await AuditLog.create({
        userId: req.user._id,
        action: 'hard_delete_user',
        targetId: req.params.id,
        targetModel: 'User',
        metadata: {
          name: target.name,
          email: target.email,
          role: target.role,
          deletedCounts
        }
      });

      await User.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'User permanently deleted',
        data: { _id: req.params.id, deletedCounts }
      });
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
      const hospital = await Hospital.create(pick(req.body, HOSPITAL_FIELDS));
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
      const hospital = await Hospital.findByIdAndUpdate(req.params.id, pick(req.body, HOSPITAL_FIELDS), { new: true })
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
      const specialty = await Specialty.create(pick(req.body, SPECIALTY_FIELDS));
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
      const specialty = await Specialty.findByIdAndUpdate(req.params.id, pick(req.body, SPECIALTY_FIELDS), { new: true })
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
    const { hospital, specialty, status, track, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(Math.max(1, Number(limit) || 50), 500);
    const query = {};
    if (track === 'basic') query.track = 'basic';
    else if (track === 'advanced') query.track = { $ne: 'basic' };
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
    const { revoked, track, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(Math.max(1, Number(limit) || 50), 500);
    const query = {};
    if (track === 'basic') query.track = 'basic';
    else if (track === 'advanced') query.track = { $ne: 'basic' };
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
