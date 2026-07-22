// backend/routes/sg.js
// Mounted at /api/sg in server.js.
// Secretary General + Assistant Secretary (+ super_admin): a STRICTLY read-only
// (GET only) oversight suite over the advanced track. No user list ever returns
// tier-0/3 accounts (super_admin, data_analyzer) — the role-scoped queries make
// that inherent — and passwords are never selected.
const router         = require('express').Router();
const path           = require('path');
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { coerceRoleToTrack, trackFilter } = require('../utils/track');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const { trainingYear } = require('../utils/trainingYear');
const User      = require('../models/User');
const Hospital  = require('../models/Hospital');
const Specialty = require('../models/Specialty');
const Country   = require('../models/Country');
const Program   = require('../models/Program');
const AnalysisReport = require('../models/AnalysisReport');

// Analysis-report files live here; downloads are served by stored fileId only.
const reportsDir = path.join(__dirname, '../uploads/analysis-reports');

const SG_ROLES = ['secretary_general', 'assistant_secretary', 'developer'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Inject computed accreditation fields (never stored for programs; centers may
// carry a stored expiry).
function withAccreditation(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, accreditationExpiry: accreditationExpiry(o), accreditationStatus: accreditationStatus(o) };
}

// Same aggregate shape as /api/analyzer/stats. Factored here (not shared with
// analyzer.js by design) so this read-only suite never depends on that route.
async function buildStats(req) {
  const { countryId, city, specialtyId } = req.query;

  let programCenterIds = null;
  if (countryId) {
    programCenterIds = (await Hospital.find({ countryId }).select('_id')).map(c => c._id);
  }

  const traineeMatch = { role: coerceRoleToTrack('trainee', req.track), isActive: { $ne: false } };
  const trainerMatch = { role: coerceRoleToTrack('trainer', req.track), isActive: { $ne: false } };
  const pdMatch      = { role: coerceRoleToTrack('program_director', req.track), isActive: { $ne: false } };
  if (countryId) { traineeMatch.countryId = countryId; trainerMatch.countryId = countryId; }
  if (specialtyId) { traineeMatch.specialtyId = specialtyId; trainerMatch.specialtyId = specialtyId; pdMatch.specialtyId = specialtyId; }

  const dioMatch = { role: 'dio', isActive: { $ne: false } };
  if (countryId) dioMatch.countryId = countryId;
  const odioMatch = { role: coerceRoleToTrack('odio', req.track), ...trackFilter(req.track), isActive: { $ne: false } };
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

  return { trainees, trainers, programDirectors, dios, odios, centers, programs, specialties, countries };
}

// GET /api/sg/stats?countryId=&city=&specialtyId=
router.get('/stats', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    res.json({ success: true, data: await buildStats(req) });
  } catch (err) {
    console.error('[sg] stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/centers — all advanced training centers with computed accreditation.
router.get('/centers', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const centers = await Hospital.find({ ...trackFilter(req.track), isActive: { $ne: false } })
      .populate('countryId', 'name code')
      .populate('dioId', 'name')
      .sort({ name: 1 });
    res.json({ success: true, data: centers.map(withAccreditation) });
  } catch (err) {
    console.error('[sg] centers:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/dios — DIOs (dio_view) plus their ODIOs (dio) and Sub-DIOs (sub_dio).
router.get('/dios', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const [dios, odios, subDios] = await Promise.all([
      User.find({ role: 'dio', isActive: { $ne: false } })
        .select('-password')
        .populate('countryId', 'name code')
        .populate('assignedCenterIds', 'name')
        .sort({ name: 1 }),
      User.find({ role: 'odio', dioId: { $ne: null }, isActive: { $ne: false } })
        .select('-password').populate('dioId', 'name').sort({ name: 1 }),
      User.find({ role: 'sub_dio', dioId: { $ne: null }, isActive: { $ne: false } })
        .select('-password').populate('dioId', 'name').sort({ name: 1 }),
    ]);
    res.json({ success: true, data: { dios, odios, subDios } });
  } catch (err) {
    console.error('[sg] dios:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/specialties — advanced specialties.
router.get('/specialties', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const specialties = await Specialty.find({ ...trackFilter(req.track), isActive: { $ne: false } })
      .populate('councilId', 'name nameEn')
      .sort({ name: 1 });
    res.json({ success: true, data: specialties });
  } catch (err) {
    console.error('[sg] specialties:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/programs — all programs with center/specialty/PD + computed accreditation.
router.get('/programs', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const programs = await Program.find({ isActive: { $ne: false } })
      .populate('trainingCenterId', 'name accreditationNumber countryId')
      .populate('specialtyId', 'name nameEn')
      .populate('programDirectorId', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: programs.map(withAccreditation) });
  } catch (err) {
    console.error('[sg] programs:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/pds — Program Directors plus their Sub-PDs.
router.get('/pds', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const [pds, subPds] = await Promise.all([
      User.find({ role: 'program_director', isActive: { $ne: false } })
        .select('-password').populate('specialtyId', 'name nameEn').sort({ name: 1 }),
      User.find({ role: 'sub_pd', pdId: { $ne: null }, isActive: { $ne: false } })
        .select('-password').populate('specialtyId', 'name nameEn').populate('pdId', 'name').sort({ name: 1 }),
    ]);
    res.json({ success: true, data: { pds, subPds } });
  } catch (err) {
    console.error('[sg] pds:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/trainees?search= — advanced trainees with injected trainingYear.
router.get('/trainees', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const query = { role: coerceRoleToTrack('trainee', req.track), isActive: { $ne: false } };
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { idNumber: rx }];
    }
    const trainees = await User.find(query).select('-password')
      .populate('programId', 'name')
      .sort({ name: 1 })
      .limit(500);
    const data = trainees.map(t => ({ ...t.toObject(), trainingYear: trainingYear(t) }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[sg] trainees:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/analysis-reports — the inbox: every analyzer-uploaded report,
// newest first, with the uploader's name.
router.get('/analysis-reports', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const reports = await AnalysisReport.find()
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reports });
  } catch (err) {
    console.error('[sg] analysis-reports:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/sg/analysis-reports/:id/download — stream a report by its stored
// fileId (server-built path only), delivered under its original filename.
router.get('/analysis-reports/:id/download', auth, allowRoles(...SG_ROLES), async (req, res) => {
  try {
    const report = await AnalysisReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });
    const abs = path.join(reportsDir, path.basename(report.fileId));
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'Report file missing on disk' });
    res.download(abs, report.name || path.basename(report.fileId));
  } catch (err) {
    console.error('[sg] analysis-report download:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
