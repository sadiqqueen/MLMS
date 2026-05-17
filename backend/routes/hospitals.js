const router         = require('express').Router();
const Hospital       = require('../models/Hospital');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// super_admin and professor can manage hospitals; admin can only view
const MANAGERS = ['super_admin', 'professor'];

// GET /api/hospitals — any logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .populate('assignedDoctor', 'name specialty initials photoUrl')
      .sort({ name: 1 });
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/hospitals
router.post('/', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const hospital  = await Hospital.create(req.body);
    const populated = await Hospital.findById(hospital._id)
      .populate('assignedDoctor', 'name specialty initials photoUrl');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/hospitals/:id
router.put('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('assignedDoctor', 'name specialty initials photoUrl');
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/hospitals/:id
router.delete('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndDelete(req.params.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    res.json({ message: 'Hospital deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
