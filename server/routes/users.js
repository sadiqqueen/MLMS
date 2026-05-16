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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const STAFF = ['admin', 'super_admin', 'professor', 'director'];

// GET /api/users — all users
router.get('/', auth, allowRoles(...STAFF), async (req, res) => {
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
router.get('/doctors', auth, async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' })
      .select('-password')
      .sort({ name: 1 });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/students — only students (for dropdowns)
router.get('/students', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('-password')
      .populate('hospital', 'name city')
      .populate('doctor', 'name specialty')
      .sort({ name: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('hospital', 'name');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/users — create user with optional photo
router.post('/', auth, allowRoles(...STAFF), upload.single('photo'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.photoUrl = `/uploads/photos/${req.file.filename}`;

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
    const isAdmin = STAFF.includes(req.user.role);
    if (!isSelf && !isAdmin) return res.status(403).json({ message: 'Access denied' });

    const { password, ...fields } = req.body;
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
router.put('/:id/password', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.params.id, { password: hashed });
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/users/:id/lock — toggle locked status
router.put('/:id/lock', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.locked = !user.locked;
    await user.save();
    res.json({ locked: user.locked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.photoUrl) {
      const filePath = path.join(__dirname, '..', user.photoUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
