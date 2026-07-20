// backend/routes/dioView.js
// Mounted at /api/dio-view in server.js.
// DIO (dio_view) + Sub-DIO (sub_dio) + ODIO (dio) + super_admin: a read-only
// oversight suite scoped to the caller's training-center set. super_admin sees
// every advanced center; a center-scoped caller with no centers gets 403.
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { trackFilter } = require('../utils/track');
const { resolveCenterSet, traineeIdsForCenterSet } = require('../utils/centerScope');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const { trainingYear } = require('../utils/trainingYear');
const User      = require('../models/User');
const Hospital  = require('../models/Hospital');
const Program   = require('../models/Program');
const Certificate = require('../models/Certificate');
const AuditLog  = require('../models/AuditLog');

const VIEW_ROLES = ['dio_view', 'sub_dio', 'dio', 'super_admin'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withAccreditation(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, accreditationExpiry: accreditationExpiry(o), accreditationStatus: accreditationStatus(o) };
}

// Resolve the caller's concrete center-id set. super_admin → all active advanced
// centers. A center-scoped caller with an empty set gets a 403 (and null is
// returned so the handler stops). Sends the response itself on the 403 path.
async function resolveScope(req, res) {
  if (req.user.role === 'super_admin') {
    const centers = await Hospital.find({ ...trackFilter('advanced'), isActive: { $ne: false } }).select('_id');
    return { set: centers.map(c => String(c._id)) };
  }
  const set = await resolveCenterSet(req.user);
  if (!set || set.length === 0) {
    res.status(403).json({ success: false, message: 'No centers assigned' });
    return null;
  }
  return { set };
}

// A User query fragment matching members of the center set: direct hospitalId, or
// through a program whose center is in the set.
function memberMatch(set, programIds) {
  const or = [{ hospitalId: { $in: set } }];
  if (programIds.length) or.push({ programId: { $in: programIds } });
  return { $or: or };
}

