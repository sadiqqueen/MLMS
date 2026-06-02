const router         = require('express').Router();
const Hospital       = require('../models/Hospital');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const MANAGERS = ['super_admin', 'dio'];
const HOSPITAL_FIELDS = ['name', 'city', 'address', 'specialties', 'assignedDoctor',
  'governorate', 'dioId', 'presidentId', 'programDirector', 'supervisors',
  'phone', 'email', 'isActive'];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

const populateHospital = query => query
  .populate('assignedDoctor', 'name specialty initials photoUrl')
  .populate('programDirector', 'name email department')
  .populate('supervisors', 'name email specialty department');

// GET /api/hospitals — any logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .populate('assignedDoctor', 'name specialty initials photoUrl')
      .populate('programDirector', 'name email department')
      .populate('supervisors', 'name email specialty department')
      .sort({ name: 1 });
    res.json(hospitals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/hospitals
router.post('/', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const hospital  = await Hospital.create(pick(req.body, HOSPITAL_FIELDS));
    const populated = await populateHospital(Hospital.findById(hospital._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/hospitals/:id
router.put('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const hospital = await populateHospital(Hospital.findByIdAndUpdate(req.params.id, pick(req.body, HOSPITAL_FIELDS), { new: true }));
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/hospitals/:id
router.patch('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const { name, city, governorate, address, phone, email, programDirector, supervisors } = req.body;
    const update = { name, city, governorate, address, phone, email, programDirector, supervisors };
    Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);

    const hospital = await populateHospital(Hospital.findByIdAndUpdate(req.params.id, update, { new: true }));
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
