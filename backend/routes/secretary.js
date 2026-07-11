// backend/routes/secretary.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { coerceRoleToTrack, trackFilter } = require('../utils/track');
const { specialtyIdsForName, specialtyUserMatch, findPdForSpecialty } = require('../utils/pdScope');
const auditLog       = require('../middleware/auditLogger');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Rotation       = require('../models/Rotation');
const Specialty      = require('../models/Specialty');
const Notification   = require('../models/Notification');
const ChangeRequest  = require('../models/ChangeRequest');

const SECRETARY = ['secretary'];
const CREATE_USER_FIELDS = ['name', 'email', 'password', 'phone', 'gender', 'city',
  'department', 'specialty', 'year', 'studentId', 'enrolledSince',
  'hospitalId', 'hospital', 'specialtyId', 'supervisorId', 'supervisor',
  'researchSupervisorId', 'photoUrl'];
const UPDATE_USER_FIELDS = ['name', 'phone', 'gender', 'city', 'department',
  'specialty', 'year', 'studentId', 'enrolledSince', 'hospitalId',
  'hospital', 'supervisorId', 'supervisor', 'researchSupervisorId', 'photoUrl', 'isActive'];
const HOSPITAL_UPDATE_FIELDS = ['name', 'city', 'governorate', 'address', 'phone', 'email'];
const ROTATION_UPDATE_FIELDS = ['startDate', 'endDate', 'status', 'supervisorId'];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

function getSpecialty(user) {
  return user.specialtyId || null;
}

function getHospital(user) {
  return user.hospitalId || user.hospital || null;
}

// Resolve every hospital ID a secretary may see/edit, derived ONLY from their
// own assigned hospital + their specialty (name match + specialty.hospitalId).
async function getSecretaryHospitalIds(req) {
  const ids = new Set();
  const own = getHospital(req.user);
  if (own) ids.add(own.toString());
  if (req.user.specialtyId) {
    const spec = await Specialty.findById(req.user.specialtyId).select('name hospitalId');
    if (spec && spec.hospitalId) ids.add(spec.hospitalId.toString());
    if (spec && spec.name) {
      const matches = await Hospital.find({ specialties: spec.name, ...trackFilter(req.track) }).select('_id');
      matches.forEach(h => ids.add(h._id.toString()));
    }
  }
  return [...ids];
}

function getSecretaryQuery(req) {
  return { specialtyId: req.user.specialtyId };
}

function dateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function inferRotationStatus(startDate, endDate) {
  const today = dateOnly(new Date());
  const start = dateOnly(new Date(startDate));
  const end = dateOnly(new Date(endDate));
  if (end < today) return 'completed';
  if (start > today) return 'upcoming';
  return 'current';
}

function populateRotation(query) {
  return query
    .populate('traineeId', 'name email initials photoUrl studentId')
    .populate('student', 'name email initials photoUrl studentId')
    .populate('supervisorId', 'name specialty initials')
    .populate('doctor', 'name specialty initials')
    .populate('specialtyId', 'name')
    .populate('hospitalId', 'name city')
    .populate('hospital', 'name city');
}

async function validateRotationDates({ traineeId, startDate, endDate, existingId = null }, res) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    res.status(400).json({ success: false, message: 'Invalid startDate or endDate' });
    return false;
  }
  if (end <= start) {
    res.status(400).json({ success: false, message: 'endDate must be after startDate' });
    return false;
  }

  const overlap = await Rotation.findOne({
    $or: [{ traineeId }, { student: traineeId }],
    status: { $ne: 'cancelled' },
    ...(existingId ? { _id: { $ne: existingId } } : {}),
    startDate: { $lt: end },
    endDate: { $gt: start }
  });
  if (overlap) {
    res.status(409).json({ success: false, message: 'Trainee already has an overlapping rotation' });
    return false;
  }
  return true;
}

function requireSecretarySpecialty(req, res) {
  if (!req.user.specialtyId) {
    res.status(403).json({ success: false, message: 'Secretary has no specialty assigned' });
    return null;
  }
  return req.user.specialtyId;
}

// Confirm a supervisor id is an active supervisor in the secretary's specialty.
async function supervisorInSpecialty(supervisorId, req) {
  if (!supervisorId) return null;
  return User.findOne({
    _id: supervisorId,
    role: coerceRoleToTrack('supervisor', req.track),
    specialtyId: req.user.specialtyId,
    isActive: { $ne: false }
  }).select('_id');
}

