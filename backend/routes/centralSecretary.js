// backend/routes/centralSecretary.js
// Mounted at /api/central in server.js.
// Central secretary (+ super_admin) — GLOBAL scope (all countries, all
// specialties). Creates trainees (trainer OPTIONAL) and trainers against a
// program; edits are queued as ChangeRequests approved by the center's ODIO.
const router         = require('express').Router();
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const User          = require('../models/User');
const Program       = require('../models/Program');
const Hospital      = require('../models/Hospital');
const Country       = require('../models/Country');
const Certificate   = require('../models/Certificate');
const Evaluation    = require('../models/Evaluation');
const Research      = require('../models/Research');
const Notification  = require('../models/Notification');
const ChangeRequest = require('../models/ChangeRequest');
const AuditLog      = require('../models/AuditLog');
const { currentYearRange, inYear } = require('../utils/capacity');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const { trainingYear } = require('../utils/trainingYear');
const { specialtyIdsForCs } = require('../utils/councilScope');
const { changeHistoryFor } = require('../utils/changeHistory');
const { decodeOriginalName } = require('../utils/filename');
const { bocUpload, BOC_URL_PREFIX } = require('../utils/bookOfChanges');
const { ROUTE_TARGETS, buildRegistryChangePayload, notifyAnalyzers } = require('../utils/registryChanges');

const CENTRAL_ROLES = ['central_secretary', 'super_admin'];
const EDIT_FIELDS = ['name', 'phone', 'city', 'gender', 'supervisorId', 'researchSupervisorId'];

// Resolve the CS specialty scope. super_admin sees everything (all:true); a main
// CS is scoped to its council's specialties, a precise CS to every precise
// specialty (utils/councilScope.js).
async function csScope(req) {
  if (req.user.role === 'super_admin') return { all: true, ids: null };
  const ids = await specialtyIdsForCs(req.user);
  return { all: false, ids: ids || [] };
}

// True when a specialtyId is inside the CS's scope (super_admin: always true).
function inCsScope(scope, specialtyId) {
  if (scope.all) return true;
  if (!specialtyId) return false;
  return (scope.ids || []).some(id => String(id) === String(specialtyId));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeAuditMetadata(data) {
  const clone = { ...data };
  delete clone.password;
  delete clone.newPassword;
  return clone;
}

async function writeAudit(req, action, targetModel, targetId, metadata = {}) {
  await AuditLog.create({
    userId: req.user._id,
    action,
    targetId,
    targetModel,
    metadata: sanitizeAuditMetadata(metadata),
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
  }).catch(err => console.error('[AuditLog] Failed to write central audit:', err.message));
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

// Inject computed accreditation fields (never stored for programs).
function withAccreditation(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, accreditationExpiry: accreditationExpiry(o), accreditationStatus: accreditationStatus(o) };
}

// Current-year active-trainee count on one program (mirrors utils/capacity.js:
// a trainee counts toward the year of its enrolledSince, falling back to createdAt).
async function capacityUsedFor(programId) {
  const { yr } = currentYearRange();
  const trainees = await User.find({ role: 'trainee', programId, isActive: { $ne: false } })
    .select('enrolledSince createdAt');
  return trainees.filter(t => inYear(t.enrolledSince || t.createdAt, yr)).length;
}

// ── ChangeRequest queue helpers (adapted from routes/secretary.js) ──────────

// A ChangeRequest as a plain object with the sensitive queued password removed.
function viewChangeRequest(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  if (o.changes && typeof o.changes === 'object') {
    const c = { ...o.changes };
    delete c.password;
    o.changes = c;
  }
  return o;
}

const CHANGE_FIELD_LABELS = {
  name: 'Name', phone: 'Phone', city: 'City', gender: 'Gender',
  supervisorId: 'Trainer', researchSupervisorId: 'Research Trainer',
};

// Resolve a field value to a human label for the ODIO's diff view.
async function displayValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (['supervisorId', 'researchSupervisorId'].includes(key)) {
    const u = await User.findById(value).select('name');
    return u?.name || String(value);
  }
  return String(value);
}

// Build the { before, display } payload for a change request.
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

