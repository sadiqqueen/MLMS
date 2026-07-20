// backend/routes/analyzer.js
// Mounted at /api/analyzer in server.js.
// Data analyzer (+ super_admin): a filterable dashboard over the advanced track
// plus creation/management of Data-entry clerks and Central secretaries.
const router         = require('express').Router();
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { coerceRoleToTrack, trackFilter } = require('../utils/track');
const { decodeOriginalName } = require('../utils/filename');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const { changeHistoryFor } = require('../utils/changeHistory');
const { applyChangeRequest } = require('../utils/applyChangeRequest');
const { runSnapshot, RANGES, SNAPSHOTS_DIR } = require('../jobs/snapshots');
const { trainingYear } = require('../utils/trainingYear');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Specialty      = require('../models/Specialty');
const Country        = require('../models/Country');
const Program        = require('../models/Program');
const AuditLog       = require('../models/AuditLog');
const DataSnapshot   = require('../models/DataSnapshot');
const AnalysisReport = require('../models/AnalysisReport');
const Notification   = require('../models/Notification');
const ChangeRequest  = require('../models/ChangeRequest');
const Certificate    = require('../models/Certificate');
const Evaluation     = require('../models/Evaluation');
const Research       = require('../models/Research');
const ScientificCouncil = require('../models/ScientificCouncil');

const ANALYZER_ROLES = ['data_analyzer', 'super_admin'];
// The only account types the legacy /staff endpoint creates/manages. Creation of
// clerks/CS is also a developer (adminV2) capability in the redesign (RULINGS §37);
// this endpoint is retained and now persists CS council/type when present.
const STAFF_ROLES = ['data_entry', 'central_secretary'];

function withAccreditation(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, accreditationExpiry: accreditationExpiry(o), accreditationStatus: accreditationStatus(o) };
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
  }).catch(err => console.error('[AuditLog] Failed to write analyzer audit:', err.message));
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

// ── Analysis-report uploads (pdf / ppt / pptx) ─────────────────────────────
// Same multer-in-handler rigor as routes/eventFeedback.js: ext AND mime are
// both checked (octet-stream tolerated), 15MB cap, unique disk filename.
const reportsDir = path.join(__dirname, '../uploads/analysis-reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const reportStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reportsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});
const uploadReport = multer({
  storage: reportStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okExt = /\.(pdf|ppt|pptx)$/i.test(path.extname(file.originalname).toLowerCase());
    const okMime = /pdf|powerpoint|presentation|officedocument|octet-stream/.test(file.mimetype);
    okExt && okMime ? cb(null, true) : cb(new Error('Only PDF or PowerPoint (ppt/pptx) files are allowed'));
  },
});