// ── Secretary account edits → queued DIO approval ("Promotions") ────────────
// A secretary's edit to a trainee/supervisor account is NOT applied directly; it
// becomes a pending ChangeRequest the DIO approves (creates and deactivations are
// unaffected and still apply immediately).
const CHANGE_FIELD_LABELS = {
  name: 'Name', phone: 'Phone', gender: 'Gender', city: 'City', department: 'Department',
  year: 'Year', studentId: 'Student ID', hospitalId: 'Hospital', supervisorId: 'Supervisor',
  researchSupervisorId: 'Research Supervisor', isActive: 'Active', specialty: 'Specialty',
  enrolledSince: 'Enrolled Since',
};

// Resolve a field value to a human label for the DIO's diff view.
async function displayValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (['supervisorId', 'researchSupervisorId'].includes(key)) {
    const u = await User.findById(value).select('name');
    return u?.name || String(value);
  }
  if (key === 'hospitalId') {
    const h = await Hospital.findById(value).select('name');
    return h?.name || String(value);
  }
  if (key === 'isActive') return value ? 'Active' : 'Inactive';
  if (key === 'year') return `Year ${value}`;
  return String(value);
}

// Build the { changes, before, display } payload for a change request.
async function buildChangePayload(fields, existing) {
  const before = {};
  const display = [];
  for (const key of Object.keys(fields)) {
    // Skip the mirrored legacy alias so the diff isn't shown twice.
    if (key === 'supervisor') continue;
    const beforeVal = existing[key] === undefined ? null : existing[key];
    before[key] = beforeVal?._id || beforeVal || null;
    display.push({
      label: CHANGE_FIELD_LABELS[key] || key,
      from: await displayValue(key, before[key]),
      to: await displayValue(key, fields[key]),
    });
  }
  return { before, display };
}

// Create the pending request + notify the track's DIOs. Returns the CR.
async function queueChangeRequest({ req, routeKey, existing, fields }) {
  const { before, display } = await buildChangePayload(fields, existing);
  const cr = await ChangeRequest.create({
    requestedBy: req.user._id,
    targetModel: 'User',
    targetId: existing._id,
    routeKey,
    targetLabel: existing.name || '',
    changes: fields,
    before,
    display,
    status: 'pending',
    specialtyId: req.user.specialtyId,
    track: req.track,
  });
  const dios = await User.find({
    role: coerceRoleToTrack('dio', req.track),
    isActive: { $ne: false }
  }).select('_id');
  await Promise.all(dios.map(d =>
    Notification.create({
      user: d._id,
      message: `${req.user.name} requested a change to ${existing.name || 'an account'} — awaiting your approval.`,
      category: 'promotions'
    }).catch(() => {})));
  return cr;
}

// ── TRAINEES ──────────────────────────────────────────────────────────────

