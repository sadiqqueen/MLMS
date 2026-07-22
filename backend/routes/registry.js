// backend/routes/registry.js
// Mounted at /api/registry in server.js.
// Global registry management for Data-entry clerks (+ super_admin): training
// centers, specialties, DIO/ODIO/Sub-DIO accounts, PD/Sub-PD accounts, and the
// dashboard. CREATES apply directly (RULINGS §E22). EDITS and DELETES on registry
// entities are queued as ChangeRequests with a required book-of-changes PDF and
// reviewed by the Head AD (utils/registryChanges.js).
const router         = require('express').Router();
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const { trackFilter } = require('../utils/track');
const { decodeOriginalName } = require('../utils/filename');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const { changeHistoryFor } = require('../utils/changeHistory');
const { bocUpload, BOC_URL_PREFIX } = require('../utils/bookOfChanges');
const {
  ROUTE_TARGETS, buildRegistryChangePayload, syncCenterDioAssignment, notifyHeadAds,
} = require('../utils/registryChanges');
const User          = require('../models/User');
const Hospital      = require('../models/Hospital');
const Specialty     = require('../models/Specialty');
const Country       = require('../models/Country');
const Program       = require('../models/Program');
const ChangeRequest = require('../models/ChangeRequest');
const AuditLog      = require('../models/AuditLog');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const REGISTRY_ROLES = ['data_entry', 'developer'];
// Head AD reads every registry list but never writes: it gets the read-only GETs
// via REGISTRY_READ_ROLES and 403s on every POST/PATCH/DELETE (which keep
// REGISTRY_ROLES). This split is the server-side read-only guarantee.
const REGISTRY_READ_ROLES = [...REGISTRY_ROLES, 'head_ad'];
// The only account types a data-entry clerk manages/sees.
const MANAGED_ROLES = ['dio', 'odio', 'sub_dio', 'program_director', 'sub_pd'];

const CENTER_FIELDS = ['name', 'city', 'address', 'governorate', 'phone', 'email',
  'countryId', 'idNumber', 'accreditationNumber', 'accreditationGrantDate', 'accreditationExpiry',
  'accreditationWithdrawn', 'dioId', 'subDioId'];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

function withAccreditation(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, accreditationExpiry: accreditationExpiry(o), accreditationStatus: accreditationStatus(o) };
}

function handleDuplicate(err, res) {
  // A malformed ObjectId (e.g. bad specialtyId / :id) → 400, not a 500.
  if (err && err.name === 'CastError') { res.status(400).json({ message: 'Invalid id provided' }); return true; }
  if (err && err.code === 11000) {
    if (err.keyPattern && err.keyPattern.idNumber) { res.status(409).json({ message: 'ID number already exists' }); return true; }
    if (err.keyPattern && err.keyPattern.email)    { res.status(409).json({ message: 'Email already exists' }); return true; }
    res.status(409).json({ message: 'Duplicate value' });
    return true;
  }
  return false;
}

function sanitizeAuditMetadata(data) {
  const clone = { ...data };
  delete clone.password;
  delete clone.newPassword;
  return clone;
}

async function writeAudit(req, action, targetModel, targetId, metadata = {}) {
  await AuditLog.create({
    userId: req.user._id, action, targetId, targetModel,
    metadata: sanitizeAuditMetadata(metadata),
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
  }).catch(err => console.error('[AuditLog] Failed to write registry audit:', err.message));
}

function validateNewUser({ name, idNumber, password }) {
  if (!name || !String(name).trim()) return 'Name is required';
  if (!idNumber || !String(idNumber).trim()) return 'ID number is required';
  if (!password || String(password).length < 6) return 'Password must be at least 6 characters';
  return null;
}

// Base user payload from the common registry account fields. Email/phone/city are
// only set when non-empty (sparse-unique index treats missing — not '' — as absent).
function baseUserPayload(body) {
  const payload = {
    name: String(body.name).trim(),
    idNumber: String(body.idNumber).trim(),
    password: String(body.password),
  };
  if (body.email && String(body.email).trim()) payload.email = String(body.email).trim();
  if (body.phone !== undefined) payload.phone = String(body.phone).trim();
  if (body.city !== undefined) payload.city = String(body.city).trim();
  return payload;
}