// GET /api/analyzer/stats?countryId=&city=&specialtyId=
router.get('/stats', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const { countryId, city, specialtyId } = req.query;

    // Center ids for the selected country (used to scope programs by center).
    let programCenterIds = null;
    if (countryId) {
      programCenterIds = (await Hospital.find({ countryId }).select('_id')).map(c => c._id);
    }

    const traineeMatch = { role: coerceRoleToTrack('trainee', req.track), isActive: { $ne: false } };
    const trainerMatch = { role: coerceRoleToTrack('supervisor', req.track), isActive: { $ne: false } };
    const pdMatch      = { role: coerceRoleToTrack('program_director', req.track), isActive: { $ne: false } };
    if (countryId) { traineeMatch.countryId = countryId; trainerMatch.countryId = countryId; }
    if (specialtyId) { traineeMatch.specialtyId = specialtyId; trainerMatch.specialtyId = specialtyId; pdMatch.specialtyId = specialtyId; }

    const dioMatch = { role: 'dio_view', isActive: { $ne: false } };
    if (countryId) dioMatch.countryId = countryId;
    const odioMatch = { role: coerceRoleToTrack('dio', req.track), ...trackFilter(req.track), isActive: { $ne: false } };
    if (countryId) odioMatch.countryId = countryId;

    const centerMatch = { ...trackFilter(req.track) };
    if (countryId) centerMatch.countryId = countryId;
    if (city && String(city).trim()) {
      centerMatch.city = new RegExp('^' + escapeRegex(String(city).trim()) + '$', 'i');
    }

    const programMatch = { isActive: { $ne: false } };
    if (specialtyId) programMatch.specialtyId = specialtyId;
    if (countryId) programMatch.trainingCenterId = { $in: programCenterIds };

    const [
      trainees, trainers, programDirectors, dios, odios,
      centers, programs, specialties, countries,
      clerks, centralSecretaries, hocs,
      certificates, evaluations, researches, pendingChangeRequests
    ] = await Promise.all([
      User.countDocuments(traineeMatch),
      User.countDocuments(trainerMatch),
      User.countDocuments(pdMatch),
      User.countDocuments(dioMatch),
      User.countDocuments(odioMatch),
      Hospital.countDocuments(centerMatch),
      Program.countDocuments(programMatch),
      Specialty.countDocuments({ ...trackFilter(req.track), isActive: { $ne: false } }),
      Country.countDocuments({ isActive: { $ne: false } }),
      User.countDocuments({ role: 'data_entry', isActive: { $ne: false } }),
      User.countDocuments({ role: 'central_secretary', isActive: { $ne: false } }),
      User.countDocuments({ role: 'hoc', isActive: { $ne: false } }),
      Certificate.countDocuments({ ...trackFilter(req.track), revokedAt: null }),
      Evaluation.countDocuments({ ...trackFilter(req.track) }),
      Research.countDocuments({}),
      ChangeRequest.countDocuments({ reviewerRole: 'data_analyzer', status: 'pending' }),
    ]);

    res.json({
      success: true,
      data: {
        trainees, trainers, programDirectors, dios, odios, centers, programs, specialties, countries,
        clerks, centralSecretaries, hocs, certificates, evaluations, researches, pendingChangeRequests,
      }
    });
  } catch (err) {
    console.error('[analyzer] stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/analyzer/staff — create a Data-entry clerk or Central secretary.
router.post('/staff', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const { name, idNumber, password, email, phone, role, secretaryType, councilId } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required' });
    if (!idNumber || !String(idNumber).trim()) return res.status(400).json({ message: 'ID number is required' });
    if (!password || String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Role must be data_entry or central_secretary' });
    }

    const payload = {
      name: String(name).trim(),
      idNumber: String(idNumber).trim(),
      password: String(password),
      role,
    };
    if (email && String(email).trim()) payload.email = String(email).trim();
    if (phone !== undefined) payload.phone = String(phone).trim();

    // Central secretary council assignment (RULINGS §40): 'main' → councilId
    // required; 'precise' → covers every precise specialty, no council.
    if (role === 'central_secretary') {
      const st = secretaryType === 'precise' ? 'precise' : 'main';
      payload.secretaryType = st;
      if (st === 'main') {
        if (!councilId) return res.status(400).json({ message: 'A main central secretary requires a council' });
        if (!(await ScientificCouncil.findById(councilId).select('_id'))) {
          return res.status(400).json({ message: 'Council not found' });
        }
        payload.councilId = councilId;
      }
    }

    const user = new User(payload);
    await user.save();
    await writeAudit(req, 'analyzer_create_staff', 'User', user._id, { role, fields: Object.keys(payload) });

    const saved = await User.findById(user._id).select('-password');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    console.error('[analyzer] create staff:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analyzer/staff?includeInactive=true
router.get('/staff', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { role: { $in: STAFF_ROLES } };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };
    const users = await User.find(query).select('-password').sort({ role: 1, name: 1 });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[analyzer] list staff:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/analyzer/staff/:id — edit a staff account (only the two staff roles).
router.patch('/staff/:id', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const existing = await User.findById(req.params.id).select('role');
    if (!existing || !STAFF_ROLES.includes(existing.role)) {
      return res.status(404).json({ message: 'Staff account not found' });
    }

    const update = {};
    const unset = {};
    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      update.name = String(req.body.name).trim();
    }
    if (req.body.phone !== undefined) update.phone = String(req.body.phone).trim();
    if (req.body.email !== undefined) {
      const em = req.body.email == null ? '' : String(req.body.email).trim();
      if (em) update.email = em; else unset.email = 1;   // clearing → unset, never ''
    }
    if (req.body.locked !== undefined) update.locked = !!req.body.locked;
    if (req.body.isActive !== undefined) update.isActive = !!req.body.isActive;

    const finalUpdate = { ...update };
    if (Object.keys(unset).length) finalUpdate.$unset = unset;

    const user = await User.findByIdAndUpdate(req.params.id, finalUpdate, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Staff account not found' });
    await writeAudit(req, 'analyzer_update_staff', 'User', user._id, { fields: [...Object.keys(update), ...Object.keys(unset)] });
    res.json({ success: true, data: user });
  } catch (err) {
    if (handleDuplicate(err, res)) return;
    console.error('[analyzer] update staff:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── READ-ONLY REGISTRY LISTS ────────────────────────────────────────────────
// Every list below is READ-ONLY (RULINGS §37). Creation/edits stay with the
// developer/clerk/CS; the analyzer only observes + approves.

function cityFilter(city) {
  return city && String(city).trim()
    ? new RegExp('^' + escapeRegex(String(city).trim()) + '$', 'i')
    : null;
}

// GET /api/analyzer/countries
router.get('/countries', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const countries = await Country.find({ isActive: { $ne: false } }).sort({ name: 1 });
    const centerCounts = await Hospital.aggregate([
      { $match: { isActive: { $ne: false } } },
      { $group: { _id: '$countryId', count: { $sum: 1 } } },
    ]);
    const byCountry = new Map(centerCounts.map(c => [String(c._id), c.count]));
    const data = countries.map(c => ({ ...c.toObject(), centersCount: byCountry.get(String(c._id)) || 0 }));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/centers?countryId=&city=&search=
router.get('/centers', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { ...trackFilter(req.track) };
    if (req.query.countryId) query.countryId = req.query.countryId;
    const city = cityFilter(req.query.city);
    if (city) query.city = city;
    if (req.query.search) query.name = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
    const centers = await Hospital.find(query)
      .populate('countryId', 'name code').populate('dioId', 'name').populate('subDioId', 'name')
      .sort({ name: 1 });
    const centerIds = centers.map(c => c._id);
    const [hist, programCounts, traineeCounts] = await Promise.all([
      changeHistoryFor(centerIds),
      Program.aggregate([
        { $match: { trainingCenterId: { $in: centerIds }, isActive: { $ne: false } } },
        { $group: { _id: '$trainingCenterId', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: 'trainee', isActive: { $ne: false }, hospitalId: { $in: centerIds } } },
        { $group: { _id: '$hospitalId', count: { $sum: 1 } } },
      ]),
    ]);
    const progByCenter = new Map(programCounts.map(p => [String(p._id), p.count]));
    const traineeByCenter = new Map(traineeCounts.map(t => [String(t._id), t.count]));
    res.json({
      success: true,
      data: centers.map(c => ({
        ...withAccreditation(c),
        changeHistory: hist[String(c._id)] || [],
        programsCount: progByCenter.get(String(c._id)) || 0,
        traineesCount: traineeByCenter.get(String(c._id)) || 0,
      })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/dios?countryId=&city=&centerId= — DIOs + their ODIOs/Sub-DIOs.
router.get('/dios', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const dioQuery = { role: 'dio_view', isActive: { $ne: false } };
    if (req.query.countryId) dioQuery.countryId = req.query.countryId;
    const city = cityFilter(req.query.city);
    if (city) dioQuery.city = city;
    if (req.query.centerId) dioQuery.assignedCenterIds = req.query.centerId;

    const dios = await User.find(dioQuery).select('-password')
      .populate('countryId', 'name code').populate('assignedCenterIds', 'name').sort({ name: 1 });
    const dioIds = dios.map(d => d._id);
    const [odios, subDios] = await Promise.all([
      User.find({ role: 'dio', dioId: { $in: dioIds }, isActive: { $ne: false } })
        .select('-password').populate('dioId', 'name').sort({ name: 1 }),
      User.find({ role: 'sub_dio', dioId: { $in: dioIds }, isActive: { $ne: false } })
        .select('-password').populate('dioId', 'name').sort({ name: 1 }),
    ]);
    const hist = await changeHistoryFor([...dioIds, ...odios.map(o => o._id), ...subDios.map(s => s._id)]);
    const stamp = u => ({ ...u.toObject(), changeHistory: hist[String(u._id)] || [] });
    res.json({ success: true, data: { dios: dios.map(stamp), odios: odios.map(stamp), subDios: subDios.map(stamp) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/programs?countryId=&city=&centerId=&specialtyId=&search=
router.get('/programs', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { isActive: { $ne: false } };
    if (req.query.specialtyId) query.specialtyId = req.query.specialtyId;
    if (req.query.centerId) query.trainingCenterId = req.query.centerId;
    if (req.query.search) query.name = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
    if (req.query.countryId || cityFilter(req.query.city)) {
      const cq = {};
      if (req.query.countryId) cq.countryId = req.query.countryId;
      const city = cityFilter(req.query.city);
      if (city) cq.city = city;
      const centers = await Hospital.find(cq).select('_id');
      const ids = centers.map(c => c._id);
      query.trainingCenterId = query.trainingCenterId
        ? (ids.some(id => String(id) === String(query.trainingCenterId)) ? query.trainingCenterId : null)
        : { $in: ids };
    }
    const programs = await Program.find(query)
      .populate({ path: 'trainingCenterId', select: 'name accreditationNumber countryId city', populate: { path: 'countryId', select: 'code name' } })
      .populate('specialtyId', 'name nameEn type code')
      .populate('programDirectorId', 'name')
      .populate('subProgramDirectorId', 'name')
      .sort({ createdAt: -1 });
    const hist = await changeHistoryFor(programs.map(p => p._id));
    res.json({ success: true, data: programs.map(p => ({ ...withAccreditation(p), changeHistory: hist[String(p._id)] || [] })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/pds?specialtyId=&programId=&search= — PDs + their Sub-PDs.
router.get('/pds', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { role: 'program_director', isActive: { $ne: false } };
    if (req.query.specialtyId) query.specialtyId = req.query.specialtyId;
    if (req.query.search) query.name = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
    if (req.query.programId) {
      const prog = await Program.findById(req.query.programId).select('programDirectorId');
      query._id = prog ? prog.programDirectorId : null;
    }
    const pds = await User.find(query).select('-password').populate('specialtyId', 'name').populate('countryId', 'name code').sort({ name: 1 });
    const subPds = await User.find({ role: 'sub_pd', pdId: { $in: pds.map(p => p._id) }, isActive: { $ne: false } })
      .select('-password').populate('specialtyId', 'name').populate('pdId', 'name').sort({ name: 1 });
    const hist = await changeHistoryFor([...pds.map(p => p._id), ...subPds.map(s => s._id)]);
    const stamp = u => ({ ...u.toObject(), changeHistory: hist[String(u._id)] || [] });
    res.json({ success: true, data: { pds: pds.map(stamp), subPds: subPds.map(stamp) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/clerks
router.get('/clerks', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { role: 'data_entry' };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };
    const clerks = await User.find(query).select('-password').sort({ name: 1 });
    const hist = await changeHistoryFor(clerks.map(c => c._id));
    res.json({ success: true, data: clerks.map(c => ({ ...c.toObject(), changeHistory: hist[String(c._id)] || [] })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/central-secretaries — CS accounts with council + type.
router.get('/central-secretaries', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { role: 'central_secretary' };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };
    const list = await User.find(query).select('-password').populate('councilId', 'name nameEn').sort({ name: 1 });
    const hist = await changeHistoryFor(list.map(c => c._id));
    res.json({ success: true, data: list.map(c => ({ ...c.toObject(), changeHistory: hist[String(c._id)] || [] })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/hocs — Heads of Council with their council.
router.get('/hocs', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { role: 'hoc' };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };
    const list = await User.find(query).select('-password').populate('councilId', 'name nameEn').sort({ name: 1 });
    const hist = await changeHistoryFor(list.map(h => h._id));
    res.json({ success: true, data: list.map(h => ({ ...h.toObject(), changeHistory: hist[String(h._id)] || [] })) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/councils — the 20 Scientific Councils (for the Add-specialty
// council selector). Read-only reference list.
router.get('/councils', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const councils = await ScientificCouncil.find({}).select('name nameEn').sort({ name: 1 });
    res.json({ success: true, data: councils });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/specialties?type=&councilId= — with council label.
router.get('/specialties', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { ...trackFilter(req.track), isActive: { $ne: false } };
    if (req.query.type) query.type = req.query.type;
    if (req.query.councilId) query.councilId = req.query.councilId;
    const specialties = await Specialty.find(query).populate('councilId', 'name nameEn').sort({ type: 1, name: 1 });
    const programCounts = await Program.aggregate([
      { $match: { specialtyId: { $in: specialties.map(s => s._id) }, isActive: { $ne: false } } },
      { $group: { _id: '$specialtyId', count: { $sum: 1 } } },
    ]);
    const byId = new Map(programCounts.map(p => [String(p._id), p.count]));
    const data = specialties.map(s => ({ ...s.toObject(), programsCount: byId.get(String(s._id)) || 0 }));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/analyzer/trainees?countryId=&city=&centerId=&specialtyId=&programId=&search=
router.get('/trainees', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { role: coerceRoleToTrack('trainee', req.track), isActive: { $ne: false } };
    if (req.query.countryId) query.countryId = req.query.countryId;
    if (req.query.specialtyId) query.specialtyId = req.query.specialtyId;
    if (req.query.programId) query.programId = req.query.programId;
    if (req.query.centerId) query.$or = [{ hospitalId: req.query.centerId }, { hospital: req.query.centerId }];
    const city = cityFilter(req.query.city);
    if (city) query.city = city;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
      const search = [{ name: rx }, { idNumber: rx }, { studentId: rx }];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: search }];
        delete query.$or;
      } else {
        query.$or = search;
      }
    }
    const trainees = await User.find(query).select('-password')
      .populate('programId', 'name').populate('hospitalId', 'name').populate('specialtyId', 'name')
      .populate('pdId', 'name').populate('countryId', 'name code').sort({ name: 1 }).limit(1000);
    const hist = await changeHistoryFor(trainees.map(t => t._id));
    const data = trainees.map(t => ({ ...t.toObject(), trainingYear: trainingYear(t), changeHistory: hist[String(t._id)] || [] }));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PENDING CHANGES INBOX (analyzer-reviewed clerk/CS requests) ──────────────

function viewChangeRequest(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  if (o.changes && typeof o.changes === 'object') { const c = { ...o.changes }; delete c.password; o.changes = c; }
  return o;
}

// GET /api/analyzer/change-requests?status=pending|approved|rejected
router.get('/change-requests', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const query = { reviewerRole: 'data_analyzer', ...trackFilter(req.track) };
    if (req.query.status) query.status = req.query.status;
    if (req.query.requestType) query.requestType = req.query.requestType;
    const items = await ChangeRequest.find(query)
      .populate('requestedBy', 'name role')
      .populate('reviewedBy', 'name')
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name')
      .sort({ createdAt: -1 })
      .limit(300);
    res.json({ success: true, data: items.map(viewChangeRequest) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/analyzer/change-requests/:id/approve — apply + notify requester.
router.patch('/change-requests/:id/approve', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const cr = await ChangeRequest.findOne({ _id: req.params.id, status: 'pending', reviewerRole: 'data_analyzer' });
    if (!cr) return res.status(404).json({ success: false, message: 'Pending request not found' });

    let updated;
    try {
      updated = await applyChangeRequest(cr);
    } catch (applyErr) {
      return res.status(applyErr.status || 400).json({ success: false, message: applyErr.message });
    }

    cr.status = 'approved';
    cr.reviewedBy = req.user._id;
    cr.reviewedAt = new Date();
    if (req.body && req.body.note) cr.reviewNote = String(req.body.note);
    await cr.save();
    await writeAudit(req, 'analyzer_approve_change_request', 'ChangeRequest', cr._id, { routeKey: cr.routeKey, requestType: cr.requestType, targetId: cr.targetId });
    await Notification.create({
      user: cr.requestedBy,
      message: `Your ${cr.requestType === 'delete' ? 'deletion of' : 'change to'} ${cr.targetLabel || 'a record'} was approved by the Data Analyzer.`,
      category: 'promotions',
    }).catch(() => {});
    res.json({ success: true, data: { changeRequest: viewChangeRequest(cr), target: updated } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/analyzer/change-requests/:id/reject — note REQUIRED.
router.patch('/change-requests/:id/reject', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const note = req.body && req.body.note;
    if (!note || !String(note).trim()) return res.status(400).json({ success: false, message: 'A rejection note is required' });
    const cr = await ChangeRequest.findOne({ _id: req.params.id, status: 'pending', reviewerRole: 'data_analyzer' });
    if (!cr) return res.status(404).json({ success: false, message: 'Pending request not found' });

    cr.status = 'rejected';
    cr.reviewedBy = req.user._id;
    cr.reviewedAt = new Date();
    cr.reviewNote = String(note).trim();
    await cr.save();
    await writeAudit(req, 'analyzer_reject_change_request', 'ChangeRequest', cr._id, { routeKey: cr.routeKey, requestType: cr.requestType });
    await Notification.create({
      user: cr.requestedBy,
      message: `Your ${cr.requestType === 'delete' ? 'deletion of' : 'change to'} ${cr.targetLabel || 'a record'} was rejected by the Data Analyzer.`,
      category: 'promotions',
    }).catch(() => {});
    res.json({ success: true, data: viewChangeRequest(cr) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── SNAPSHOTS ──────────────────────────────────────────────────────────────

// GET /api/analyzer/snapshots — the generated snapshot files, newest first.
router.get('/snapshots', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const snapshots = await DataSnapshot.find().sort({ createdAt: -1 }).limit(1000);
    res.json({ success: true, data: snapshots });
  } catch (err) {
    console.error('[analyzer] snapshots list:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/analyzer/snapshots/:id/download — stream a stored CSV. The path is
// built ONLY from the stored fileName joined under uploads/snapshots; no
// client-supplied path is ever used, and the resolved path must stay inside it.
router.get('/snapshots/:id/download', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const snap = await DataSnapshot.findById(req.params.id);
    if (!snap) return res.status(404).json({ message: 'Snapshot not found' });
    const baseDir = path.resolve(SNAPSHOTS_DIR);
    const abs = path.resolve(baseDir, snap.fileName);
    if (abs !== baseDir && !abs.startsWith(baseDir + path.sep)) {
      return res.status(400).json({ message: 'Invalid snapshot path' });
    }
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'Snapshot file missing on disk' });
    res.download(abs, path.basename(snap.fileName));
  } catch (err) {
    console.error('[analyzer] snapshot download:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/analyzer/snapshots/run  { range } — run a snapshot now (first-run /
// testing). Returns 202 with the created DataSnapshot documents.
router.post('/snapshots/run', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const { range } = req.body || {};
    if (!RANGES.includes(range)) {
      return res.status(400).json({ message: 'range must be weekly, monthly, or yearly' });
    }
    const created = await runSnapshot(range);
    await writeAudit(req, 'analyzer_run_snapshot', 'DataSnapshot', null, { range, files: created.length });
    res.status(202).json({ success: true, data: created });
  } catch (err) {
    console.error('[analyzer] run snapshot:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── ANALYSIS REPORTS ───────────────────────────────────────────────────────

// POST /api/analyzer/analysis-reports — upload a PDF/PPTX report for the
// Secretary General + Assistant Secretary inbox. Multer runs inside the handler
// so filter/size errors surface as 400 (never 500).
router.post('/analysis-reports', auth, allowRoles(...ANALYZER_ROLES), (req, res) => {
  uploadReport.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    try {
      const range = req.body && req.body.range;
      if (!RANGES.includes(range)) {
        fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ message: 'range must be weekly, monthly, or yearly' });
      }

      const report = await AnalysisReport.create({
        range,
        name: decodeOriginalName(req.file),
        url: `/uploads/analysis-reports/${req.file.filename}`,
        fileId: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedBy: req.user._id,
      });

      // Notify every active Secretary General + Assistant Secretary. The message
      // contains the word 'report' so Navbar's notifLink can route it.
      const recipients = await User.find({
        role: { $in: ['secretary_general', 'assistant_secretary'] },
        isActive: { $ne: false },
      }).select('_id');
      await Promise.all(recipients.map(u =>
        Notification.create({
          user: u._id,
          message: `New analysis report uploaded: ${report.name}`,
          category: 'reports',
        }).catch(() => {})
      ));

      await writeAudit(req, 'analyzer_upload_report', 'AnalysisReport', report._id, { range, name: report.name });
      res.status(201).json({ success: true, data: report });
    } catch (e) {
      fs.promises.unlink(req.file.path).catch(() => {});
      console.error('[analyzer] upload report:', e.message);
      res.status(500).json({ message: e.message });
    }
  });
});

// GET /api/analyzer/analysis-reports — the analyzer's own uploads, newest first.
router.get('/analysis-reports', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const reports = await AnalysisReport.find({ uploadedBy: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error('[analyzer] list reports:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
