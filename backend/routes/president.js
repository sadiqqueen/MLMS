// backend/routes/president.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const User           = require('../models/User');

const PRESIDENT = ['president'];

function getHospital(user) {
  return user.hospitalId || user.hospital || null;
}

function buildQuery(user, role) {
  const hospitalId = getHospital(user);
  const q = { role, isActive: { $ne: false } };
  if (hospitalId) q.$or = [{ hospitalId }, { hospital: hospitalId }];
  return q;
}

// GET /api/president/trainees — read only
router.get('/trainees', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    const trainees = await User.find(buildQuery(req.user, 'trainee'))
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

// GET /api/president/supervisors — read only
router.get('/supervisors', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    const supervisors = await User.find(buildQuery(req.user, 'supervisor'))
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/president/program-directors — read only
router.get('/program-directors', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    const pds = await User.find(buildQuery(req.user, 'program_director'))
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: pds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/president/secretaries — read only
router.get('/secretaries', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    const secretaries = await User.find(buildQuery(req.user, 'secretary'))
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: secretaries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
