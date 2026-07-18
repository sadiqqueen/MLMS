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
const { runSnapshot, RANGES, SNAPSHOTS_DIR } = require('../jobs/snapshots');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Specialty      = require('../models/Specialty');
const Country        = require('../models/Country');
const Program        = require('../models/Program');
const AuditLog       = require('../models/AuditLog');
const DataSnapshot   = require('../models/DataSnapshot');
const AnalysisReport = require('../models/AnalysisReport');
const Notification   = require('../models/Notification');

const ANALYZER_ROLES = ['data_analyzer', 'super_admin'];
// The only account types a data analyzer creates/manages.
const STAFF_ROLES = ['data_entry', 'central_secretary'];

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
      centers, programs, specialties, countries
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
    ]);

    res.json({
      success: true,
      data: { trainees, trainers, programDirectors, dios, odios, centers, programs, specialties, countries }
    });
  } catch (err) {
    console.error('[analyzer] stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/analyzer/staff — create a Data-entry clerk or Central secretary.
router.post('/staff', auth, allowRoles(...ANALYZER_ROLES), async (req, res) => {
  try {
    const { name, idNumber, password, email, phone, role } = req.body;
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