// GET /api/secretary/trainees
router.get('/trainees', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = requireSecretarySpecialty(req, res);
    if (!specialtyId) return;

    const trainees = await User.find({
      role: coerceRoleToTrack('trainee', req.track),
      specialtyId,
      isActive: { $ne: false }
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .populate('supervisorId', 'name email')
      .populate('researchSupervisorId', 'name email')
      .sort({ name: 1 });

    res.json({ success: true, data: trainees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/secretary/trainees
router.post('/trainees',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_trainee', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const hospitalId  = req.body.hospitalId || req.body.hospital || getHospital(req.user);
      const data = pick(req.body, CREATE_USER_FIELDS);
      data.role = coerceRoleToTrack('trainee', req.track);
      data.specialtyId = specialtyId;
      data.specialty = req.user.specialty || data.specialty || '';
      if (hospitalId)  { data.hospitalId = hospitalId; data.hospital = hospitalId; }

      // A trainee must be assigned a supervisor (in this secretary's specialty).
      if (!data.supervisorId) {
        return res.status(400).json({ success: false, message: 'A supervisor is required' });
      }
      if (!(await supervisorInSpecialty(data.supervisorId, req))) {
        return res.status(400).json({ success: false, message: 'Supervisor is not in your specialty' });
      }
      data.supervisor = data.supervisorId;
      if (data.researchSupervisorId && !(await supervisorInSpecialty(data.researchSupervisorId, req))) {
        return res.status(400).json({ success: false, message: 'Research supervisor is not in your specialty' });
      }

      const user = new User(data);
      await user.save();

      const saved = await User.findById(user._id)
        .select('-password')
        .populate('hospitalId',  'name city')
        .populate('specialtyId', 'name')
        .populate('supervisorId', 'name email')
        .populate('researchSupervisorId', 'name email');

      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists' });
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/secretary/trainees/:id
router.patch('/trainees/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_trainee', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const fields = pick(req.body, UPDATE_USER_FIELDS);
      const existing = await User.findOne({ _id: req.params.id, specialtyId });
      if (!existing) return res.status(404).json({ success: false, message: 'User not found in secretary specialty' });
      delete fields.specialtyId;
      // Fold the legacy alias into supervisorId so it is validated, not smuggled.
      if (fields.supervisor && !fields.supervisorId) fields.supervisorId = fields.supervisor;
      // A trainee must keep a supervisor — allow changing it, never clearing it.
      if (('supervisorId' in fields || 'supervisor' in fields) && !fields.supervisorId && !fields.supervisor) {
        return res.status(400).json({ success: false, message: 'A trainee must have a supervisor' });
      }
      if (fields.supervisorId) {
        if (!(await supervisorInSpecialty(fields.supervisorId, req))) {
          return res.status(400).json({ success: false, message: 'Supervisor is not in your specialty' });
        }
        fields.supervisor = fields.supervisorId;
      }
      if (fields.researchSupervisorId && !(await supervisorInSpecialty(fields.researchSupervisorId, req))) {
        return res.status(400).json({ success: false, message: 'Research supervisor is not in your specialty' });
      }
      if (!Object.keys(fields).length) {
        return res.status(400).json({ success: false, message: 'No changes provided' });
      }
      // Queue for DIO approval instead of applying directly.
      const dup = await ChangeRequest.findOne({ targetId: existing._id, status: 'pending' });
      if (dup) return res.status(409).json({ success: false, message: 'This account already has a pending change awaiting DIO approval' });
      const cr = await queueChangeRequest({ req, routeKey: 'trainees', existing, fields });
      res.status(202).json({ success: true, pending: true, data: cr });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'This account already has a pending change awaiting DIO approval' });
      res.status(500).json({ message: err.message });
    }
  }
);

// ── SUPERVISORS ───────────────────────────────────────────────────────────

// GET /api/secretary/supervisors
router.get('/supervisors', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = requireSecretarySpecialty(req, res);
    if (!specialtyId) return;

    const supervisors = await User.find({
      role: coerceRoleToTrack('supervisor', req.track),
      specialtyId,
      isActive: { $ne: false }
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/secretary/supervisors
router.post('/supervisors',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_supervisor', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const hospitalId  = req.body.hospitalId || req.body.hospital || getHospital(req.user);
      const data = pick(req.body, CREATE_USER_FIELDS);
      data.role = coerceRoleToTrack('supervisor', req.track);
      data.specialtyId = specialtyId;
      data.specialty = req.user.specialty || data.specialty || '';
      if (hospitalId)  { data.hospitalId = hospitalId; data.hospital = hospitalId; }

      const user = new User(data);
      await user.save();

      const saved = await User.findById(user._id)
        .select('-password')
        .populate('hospitalId',  'name city')
        .populate('specialtyId', 'name');

      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ message: 'Email already exists' });
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/secretary/supervisors/:id
router.patch('/supervisors/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_supervisor', 'User'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const fields = pick(req.body, UPDATE_USER_FIELDS);
      const existing = await User.findOne({ _id: req.params.id, specialtyId });
      if (!existing) return res.status(404).json({ success: false, message: 'User not found in secretary specialty' });
      delete fields.specialtyId;
      // Fold + validate the legacy supervisor alias so it can't smuggle an
      // arbitrary out-of-specialty reference through the change request.
      if (fields.supervisor && !fields.supervisorId) fields.supervisorId = fields.supervisor;
      if (fields.supervisorId) {
        if (!(await supervisorInSpecialty(fields.supervisorId, req))) {
          return res.status(400).json({ success: false, message: 'Supervisor is not in your specialty' });
        }
        fields.supervisor = fields.supervisorId;
      }
      if (fields.researchSupervisorId && !(await supervisorInSpecialty(fields.researchSupervisorId, req))) {
        return res.status(400).json({ success: false, message: 'Research supervisor is not in your specialty' });
      }
      if (!Object.keys(fields).length) {
        return res.status(400).json({ success: false, message: 'No changes provided' });
      }
      // Queue for DIO approval instead of applying directly.
      const dup = await ChangeRequest.findOne({ targetId: existing._id, status: 'pending' });
      if (dup) return res.status(409).json({ success: false, message: 'This account already has a pending change awaiting DIO approval' });
      const cr = await queueChangeRequest({ req, routeKey: 'supervisors', existing, fields });
      res.status(202).json({ success: true, pending: true, data: cr });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, message: 'This account already has a pending change awaiting DIO approval' });
      res.status(500).json({ message: err.message });
    }
  }
);

