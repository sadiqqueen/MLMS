// express.Router() is a mini-app that handles a group of routes.
// All routes here will be prefixed with /api/auth (set in server.js)
const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const auth   = require('../middleware/auth');

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
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
