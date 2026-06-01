const router         = require('express').Router();
const Distribution   = require('../models/Distribution');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const STAFF = ['admin', 'super_admin', 'professor'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/distributions — supports ?hospital= ?specialty= ?status= filters
router.get('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const query = {};
    if (req.query.hospital)  query.hospital  = req.query.hospital;
    if (req.query.specialty) query.specialty  = new RegExp(escapeRegex(req.query.specialty.slice(0, 100)), 'i');
    if (req.query.status)    query.status     = req.query.status;

    const distributions = await Distribution.find(query)
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
    const dist = await Distribution.findByIdAndDelete(req.params.id);
    if (!dist) return res.status(404).json({ message: 'Distribution not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