// GET /api/secretary/change-requests — the secretary's own pending/recent requests
router.get('/change-requests', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const query = { requestedBy: req.user._id };
    if (req.query.status) query.status = req.query.status;
    const items = await ChangeRequest.find(query).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/secretary/change-requests/:id/cancel — withdraw a still-pending request
router.patch('/change-requests/:id/cancel', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const cr = await ChangeRequest.findOne({ _id: req.params.id, requestedBy: req.user._id, status: 'pending' });
    if (!cr) return res.status(404).json({ success: false, message: 'Pending request not found' });
    cr.status = 'cancelled';
    await cr.save();
    res.json({ success: true, data: cr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PROGRAM DIRECTORS ─────────────────────────────────────────────────────

// GET /api/secretary/program-directors
router.get('/program-directors', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    // The secretary sees the Program Director of their own specialty.
    const info = await specialtyIdsForName(req.user.specialtyId, req.track);

    const query = {
      role: coerceRoleToTrack('program_director', req.track),
      isActive: { $ne: false }
    };
    if (info) Object.assign(query, specialtyUserMatch(info));
    else query._id = null;

    const pds = await User.find(query)
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: pds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/secretary/program-directors
router.post('/program-directors',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_program_director', 'User'),
  async (req, res) => {
    try {
      // A secretary can only create the Program Director of their OWN specialty.
      const specialtyId = req.user.specialtyId;
      if (!specialtyId) {
        return res.status(400).json({ success: false, message: 'You have no specialty assigned' });
      }
      const clash = await findPdForSpecialty(specialtyId, req.track, null);
      if (clash) {
        return res.status(409).json({ success: false, message: `This specialty already has a Program Director (${clash.name})` });
      }
      const data = pick(req.body, CREATE_USER_FIELDS);
      data.role = coerceRoleToTrack('program_director', req.track);
      data.specialtyId = specialtyId;
      delete data.specialty;
      // Hospital is optional metadata now (PDs span every hospital of the specialty).
      const hospitalId = req.body.hospitalId || req.body.hospital || getHospital(req.user);
      if (hospitalId) { data.hospitalId = hospitalId; data.hospital = hospitalId; }

      const user = new User(data);
      await user.save();

      const saved = await User.findById(user._id)
        .select('-password')
        .populate('hospitalId', 'name city')
        .populate('specialtyId', 'name');

      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ message: 'Email already exists' });
      res.status(500).json({ message: err.message });
    }
  }
);

// ── HOSPITALS ─────────────────────────────────────────────────────────────

// GET /api/secretary/hospitals
router.get('/hospitals', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const ids = await getSecretaryHospitalIds(req);
    const query = ids.length ? { _id: { $in: ids } } : { _id: null };
    const hospitals = await Hospital.find(query).sort({ name: 1 });
    res.json({ success: true, data: hospitals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/secretary/hospitals — a secretary may create a hospital, tagged
// with their own specialty so it falls within their specialty scope (and no
// other). Track follows the acting secretary's portal.
router.post('/hospitals',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_hospital', 'Hospital'),
  async (req, res) => {
    try {
      const specialtyId = requireSecretarySpecialty(req, res);
      if (!specialtyId) return;
      const spec = await Specialty.findById(specialtyId).select('name');
      const specName = spec?.name || req.user.specialty || '';

      const data = pick(req.body, HOSPITAL_UPDATE_FIELDS);
      if (!data.name || !String(data.name).trim()) {
        return res.status(400).json({ success: false, message: 'Hospital name is required' });
      }
      data.track = req.track;
      // Scope tag: the secretary only ever adds hospitals for their specialty.
      data.specialties = specName ? [specName] : [];

      const hospital = await Hospital.create(data);
      res.status(201).json({ success: true, data: hospital });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// PATCH /api/secretary/hospitals/:id
router.patch('/hospitals/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_hospital', 'Hospital'),
  async (req, res) => {
    try {
      const ids = await getSecretaryHospitalIds(req);
      if (!ids.length || !ids.includes(req.params.id.toString())) {
        return res.status(403).json({ success: false, message: 'Access denied: hospital not in your specialty scope' });
      }

      const updates = pick(req.body, HOSPITAL_UPDATE_FIELDS);
      const hospital = await Hospital.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!hospital) return res.status(404).json({ message: 'Hospital not found' });
      res.json({ success: true, data: hospital });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── DISTRIBUTIONS ─────────────────────────────────────────────────────────

// POST /api/secretary/distributions
// Compatibility URL: creates a Rotation assignment for a trainee.
router.post('/distributions',
  auth,
  allowRoles(...SECRETARY),
  auditLog('create_rotation', 'Rotation'),
  async (req, res) => {
    try {
      const specialtyId = getSpecialty(req.user);
      const hospitalId  = getHospital(req.user);
      const { traineeId, supervisorId, startDate, endDate } = req.body;

      if (!traineeId || !supervisorId || !startDate || !endDate) {
        return res.status(400).json({ message: 'traineeId, supervisorId, startDate, and endDate are required' });
      }

      if (!specialtyId) {
        return res.status(403).json({ success: false, message: 'Secretary has no specialty assigned' });
      }

      const trainee = await User.findOne({
        _id: traineeId,
        role: coerceRoleToTrack('trainee', req.track),
        ...getSecretaryQuery(req),
        isActive: { $ne: false }
      });
      if (!trainee) {
        return res.status(403).json({ success: false, message: 'Trainee is not in secretary specialty' });
      }

      const supervisor = await User.findOne({
        _id: supervisorId,
        role: coerceRoleToTrack('supervisor', req.track),
        ...getSecretaryQuery(req),
        isActive: { $ne: false }
      });
      if (!supervisor) {
        return res.status(403).json({ success: false, message: 'Supervisor is not in secretary specialty' });
      }

      if (!(await validateRotationDates({ traineeId, startDate, endDate }, res))) return;

      const rotation = await Rotation.create({
        traineeId,
        student:       traineeId,
        supervisorId,
        doctor:        supervisorId, // legacy compatibility
        specialtyId:   specialtyId   || null,
        hospitalId:    hospitalId    || null,
        hospital:      hospitalId    || null, // legacy
        startDate,
        endDate,
        status:        inferRotationStatus(startDate, endDate)
      });

      const populated = await populateRotation(Rotation.findById(rotation._id));

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// GET /api/secretary/distributions
// Compatibility URL: returns Rotation records in the secretary specialty.
router.get('/distributions', auth, allowRoles(...SECRETARY), async (req, res) => {
  try {
    const specialtyId = getSpecialty(req.user);
    const query = specialtyId ? { specialtyId } : { _id: null };

    const distributions = await populateRotation(Rotation.find(query)).sort({ createdAt: -1 });

    res.json({ success: true, data: distributions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/secretary/distributions/:id
router.patch('/distributions/:id',
  auth,
  allowRoles(...SECRETARY),
  auditLog('update_rotation', 'Rotation'),
  async (req, res) => {
    try {
      const specialtyId = getSpecialty(req.user);
      const existing = await Rotation.findOne({ _id: req.params.id, specialtyId });
      if (!existing) return res.status(404).json({ success: false, message: 'Rotation not found in secretary specialty' });

      const updates = pick(req.body, ROTATION_UPDATE_FIELDS);
      if (updates.supervisorId) {
        const supervisor = await User.findOne({
          _id: updates.supervisorId,
          role: coerceRoleToTrack('supervisor', req.track),
          ...getSecretaryQuery(req),
          isActive: { $ne: false }
        });
        if (!supervisor) {
          return res.status(403).json({ success: false, message: 'Supervisor is not in secretary specialty' });
        }
        updates.doctor = updates.supervisorId;
      }

      const startDate = updates.startDate || existing.startDate;
      const endDate = updates.endDate || existing.endDate;
      const traineeId = existing.traineeId || existing.student;
      if (updates.startDate || updates.endDate) {
        if (!(await validateRotationDates({ traineeId, startDate, endDate, existingId: req.params.id }, res))) return;
        if (!updates.status) updates.status = inferRotationStatus(startDate, endDate);
      }

      const dist = await populateRotation(Rotation.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }));
      if (!dist) return res.status(404).json({ message: 'Rotation not found' });
      res.json({ success: true, data: dist });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
