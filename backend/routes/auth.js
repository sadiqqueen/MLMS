// backend/routes/auth.js
const router      = require('express').Router();
const jwt         = require('jsonwebtoken');
const path        = require('path');
const multer      = require('multer');
const User        = require('../models/User');
const auth        = require('../middleware/auth');
const { loginLimiter, refreshLimiter } = require('../middleware/rateLimiter');
const { hasInitiativeAccess } = require('../middleware/requireInitiativeAccess');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp|gif/.test(path.extname(file.originalname).toLowerCase())
            && /image\//.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  }
});

function denyMutationsFor(roles, message = 'This account is read-only') {
  return (req, res, next) => {
    if (roles.includes(req.user?.role)) {
      return res.status(403).json({ message });
    }
    next();
  };
}

const READ_ONLY_SELF_ROLES = ['president', 'dio_view', 'sub_dio', 'sub_pd', 'secretary_general', 'assistant_secretary'];
const denyReadOnlyMutations = denyMutationsFor(READ_ONLY_SELF_ROLES);
const denyPresidentMutations = denyMutationsFor(['president'], 'President is read-only');

// ── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    if (user.isActive === false) return res.status(403).json({ message: 'Account deactivated' });
    if (user.locked === true) return res.status(423).json({ message: 'Account locked. Contact an administrator.' });

    // Check if account is locked
    if (user.isLocked()) {
      const mins = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({ message: `Account locked. Try again in ${mins} minute(s).` });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      await user.incrementLoginAttempts();
      const attemptsLeft = 5 - (user.loginAttempts || 0);
      if (attemptsLeft <= 0) {
        return res.status(423).json({ message: 'Account locked for 15 minutes due to too many failed attempts.' });
      }
      return res.status(401).json({ message: `Invalid email or password. ${attemptsLeft} attempt(s) remaining.` });
    }

    // Success — reset lockout counters
    await user.resetLoginAttempts();

    // Issue access token (15 min)
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Issue refresh token (7 days) — stored in httpOnly cookie
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
    });

    res.json({
      token,
      user: {
        _id:           user._id,
        name:          user.name,
        email:         user.email,
        role:          user.role,
        initials:      user.initials,
        year:          user.year,
        studentId:     user.studentId,
        department:    user.department,
        specialty:     user.specialty,
        phone:         user.phone,
        photoUrl:      user.photoUrl,
        hospital:      user.hospital,
        hospitalId:    user.hospitalId,
        specialtyId:   user.specialtyId,
        enrolledSince: user.enrolledSince
      },
      permissions: { initiatives: hasInitiativeAccess(user) }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────
router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isActive === false) return res.status(403).json({ message: 'Account deactivated' });
    if (user.locked === true) return res.status(423).json({ message: 'Account locked. Contact an administrator.' });

    const newToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      token: newToken,
      user: {
        _id:        user._id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        initials:   user.initials,
        photoUrl:   user.photoUrl,
        hospital:   user.hospital,
        hospitalId: user.hospitalId,
        specialtyId: user.specialtyId
      }
    });
  } catch {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('hospital',    'name city')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name');
    res.json({ success: true, data: user, permissions: { initiatives: hasInitiativeAccess(user) } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PATCH /api/auth/me ────────────────────────────────────────────────────
router.patch('/me', auth, denyReadOnlyMutations, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    if (name.trim().length > 100) return res.status(400).json({ message: 'Name too long' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true }
    ).select('-password');

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/auth/upload-photo ────────────────────────────────────────────
router.put('/upload-photo', auth, denyReadOnlyMutations, uploadPhoto.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const photoUrl = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.user._id, { photoUrl });
    res.json({ photoUrl });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────
router.put('/change-password', auth, denyPresidentMutations, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'All fields are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });

    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect.' });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
