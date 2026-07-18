// backend/routes/registry.js
// Mounted at /api/registry in server.js.
// Global, unscoped registry management for Data-entry clerks (+ super_admin):
// training centers, specialties, DIO/ODIO/Sub-DIO accounts and PD/Sub-PD accounts.
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const { trackFilter } = require('../utils/track');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const User      = require('../models/User');
const Hospital  = require('../models/Hospital');
const Specialty = require('../models/Specialty');
const Country   = require('../models/Country');
const Program   = require('../models/Program');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const REGISTRY_ROLES = ['data_entry', 'super_admin'];
// The only account types a data-entry clerk manages/sees.
const MANAGED_ROLES = ['dio_view', 'dio', 'sub_dio', 'program_director', 'sub_pd'];

const CENTER_FIELDS = ['name', 'city', 'address', 'governorate', 'phone', 'email',
  'countryId', 'accreditationNumber', 'accreditationGrantDate', 'accreditationExpiry',
  'accreditationWithdrawn'];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

// Inject computed accreditation fields (never stored for programs).
function withAccreditation(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, accreditationExpiry: accreditationExpiry(o), accreditationStatus: accreditationStatus(o) };
}

// Map an E11000 duplicate-key error onto a clear 409. Returns true if handled.
function handleDuplicate(err, res) {
  if (err && err.code === 11000) {
    if (err.keyPattern && err.keyPattern.idNumber) { res.status(409).json({ message: 'ID number already exists' }); return true; }
    if (err.keyPattern && err.keyPattern.email)    { res.status(409).json({ message: 'Email already exists' }); return true; }
    res.status(409).json({ message: 'Duplicate value' });
    return true;
  }
  return false;
}

function validateNewUser({ name, idNumber, password }) {
  if (!name || !String(name).trim()) return 'Name is required';
  if (!idNumber || !String(idNumber).trim()) return 'ID number is required';
  if (!password || String(password).length < 6) return 'Password must be at least 6 characters';
  return null;
}

// Base user payload from the common registry account fields. Email is only set
// when non-empty (sparse-unique index treats missing — not '' — as absent).
function baseUserPayload(body) {
  const payload = {
    name: String(body.name).trim(),
    idNumber: String(body.idNumber).trim(),
    password: String(body.password)
  };
  if (body.email && String(body.email).trim()) payload.email = String(body.email).trim();
  if (body.phone !== undefined) payload.phone = String(body.phone).trim();
  return payload;
}

async function countryExists(countryId) {
  const c = await Country.findById(countryId).select('_id');
  return !!c;
}

// ── TRAINING CENTERS ────────────────────────────────────────────────────────