async function countryExists(countryId) {
  const c = await Country.findById(countryId).select('_id');
  return !!c;
}

const MODELS = { User, Hospital, Program, Country };

// Load the current document for a routeKey (role-checked for User targets).
async function loadRegistryTarget(routeKey, id) {
  const t = ROUTE_TARGETS[routeKey];
  if (!t) return { t: null };
  const Model = MODELS[t.model];
  const query = { _id: id };
  if (t.role) query.role = t.role;
  const doc = await Model.findOne(query);
  return { t, doc };
}

function viewChangeRequest(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  if (o.changes && typeof o.changes === 'object') {
    const c = { ...o.changes };
    delete c.password;
    o.changes = c;
  }
  return o;
}

// Generic approval-gated edit/delete submit → ChangeRequest + book-of-changes PDF.
function submitRegistryChange(routeKey, requestType) {
  return (req, res) => {
    bocUpload.single('bookOfChanges')(req, res, async err => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: 'A book-of-changes PDF is required' });
      const cleanup = () => fs.promises.unlink(req.file.path).catch(() => {});
      try {
        const { t, doc } = await loadRegistryTarget(routeKey, req.params.id);
        if (!t) { cleanup(); return res.status(400).json({ message: 'Unknown target type' }); }
        if (!doc) { cleanup(); return res.status(404).json({ message: `${t.label} not found` }); }

        let fields = {};
        if (requestType === 'edit') {
          fields = pick(req.body, t.fields);
          if ('name' in fields) {
            fields.name = String(fields.name).trim();
            if (!fields.name) { cleanup(); return res.status(400).json({ message: 'Name cannot be empty' }); }
          }
          if (!Object.keys(fields).length) { cleanup(); return res.status(400).json({ message: 'No changes provided' }); }
        }

        const dup = await ChangeRequest.findOne({ targetId: doc._id, status: 'pending' });
        if (dup) { cleanup(); return res.status(409).json({ message: 'This record already has a pending change awaiting approval' }); }

        const { before, display } = requestType === 'edit'
          ? await buildRegistryChangePayload(fields, doc)
          : { before: {}, display: [] };

        const hospitalId = t.model === 'Hospital' ? doc._id
          : (doc.hospitalId || doc.hospital || doc.trainingCenterId || null);

        const cr = await ChangeRequest.create({
          requestedBy: req.user._id,
          requestType,
          targetModel: t.model,
          targetId: doc._id,
          hospitalId: hospitalId || null,
          routeKey,
          reviewerRole: 'head_ad',
          targetLabel: doc.name || t.label,
          changes: fields,
          before,
          display,
          bookOfChangesPdf: {
            fileUrl: BOC_URL_PREFIX + req.file.filename,
            fileName: decodeOriginalName(req.file),
            sizeBytes: req.file.size,
          },
          specialtyId: doc.specialtyId || null,
          track: req.track,
        });

        await notifyHeadAds(`${req.user.name} submitted a ${requestType === 'delete' ? 'deletion' : 'change'} to ${doc.name || t.label} for approval.`);
        await writeAudit(req, `registry_submit_${requestType}`, t.model, doc._id, { routeKey });
        res.status(202).json({ success: true, pending: true, data: viewChangeRequest(cr) });
      } catch (e) {
        cleanup();
        if (e.code === 11000) return res.status(409).json({ message: 'This record already has a pending change awaiting approval' });
        console.error('[registry] submit change:', e.message);
        res.status(500).json({ message: e.message });
      }
    });
  };
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