// Notify the ODIO(s) responsible for a center: the ODIOs (role 'dio') linked
// to any dio_view whose assignedCenterIds contains the center. Best-effort; the
// message includes "approval" so the Navbar notifLink routes it to Approvals.
async function notifyCenterOdios(hospitalId, message) {
  if (!hospitalId) return;
  const dioViews = await User.find({
    role: 'dio_view', isActive: { $ne: false }, assignedCenterIds: hospitalId,
  }).select('_id');
  if (!dioViews.length) return;
  const odios = await User.find({
    role: 'dio', isActive: { $ne: false }, dioId: { $in: dioViews.map(d => d._id) },
  }).select('_id');
  await Promise.all(odios.map(o =>
    Notification.create({ user: o._id, message, category: 'promotions' }).catch(() => {})));
}

// Create the pending edit request scoped to the TARGET's specialty/center so the
// ODIO's applyChangeRequest re-validation resolves the account. Returns the CR.
async function queueChangeRequest({ req, routeKey, existing, fields }) {
  const { before, display } = await buildChangePayload(fields, existing);
  const cr = await ChangeRequest.create({
    requestedBy: req.user._id,
    requestType: 'edit',
    targetModel: 'User',
    targetId: existing._id,
    hospitalId: existing.hospitalId || existing.hospital || null,
    routeKey,
    targetLabel: existing.name || '',
    changes: fields,
    before,
    display,
    status: 'pending',
    specialtyId: existing.specialtyId || null,
    track: req.track,
  });
  await notifyCenterOdios(existing.hospitalId || existing.hospital || null,
    `${req.user.name} requested a change to ${existing.name || 'an account'} — awaiting your approval.`);
  return cr;
}

// ── PROGRAMS (global picker with accreditation + capacity usage) ────────────