// GET /api/registry/centers?countryId=&search=
router.get('/centers', auth, allowRoles(...REGISTRY_ROLES), async (req, res) => {
  try {
    const { countryId, search } = req.query;
    const query = { ...trackFilter(req.track) };
    if (countryId) query.countryId = countryId;
    if (search) query.name = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i');

    const centers = await Hospital.find(query)
      .populate('countryId', 'name code')
      .sort({ name: 1 });
    res.json({ success: true, data: centers.map(withAccreditation) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/registry/centers/:id — center + its active programs.
router.get('/centers/:id', auth, allowRoles(...REGISTRY_ROLES), async (req, res) => {
  try {
    const center = await Hospital.findById(req.params.id).populate('countryId', 'name code');
    if (!center) return res.status(404).json({ message: 'Training center not found' });

    const programs = await Program.find({ trainingCenterId: center._id, isActive: { $ne: false } })
      .populate('specialtyId', 'name')
      .populate('programDirectorId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { ...withAccreditation(center), programs: programs.map(withAccreditation) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/registry/centers
router.post('/centers', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_center', 'Hospital'), async (req, res) => {
  try {
    const data = pick(req.body, CENTER_FIELDS);
    if (!data.name || !String(data.name).trim()) return res.status(400).json({ message: 'Center name is required' });
    if (data.countryId && !(await countryExists(data.countryId))) return res.status(400).json({ message: 'Country not found' });

    const center = await Hospital.create(data);
    const populated = await Hospital.findById(center._id).populate('countryId', 'name code');
    res.status(201).json({ success: true, data: withAccreditation(populated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/registry/centers/:id
router.patch('/centers/:id', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_update_center', 'Hospital'), async (req, res) => {
  try {
    const data = pick(req.body, CENTER_FIELDS);
    if (data.name !== undefined && !String(data.name).trim()) return res.status(400).json({ message: 'Center name cannot be empty' });
    if (data.countryId && !(await countryExists(data.countryId))) return res.status(400).json({ message: 'Country not found' });

    const center = await Hospital.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
      .populate('countryId', 'name code');
    if (!center) return res.status(404).json({ message: 'Training center not found' });
    res.json({ success: true, data: withAccreditation(center) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── SPECIALTIES (advanced track) ────────────────────────────────────────────

const SPECIALTY_FIELDS = ['name', 'isActive'];

// GET /api/registry/specialties
router.get('/specialties', auth, allowRoles(...REGISTRY_ROLES), async (req, res) => {
  try {
    const specialties = await Specialty.find(trackFilter(req.track)).sort({ name: 1 });
    res.json({ success: true, data: specialties });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/registry/specialties
router.post('/specialties', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_specialty', 'Specialty'), async (req, res) => {
  try {
    const data = pick(req.body, SPECIALTY_FIELDS);
    if (!data.name || !String(data.name).trim()) return res.status(400).json({ message: 'Specialty name is required' });
    data.track = req.track; // belongs to the creator's training track
    const specialty = await Specialty.create(data);
    res.status(201).json({ success: true, data: specialty });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/registry/specialties/:id
router.patch('/specialties/:id', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_update_specialty', 'Specialty'), async (req, res) => {
  try {
    const data = pick(req.body, SPECIALTY_FIELDS);
    if (data.name !== undefined && !String(data.name).trim()) return res.status(400).json({ message: 'Specialty name cannot be empty' });
    const specialty = await Specialty.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
    res.json({ success: true, data: specialty });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

// ── DIO / ODIO / SUB-DIO ────────────────────────────────────────────────────

// Validate that every id in assignedCenterIds is a center in the given country.
async function centersBelongToCountry(assignedCenterIds, countryId) {
  if (!Array.isArray(assignedCenterIds) || assignedCenterIds.length === 0) return true;
  const count = await Hospital.countDocuments({ _id: { $in: assignedCenterIds }, countryId });
  return count === assignedCenterIds.length;
}

// POST /api/registry/dios — create a dio_view user.
router.post('/dios', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_dio', 'User'), async (req, res) => {
  try {
    const invalid = validateNewUser(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    const { countryId, assignedCenterIds = [] } = req.body;
    if (!countryId) return res.status(400).json({ message: 'Country is required' });
    if (!(await countryExists(countryId))) return res.status(400).json({ message: 'Country not found' });
    if (!Array.isArray(assignedCenterIds)) return res.status(400).json({ message: 'assignedCenterIds must be an array' });
    if (!(await centersBelongToCountry(assignedCenterIds, countryId))) {
      return res.status(400).json({ message: 'All assigned centers must belong to the selected country' });
    }

    const user = new User({
      ...baseUserPayload(req.body),
      role: 'dio_view',
      countryId,
      assignedCenterIds
    });
    await user.save();

    const saved = await User.findById(user._id).select('-password')
      .populate('countryId', 'name code')
      .populate('assignedCenterIds', 'name');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
});

// Shared creator for a DIO's ODIO / Sub-DIO. `role` is 'dio' or 'sub_dio'.
// Both resolve their center set THROUGH the parent dio_view via dioId.
async function createDioChild(req, res, role) {
  try {
    const parent = await User.findById(req.params.id).select('role isActive countryId');
    if (!parent || parent.isActive === false || parent.role !== 'dio_view') {
      return res.status(404).json({ message: 'DIO account not found' });
    }
    const invalid = validateNewUser(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    const user = new User({
      ...baseUserPayload(req.body),
      role,
      dioId: parent._id,
      countryId: parent.countryId || null
    });
    await user.save();

    const saved = await User.findById(user._id).select('-password')
      .populate('dioId', 'name')
      .populate('countryId', 'name code');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
}

// POST /api/registry/dios/:id/odio — create the ODIO (role: dio).
router.post('/dios/:id/odio', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_odio', 'User'), (req, res) => {
  createDioChild(req, res, 'dio');
});

// POST /api/registry/dios/:id/sub-dio — create the Sub-DIO (role: sub_dio).
router.post('/dios/:id/sub-dio', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_sub_dio', 'User'), (req, res) => {
  createDioChild(req, res, 'sub_dio');
});

// PATCH /api/registry/dios/:id — update a dio_view's centers + basic fields.
router.patch('/dios/:id', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_update_dio', 'User'), async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select('role countryId assignedCenterIds');
    if (!target || target.role !== 'dio_view') return res.status(404).json({ message: 'DIO account not found' });

    const fields = {};
    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      fields.name = String(req.body.name).trim();
    }
    if (req.body.phone !== undefined) fields.phone = String(req.body.phone).trim();
    if (req.body.email !== undefined) {
      const em = String(req.body.email).trim();
      fields.email = em || undefined; // never store '' under a sparse-unique index
    }
    if (req.body.countryId !== undefined) {
      if (!req.body.countryId || !(await countryExists(req.body.countryId))) {
        return res.status(400).json({ message: 'Country not found' });
      }
      fields.countryId = req.body.countryId;
    }

    const effectiveCountry = fields.countryId || target.countryId;
    if (req.body.assignedCenterIds !== undefined) {
      if (!Array.isArray(req.body.assignedCenterIds)) return res.status(400).json({ message: 'assignedCenterIds must be an array' });
      if (!(await centersBelongToCountry(req.body.assignedCenterIds, effectiveCountry))) {
        return res.status(400).json({ message: 'All assigned centers must belong to the selected country' });
      }
      fields.assignedCenterIds = req.body.assignedCenterIds;
    }

    const user = await User.findByIdAndUpdate(req.params.id, fields, { new: true }).select('-password')
      .populate('countryId', 'name code')
      .populate('assignedCenterIds', 'name');
    if (!user) return res.status(404).json({ message: 'DIO account not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
});

// ── PD / SUB-PD ─────────────────────────────────────────────────────────────

// POST /api/registry/pds — create a program_director.
router.post('/pds', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_pd', 'User'), async (req, res) => {
  try {
    const invalid = validateNewUser(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    const { specialtyId } = req.body;
    if (!specialtyId) return res.status(400).json({ message: 'Specialty is required' });
    const specialty = await Specialty.findById(specialtyId).select('_id');
    if (!specialty) return res.status(400).json({ message: 'Specialty not found' });

    const user = new User({
      ...baseUserPayload(req.body),
      role: 'program_director',
      specialtyId
    });
    await user.save();

    const saved = await User.findById(user._id).select('-password').populate('specialtyId', 'name');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
});

// POST /api/registry/pds/:id/sub-pd — create a sub_pd linked to PD :id.
router.post('/pds/:id/sub-pd', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_sub_pd', 'User'), async (req, res) => {
  try {
    const parent = await User.findById(req.params.id).select('role isActive specialtyId programId');
    if (!parent || parent.isActive === false || parent.role !== 'program_director') {
      return res.status(404).json({ message: 'Program director not found' });
    }
    const invalid = validateNewUser(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    const user = new User({
      ...baseUserPayload(req.body),
      role: 'sub_pd',
      pdId: parent._id,
      specialtyId: parent.specialtyId || null,
      programId: parent.programId || null
    });
    await user.save();

    const saved = await User.findById(user._id).select('-password')
      .populate('pdId', 'name')
      .populate('specialtyId', 'name');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
});

// ── USERS (clerk's managed accounts) ────────────────────────────────────────

// GET /api/registry/users?role=&countryId=&specialtyId=&search=
router.get('/users', auth, allowRoles(...REGISTRY_ROLES), async (req, res) => {
  try {
    const { role, countryId, specialtyId, search } = req.query;
    const query = { isActive: { $ne: false } };
    if (role) {
      if (!MANAGED_ROLES.includes(role)) return res.json({ success: true, data: [] });
      query.role = role;
    } else {
      query.role = { $in: MANAGED_ROLES };
    }
    if (countryId) query.countryId = countryId;
    if (specialtyId) query.specialtyId = specialtyId;
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { idNumber: rx }];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('countryId', 'name code')
      .populate('specialtyId', 'name')
      .populate('assignedCenterIds', 'name')
      .populate('dioId', 'name')
      .populate('pdId', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
