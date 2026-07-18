const router         = require('express').Router();
const User           = require('../models/User');
const bcrypt         = require('bcryptjs');
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { coerceRoleToTrack, trackForRole, baseRole } = require('../utils/track');
const { findPdForSpecialty } = require('../utils/pdScope');
const auditLog       = require('../middleware/auditLogger');

// Ensure photos upload folder exists
const photosDir = path.join(__dirname, '../uploads/photos');
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, photosDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())
            && /image\//.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
  }
});

const SELF_EDITABLE = ['name', 'phone', 'city', 'gender', 'photoUrl'];
const ADMIN_EDITABLE = ['name', 'phone', 'city', 'gender', 'photoUrl',
                        'isActive', 'department', 'specialty', 'year',
                        'studentId', 'hospitalId', 'specialtyId', 'supervisorId',
                        'hospital', 'supervisor'];
const ALLOWED_CREATE_FIELDS = ['name', 'email', 'password', 'role', 'phone',
  'gender', 'city', 'department', 'specialty', 'year', 'studentId',
  'enrolledSince', 'hospitalId', 'specialtyId', 'supervisorId',
  'hospital', 'supervisor'];
const ROLE_ALLOWED = {
  secretary:        ['trainee'],
  dio:              ['trainee', 'supervisor', 'program_director', 'secretary'],
  program_director: [],
  president:        [],
  super_admin:      null
};
const READ_STAFF = ['secretary', 'dio', 'program_director', 'president', 'super_admin'];
const WRITE_STAFF = ['secretary', 'dio', 'program_director', 'super_admin'];
const PASSWORD_RESET_ROLES = ['super_admin'];
const ROLE_RANK = {
  trainee: 10,
  supervisor: 30,
  secretary: 40,
  data_entry: 45,
  central_secretary: 45,
  program_director: 50,
  sub_pd: 55,
  sub_dio: 60,
  dio: 60,
  dio_view: 65,
  president: 70,
  data_analyzer: 85,
  assistant_secretary: 88,
  secretary_general: 90,
  // ASG.1 / ASG.2 sit just below super_admin so ONLY super_admin can
  // edit, lock, or delete them.
  asg1: 90,
  asg2: 90,
  super_admin: 100
};

// ASG accounts are visible to super_admin only.
const HIDDEN_FROM_NON_ADMIN = ['asg1', 'asg2', 'secretary_general', 'assistant_secretary', 'data_analyzer'];

// A DIO oversees its whole training track (Advanced for `dio`, Basic for
// `b_dio`). On the generic /api/users reads it sees every user in that track —
// trainees, supervisors, program directors, secretaries and the president
// (view-only) — but never the other track, other DIOs, super_admins or ASG.
function dioVisibleRoles(req) {
  return ['trainee', 'supervisor', 'program_director', 'secretary', 'president']
    .map(r => coerceRoleToTrack(r, req.track));
}

// Compare by BASE role so Basic-track targets aren't treated as rank 0 (which
// would let any write-staff out-rank e.g. b_president / b_dio).
// A super_admin (Developer) outranks everyone, including other super_admins —
// peer Developers must be manageable (deactivate/lock/edit/reset); self-actions
// stay blocked by the per-route self guards.
function hasHigherRole(actorRole, targetRole) {
  if (baseRole(actorRole) === 'super_admin') return true;
  return (ROLE_RANK[baseRole(actorRole)] || 0) > (ROLE_RANK[baseRole(targetRole)] || 0);
}

// Non-super_admin write-staff may only act on users in their OWN track. Returns
// true when the caller is blocked (and this fn has sent the 404 response).
function blockCrossTrackWrite(req, res, target) {
  if (req.user.role === 'super_admin') return false;
  if (trackForRole(target.role) !== req.track) {
    res.status(404).json({ message: 'User not found' });
    return true;
  }
  return false;
}