// GET /api/dio-view/stats
router.get('/stats', auth, allowRoles(...VIEW_ROLES), async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;
    const { set } = scope;

    const programs = await Program.find({ trainingCenterId: { $in: set }, isActive: { $ne: false } })
      .select('_id programDirectorId');
    const programIds = programs.map(p => p._id);
    const programDirectors = new Set(programs.map(p => p.programDirectorId).filter(Boolean).map(String)).size;

    const member = memberMatch(set, programIds);
    const traineeIds = await traineeIdsForCenterSet(set);

    const [trainees, trainers, certificates] = await Promise.all([
      User.countDocuments({ role: 'trainee', isActive: { $ne: false }, ...member }),
      User.countDocuments({ role: 'supervisor', isActive: { $ne: false }, ...member }),
      Certificate.countDocuments({
        $or: [{ student: { $in: traineeIds } }, { traineeId: { $in: traineeIds } }],
        revokedAt: null
      }),
    ]);

    res.json({
      success: true,
      data: { centers: set.length, programs: programIds.length, trainees, trainers, programDirectors, certificates }
    });
  } catch (err) {
    console.error('[dio-view] stats:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio-view/centers — the set's centers, each with its programs.
router.get('/centers', auth, allowRoles(...VIEW_ROLES), async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;
    const { set } = scope;

    const [centers, programs] = await Promise.all([
      Hospital.find({ _id: { $in: set }, isActive: { $ne: false } })
        .populate('countryId', 'name code').sort({ name: 1 }),
      Program.find({ trainingCenterId: { $in: set }, isActive: { $ne: false } })
        .populate('specialtyId', 'name').populate('programDirectorId', 'name').sort({ createdAt: -1 }),
    ]);
    const traineeCounts = centers.length
      ? await User.aggregate([
          { $match: { role: 'trainee', isActive: { $ne: false }, hospitalId: { $in: centers.map(c => c._id) } } },
          { $group: { _id: '$hospitalId', count: { $sum: 1 } } },
        ])
      : [];

    const byCenter = {};
    programs.forEach(p => {
      const k = String(p.trainingCenterId);
      (byCenter[k] = byCenter[k] || []).push(withAccreditation(p));
    });
    const traineesByCenter = new Map(traineeCounts.map(t => [String(t._id), t.count]));

    const data = centers.map(c => ({
      ...withAccreditation(c),
      programs: byCenter[String(c._id)] || [],
      traineesCount: traineesByCenter.get(String(c._id)) || 0,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error('[dio-view] centers:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio-view/program-directors — PDs of the set's programs + their Sub-PDs.
router.get('/program-directors', auth, allowRoles(...VIEW_ROLES), async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;
    const { set } = scope;

    const programs = await Program.find({ trainingCenterId: { $in: set }, isActive: { $ne: false } })
      .select('programDirectorId name trainingCenterId')
      .populate('trainingCenterId', 'name');
    const pdIds = [...new Set(programs.map(p => p.programDirectorId).filter(Boolean).map(String))];
    const programByPdId = new Map();
    programs.forEach(p => {
      if (p.programDirectorId) {
        programByPdId.set(String(p.programDirectorId), {
          program: { name: p.name },
          center: p.trainingCenterId ? { name: p.trainingCenterId.name } : null,
        });
      }
    });

    const [programDirectors, subPds] = await Promise.all([
      User.find({ _id: { $in: pdIds }, role: 'program_director' })
        .select('-password').populate('specialtyId', 'name').sort({ name: 1 }),
      User.find({ role: 'sub_pd', pdId: { $in: pdIds }, isActive: { $ne: false } })
        .select('-password').populate('specialtyId', 'name').populate('pdId', 'name').sort({ name: 1 }),
    ]);
    const withProgram = u => ({ ...u.toObject(), ...(programByPdId.get(String(u._id)) || {}) });

    res.json({ success: true, data: { programDirectors: programDirectors.map(withProgram), subPds } });
  } catch (err) {
    console.error('[dio-view] program-directors:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// Shared list handler for trainees / trainers of the center set (?search=).
async function listMembers(req, res, role, injectYear) {
  const scope = await resolveScope(req, res);
  if (!scope) return;
  const { set } = scope;

  const programs = await Program.find({ trainingCenterId: { $in: set }, isActive: { $ne: false } }).select('_id');
  const programIds = programs.map(p => p._id);
  const member = memberMatch(set, programIds);

  const query = { role, isActive: { $ne: false } };
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search).slice(0, 100)), 'i');
    query.$and = [member, { $or: [{ name: rx }, { idNumber: rx }, { studentId: rx }] }];
  } else {
    Object.assign(query, member);
  }

  const users = await User.find(query).select('-password')
    .populate('programId', 'name')
    .populate('hospitalId', 'name')
    .populate('specialtyId', 'name')
    .sort({ name: 1 })
    .limit(500);

  const data = injectYear ? users.map(u => ({ ...u.toObject(), trainingYear: trainingYear(u) })) : users;
  res.json({ success: true, data });
}

// GET /api/dio-view/trainees?search=
router.get('/trainees', auth, allowRoles(...VIEW_ROLES), (req, res) => listMembers(req, res, 'trainee', true));

// GET /api/dio-view/trainers?search=
router.get('/trainers', auth, allowRoles(...VIEW_ROLES), (req, res) => listMembers(req, res, 'supervisor', false));

// ── ODIO SELF-SERVICE (DIO-only write) ──────────────────────────────────────
// The DIO (dio_view) is read-only everywhere EXCEPT creating its own ODIOs
// (RULINGS §F28). Country/city are inherited from the DIO; centers resolve
// dynamically through the parent via dioId (never a stale copy). Sub-DIO and
// ODIO accounts cannot use this — only the DIO itself.

// GET /api/dio-view/odios — the DIO's own ODIO accounts. dio_view sees its own;
// sub_dio (read-only) sees its parent DIO's; super_admin sees none (no single
// parent to resolve) and gets an empty list rather than a 403.
router.get('/odios', auth, allowRoles('dio_view', 'sub_dio', 'super_admin'), async (req, res) => {
  try {
    let parentDioId = null;
    if (req.user.role === 'dio_view') parentDioId = req.user._id;
    else if (req.user.role === 'sub_dio') parentDioId = req.user.dioId || null;
    if (!parentDioId) return res.json({ success: true, data: [] });

    const odios = await User.find({ role: 'dio', dioId: parentDioId })
      .select('-password')
      .populate('countryId', 'name code')
      .sort({ name: 1 });
    res.json({ success: true, data: odios });
  } catch (err) {
    console.error('[dio-view] odios:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio-view/me — the authoritative country/city a new ODIO inherits
// (dio_view only; used by the Add-ODIO modal's read-only preview fields).
router.get('/me', auth, allowRoles('dio_view'), async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('countryId city').populate('countryId', 'name code');
    res.json({ success: true, data: { countryId: me.countryId || null, city: me.city || '' } });
  } catch (err) {
    console.error('[dio-view] me:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/dio-view/odios — create an ODIO (role 'dio') under this DIO.
router.post('/odios', auth, allowRoles('dio_view'), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required' });
    if (!email || !String(email).trim()) return res.status(400).json({ message: 'Email is required' });
    if (!password || String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const payload = {
      name: String(name).trim(),
      email: String(email).trim(),
      password: String(password),
      role: 'dio',
      dioId: req.user._id,                 // links the ODIO to this DIO → center set
      countryId: req.user.countryId || null, // inherited (read-only in the UI)
      city: req.user.city || '',           // inherited
      // assignedCenterIds intentionally NOT copied — resolved through dioId.
    };
    if (phone !== undefined) payload.phone = String(phone).trim();

    const user = new User(payload);
    await user.save();
    await AuditLog.create({
      userId: req.user._id,
      action: 'dio_create_odio',
      targetId: user._id,
      targetModel: 'User',
      metadata: { dioId: String(req.user._id) },
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    }).catch(err => console.error('[AuditLog] Failed to write ODIO create:', err.message));

    const saved = await User.findById(user._id).select('-password').populate('countryId', 'name code');
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern && err.keyPattern.idNumber ? 'ID number' : 'Email';
      return res.status(409).json({ message: `${field} already exists` });
    }
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    console.error('[dio-view] create odio:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
