const router         = require('express').Router();
const mongoose       = require('mongoose');
const Distribution   = require('../models/Distribution');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const STAFF = ['admin', 'super_admin', 'professor', 'secretary', 'dio'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/distributions — supports ?hospital= ?specialty= ?status= filters
router.get('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const query = {};
    const and = [];
    if (req.query.hospital) {
      const hospitalMatch = [{ hospital: req.query.hospital }];
      if (mongoose.Types.ObjectId.isValid(req.query.hospital)) {
        hospitalMatch.push({ hospitalId: req.query.hospital });
      }
      and.push({ $or: hospitalMatch });
    }
    if (req.query.specialty) {
      const safeSpecialty = new RegExp(escapeRegex(req.query.specialty.slice(0, 100)), 'i');
      const specialtyMatch = [{ specialty: safeSpecialty }];
      if (mongoose.Types.ObjectId.isValid(req.query.specialty)) {
        specialtyMatch.push({ specialtyId: req.query.specialty });
      }
      and.push({ $or: specialtyMatch });
    }
    if (req.query.status)    query.status     = req.query.status;
    if (and.length) query.$and = and;

    const distributions = await Distribution.find(query)
      .populate('traineeId', 'name email studentId photoUrl initials')
      .populate('supervisorId', 'name specialty photoUrl initials')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name city')
      .populate('doctor',   'name specialty photoUrl initials')
      .populate('hospital', 'name city')
      .sort({ createdAt: -1 });
    res.json(distributions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const ALLOWED = ['traineeId', 'supervisorId', 'specialtyId', 'hospitalId',
                     'startDate', 'endDate', 'durationWeeks', 'status',
                     'doctor', 'hospital', 'specialty'];
    const data = {};
    ALLOWED.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    data.createdBy = req.user._id;

    const dist      = await Distribution.create(data);
    const populated = await Distribution.findById(dist._id)
      .populate('traineeId', 'name email studentId photoUrl initials')
      .populate('supervisorId', 'name specialty photoUrl initials')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name city')
      .populate('doctor',   'name specialty photoUrl initials')
      .populate('hospital', 'name city');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const UPDATE_ALLOWED = ['startDate', 'endDate', 'durationWeeks', 'status',
                            'supervisorId', 'specialtyId', 'hospitalId',
                            'doctor', 'hospital', 'specialty'];
    const updates = {};
    UPDATE_ALLOWED.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const dist = await Distribution.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('traineeId', 'name email studentId photoUrl initials')
      .populate('supervisorId', 'name specialty photoUrl initials')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name city')
      .populate('doctor',   'name specialty photoUrl initials')
      .populate('hospital', 'name city');
    if (!dist) return res.status(404).json({ message: 'Distribution not found' });
    res.json(dist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const dist = await Distribution.findByIdAndUpdate(
      req.params.id,
      { status: 'cancelled' },
      { new: true }
    );
    if (!dist) return res.status(404).json({ message: 'Distribution not found' });
    res.json({ message: 'Distribution cancelled', data: dist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
