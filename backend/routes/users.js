const router         = require('express').Router();
const User           = require('../models/User');
const bcrypt         = require('bcryptjs');
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

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
  program_director: 50,
  dio: 60,
  president: 70,
  super_admin: 100
};

function hasHigherRole(actorRole, targetRole) {
  return (ROLE_RANK[actorRole] || 0) > (ROLE_RANK[targetRole] || 0);
}

// GET /api/users — all users
router.get('/', auth, allowRoles(...READ_STAFF), async (req, res) => {
  try {
    const users = await User.find()
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
    const supervisors = await User.find({
      role: 'supervisor',
      isActive: { $ne: false }
    })
      .select('name email specialty specialtyId hospitalId department initials photoUrl')
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
    const pds = await User.find({
      role: 'program_director',
      isActive: { $ne: false }
    })
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
    const students = await User.find({
      role: 'trainee',
      isActive: { $ne: false }
    })
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
router.put('/:id', auth, upload.single('photo'), async (req, res) => {
  try {
    const isSelf  = req.user._id.toString() === req.params.id;
    if (req.user.role === 'president') {
      return res.status(403).json({ message: 'President is read-only' });
    }
    const isAdmin = WRITE_STAFF.includes(req.user.role);
    if (!isSelf && !isAdmin) return res.status(403).json({ message: 'Access denied' });
    const target = await User.findById(req.params.id).select('role isActive');
    if (!target || target.isActive === false) return res.status(404).json({ message: 'User not found' });
    if (!isSelf && !hasHigherRole(req.user.role, target.role)) {
      return res.status(403).json({ message: 'Insufficient permission to update this user' });
    }

    const allowedKeys = isAdmin ? ADMIN_EDITABLE : SELF_EDITABLE;
    const fields = {};
    allowedKeys.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
    if (req.file) fields.photoUrl = `/uploads/photos/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true })
      .select('-password')
      .populate('hospital', 'name city');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/password — change password
router.put('/:id/password', auth, allowRoles(...PASSWORD_RESET_ROLES), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });

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
router.delete('/:id', auth, allowRoles(...WRITE_STAFF), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target || target.isActive === false) return res.status(404).json({ message: 'User not found' });
    if (!hasHigherRole(req.user.role, target.role)) {
      return res.status(403).json({ message: 'Insufficient permission to delete this user' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false, deletedAt: new Date() },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deactivated', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
