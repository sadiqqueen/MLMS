// express.Router() is a mini-app that handles a group of routes.
// All routes here will be prefixed with /api/auth (set in server.js)
const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const path   = require('path');
const multer = require('multer');
const User   = require('../models/User');
const auth   = require('../middleware/auth');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|gif/.test(path.extname(file.originalname).toLowerCase())
            && /image\//.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
});

// ── POST /api/auth/login ──────────────────────────────────────────────────
// The browser sends: { email: "...", password: "..." }
// We send back:      { token: "...", user: { ... } }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    // req.body contains whatever the browser sent as JSON in the request body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
      //          ↑ 400 = "Bad Request" — the client sent incomplete data
    }

    // Look for a user with this email in the database
    const user = await User.findOne({ email: email.toLowerCase() });

    // Don't tell the user *which* one was wrong (email or password)
    // — this prevents attackers from probing valid emails
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    // Use our model's comparePassword method to check the password
    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid email or password' });

    // ✅ Login is valid — create a JWT token
    // jwt.sign(payload, secret, options)
    // payload = the data encoded inside the token
    const token = jwt.sign(
      { id: user._id, role: user.role },   // what we store in the token
      process.env.JWT_SECRET,               // our secret key for signing
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Send the token and safe user info back to the browser
    // Never send the password hash, even the hashed version
    res.json({
      token,
      user: {
        _id:          user._id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        initials:     user.initials,
        year:         user.year,
        studentId:    user.studentId,
        department:   user.department,
        specialty:    user.specialty,
        phone:        user.phone,
        photoUrl:     user.photoUrl,
        hospital:     user.hospital,   // ObjectId — used by doctor screens
        enrolledSince:user.enrolledSince
      }
    });

  } catch (err) {
    // 500 = "Internal Server Error" — something unexpected broke
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
// Used to refresh the user's info from the database.
// Requires the auth middleware — only works if logged in.
router.get('/me', auth, async (req, res) => {
  try {
    // req.user was attached by the auth middleware
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('hospital', 'name city');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/auth/upload-photo ───────────────────────────────────────────────
router.put('/upload-photo', auth, uploadPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const photoUrl = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user._id, { photoUrl });
    res.json({ photoUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/auth/change-password ────────────────────────────────────────────
// Lets any logged-in user change their own password (must supply current one)
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'All fields are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });

    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match)
      return res.status(401).json({ message: 'Current password is incorrect.' });

    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