// GET /api/users — all users (ASG accounts only appear for super_admin).
// A DIO is hospital-scoped and only ever sees the roles it oversees — never
// presidents, other DIOs, super_admins or ASG accounts, and never other
// hospitals. Other staff keep their existing (non-ASG) visibility.
router.get('/', auth, allowRoles(...READ_STAFF), async (req, res) => {
  try {
    let filter;
    if (req.user.role === 'super_admin') {
      filter = {};
    } else if (req.user.role === 'dio') {
      filter = { role: { $in: dioVisibleRoles(req) } };
    } else {
      filter = { role: { $nin: HIDDEN_FROM_NON_ADMIN } };
    }
    const users = await User.find(filter)
      .select('-password')
      .populate('hospital', 'name city')
      .populate('doctor', 'name specialty')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/doctors — only doctors (for dropdowns)
// GET /api/users/supervisors — for dropdowns
router.get('/supervisors', auth, allowRoles('super_admin', 'secretary', 'dio', 'president'), async (req, res) => {
  try {
    const filter = { role: { $in: ['supervisor', 'b_supervisor'] }, isActive: { $ne: false } };
    if (req.user.role === 'dio') {
      filter.role = coerceRoleToTrack('supervisor', req.track); // this DIO's track only
    }
    const supervisors = await User.find(filter)
      .select('name email specialty specialtyId hospitalId department initials photoUrl track')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/program-directors — for dropdowns
router.get('/program-directors', auth, allowRoles('super_admin', 'secretary', 'dio', 'president'), async (req, res) => {
  try {
    const filter = { role: 'program_director', isActive: { $ne: false } };
    if (req.user.role === 'dio') {
      filter.role = coerceRoleToTrack('program_director', req.track); // this DIO's track only
    }
    const pds = await User.find(filter)
      .select('name email specialtyId hospitalId department initials photoUrl')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: pds });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/students — kept for backward compat (returns trainees)
router.get('/students', auth, allowRoles('supervisor', 'program_director', 'secretary', 'dio', 'super_admin', 'president'), async (req, res) => {
  try {
    const filter = { role: 'trainee', isActive: { $ne: false } };
    if (req.user.role === 'dio') {
      filter.role = coerceRoleToTrack('trainee', req.track); // this DIO's track only
    }
    const students = await User.find(filter)
      .select('name email studentId specialty specialtyId hospitalId supervisorId initials photoUrl year')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name')
      .populate('supervisorId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const isSelf  = req.params.id === req.user._id.toString();
    const isStaff = READ_STAFF.includes(req.user.role);
    if (!isSelf && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    // ASG accounts are hidden from everyone except super_admin (and themselves)
    if (!isSelf && req.user.role !== 'super_admin') {
      const target = await User.findById(req.params.id).select('role');
      if (target && HIDDEN_FROM_NON_ADMIN.includes(target.role)) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }

    // A DIO may only view (non-self) users within its own training track.
    if (!isSelf && req.user.role === 'dio') {
      const target = await User.findById(req.params.id).select('role');
      if (!target || !dioVisibleRoles(req).includes(target.role)) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }

    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('hospital', 'name')
      .populate('doctor', 'name email specialty department');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users — create user with optional photo
router.post('/', auth, allowRoles(...WRITE_STAFF), upload.single('photo'), async (req, res) => {
  try {
    const data = {};
    ALLOWED_CREATE_FIELDS.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    if (req.file) data.photoUrl = `/uploads/photos/${req.file.filename}`;

    const callerRole = req.user.role;
    if (!Object.prototype.hasOwnProperty.call(ROLE_ALLOWED, callerRole)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const permitted = ROLE_ALLOWED[callerRole];
    if (permitted && !permitted.includes(data.role)) {
      return res.status(403).json({ success: false, message: `Your role cannot create a user with role: ${data.role}` });
    }

    // Basic staff (req.track === 'basic') can only ever create Basic (b_*) users.
    data.role = coerceRoleToTrack(data.role, req.track);
    // One Program Director per specialty (by name, within track).
    if (baseRole(data.role) === 'program_director' && data.specialtyId) {
      const clash = await findPdForSpecialty(data.specialtyId, trackForRole(data.role), null);
      if (clash) return res.status(409).json({ success: false, message: `This specialty already has a Program Director (${clash.name})` });
    }
    const user = new User(data);
    await user.save();

    const saved = await User.findById(user._id)
      .select('-password')
      .populate('hospital', 'name city');
    res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Email already exists' });
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id — update user with optional photo
async function updateUser(req, res) {
  try {
    const isSelf  = req.user._id.toString() === req.params.id;
    if (req.user.role === 'president') {
      return res.status(403).json({ message: 'President is read-only' });
    }
    const isAdmin = WRITE_STAFF.includes(req.user.role);
    if (!isSelf && !isAdmin) return res.status(403).json({ message: 'Access denied' });
    const target = await User.findById(req.params.id).select('role isActive');
    if (!target || target.isActive === false) return res.status(404).json({ message: 'User not found' });
    if (!isSelf && blockCrossTrackWrite(req, res, target)) return;
    if (!isSelf && !hasHigherRole(req.user.role, target.role)) {
      return res.status(403).json({ message: 'Insufficient permission to update this user' });
    }

    const allowedKeys = isSelf ? SELF_EDITABLE : ADMIN_EDITABLE;
    const fields = {};
    allowedKeys.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
    if (req.file) fields.photoUrl = `/uploads/photos/${req.file.filename}`;

    // One Program Director per specialty (by name, within track).
    if (baseRole(target.role) === 'program_director' && fields.specialtyId) {
      const clash = await findPdForSpecialty(fields.specialtyId, trackForRole(target.role), req.params.id);
      if (clash) return res.status(409).json({ message: `This specialty already has a Program Director (${clash.name})` });
    }

    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true })
      .select('-password')
      .populate('hospital', 'name city');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

router.put('/:id', auth, upload.single('photo'), updateUser);
router.patch('/:id', auth, upload.single('photo'), updateUser);

// PUT /api/users/:id/password — change password
router.put('/:id/password', auth, allowRoles(...PASSWORD_RESET_ROLES), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const target = await User.findById(req.params.id);
    if (!target || target.isActive === false) return res.status(404).json({ message: 'User not found' });
    if (req.user._id.toString() === req.params.id) {
      return res.status(403).json({ message: 'Use change-password to update your own password' });
    }
    if (!hasHigherRole(req.user.role, target.role)) {
      return res.status(403).json({ message: 'Insufficient permission to reset this password' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.params.id, { password: hashed });
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/lock — toggle locked status
router.put('/:id/lock', auth, allowRoles(...WRITE_STAFF), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (blockCrossTrackWrite(req, res, user)) return;
    if (!hasHigherRole(req.user.role, user.role)) {
      return res.status(403).json({ message: 'Insufficient permission to lock this user' });
    }
    user.locked = !user.locked;
    await user.save();
    res.json({ locked: user.locked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', auth, allowRoles(...WRITE_STAFF), auditLog('deactivate_user', 'User'), async (req, res) => {
  try {
    if (req.params.id === (req.user._id || req.user.id).toString()) {
      return res.status(403).json({ message: 'You cannot deactivate your own account' });
    }

    const target = await User.findById(req.params.id);
    if (!target || target.isActive === false) return res.status(404).json({ message: 'User not found' });
    if (blockCrossTrackWrite(req, res, target)) return;
    if (!hasHigherRole(req.user.role, target.role)) {
      return res.status(403).json({ message: 'Insufficient permission to deactivate this user' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false, deletedAt: new Date() },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.locals.targetId = req.params.id;
    res.json({ message: 'User deactivated', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
