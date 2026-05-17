const router         = require('express').Router();
const Rotation       = require('../models/Rotation');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const STAFF = ['admin', 'super_admin', 'professor'];

// GET /api/rotations — all rotations (staff)
router.get('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const rotations = await Rotation.find()
      .populate('student',  'name email initials photoUrl')
      .populate('hospital', 'name city')
      .populate('doctor',   'name specialty initials photoUrl')
      .sort({ createdAt: -1 });
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/rotations/doctor/:doctorId — rotations supervised by a specific doctor
router.get('/doctor/:doctorId', auth, async (req, res) => {
  try {
    const rotations = await Rotation.find({ doctor: req.params.doctorId })
      .populate('student',  'name email initials photoUrl year studentId')
      .populate('hospital', 'name city')
      .sort({ startDate: -1 });
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/rotations/student/:id — all rotations for one student (sorted oldest → newest)
router.get('/student/:id', auth, async (req, res) => {
  try {
    const rotations = await Rotation.find({ student: req.params.id })
      .populate('hospital', 'name address department city')
      .populate('doctor',   'name specialty department initials')
      .sort({ startDate: 1 });   // 1 = ascending (oldest first)
    res.json(rotations);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/rotations/current/:studentId — the student's active rotation (status = 'current')
router.get('/current/:studentId', auth, async (req, res) => {
  try {
    const rotation = await Rotation.findOne({ student: req.params.studentId, status: 'current' })
      .populate('hospital', 'name address department')
      .populate('doctor',   'name department initials');
    res.json(rotation || null);  // return null if no current rotation
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/rotations — create a new rotation
router.post('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const rotation = await Rotation.create(req.body);
    const populated = await Rotation.findById(rotation._id)
      .populate('student',  'name email initials photoUrl')
      .populate('hospital', 'name city')
      .populate('doctor',   'name specialty initials photoUrl');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/rotations/:id
router.delete('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    await Rotation.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/rotations/:id — update a rotation (e.g. add final grade)
router.put('/:id', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const rotation = await Rotation.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('student',  'name email initials photoUrl')
      .populate('hospital', 'name city')
      .populate('doctor',   'name specialty initials photoUrl');
    if (!rotation) return res.status(404).json({ message: 'Rotation not found' });
    res.json(rotation);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
