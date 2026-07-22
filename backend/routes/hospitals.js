const router         = require('express').Router();
const Hospital       = require('../models/Hospital');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { syncCenterDioAssignment } = require('../utils/registryChanges');

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

// A DIO may only edit/delete hospitals in its own training track; super_admin
// is unrestricted. Returns false (and sends 404) when the caller is blocked.
async function ensureHospitalInTrack(req, res, id) {
  if (req.user.role === 'super_admin') return true;
  const h = await Hospital.findById(id).select('track');
  if (!h || (h.track || 'advanced') !== req.track) {
    res.status(404).json({ message: 'Hospital not found' });
    return false;
  }
  return true;
}

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
    const data = pick(req.body, HOSPITAL_FIELDS);
    data.track = req.track; // hospital belongs to the creator's training track
    const hospital  = await Hospital.create(data);
    const populated = await populateHospital(Hospital.findById(hospital._id));
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/hospitals/:id
router.put('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    if (!(await ensureHospitalInTrack(req, res, req.params.id))) return;
    const body = pick(req.body, HOSPITAL_FIELDS);
    // Capture the prior DIO so a reassignment re-syncs the AUTHORITATIVE
    // dio_view.assignedCenterIds + trainee snapshots — not just Hospital.dioId.
    let prevDioId = null;
    if ('dioId' in body) {
      const prev = await Hospital.findById(req.params.id).select('dioId');
      prevDioId = prev ? prev.dioId : null;
    }
    const hospital = await populateHospital(Hospital.findByIdAndUpdate(req.params.id, body, { new: true }));
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    if ('dioId' in body) await syncCenterDioAssignment(hospital._id, body.dioId || null, prevDioId);
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/hospitals/:id
router.patch('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    if (!(await ensureHospitalInTrack(req, res, req.params.id))) return;
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
    if (!(await ensureHospitalInTrack(req, res, req.params.id))) return;
    const hospital = await Hospital.findByIdAndDelete(req.params.id);
    if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
    // Detach the (now-deleted) centre from its DIO's scope + trainee snapshots.
    if (hospital.dioId) await syncCenterDioAssignment(hospital._id, null, hospital.dioId);
    res.json({ message: 'Hospital deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