// GET /api/registry/stats — clerk dashboard counts (advanced track).
router.get('/stats', auth, allowRoles(...REGISTRY_READ_ROLES), async (req, res) => {
  try {
    const tf = trackFilter(req.track);
    const [countries, centers, programs, specialties, dios, pds, pendingChanges] = await Promise.all([
      Country.countDocuments({ isActive: { $ne: false } }),
      Hospital.countDocuments({ ...tf, isActive: { $ne: false } }),
      Program.countDocuments({ isActive: { $ne: false } }),
      Specialty.countDocuments({ ...tf, isActive: { $ne: false } }),
      User.countDocuments({ role: 'dio', isActive: { $ne: false } }),
      User.countDocuments({ role: 'program_director', isActive: { $ne: false } }),
      // Head AD's card counts requests awaiting its approval; the clerk's counts
      // its own queued (reviewer-agnostic by requestedBy) requests.
      req.user.role === 'head_ad'
        ? ChangeRequest.countDocuments({ reviewerRole: 'head_ad', status: 'pending' })
        : ChangeRequest.countDocuments({ requestedBy: req.user._id, status: 'pending' }),
    ]);
    res.json({ success: true, data: { countries, centers, programs, specialties, dios, pds, pendingChanges } });
  } catch (err) {
    console.error('[registry] stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── TRAINING CENTERS ────────────────────────────────────────────────────────

// GET /api/registry/centers?countryId=&search=
router.get('/centers', auth, allowRoles(...REGISTRY_READ_ROLES), async (req, res) => {
  try {
    const { countryId, search } = req.query;
    const query = { ...trackFilter(req.track) };
    if (countryId) query.countryId = countryId;
    if (search) query.name = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i');

    const centers = await Hospital.find(query)
      .populate('countryId', 'name code')
      .populate('dioId', 'name')
      .populate('subDioId', 'name')
      .sort({ name: 1 });
    const hist = await changeHistoryFor(centers.map(c => c._id));
    res.json({ success: true, data: centers.map(c => ({ ...withAccreditation(c), changeHistory: hist[String(c._id)] || [] })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/registry/centers/:id — center + its active programs.
router.get('/centers/:id', auth, allowRoles(...REGISTRY_READ_ROLES), async (req, res) => {
  try {
    const center = await Hospital.findById(req.params.id)
      .populate('countryId', 'name code')
      .populate('dioId', 'name')
      .populate('subDioId', 'name');
    if (!center) return res.status(404).json({ message: 'Training center not found' });

    const programs = await Program.find({ trainingCenterId: center._id, isActive: { $ne: false } })
      .populate('specialtyId', 'name nameEn type code')
      .populate('programDirectorId', 'name')
      .populate('subProgramDirectorId', 'name')
      .sort({ createdAt: -1 });

    const hist = await changeHistoryFor([center._id]);
    res.json({
      success: true,
      data: {
        ...withAccreditation(center),
        changeHistory: hist[String(center._id)] || [],
        programs: programs.map(withAccreditation),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/registry/centers — direct create (RULINGS §E22). Dual-writes the
// assigned DIO's assignedCenterIds so center-scope keeps working (§F27).
router.post('/centers', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_center', 'Hospital'), async (req, res) => {
  try {
    const data = pick(req.body, CENTER_FIELDS);
    if (!data.name || !String(data.name).trim()) return res.status(400).json({ message: 'Center name is required' });
    if (data.countryId && !(await countryExists(data.countryId))) return res.status(400).json({ message: 'Country not found' });
    if (data.dioId) {
      const dio = await User.findOne({ _id: data.dioId, role: 'dio', isActive: { $ne: false } }).select('_id');
      if (!dio) return res.status(400).json({ message: 'Assigned DIO not found or inactive' });
    }
    if (data.subDioId) {
      const sub = await User.findOne({ _id: data.subDioId, role: 'sub_dio', isActive: { $ne: false } }).select('_id');
      if (!sub) return res.status(400).json({ message: 'Assigned Sub-DIO not found or inactive' });
    }

    const center = await Hospital.create(data);
    if (data.dioId) await syncCenterDioAssignment(center._id, data.dioId, null);

    const populated = await Hospital.findById(center._id)
      .populate('countryId', 'name code').populate('dioId', 'name').populate('subDioId', 'name');
    res.status(201).json({ success: true, data: withAccreditation(populated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/registry/centers/:id — queued (analyzer approval + PDF).
router.patch('/centers/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('centers', 'edit'));
// DELETE /api/registry/centers/:id — queued delete (analyzer approval + PDF).
router.delete('/centers/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('centers', 'delete'));

// ── SPECIALTIES (dropdown source; the Data Analyzer owns specialty management) ─

const SPECIALTY_FIELDS = ['name', 'isActive'];
// Specialty creation/updates are a Data-Analyzer (+ Developer) capability — NOT
// the Data-Entry clerk. Reads stay open to the clerk (program-form dropdowns).
const SPECIALTY_WRITE_ROLES = ['data_analyzer', 'developer'];

// GET /api/registry/specialties?type=&councilId=
router.get('/specialties', auth, allowRoles(...REGISTRY_READ_ROLES), async (req, res) => {
  try {
    const query = { ...trackFilter(req.track) };
    if (req.query.type) query.type = req.query.type;
    if (req.query.councilId) query.councilId = req.query.councilId;
    const specialties = await Specialty.find(query)
      .populate('councilId', 'name nameEn')
      .sort({ name: 1 });
    res.json({ success: true, data: specialties });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST/PATCH specialty — direct writes gated to the Data Analyzer (+ Developer).
// The clerk can no longer create/edit specialties (role redesign, Change 1).
router.post('/specialties', auth, allowRoles(...SPECIALTY_WRITE_ROLES), auditLog('registry_create_specialty', 'Specialty'), async (req, res) => {
  try {
    const data = pick(req.body, SPECIALTY_FIELDS);
    if (!data.name || !String(data.name).trim()) return res.status(400).json({ message: 'Specialty name is required' });
    data.track = req.track;
    const specialty = await Specialty.create(data);
    res.status(201).json({ success: true, data: specialty });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
});

router.patch('/specialties/:id', auth, allowRoles(...SPECIALTY_WRITE_ROLES), auditLog('registry_update_specialty', 'Specialty'), async (req, res) => {
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

async function centersBelongToCountry(assignedCenterIds, countryId) {
  if (!Array.isArray(assignedCenterIds) || assignedCenterIds.length === 0) return true;
  const count = await Hospital.countDocuments({ _id: { $in: assignedCenterIds }, countryId });
  return count === assignedCenterIds.length;
}

// POST /api/registry/dios — create a dio_view (direct). Centers are assigned on
// the training-center form (§F27), so assignedCenterIds is optional here.
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

    const user = new User({ ...baseUserPayload(req.body), role: 'dio', countryId, assignedCenterIds });
    await user.save();

    const saved = await User.findById(user._id).select('-password')
      .populate('countryId', 'name code').populate('assignedCenterIds', 'name');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
});

// Shared creator for a DIO's ODIO / Sub-DIO (role 'odio' | 'sub_dio'). Both resolve
// their center set THROUGH the parent dio_view via dioId; country/city inherited.
async function createDioChild(req, res, role) {
  try {
    const parent = await User.findById(req.params.id).select('role isActive countryId city');
    if (!parent || parent.isActive === false || parent.role !== 'dio') {
      return res.status(404).json({ message: 'DIO account not found' });
    }
    const invalid = validateNewUser(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    const payload = { ...baseUserPayload(req.body), role, dioId: parent._id, countryId: parent.countryId || null };
    if (payload.city === undefined && parent.city) payload.city = parent.city;
    const user = new User(payload);
    await user.save();

    const saved = await User.findById(user._id).select('-password')
      .populate('dioId', 'name').populate('countryId', 'name code');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
}

// ODIO creation is NOT a clerk capability — an ODIO is created ONLY by its DIO
// (dioView.js POST /odios, allowRoles('dio')), inheriting the DIO's centers.
// The former clerk route POST /dios/:id/odio was removed in the role redesign
// (Change 2). The clerk still adds DIO and Sub-DIO below.

// POST /api/registry/dios/:id/sub-dio — create the Sub-DIO (role: sub_dio).
router.post('/dios/:id/sub-dio', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_sub_dio', 'User'), (req, res) => {
  createDioChild(req, res, 'sub_dio');
});

// PATCH/DELETE DIO + children — queued (analyzer approval + PDF).
router.patch('/dios/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('dios', 'edit'));
router.delete('/dios/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('dios', 'delete'));
router.patch('/odios/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('odios', 'edit'));
router.delete('/odios/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('odios', 'delete'));
router.patch('/sub-dios/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('sub_dios', 'edit'));
router.delete('/sub-dios/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('sub_dios', 'delete'));

// ── PD / SUB-PD ─────────────────────────────────────────────────────────────

// POST /api/registry/pds — create a program_director (direct). specialtyId is
// REQUIRED and chosen on the form (Change 4 — the PD's specialty/sub-specialty
// is explicit, no longer only derived from program attachment); password is
// REQUIRED. Country/city captured from the modal.
router.post('/pds', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_pd', 'User'), async (req, res) => {
  try {
    const invalid = validateNewUser(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    if (!req.body.specialtyId) return res.status(400).json({ message: 'Specialty is required' });
    const specialty = await Specialty.findById(req.body.specialtyId).select('_id');
    if (!specialty) return res.status(400).json({ message: 'Specialty not found' });

    const payload = { ...baseUserPayload(req.body), role: 'program_director', specialtyId: req.body.specialtyId };
    if (req.body.countryId) {
      if (!(await countryExists(req.body.countryId))) return res.status(400).json({ message: 'Country not found' });
      payload.countryId = req.body.countryId;
    }

    const user = new User(payload);
    await user.save();
    const saved = await User.findById(user._id).select('-password')
      .populate('specialtyId', 'name nameEn').populate('countryId', 'name code');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
});

// POST /api/registry/pds/:id/sub-pd — create a sub_pd linked to PD :id (password REQUIRED).
router.post('/pds/:id/sub-pd', auth, allowRoles(...REGISTRY_ROLES), auditLog('registry_create_sub_pd', 'User'), async (req, res) => {
  try {
    const parent = await User.findById(req.params.id).select('role isActive specialtyId programId countryId city');
    if (!parent || parent.isActive === false || parent.role !== 'program_director') {
      return res.status(404).json({ message: 'Program director not found' });
    }
    const invalid = validateNewUser(req.body);
    if (invalid) return res.status(400).json({ message: invalid });

    // Sub-PD's specialty is now EXPLICIT and chosen on the form (Change 4) — it
    // defaults to the parent PD's specialty in the UI but is sent + validated here.
    if (!req.body.specialtyId) return res.status(400).json({ message: 'Specialty is required' });
    const specialty = await Specialty.findById(req.body.specialtyId).select('_id');
    if (!specialty) return res.status(400).json({ message: 'Specialty not found' });

    const payload = {
      ...baseUserPayload(req.body),
      role: 'sub_pd',
      pdId: parent._id,
      specialtyId: req.body.specialtyId,
      programId: parent.programId || null,
      countryId: parent.countryId || null,
    };
    if (payload.city === undefined && parent.city) payload.city = parent.city;
    const user = new User(payload);
    await user.save();

    const saved = await User.findById(user._id).select('-password')
      .populate('pdId', 'name').populate('specialtyId', 'name nameEn');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    res.status(500).json({ message: err.message });
  }
});

// PATCH/DELETE PD + Sub-PD — queued (analyzer approval + PDF).
router.patch('/pds/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('pds', 'edit'));
router.delete('/pds/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('pds', 'delete'));
router.patch('/sub-pds/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('sub_pds', 'edit'));
router.delete('/sub-pds/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('sub_pds', 'delete'));

// ── PROGRAMS (edit/delete gating; create lives in its own router) ──
router.patch('/programs/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('programs', 'edit'));
router.delete('/programs/:id', auth, allowRoles(...REGISTRY_ROLES), submitRegistryChange('programs', 'delete'));
// Countries: edit/delete are super_admin (Developer) only and go through the direct
// /api/countries PATCH/DELETE route — the clerk may only ADD a country, never edit
// or delete one, so no approval-gated country edit/delete is exposed here.

// ── USERS (clerk's managed accounts) ────────────────────────────────────────

// GET /api/registry/users?role=&countryId=&specialtyId=&search=
router.get('/users', auth, allowRoles(...REGISTRY_READ_ROLES), async (req, res) => {
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
      .populate('specialtyId', 'name nameEn')
      .populate('assignedCenterIds', 'name')
      .populate('dioId', 'name')
      .populate('pdId', 'name')
      .sort({ createdAt: -1 });
    const hist = await changeHistoryFor(users.map(u => u._id));
    res.json({ success: true, data: users.map(u => ({ ...u.toObject(), changeHistory: hist[String(u._id)] || [] })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
