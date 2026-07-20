// backend/routes/hoc.js
// Mounted at /api/hoc in server.js.
// Head of Council (role 'hoc'): a STRICTLY read-only oversight suite scoped to
// the HOC's assigned Scientific Council. The scope chain is:
//   council → its specialties (main + precise) → programs on those specialties
//   → the training centers running those programs.
// Zero write endpoints (RULINGS §12, §43).
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { specialtyIdsForCouncil } = require('../utils/councilScope');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const { currentYearRange, inYear } = require('../utils/capacity');
const User            = require('../models/User');
const Hospital        = require('../models/Hospital');
const Program         = require('../models/Program');
const Specialty       = require('../models/Specialty');
const ScientificCouncil = require('../models/ScientificCouncil');

const HOC = ['hoc'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withAccreditation(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, accreditationExpiry: accreditationExpiry(o), accreditationStatus: accreditationStatus(o) };
}

// Current-year active-trainee count on one program.
async function capacityUsedFor(programId) {
  const { yr } = currentYearRange();
  const trainees = await User.find({ role: 'trainee', programId, isActive: { $ne: false } })
    .select('enrolledSince createdAt');
  return trainees.filter(t => inYear(t.enrolledSince || t.createdAt, yr)).length;
}

// Resolve the HOC's full scope: council doc + specialty ids + active programs +
// distinct center ids. Every endpoint derives its data from this.
async function resolveScope(req) {
  const councilId = req.user.councilId || null;
  const [council, specialties] = await Promise.all([
    councilId ? ScientificCouncil.findById(councilId).select('name nameEn') : null,
    councilId ? Specialty.find({ councilId }).select('_id type') : [],
  ]);
  const specialtyIds = specialties.map(s => s._id);
  const programs = specialtyIds.length
    ? await Program.find({ specialtyId: { $in: specialtyIds }, isActive: { $ne: false } })
        .select('_id trainingCenterId programDirectorId')
    : [];
  const centerIds = [...new Set(programs.map(p => String(p.trainingCenterId)).filter(Boolean))];
  return { councilId, council, specialties, specialtyIds, programs, centerIds };
}

// GET /api/hoc/stats — dashboard counts for the council.
router.get('/stats', auth, allowRoles(...HOC), async (req, res) => {
  try {
    const scope = await resolveScope(req);
    const { council, specialties, specialtyIds, programs, centerIds } = scope;

    const programIds = programs.map(p => p._id);
    const pdCount = new Set(programs.map(p => p.programDirectorId).filter(Boolean).map(String)).size;

    const traineeMatch = specialtyIds.length
      ? { role: 'trainee', isActive: { $ne: false }, $or: [{ specialtyId: { $in: specialtyIds } }, { programId: { $in: programIds } }] }
      : { _id: null };

    const [trainees, centerDocs, centralSecretaries, traineesByMonthRaw] = await Promise.all([
      User.countDocuments(traineeMatch),
      centerIds.length ? Hospital.find({ _id: { $in: centerIds } }).select('dioId') : [],
      councilId
        ? User.countDocuments({
            role: 'central_secretary', isActive: { $ne: false },
            $or: [{ secretaryType: 'main', councilId }, { secretaryType: 'precise' }],
          })
        : 0,
      specialtyIds.length
        ? User.aggregate([
            { $match: {
                role: 'trainee', isActive: { $ne: false },
                $or: [{ specialtyId: { $in: specialtyIds } }, { programId: { $in: programIds } }],
                createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
              } },
            { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
          ])
        : [],
    ]);
    const dioCount = new Set(centerDocs.map(c => c.dioId).filter(Boolean).map(String)).size;
    const byKey = new Map(traineesByMonthRaw.map(r => [`${r._id.y}-${r._id.m}`, r.count]));
    const traineesByMonth = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (11 - i)); d.setDate(1);
      return { label: d.toLocaleString('en', { month: 'short' }), count: byKey.get(`${d.getFullYear()}-${d.getMonth() + 1}`) || 0 };
    });

    res.json({
      success: true,
      data: {
        council: council ? { _id: council._id, name: council.name, nameEn: council.nameEn || '' } : null,
        specialties: specialtyIds.length,
        mainSpecialties: specialties.filter(s => s.type === 'main').length,
        preciseSpecialties: specialties.filter(s => s.type === 'precise').length,
        centers: centerIds.length,
        programs: programIds.length,
        programDirectors: pdCount,
        dios: dioCount,
        centralSecretaries,
        trainees,
        traineesByMonth,
      },
    });
  } catch (err) {
    console.error('[hoc] stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/hoc/centers?search= — training centers running the council's
// programs, each with its council-scoped programs.
router.get('/centers', auth, allowRoles(...HOC), async (req, res) => {
  try {
    const scope = await resolveScope(req);
    const { centerIds, specialtyIds } = scope;
    if (!centerIds.length) return res.json({ success: true, data: [] });

    const centerQuery = { _id: { $in: centerIds }, isActive: { $ne: false } };
    if (req.query.search) {
      centerQuery.name = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
    }

    const [centers, programs] = await Promise.all([
      Hospital.find(centerQuery).populate('countryId', 'name code').populate('dioId', 'name').sort({ name: 1 }),
      Program.find({ trainingCenterId: { $in: centerIds }, specialtyId: { $in: specialtyIds }, isActive: { $ne: false } })
        .populate('specialtyId', 'name nameEn type code')
        .populate('programDirectorId', 'name')
        .sort({ createdAt: -1 }),
    ]);

    const byCenter = {};
    programs.forEach(p => {
      const k = String(p.trainingCenterId);
      (byCenter[k] = byCenter[k] || []).push(withAccreditation(p));
    });

    const data = centers.map(c => ({ ...withAccreditation(c), programs: byCenter[String(c._id)] || [] }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[hoc] centers:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/hoc/programs?search=&specialtyId=&centerId= — the council's programs.
router.get('/programs', auth, allowRoles(...HOC), async (req, res) => {
  try {
    const scope = await resolveScope(req);
    const { specialtyIds } = scope;
    if (!specialtyIds.length) return res.json({ success: true, data: [] });

    const query = { specialtyId: { $in: specialtyIds }, isActive: { $ne: false } };
    if (req.query.specialtyId) {
      // Only allow narrowing WITHIN the council's specialty set.
      if (specialtyIds.some(id => String(id) === String(req.query.specialtyId))) {
        query.specialtyId = req.query.specialtyId;
      }
    }
    if (req.query.centerId) query.trainingCenterId = req.query.centerId;
    if (req.query.search) query.name = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');

    const programs = await Program.find(query)
      .populate({ path: 'trainingCenterId', select: 'name accreditationNumber countryId', populate: { path: 'countryId', select: 'code name' } })
      .populate('specialtyId', 'name nameEn type code')
      .populate('programDirectorId', 'name')
      .populate('subProgramDirectorId', 'name')
      .sort({ createdAt: -1 });

    const data = await Promise.all(programs.map(async p => ({
      ...withAccreditation(p),
      capacityUsed: await capacityUsedFor(p._id),
    })));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[hoc] programs:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/hoc/specialties — the council's specialties (read-only reference).
router.get('/specialties', auth, allowRoles(...HOC), async (req, res) => {
  try {
    const councilId = req.user.councilId || null;
    if (!councilId) return res.json({ success: true, data: [] });
    const specialties = await Specialty.find({ councilId })
      .select('name nameEn type code isActive')
      .sort({ type: 1, name: 1 });
    res.json({ success: true, data: specialties });
  } catch (err) {
    console.error('[hoc] specialties:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