// GET /api/central/programs?search=&specialtyId=&countryId= — scoped to the CS.
router.get('/programs', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const { search, specialtyId, countryId } = req.query;
    const scope = await csScope(req);
    const query = { isActive: { $ne: false } };
    if (specialtyId) {
      if (!inCsScope(scope, specialtyId)) return res.json({ success: true, data: [] });
      query.specialtyId = specialtyId;
    } else if (!scope.all) {
      query.specialtyId = { $in: scope.ids };
    }
    if (search) query.name = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i');
    if (countryId) {
      const centers = await Hospital.find({ countryId }).select('_id');
      query.trainingCenterId = { $in: centers.map(c => c._id) };
    }

    const programs = await Program.find(query)
      .populate({ path: 'trainingCenterId', select: 'name accreditationNumber countryId dioId', populate: [{ path: 'countryId', select: 'code name' }, { path: 'dioId', select: 'name' }] })
      .populate('specialtyId', 'name nameEn type code')
      .populate('programDirectorId', 'name')
      .populate('subProgramDirectorId', 'name')
      .sort({ createdAt: -1 });

    const hist = await changeHistoryFor(programs.map(p => p._id));
    const data = await Promise.all(programs.map(async p => ({
      ...withAccreditation(p),
      capacityUsed: await capacityUsedFor(p._id),
      changeHistory: hist[String(p._id)] || [],
    })));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[central] programs:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/central/stats — dashboard counts scoped to the CS's specialties.
router.get('/stats', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const scope = await csScope(req);
    const programQuery = { isActive: { $ne: false } };
    if (!scope.all) programQuery.specialtyId = { $in: scope.ids };
    const programs = await Program.find(programQuery).select('_id trainingCenterId programDirectorId');
    const programIds = programs.map(p => p._id);
    const centerIds = [...new Set(programs.map(p => String(p.trainingCenterId)).filter(Boolean))];
    const pdCount = new Set(programs.map(p => p.programDirectorId).filter(Boolean).map(String)).size;

    const traineeQuery = { role: 'trainee', isActive: { $ne: false } };
    if (!scope.all) traineeQuery.$or = [{ specialtyId: { $in: scope.ids } }, { programId: { $in: programIds } }];
    const trainees = await User.find(traineeQuery).select('_id');
    const traineeIds = trainees.map(t => t._id);

    const dioQuery = { role: 'dio_view', isActive: { $ne: false } };
    if (!scope.all) dioQuery.assignedCenterIds = { $in: centerIds };

    const [dios, evaluations, researches, certificates] = await Promise.all([
      User.countDocuments(dioQuery),
      traineeIds.length ? Evaluation.countDocuments({ $or: [{ student: { $in: traineeIds } }, { traineeId: { $in: traineeIds } }] }) : 0,
      traineeIds.length ? Research.countDocuments({ trainee: { $in: traineeIds } }) : 0,
      traineeIds.length ? Certificate.countDocuments({ $or: [{ student: { $in: traineeIds } }, { traineeId: { $in: traineeIds } }], revokedAt: null }) : 0,
    ]);

    res.json({
      success: true,
      data: {
        centers: centerIds.length,
        dios,
        programs: programIds.length,
        programDirectors: pdCount,
        trainees: traineeIds.length,
        evaluations,
        researches,
        certificates,
      },
    });
  } catch (err) {
    console.error('[central] stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/central/countries — dropdown source (all active countries).
router.get('/countries', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const countries = await Country.find({ isActive: { $ne: false } }).sort({ name: 1 });
    res.json({ success: true, data: countries });
  } catch (err) {
    console.error('[central] countries:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/central/centers?search=&countryId= — centers running the CS's
// programs, each with its assigned DIO/Sub-DIO.
router.get('/centers', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const scope = await csScope(req);
    let centerIds = null;
    if (!scope.all) {
      const programs = await Program.find({ specialtyId: { $in: scope.ids }, isActive: { $ne: false } }).select('trainingCenterId');
      centerIds = [...new Set(programs.map(p => String(p.trainingCenterId)).filter(Boolean))];
      if (!centerIds.length) return res.json({ success: true, data: [] });
    }
    const query = {};
    if (centerIds) query._id = { $in: centerIds };
    if (req.query.countryId) query.countryId = req.query.countryId;
    if (req.query.search) query.name = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');

    const centers = await Hospital.find(query)
      .populate('countryId', 'name code').populate('dioId', 'name').populate('subDioId', 'name')
      .sort({ name: 1 });
    const hist = await changeHistoryFor(centers.map(c => c._id));
    res.json({ success: true, data: centers.map(c => ({ ...withAccreditation(c), changeHistory: hist[String(c._id)] || [] })) });
  } catch (err) {
    console.error('[central] centers:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── TRAINEES ────────────────────────────────────────────────────────────────

// Queue a CS trainee edit/delete as an analyzer-reviewed ChangeRequest with a
// required book-of-changes PDF (RULINGS §E22). Scoped to the CS's specialties.
function submitTraineeChange(requestType) {
  return (req, res) => {
    bocUpload.single('bookOfChanges')(req, res, async err => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: 'A book-of-changes PDF is required' });
      const cleanup = () => fs.promises.unlink(req.file.path).catch(() => {});
      try {
        const trainee = await User.findOne({ _id: req.params.id, role: 'trainee' });
        if (!trainee) { cleanup(); return res.status(404).json({ message: 'Trainee not found' }); }

        const scope = await csScope(req);
        if (!inCsScope(scope, trainee.specialtyId)) {
          cleanup();
          return res.status(403).json({ message: 'Trainee is outside your specialty scope' });
        }

        let fields = {};
        if (requestType === 'edit') {
          ROUTE_TARGETS.trainees.fields.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
          if ('name' in fields) {
            fields.name = String(fields.name).trim();
            if (!fields.name) { cleanup(); return res.status(400).json({ message: 'Name cannot be empty' }); }
          }
          if (!Object.keys(fields).length) { cleanup(); return res.status(400).json({ message: 'No changes provided' }); }
        }

        const dup = await ChangeRequest.findOne({ targetId: trainee._id, status: 'pending' });
        if (dup) { cleanup(); return res.status(409).json({ message: 'This trainee already has a pending change awaiting approval' }); }

        const { before, display } = requestType === 'edit'
          ? await buildRegistryChangePayload(fields, trainee)
          : { before: {}, display: [] };

        const cr = await ChangeRequest.create({
          requestedBy: req.user._id,
          requestType,
          targetModel: 'User',
          targetId: trainee._id,
          hospitalId: trainee.hospitalId || trainee.hospital || null,
          routeKey: 'trainees',
          reviewerRole: 'data_analyzer',
          targetLabel: trainee.name || 'Trainee',
          changes: fields,
          before,
          display,
          bookOfChangesPdf: {
            fileUrl: BOC_URL_PREFIX + req.file.filename,
            fileName: decodeOriginalName(req.file),
            sizeBytes: req.file.size,
          },
          specialtyId: trainee.specialtyId || null,
          track: req.track,
        });
        await notifyAnalyzers(`${req.user.name} submitted a ${requestType === 'delete' ? 'deletion' : 'change'} to ${trainee.name || 'a trainee'} for approval.`);
        await writeAudit(req, `central_submit_${requestType}`, 'User', trainee._id, { routeKey: 'trainees' });
        res.status(202).json({ success: true, pending: true, data: viewChangeRequest(cr) });
      } catch (e) {
        cleanup();
        if (e.code === 11000) return res.status(409).json({ message: 'This trainee already has a pending change awaiting approval' });
        console.error('[central] submit trainee change:', e.message);
        res.status(500).json({ message: e.message });
      }
    });
  };
}

// POST /api/central/trainees — direct create (RULINGS §E22). Links the trainee
// to a Program Director (§D19); defaults to the program's PD when none is chosen.
router.post('/trainees', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const { name, idNumber, password, email, phone, city, gender, programId, pdId, startDate, supervisorId, researchSupervisorId } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required' });
    if (!idNumber || !String(idNumber).trim()) return res.status(400).json({ message: 'ID number is required' });
    if (!password || String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (!programId) return res.status(400).json({ message: 'Program is required' });

    const program = await Program.findOne({ _id: programId, isActive: { $ne: false } });
    if (!program) return res.status(400).json({ message: 'Program not found' });

    // A CS may only enroll trainees into programs within its specialty scope.
    const scope = await csScope(req);
    if (!inCsScope(scope, program.specialtyId)) {
      return res.status(403).json({ message: 'Program is outside your specialty scope' });
    }

    // Trainee → PD link (default = the program's PD). An explicit override is
    // restricted to the program's own PD or a PD within the CS's specialty scope.
    let resolvedPdId = program.programDirectorId || null;
    if (pdId) {
      const pd = await User.findOne({ _id: pdId, role: 'program_director', isActive: { $ne: false } }).select('_id specialtyId');
      if (!pd) return res.status(400).json({ message: 'Program director not found or inactive' });
      const isProgramPd = String(pd._id) === String(program.programDirectorId || '');
      if (!isProgramPd && !inCsScope(scope, pd.specialtyId)) {
        return res.status(403).json({ message: 'Program director is outside your specialty scope' });
      }
      resolvedPdId = pd._id;
    }

    const center = await Hospital.findById(program.trainingCenterId).select('countryId dioId');

    // Capacity hard block — no exception request in the advanced flow.
    const used = await capacityUsedFor(program._id);
    if (used >= program.yearlyCapacity) {
      return res.status(409).json({
        message: `Program is at capacity (${used}/${program.yearlyCapacity})`,
        capacityFull: true, used, capacity: program.yearlyCapacity,
      });
    }

    // Trainer is OPTIONAL in v2; when given it must be an active supervisor of
    // the SAME program.
    let resolvedSupervisorId = null;
    if (supervisorId) {
      const sup = await User.findOne({ _id: supervisorId, role: 'supervisor', isActive: { $ne: false } }).select('programId');
      if (!sup) return res.status(400).json({ message: 'Supervisor not found or inactive' });
      if (String(sup.programId) !== String(program._id)) {
        return res.status(403).json({ message: 'Supervisor must belong to the selected program' });
      }
      resolvedSupervisorId = sup._id;
    }

    // Research trainer: optional; may be a supervisor OR a program director;
    // defaults to the program's PD when absent.
    let resolvedResearchId = null;
    if (researchSupervisorId) {
      const rs = await User.findOne({
        _id: researchSupervisorId,
        role: { $in: ['supervisor', 'program_director'] },
        isActive: { $ne: false },
      }).select('role programId specialtyId');
      if (!rs) return res.status(400).json({ message: 'Research supervisor not found or inactive' });
      // A supervisor research trainer must belong to the program (mirrors supervisorId);
      // a PD must be the program's own PD or within the CS's specialty scope.
      if (rs.role === 'supervisor' && String(rs.programId) !== String(program._id)) {
        return res.status(403).json({ message: 'Research supervisor must belong to the selected program' });
      }
      if (rs.role === 'program_director') {
        const isProgramPd = String(rs._id) === String(program.programDirectorId || '');
        if (!isProgramPd && !inCsScope(scope, rs.specialtyId)) {
          return res.status(403).json({ message: 'Research supervisor is outside your specialty scope' });
        }
      }
      resolvedResearchId = rs._id;
    } else {
      resolvedResearchId = program.programDirectorId || null;
    }

    const payload = {
      name: String(name).trim(),
      idNumber: String(idNumber).trim(),
      password: String(password),
      role: 'trainee',
      programId: program._id,
      hospitalId: program.trainingCenterId,
      hospital: program.trainingCenterId,          // legacy alias
      countryId: center?.countryId || null,
      dioId: center?.dioId || null,                 // auto-assigned: the training centre's DIO
      specialtyId: program.specialtyId,
      pdId: resolvedPdId,                            // auto-assigned: the program's PD
      enrolledSince: startDate ? new Date(startDate) : new Date(),
      supervisorId: resolvedSupervisorId,
      supervisor: resolvedSupervisorId,             // legacy alias
      researchSupervisorId: resolvedResearchId,
    };
    if (email && String(email).trim()) payload.email = String(email).trim();
    if (phone !== undefined) payload.phone = String(phone).trim();
    if (city !== undefined) payload.city = String(city).trim();
    if (gender !== undefined) payload.gender = gender;

    const user = new User(payload);
    await user.save();
    await writeAudit(req, 'central_create_trainee', 'User', user._id, { programId: String(program._id), fields: Object.keys(payload) });

    const saved = await User.findById(user._id).select('-password')
      .populate('programId', 'name')
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name')
      .populate('pdId', 'name')
      .populate('supervisorId', 'name')
      .populate('researchSupervisorId', 'name');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    console.error('[central] create trainee:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/central/trainees — CS-scoped list; injects trainingYear + change history.
router.get('/trainees', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const { search, programId, specialtyId, countryId, includeInactive } = req.query;
    const scope = await csScope(req);
    const query = { role: 'trainee' };
    if (includeInactive !== 'true') query.isActive = { $ne: false };
    if (programId) query.programId = programId;
    if (specialtyId) {
      if (!inCsScope(scope, specialtyId)) return res.json({ success: true, data: [] });
      query.specialtyId = specialtyId;
    } else if (!scope.all) {
      query.specialtyId = { $in: scope.ids };
    }
    if (countryId) query.countryId = countryId;
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { idNumber: rx }, { email: rx }];
    }

    const trainees = await User.find(query).select('-password')
      .populate('programId', 'name')
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name')
      .populate('pdId', 'name')
      .populate('supervisorId', 'name')
      .populate('researchSupervisorId', 'name')
      .sort({ name: 1 });

    const hist = await changeHistoryFor(trainees.map(t => t._id));
    const data = trainees.map(t => ({ ...t.toObject(), trainingYear: trainingYear(t), changeHistory: hist[String(t._id)] || [] }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[central] list trainees:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/central/trainees/:id — edit queued as a ChangeRequest with a required
// book-of-changes PDF, reviewed by the Data Analyzer (RULINGS §E22).
router.patch('/trainees/:id', auth, allowRoles(...CENTRAL_ROLES), submitTraineeChange('edit'));
// DELETE /api/central/trainees/:id — delete queued (analyzer approval + PDF).
router.delete('/trainees/:id', auth, allowRoles(...CENTRAL_ROLES), submitTraineeChange('delete'));

// ── TRAINERS ──────────────────────────────────────────────────────────────

// POST /api/central/trainers
router.post('/trainers', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const { name, idNumber, password, email, phone, city, gender, programId } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required' });
    if (!idNumber || !String(idNumber).trim()) return res.status(400).json({ message: 'ID number is required' });
    if (!password || String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (!programId) return res.status(400).json({ message: 'Program is required' });

    const program = await Program.findOne({ _id: programId, isActive: { $ne: false } });
    if (!program) return res.status(400).json({ message: 'Program not found' });
    const center = await Hospital.findById(program.trainingCenterId).select('countryId');

    const payload = {
      name: String(name).trim(),
      idNumber: String(idNumber).trim(),
      password: String(password),
      role: 'supervisor',
      programId: program._id,
      hospitalId: program.trainingCenterId,
      hospital: program.trainingCenterId,          // legacy alias
      countryId: center?.countryId || null,
      specialtyId: program.specialtyId,
    };
    if (email && String(email).trim()) payload.email = String(email).trim();
    if (phone !== undefined) payload.phone = String(phone).trim();
    if (city !== undefined) payload.city = String(city).trim();
    if (gender !== undefined) payload.gender = gender;

    const user = new User(payload);
    await user.save();
    await writeAudit(req, 'central_create_trainer', 'User', user._id, { programId: String(program._id), fields: Object.keys(payload) });

    const saved = await User.findById(user._id).select('-password')
      .populate('programId', 'name')
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    console.error('[central] create trainer:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/central/trainers — global list.
router.get('/trainers', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const { search, programId, specialtyId, countryId, includeInactive } = req.query;
    const query = { role: 'supervisor' };
    if (includeInactive !== 'true') query.isActive = { $ne: false };
    if (programId) query.programId = programId;
    if (specialtyId) query.specialtyId = specialtyId;
    if (countryId) query.countryId = countryId;
    if (search) {
      const rx = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { idNumber: rx }, { email: rx }];
    }

    const trainers = await User.find(query).select('-password')
      .populate('programId', 'name')
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: trainers });
  } catch (err) {
    console.error('[central] list trainers:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/central/trainers/:id — queued as a ChangeRequest (ODIO approves).
router.patch('/trainers/:id', auth, allowRoles(...CENTRAL_ROLES), (req, res) => handleEdit(req, res, 'supervisors', 'supervisor'));

// Shared edit handler: allowlist-pick, keep the legacy supervisor alias in sync
// (trainer optional → may be cleared), enforce one pending CR per target, queue.
async function handleEdit(req, res, routeKey, role) {
  try {
    const existing = await User.findOne({ _id: req.params.id, role });
    if (!existing) return res.status(404).json({ message: role === 'trainee' ? 'Trainee not found' : 'Trainer not found' });

    const fields = {};
    EDIT_FIELDS.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
    if ('name' in fields) {
      fields.name = String(fields.name).trim();
      if (!fields.name) return res.status(400).json({ message: 'Name cannot be empty' });
    }
    if ('phone' in fields) fields.phone = String(fields.phone).trim();
    if ('city' in fields) fields.city = String(fields.city).trim();
    // Trainer is optional in v2: supervisorId may be set OR cleared (null).
    if ('supervisorId' in fields) {
      if (fields.supervisorId === '' || fields.supervisorId === null) fields.supervisorId = null;
      fields.supervisor = fields.supervisorId;                 // keep legacy alias in sync (may be null)
    }
    if ('researchSupervisorId' in fields && fields.researchSupervisorId === '') fields.researchSupervisorId = null;

    if (!Object.keys(fields).length) return res.status(400).json({ message: 'No changes provided' });

    const dup = await ChangeRequest.findOne({ targetId: existing._id, status: 'pending' });
    if (dup) return res.status(409).json({ message: 'This account already has a pending change awaiting approval' });

    const cr = await queueChangeRequest({ req, routeKey, existing, fields });
    res.status(202).json({ success: true, pending: true, data: viewChangeRequest(cr) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This account already has a pending change awaiting approval' });
    console.error('[central] edit:', err.message);
    res.status(500).json({ message: err.message });
  }
}

// ── SELF-SERVICE CHANGE REQUESTS ────────────────────────────────────────────

// GET /api/central/change-requests — the central secretary's own requests.
router.get('/change-requests', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    const query = { requestedBy: req.user._id };
    if (req.query.status) query.status = req.query.status;
    if (req.query.requestType) query.requestType = req.query.requestType;
    const items = await ChangeRequest.find(query)
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: items.map(viewChangeRequest) });
  } catch (err) {
    console.error('[central] change-requests:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/central/change-requests/:id/cancel — withdraw a pending request.
router.patch('/change-requests/:id/cancel', auth, allowRoles(...CENTRAL_ROLES), async (req, res) => {
  try {
    // Atomic cancel so it competes with approve on the same status:'pending'
    // predicate — one side deterministically wins the race.
    const cr = await ChangeRequest.findOneAndUpdate(
      { _id: req.params.id, requestedBy: req.user._id, status: 'pending' },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!cr) return res.status(404).json({ message: 'Pending request not found' });
    res.json({ success: true, data: viewChangeRequest(cr) });
  } catch (err) {
    console.error('[central] cancel change-request:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
