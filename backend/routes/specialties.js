// backend/routes/specialties.js
// Mounted at /api/specialties in server.js.
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const Specialty      = require('../models/Specialty');

// Any authenticated user may list specialties (needed for dropdowns)
const READ_ROLES  = ['super_admin', 'secretary', 'dio', 'supervisor', 'trainee', 'president', 'program_director'];
const WRITE_ROLES = ['super_admin', 'dio'];

// GET /api/specialties
router.get('/', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const { hospital, active } = req.query;
    const query = {};
    if (hospital) query.hospitalId = hospital;
    if (active === 'true')  query.isActive = true;
    if (active === 'false') query.isActive = false;

    const specialties = await Specialty.find(query)
      .populate('hospitalId',  'name city')
      .populate('secretaryId', 'name email')
      .sort({ name: 1 });

    res.json({ success: true, data: specialties });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/specialties/:id
router.get('/:id', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id)
      .populate('hospitalId',  'name city')
      .populate('secretaryId', 'name email');
    if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
    res.json({ success: true, data: specialty });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/specialties — super_admin or dio only
router.post('/',
  auth,
  allowRoles(...WRITE_ROLES),
  auditLog('create_specialty', 'Specialty'),
  async (req, res) => {
    try {
      const specialty = await Specialty.create(req.body);
      res.status(201).json({ success: true, data: specialty });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/specialties/:id — super_admin or dio only
router.patch('/:id',
  auth,
  allowRoles(...WRITE_ROLES),
  auditLog('update_specialty', 'Specialty'),
  async (req, res) => {
    try {
      const specialty = await Specialty.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
        .populate('hospitalId',  'name city')
        .populate('secretaryId', 'name email');
      if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
      res.json({ success: true, data: specialty });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/specialties/:id — soft delete (super_admin only)
router.delete('/:id',
  auth,
  allowRoles('super_admin'),
  auditLog('deactivate_specialty', 'Specialty'),
  async (req, res) => {
    try {
      const specialty = await Specialty.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
      res.json({ success: true, message: 'Specialty deactivated', data: specialty });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
