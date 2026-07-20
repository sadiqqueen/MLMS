// backend/routes/dio.js
const router         = require('express').Router();
const mongoose       = require('mongoose');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { coerceRoleToTrack, trackFilter, trackForRole } = require('../utils/track');
const { findPdForSpecialty } = require('../utils/pdScope');
const { averageScore, isWpbaForm, wpbaAlreadyThisMonth } = require('../utils/evalScoring');
const auditLog       = require('../middleware/auditLogger');
const { v4: uuidv4 } = require('uuid');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Specialty      = require('../models/Specialty');
const Distribution   = require('../models/Distribution');
const Rotation       = require('../models/Rotation');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const Certificate    = require('../models/Certificate');
const Notification   = require('../models/Notification');
const AuditLog       = require('../models/AuditLog');
const ChangeRequest  = require('../models/ChangeRequest');
const Program        = require('../models/Program');
const { applyChangeRequest } = require('../utils/applyChangeRequest');
const { computeCapacityUsage, maxExtraFor, settingFor } = require('../utils/capacity');
const { resolveCenterSet, inCenterSet, traineeIdsForCenterSet } = require('../utils/centerScope');

// Return a ChangeRequest as a plain object with the sensitive fields of a queued
// capacity payload removed (never expose a stored password hash to any client).
function viewChangeRequest(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  if (o.changes && typeof o.changes === 'object') {
    const c = { ...o.changes };
    delete c.password;
    o.changes = c;
  }
  return o;
}

// ── Advanced-track ODIO lockdowns ───────────────────────────────────────────
// Two distinct guards for an advanced ODIO (role 'dio', req.track === 'advanced'):
//
//  • isAdvancedOdio — creation/deletion of accounts moved to the registry by
//    owner decision, so POST/DELETE are locked for EVERY advanced ODIO (with or
//    without a dioId).
//  • isCenterScopedOdio — edit/approve/reject are center-scoped ONLY for a v2
//    ODIO linked to a dio_view via dioId. A legacy advanced ODIO (no dioId)
//    would resolve an empty center set and be 403'd on every managed-user PATCH
//    and change-request approve/reject, breaking the legacy secretary→DIO
//    approval round-trip — so it keeps today's track-scoped behavior there.
//
// super_admin and Basic b_dio (req.track === 'basic') are unaffected by either.
function isAdvancedOdio(req) {
  return req.track === 'advanced' && req.user.role === 'dio';
}

function isCenterScopedOdio(req) {
  return req.track === 'advanced' && req.user.role === 'dio' && !!req.user.dioId;
}

// The center a managed user belongs to: direct hospitalId/hospital, else the
// training center of its program.
async function targetCenterId(target) {
  if (!target) return null;
  const direct = target.hospitalId || target.hospital || null;
  if (direct) return direct._id || direct;
  if (target.programId) {
    const program = await Program.findById(target.programId).select('trainingCenterId');
    return program?.trainingCenterId || null;
  }
  return null;
}

// Send 403 + return true when an advanced ODIO acts outside its center set
// (an empty set is always outside).
async function blockedOutsideCenters(req, res, hospitalId) {
  const set = await resolveCenterSet(req.user);
  if (!set || set.length === 0 || !inCenterSet(set, hospitalId)) {
    res.status(403).json({ success: false, message: 'Outside your assigned centers' });
    return true;
  }
  return false;
}

// ── Center-scoped certificate access (v2) ───────────────────────────────────
// A caller is center-scoped for certificates when — on the advanced track — it
// is a DIO (dio_view), a Sub-DIO (sub_dio), or an ODIO (role 'dio') LINKED to a
// dio_view via dioId. Basic b_dio, super_admin, and legacy advanced ODIOs
// without a dioId are NOT center-scoped and keep their current (all-track) view.
// Returns { scoped:true, ids:[trainee ObjectIds] } for a scoped caller, else
// { scoped:false }.
function isCenterScopedForCertificates(req) {
  if (req.track !== 'advanced') return false;
  const role = req.user.role;
  return role === 'dio_view' || role === 'sub_dio' || (role === 'dio' && !!req.user.dioId);
}

async function certificateCenterScope(req) {
  if (!isCenterScopedForCertificates(req)) return { scoped: false };
  const set = await resolveCenterSet(req.user);
  const ids = await traineeIdsForCenterSet(set || []);
  return { scoped: true, ids };
}

// ── DIO scope = TRAINING TRACK (not hospital) ────────────────────────────────
// A DIO oversees its entire training track (Advanced for `dio`, Basic for
// `b_dio`, resolved from req.track). It sees and manages every user/record in
// that track across all hospitals — never the other track, and never
// presidents/other-DIOs/super_admins as manageable users. Track membership is
// carried by the User/Rotation/Certificate `track` field (and by the b_* role
// prefix), so scoping is done with coerceRoleToTrack(role, req.track) for user
// role queries and trackFilter(req.track) for rotation/certificate queries.
const DIO = ['dio'];
const DIO_USER_FIELDS = ['name', 'email', 'phone', 'gender', 'city', 'department',
  'specialty', 'year', 'studentId', 'enrolledSince', 'hospitalId', 'specialtyId',
  'supervisorId', 'researchSupervisorId', 'hospital', 'supervisor', 'photoUrl', 'isActive'];
const DIO_ROLE_ROUTE = {
  trainees: 'trainee',
  supervisors: 'supervisor',
  'program-directors': 'program_director',
  secretaries: 'secretary'
};

function getHospital(user) {
  const hospital = user.hospitalId || user.hospital || null;
  return hospital?._id || hospital;
}

function sameId(a, b) {
  if (!a || !b) return false;
  const left = a?._id || a;
  const right = b?._id || b;
  return left.toString() === right.toString();
}

function hospitalCondition(hospitalId) {
  return { $or: [{ hospitalId }, { hospital: hospitalId }] };
}

function addAnd(query, condition) {
  if (!condition) return;
  query.$and = [...(query.$and || []), condition];
}

function belongsToHospital(doc, hospitalId) {
  return sameId(doc?.hospitalId, hospitalId) || sameId(doc?.hospital, hospitalId);
}

function getDioHospitalOrFail(req, res) {
  if (req.user.role !== 'dio') return null;
  const hospitalId = getHospital(req.user);
  if (!hospitalId) {
    res.status(403).json({ success: false, message: 'DIO account is not assigned to a hospital' });
    return false;
  }
  return hospitalId;
}

function ensureDioCanAccessHospitalDoc(req, res, doc, message = 'Access denied: record belongs to a different hospital') {
  const hospitalId = getDioHospitalOrFail(req, res);
  if (hospitalId === false) return false;
  if (!hospitalId) return true;
  if (belongsToHospital(doc, hospitalId)) return true;
  res.status(403).json({ success: false, message });
  return false;
}

// A DIO oversees its whole training track (see note above): it may grade any
// report whose trainee belongs to the DIO's track. super_admin passes through.
async function ensureDioCanAccessReport(req, res, report) {
  if (req.user.role !== 'dio') return true;
  if (report.student) {
    const trainee = await User.findById(report.student).select('role');
    if (trainee && trackForRole(trainee.role) === req.track) return true;
  }
  res.status(403).json({ success: false, message: 'Access denied: report belongs to a different track' });
  return false;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isReportGraded(report) {
  return report?.status === 'graded'
      || !!report?.grade
      || report?.score !== null && report?.score !== undefined
      || !!report?.gradedBy;
}

function groupReports(reports) {
  return {
    weekly: reports.filter(r => r.type === 'weekly'),
    monthly: reports.filter(r => r.type === 'monthly'),
    final: reports.filter(r => r.type === 'final'),
  };
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

function normalizeUserPayload(body) {
  const data = pick(body, DIO_USER_FIELDS);
  if (!data.name && body.fullName) data.name = body.fullName;
  if (data.email) data.email = String(data.email).trim().toLowerCase();
  if (data.hospitalId && !data.hospital) data.hospital = data.hospitalId;
  if (data.hospital && !data.hospitalId) data.hospitalId = data.hospital;
  if (data.supervisorId && !data.supervisor) data.supervisor = data.supervisorId;
  if (data.supervisor && !data.supervisorId) data.supervisorId = data.supervisor;
  return data;
}

function requiredMissing(data, fields) {
  return fields.filter(field => data[field] === undefined || data[field] === null || data[field] === '');
}

function requiredFieldsForRole(role) {
  if (role === 'trainee') return ['name', 'email', 'password', 'hospitalId', 'specialtyId', 'studentId', 'supervisorId'];
  if (role === 'supervisor') return ['name', 'email', 'password', 'phone', 'hospitalId', 'specialtyId'];
  if (role === 'program_director') return ['name', 'email', 'password', 'phone', 'specialtyId'];
  if (role === 'secretary') return ['name', 'email', 'password', 'phone', 'hospitalId'];
  return ['name', 'email', 'password'];
}

function validateObjectIdFields(data, fields) {
  for (const field of fields) {
    if (data[field] && !isValidObjectId(data[field])) return field;
  }
  return null;
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
  }).catch(err => console.error('[AuditLog] Failed to write DIO audit:', err.message));
}

async function validateUserReferences(role, data, res, req) {
  const invalid = validateObjectIdFields(data, ['hospitalId', 'hospital', 'specialtyId', 'supervisorId', 'supervisor', 'researchSupervisorId']);
  if (invalid) {
    res.status(400).json({ success: false, message: `Invalid ${invalid}` });
    return false;
  }

  if (data.hospitalId) {
    const hospital = await Hospital.findOne({ _id: data.hospitalId, isActive: { $ne: false } });
    if (!hospital) {
      res.status(400).json({ success: false, message: 'Hospital not found or inactive' });
      return false;
    }
  }

  if (data.specialtyId) {
    const specialty = await Specialty.findOne({ _id: data.specialtyId, isActive: { $ne: false } });
    if (!specialty) {
      res.status(400).json({ success: false, message: 'Specialty not found or inactive' });
      return false;
    }
    if (req.user.role === 'dio' && (specialty.track || 'advanced') !== req.track) {
      res.status(400).json({ success: false, message: 'Specialty is in a different track' });
      return false;
    }
  }

  if (data.supervisorId) {
    // Supervisor reference must belong to the DIO's own track.
    const supervisor = await User.findOne({
      _id: data.supervisorId,
      role: coerceRoleToTrack('supervisor', req.track),
      isActive: { $ne: false }
    });
    if (!supervisor) {
      res.status(400).json({ success: false, message: 'Supervisor not found or inactive' });
      return false;
    }
  }

  if (data.researchSupervisorId) {
    // Research supervisor must also be an active supervisor in the DIO's track.
    const researchSup = await User.findOne({
      _id: data.researchSupervisorId,
      role: coerceRoleToTrack('supervisor', req.track),
      isActive: { $ne: false }
    });
    if (!researchSup) {
      res.status(400).json({ success: false, message: 'Research supervisor not found or inactive' });
      return false;
    }
  }

  return true;
}

function populateManagedUser(query) {
  return query
    .select('-password')
    .populate('hospitalId', 'name city governorate')
    .populate('hospital', 'name city governorate')
    .populate('specialtyId', 'name')
    .populate('supervisorId', 'name email')
    .populate('supervisor', 'name email')
    .populate('researchSupervisorId', 'name email');
}

// GET /api/dio/stats
// Dashboard statistics — scoped to this DIO's whole training track.
router.get('/stats', auth, allowRoles(...DIO, 'president'), async (req, res) => {
  try {
    const roleTrack = { isActive: { $ne: false } };
    const trackQ = trackFilter(req.track); // { track:'basic' } | { track:{ $ne:'basic' } }

    const [
      trainees,
      supervisors,
      programDirectors,
      secretaries,
      activeRotations,
      certificates
    ] = await Promise.all([
      User.countDocuments({ role: coerceRoleToTrack('trainee', req.track),          ...roleTrack }),
      User.countDocuments({ role: coerceRoleToTrack('supervisor', req.track),       ...roleTrack }),
      User.countDocuments({ role: coerceRoleToTrack('program_director', req.track), ...roleTrack }),
      User.countDocuments({ role: coerceRoleToTrack('secretary', req.track),        ...roleTrack }),
      Rotation.countDocuments({ ...trackQ, status: 'current' }),
      Certificate.countDocuments({ ...trackQ, revokedAt: null })
    ]);

    const hospitals = await Hospital.countDocuments();

    // Chart: trainees by specialty
    const traineesBySpecialty = await User.aggregate([
      { $match: { role: coerceRoleToTrack('trainee', req.track) } },
      { $lookup: { from: 'specialties', localField: 'specialtyId', foreignField: '_id', as: 'spec' } },
      { $unwind: { path: '$spec', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$spec.name', '$specialty', 'Unknown'] }, count: { $sum: 1 } } },
      { $project: { specialty: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    // Chart: rotations by specialty, kept under old key for frontend compatibility
    const distributionsBySpecialty = await Rotation.aggregate([
      { $match: trackQ },
      { $lookup: { from: 'specialties', localField: 'specialtyId', foreignField: '_id', as: 'spec' } },
      { $unwind: { path: '$spec', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$spec.name', '$specialty', 'Unknown'] }, count: { $sum: 1 } } },
      { $project: { specialty: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    // Chart: supervisors by specialty
    const supervisorsBySpecialty = await User.aggregate([
      { $match: { role: coerceRoleToTrack('supervisor', req.track) } },
      { $lookup: { from: 'specialties', localField: 'specialtyId', foreignField: '_id', as: 'spec' } },
      { $unwind: { path: '$spec', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$spec.name', '$specialty', 'Unknown'] }, count: { $sum: 1 } } },
      { $project: { specialty: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    // Chart: certificates issued per month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const certsOverTime = await Certificate.aggregate([
      { $match: { ...trackQ, issueDate: { $gte: twelveMonthsAgo } } },
      { $group: {
        _id: { year: { $year: '$issueDate' }, month: { $month: '$issueDate' } },
        count: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $project: {
        month: { $concat: [{ $toString: '$_id.year' }, '-', { $toString: '$_id.month' }] },
        count: 1, _id: 0
      }}
    ]);

    res.json({
      success: true,
      data: {
        hospitals, trainees, supervisors, programDirectors,
        secretaries, activeRotations, certificates,
        traineesBySpecialty, distributionsBySpecialty,
        supervisorsBySpecialty, certsOverTime
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/trainees
// The certificate-issue form's trainee search. dio_view is scoped to the
// trainees of its assigned center set; DIO/super_admin keep the full-track view.
router.get('/trainees', auth, allowRoles(...DIO, 'dio_view', 'super_admin'), async (req, res) => {
  try {
    const { search, includeInactive } = req.query;
    const query = { role: coerceRoleToTrack('trainee', req.track) };
    if (includeInactive !== 'true') query.isActive = { $ne: false };
    if (search) {
      const rx = new RegExp(escapeRegex(search.slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { studentId: rx }];
    }
    // A dio_view only ever sees trainees of its own center set.
    if (req.user.role === 'dio_view') {
      const set = await resolveCenterSet(req.user);
      query._id = { $in: await traineeIdsForCenterSet(set || []) };
    }

    const trainees = await populateManagedUser(User.find(query)).sort({ name: 1 });
    if (search) trainees.splice(20);
    else trainees.splice(200);

    res.json({ success: true, data: trainees });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function createManagedUser(req, res, role) {
  const data = normalizeUserPayload(req.body);
  // Basic staff (req.track === 'basic') can only ever create Basic (b_*) users.
  data.role = coerceRoleToTrack(role, req.track);
  if (req.body.role && req.body.role !== role) {
    return res.status(403).json({ success: false, message: 'Cannot assign forbidden role through this endpoint' });
  }
  const missing = requiredMissing({ ...data, password: req.body.password }, requiredFieldsForRole(role));
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
  }
  if (!req.body.password || String(req.body.password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }
  if (!(await validateUserReferences(role, data, res, req))) return null;
  // Enforce one Program Director per specialty (by name, within this track).
  if (role === 'program_director' && data.specialtyId) {
    const clash = await findPdForSpecialty(data.specialtyId, req.track, null);
    if (clash) {
      res.status(409).json({ success: false, message: `This specialty already has a Program Director (${clash.name})` });
      return null;
    }
  }
  data.password = req.body.password;

  const user = new User(data);
  await user.save();
  await writeAudit(req, `dio_create_${role}`, 'User', user._id, { role, fields: Object.keys(data) });
  return populateManagedUser(User.findById(user._id));
}

async function updateManagedUser(req, res, role, id) {
  if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
  // Track scoping is enforced by the coerced-role match: a DIO can only touch a
  // user whose role is its own track's version of the managed role.
  const existing = await User.findById(id).select('role isActive');
  if (!existing || existing.role !== coerceRoleToTrack(role, req.track)) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (req.body.role && req.body.role !== role) {
    return res.status(403).json({ success: false, message: 'Cannot change role through this endpoint' });
  }

  const updates = normalizeUserPayload(req.body);
  delete updates.email;
  delete updates.password;
  // A trainee must keep a supervisor: allow changing it, never clearing it.
  if (role === 'trainee'
      && ('supervisorId' in updates || 'supervisor' in updates)
      && !updates.supervisorId && !updates.supervisor) {
    return res.status(400).json({ success: false, message: 'A trainee must have a supervisor' });
  }
  if (!(await validateUserReferences(role, updates, res, req))) return null;
  // Re-assigning a PD's specialty must not collide with another active PD.
  if (role === 'program_director' && updates.specialtyId) {
    const clash = await findPdForSpecialty(updates.specialtyId, req.track, id);
    if (clash) {
      res.status(409).json({ success: false, message: `This specialty already has a Program Director (${clash.name})` });
      return null;
    }
  }

  const user = await populateManagedUser(User.findByIdAndUpdate(id, updates, { new: true }));
  await writeAudit(req, `dio_update_${role}`, 'User', id, { role, fields: Object.keys(updates) });
  return user;
}

function registerManagedUserRoutes(routeName, role) {
  router.post(`/${routeName}`, auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
    try {
      if (isAdvancedOdio(req)) {
        return res.status(403).json({ success: false, message: 'Creation moved to the registry' });
      }
      const user = await createManagedUser(req, res, role);
      if (!user) return;
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      if (err.code === 11000) return res.status(400).json({ success: false, message: 'Email already exists' });
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.patch(`/${routeName}/:id`, auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
    try {
      if (isCenterScopedOdio(req)) {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
        const target = await User.findById(req.params.id).select('hospitalId hospital programId');
        if (!target) return res.status(404).json({ success: false, message: 'User not found' });
        if (await blockedOutsideCenters(req, res, await targetCenterId(target))) return;
      }
      const user = await updateManagedUser(req, res, role, req.params.id);
      if (!user) return;
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.delete(`/${routeName}/:id`, auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
    try {
      if (isAdvancedOdio(req)) {
        return res.status(403).json({ success: false, message: 'Deletion is not available for ODIO accounts' });
      }
      if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
      if (req.params.id === (req.user._id || req.user.id).toString()) {
        return res.status(403).json({ success: false, message: 'You cannot deactivate your own account' });
      }
      const existing = await User.findById(req.params.id).select('role isActive');
      if (!existing || existing.role !== coerceRoleToTrack(role, req.track) || existing.isActive === false) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      const user = await populateManagedUser(User.findByIdAndUpdate(
        req.params.id,
        { isActive: false, deletedAt: new Date() },
        { new: true }
      ));
      await writeAudit(req, `dio_deactivate_${role}`, 'User', req.params.id, { role });
      res.json({ success: true, message: 'User deactivated', data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.patch(`/${routeName}/:id/reactivate`, auth, allowRoles('super_admin'), async (req, res) => {
    try {
      if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
      const existing = await User.findById(req.params.id).select('role specialtyId');
      if (!existing || existing.role !== role) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      // Reactivating a PD must not create a second active PD on the same specialty.
      if (role === 'program_director' && existing.specialtyId) {
        const clash = await findPdForSpecialty(existing.specialtyId, trackForRole(existing.role), req.params.id);
        if (clash) {
          return res.status(409).json({ success: false, message: `This specialty already has a Program Director (${clash.name})` });
        }
      }
      const user = await populateManagedUser(User.findByIdAndUpdate(
        req.params.id,
        { isActive: true, deletedAt: null },
        { new: true }
      ));
      await writeAudit(req, `dio_reactivate_${role}`, 'User', req.params.id, { role });
      res.json({ success: true, message: 'User reactivated', data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
}

Object.entries(DIO_ROLE_ROUTE).forEach(([routeName, role]) => registerManagedUserRoutes(routeName, role));

// POST /api/dio/trainees/:id/evaluations
// DIO creates an operational/academic evaluation for any trainee.
router.post('/trainees/:id/evaluations',
  auth,
  allowRoles(...DIO, 'super_admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid trainee id' });
      }

      const trainee = await User.findOne({
        _id: req.params.id,
        role: coerceRoleToTrack('trainee', req.track),
        isActive: { $ne: false }
      })
        .populate('hospitalId', 'name')
        .populate('specialtyId', 'name');

      if (!trainee) {
        return res.status(404).json({ success: false, message: 'Trainee not found' });
      }

      const evaluationType = req.body.evaluationType || req.body.type || '';
      const scores = req.body.scores && typeof req.body.scores === 'object' ? req.body.scores : {};
      const totalScore = req.body.totalScore !== undefined && req.body.totalScore !== null && req.body.totalScore !== ''
        ? Number(req.body.totalScore)
        : averageScore(scores);
      if (totalScore !== null && !Number.isFinite(totalScore)) {
        return res.status(400).json({ success: false, message: 'totalScore must be a number' });
      }

      const finalized = req.body.isFinalized !== undefined ? !!req.body.isFinalized : true;
      const status = req.body.status && ['pending', 'completed'].includes(req.body.status)
        ? req.body.status
        : finalized ? 'completed' : 'pending';
      const evaluatorRole = req.user.role === 'super_admin' ? 'super_admin' : 'dio';
      // Derive hospital from the already-scoped subject; never trust a client
      // hospitalId (would let a scoped DIO inject the record across hospitals).
      const hospital = trainee.hospitalId?._id || trainee.hospital || null;
      const specialty = req.body.specialty || trainee.specialtyId?.name || trainee.specialty || '';
      const distributionId = req.body.distributionId || null;
      const rotationId = req.body.rotationId || req.body.rotation || null;
      if (distributionId && !mongoose.Types.ObjectId.isValid(distributionId)) {
        return res.status(400).json({ success: false, message: 'Invalid distribution id' });
      }
      if (rotationId && !mongoose.Types.ObjectId.isValid(rotationId)) {
        return res.status(400).json({ success: false, message: 'Invalid rotation id' });
      }
      if (hospital && !mongoose.Types.ObjectId.isValid(hospital)) {
        return res.status(400).json({ success: false, message: 'Invalid hospital id' });
      }

      const formData = req.body.formData && typeof req.body.formData === 'object' ? req.body.formData : {};

      // Structured WPBA forms are capped at one per evaluator per trainee per
      // month; free-form quick evaluations (no matching type) are exempt.
      if (isWpbaForm(evaluationType)
        && await wpbaAlreadyThisMonth(req.user._id, trainee._id, evaluationType)) {
        return res.status(400).json({ success: false, message: `A ${evaluationType} evaluation has already been submitted for this trainee this month.` });
      }

      const evaluation = await Evaluation.create({
        student:        trainee._id,
        traineeId:      trainee._id,
        evaluateeId:    trainee._id,
        evaluateeRole:  'trainee',
        track:          req.track,
        formData,
        doctor:         req.user._id,
        evaluatorId:    req.user._id,
        evaluatorRole,
        createdBy:      req.user._id,
        createdByRole:  evaluatorRole,
        distributionId,
        rotationId,
        hospital,
        specialty,
        date:           req.body.date || new Date(),
        evaluationType,
        grade:          req.body.grade || '',
        notes:          req.body.notes || req.body.comments || '',
        comments:       req.body.comments || req.body.notes || '',
        scores,
        totalScore,
        isFinalized:    finalized,
        status,
        sentToTraineeAt: finalized || status === 'completed' ? new Date() : null
      });

      await AuditLog.create({
        userId: req.user._id,
        action: 'dio_create_evaluation',
        targetId: evaluation._id,
        targetModel: 'Evaluation',
        metadata: {
          traineeId: trainee._id,
          evaluatorRole,
          evaluationType,
          status
        },
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      }).catch(err => console.error('[AuditLog] Failed to write DIO evaluation:', err.message));

      if (trainee._id) {
        await Notification.create({
          user: trainee._id,
          message: `You have a new evaluation submitted by ${req.user.name}`
        }).catch(err => console.error('[Notification] Failed to write DIO evaluation notice:', err.message));
      }

      const populated = await Evaluation.findById(evaluation._id)
        .populate('student', 'name email initials photoUrl studentId')
        .populate('traineeId', 'name email initials photoUrl studentId')
        .populate('doctor', 'name role initials')
        .populate('evaluatorId', 'name role initials')
        .populate('hospital', 'name');

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// POST /api/dio/supervisors/:id/evaluations
// DIO evaluates a supervisor with the same WPBA forms used for trainees.
// Stored with evaluateeRole:'supervisor' — `student`/`evaluateeId` hold the
// supervisor id (satisfying the required ref) and `traineeId` is left null so
// trainee-facing queries never surface it. Finalized on create.
router.post('/supervisors/:id/evaluations',
  auth,
  allowRoles(...DIO, 'super_admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid supervisor id' });
      }
      // Match the /supervisors list endpoint's (track-coerced) role query so the
      // same supervisors the DIO can see are the ones it can evaluate.
      const supervisor = await User.findOne({
        _id: req.params.id,
        role: coerceRoleToTrack('supervisor', req.track),
        isActive: { $ne: false }
      })
        .populate('hospitalId', 'name')
        .populate('specialtyId', 'name');
      if (!supervisor) {
        return res.status(404).json({ success: false, message: 'Supervisor not found' });
      }

      const evaluationType = req.body.evaluationType || req.body.type || '';
      const scores = req.body.scores && typeof req.body.scores === 'object' ? req.body.scores : {};
      const formData = req.body.formData && typeof req.body.formData === 'object' ? req.body.formData : {};
      const totalScore = req.body.totalScore !== undefined && req.body.totalScore !== null && req.body.totalScore !== ''
        ? Number(req.body.totalScore)
        : averageScore(scores);
      if (totalScore !== null && !Number.isFinite(totalScore)) {
        return res.status(400).json({ success: false, message: 'totalScore must be a number' });
      }

      if (isWpbaForm(evaluationType)
        && await wpbaAlreadyThisMonth(req.user._id, supervisor._id, evaluationType)) {
        return res.status(400).json({ success: false, message: `A ${evaluationType} evaluation has already been submitted for this supervisor this month.` });
      }

      const evaluatorRole = req.user.role === 'super_admin' ? 'super_admin' : 'dio';
      // Derive hospital from the already-scoped subject; never trust a client
      // hospitalId (would let a scoped DIO inject the record across hospitals).
      const hospital = supervisor.hospitalId?._id || supervisor.hospital || null;
      const specialty = req.body.specialty || supervisor.specialtyId?.name || supervisor.specialty || '';

      const evaluation = await Evaluation.create({
        student:        supervisor._id,
        evaluateeId:    supervisor._id,
        evaluateeRole:  'supervisor',
        track:          req.track,
        doctor:         req.user._id,
        evaluatorId:    req.user._id,
        evaluatorRole,
        createdBy:      req.user._id,
        createdByRole:  evaluatorRole,
        hospital,
        specialty,
        date:           req.body.date || new Date(),
        evaluationType,
        grade:          req.body.grade || '',
        notes:          req.body.notes || req.body.comments || '',
        comments:       req.body.comments || req.body.notes || '',
        scores,
        formData,
        totalScore,
        isFinalized:    true,
        status:         'completed',
        sentToTraineeAt: new Date()
      });

      await AuditLog.create({
        userId: req.user._id,
        action: 'dio_create_supervisor_evaluation',
        targetId: evaluation._id,
        targetModel: 'Evaluation',
        metadata: { supervisorId: supervisor._id, evaluatorRole, evaluationType },
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      }).catch(err => console.error('[AuditLog] Failed to write DIO supervisor evaluation:', err.message));

      await Notification.create({
        user: supervisor._id,
        message: `You have a new evaluation submitted by ${req.user.name}`
      }).catch(err => console.error('[Notification] Failed to write DIO supervisor evaluation notice:', err.message));

      const populated = await Evaluation.findById(evaluation._id)
        .populate('student',     'name email initials photoUrl')
        .populate('evaluateeId', 'name email initials photoUrl')
        .populate('doctor',      'name role initials')
        .populate('evaluatorId', 'name role initials')
        .populate('hospital',    'name');

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/dio/evaluations
// Every evaluation authored by this DIO (trainee + supervisor subjects),
// scoped by evaluator identity. Powers the DIO evaluations page; the client
// splits rows by evaluateeRole (a missing value is treated as 'trainee').
router.get('/evaluations', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = {
      $or: [{ evaluatorId: req.user._id }, { doctor: req.user._id }, { createdBy: req.user._id }]
    };
    if (req.query.evaluateeRole === 'trainee' || req.query.evaluateeRole === 'supervisor') {
      query.evaluateeRole = req.query.evaluateeRole;
    }
    const evaluations = await Evaluation.find(query)
      .populate('student',     'name email initials photoUrl studentId')
      .populate('traineeId',   'name email initials photoUrl studentId')
      .populate('evaluateeId', 'name email initials photoUrl studentId')
      .populate('hospital',    'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: evaluations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/trainees/:id/details
// Full DIO trainee profile with reports and grading summary.
router.get('/trainees/:id/details', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid trainee id' });
    }

    const trainee = await User.findOne({
      _id: req.params.id,
      role: coerceRoleToTrack('trainee', req.track),
      isActive: { $ne: false }
    })
      .select('-password')
      .populate('hospitalId', 'name city governorate')
      .populate('hospital', 'name city governorate')
      .populate('specialtyId', 'name')
      .populate('supervisorId', 'name email phone specialty')
      .populate('supervisor', 'name email phone specialty');

    if (!trainee) {
      return res.status(404).json({ success: false, message: 'Trainee not found' });
    }

    const hospitalId = trainee.hospitalId?._id || trainee.hospital?._id || trainee.hospitalId || trainee.hospital;
    const [currentRotation, rotations, programDirector, reports, evaluations, certificates] = await Promise.all([
      Rotation.findOne({
        $or: [{ traineeId: trainee._id }, { student: trainee._id }],
        status: 'current'
      })
        .sort({ startDate: -1 })
        .populate('hospitalId', 'name city governorate')
        .populate('hospital', 'name city governorate')
        .populate('specialtyId', 'name')
        .populate('supervisorId', 'name email phone specialty')
        .populate('doctor', 'name email phone specialty'),
      Rotation.find({
        $or: [{ traineeId: trainee._id }, { student: trainee._id }]
      })
        .sort({ startDate: 1 })
        .populate('hospitalId', 'name city governorate')
        .populate('hospital', 'name city governorate')
        .populate('specialtyId', 'name')
        .populate('supervisorId', 'name email phone specialty')
        .populate('doctor', 'name email phone specialty'),
      // The trainee's Program Director is the PD of the trainee's specialty
      // (PDs are specialty-scoped, spanning every hospital of that specialty).
      trainee.specialtyId
        ? findPdForSpecialty(trainee.specialtyId?._id || trainee.specialtyId, req.track, null)
            .then(pd => pd && User.findById(pd._id).select('name email phone specialtyId hospitalId hospital'))
        : null,
      Report.find({ student: trainee._id })
        .populate('hospital', 'name city')
        .populate('rotation', 'startDate endDate status')
        .populate('distribution', 'startDate endDate status hospitalId specialtyId')
        .populate('gradedBy', 'name email role initials')
        .sort({ date: -1, createdAt: -1 }),
      Evaluation.find({
        $or: [{ student: trainee._id }, { traineeId: trainee._id }]
      })
        .populate('doctor', 'name role')
        .populate('supervisorId', 'name role')
        .populate('evaluatorId', 'name role')
        .populate('createdBy', 'name role')
        .sort({ createdAt: -1 }),
      Certificate.find({
        $or: [{ student: trainee._id }, { traineeId: trainee._id }]
      })
        .populate('hospital', 'name city')
        .populate('issuedBy', 'name role')
        .sort({ issueDate: -1, createdAt: -1 })
    ]);

    const plainReports = reports.map(r => r.toObject());
    const plainEvaluations = evaluations.map(e => e.toObject());
    const plainCertificates = certificates.map(c => c.toObject());
    const ungradedReports = plainReports.filter(r => !isReportGraded(r));
    const groupedReports = groupReports(plainReports);
    const finalizedEvaluations = plainEvaluations.filter(e => e.isFinalized || e.status === 'completed');
    const validCertificates = plainCertificates.filter(c => !c.revokedAt);

    res.json({
      success: true,
      data: {
        trainee,
        hospital: trainee.hospitalId || trainee.hospital || null,
        specialty: trainee.specialtyId || (trainee.specialty ? { name: trainee.specialty } : null),
        currentRotation,
        rotations,
        supervisor: trainee.supervisorId || trainee.supervisor || currentRotation?.supervisorId || currentRotation?.doctor || null,
        programDirector,
        reports: plainReports,
        reportsByType: groupedReports,
        ungradedReports,
        pendingUngradedCount: ungradedReports.length,
        evaluations: plainEvaluations,
        certificates: plainCertificates,
        evaluationsSummary: {
          total: plainEvaluations.length,
          finalized: finalizedEvaluations.length,
          pending: Math.max(0, plainEvaluations.length - finalizedEvaluations.length),
          latest: plainEvaluations[0] || null
        },
        certificatesSummary: {
          total: plainCertificates.length,
          valid: validCertificates.length,
          revoked: plainCertificates.length - validCertificates.length,
          latest: plainCertificates[0] || null
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/dio/reports/:id/grade
// DIO escalation grading and override endpoint for weekly, monthly, and final reports.
router.patch('/reports/:id/grade',
  auth,
  allowRoles(...DIO, 'super_admin'),
  async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid report id' });
      }

      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      if (!(await ensureDioCanAccessReport(req, res, report))) return;

      const { grade, score, feedback, comment, status, globalRating, assessmentCriteria } = req.body;
      const normalizedScore = score === undefined || score === null || score === '' ? null : Number(score);
      if (normalizedScore !== null && (!Number.isFinite(normalizedScore) || normalizedScore < 0 || normalizedScore > 100)) {
        return res.status(400).json({ success: false, message: 'Score must be a number between 0 and 100' });
      }

      const allowedStatuses = ['pending', 'approved', 'rejected', 'graded'];
      const nextStatus = status || 'graded';
      if (!allowedStatuses.includes(nextStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid report status' });
      }

      const nextFeedback = feedback ?? comment ?? req.body.assessorComments ?? req.body.reviewNote ?? '';
      if (!grade && normalizedScore === null && !globalRating) {
        return res.status(400).json({ success: false, message: 'Provide grade, score, or global rating' });
      }

      const wasGraded = isReportGraded(report);
      const previousGrade = {
        grade: report.grade,
        score: report.score,
        status: report.status,
        globalRating: report.globalRating || '',
        assessorComments: report.assessorComments || '',
        reviewNote: report.reviewNote || '',
        gradedBy: report.gradedBy || null,
        gradedByRole: report.gradedByRole || '',
        gradedAt: report.gradedAt || null,
        changedBy: req.user._id,
        changedByRole: req.user.role,
        changedAt: new Date(),
        action: wasGraded ? 'override' : 'grade'
      };

      if (wasGraded) report.gradeHistory.push(previousGrade);
      report.grade = grade || (globalRating === 'competent' ? 'Competent' : globalRating === 'not-competent' ? 'Not-Competent' : report.grade);
      if (normalizedScore !== null) report.score = normalizedScore;
      if (globalRating) report.globalRating = globalRating;
      if (assessmentCriteria && typeof assessmentCriteria === 'object') report.assessmentCriteria = assessmentCriteria;
      report.assessorComments = nextFeedback;
      report.reviewNote = nextFeedback;
      report.status = nextStatus === 'pending' ? 'graded' : nextStatus;
      report.gradedBy = req.user._id;
      report.gradedByRole = req.user.role;
      report.gradedAt = new Date();
      await report.save();

      await AuditLog.create({
        userId: req.user._id,
        action: wasGraded ? 'dio_override_report_grade' : 'dio_grade_report',
        targetId: report._id,
        targetModel: 'Report',
        metadata: {
          reportId: report._id,
          traineeId: report.student,
          previous: wasGraded ? previousGrade : null,
          next: {
            grade: report.grade,
            score: report.score,
            status: report.status,
            globalRating: report.globalRating,
            assessorComments: report.assessorComments,
            gradedBy: report.gradedBy,
            gradedByRole: report.gradedByRole,
            gradedAt: report.gradedAt
          }
        },
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
      }).catch(err => console.error('[AuditLog] Failed to write DIO report grade:', err.message));

      if (report.student) {
        await Notification.create({
          user: report.student,
          message: wasGraded
            ? `Your ${report.type} report "${report.title}" grade was updated by the DIO.`
            : `Your ${report.type} report "${report.title}" has been graded by the DIO.`
        });
      }

      const populated = await Report.findById(report._id)
        .populate('student', 'name email initials photoUrl studentId')
        .populate('hospital', 'name city')
        .populate('rotation', 'startDate endDate status')
        .populate('distribution', 'startDate endDate status')
        .populate('gradedBy', 'name email role initials');

      res.json({ success: true, data: populated, override: wasGraded });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/dio/supervisors
router.get('/supervisors', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { role: coerceRoleToTrack('supervisor', req.track) };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };

    const supervisors = await populateManagedUser(User.find(query)).sort({ name: 1 });

    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/supervisors/trainees-map
// Bulk map { supervisorId: [trainee,...] } for the DIO supervisor cards. Mirrors
// supervisor.js getAssignedTraineeIds (direct User.supervisorId + legacy
// Distribution/Rotation pairs) but for ALL supervisors at once (no N+1), and
// every returned trainee passes the same role+isActive filter as
// GET /trainees/:id/details, so each row is clickable without a 404.
// (Registered before program-directors; there is no GET /supervisors/:id to collide with.)
router.get('/supervisors/trainees-map', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const traineeRole = coerceRoleToTrack('trainee', req.track);
    const trackQ = trackFilter(req.track);
    const traineeSelect = 'name studentId year photoUrl initials specialtyId supervisorId';

    const supIds = (await User.find({ role: coerceRoleToTrack('supervisor', req.track) })
      .select('_id').lean()).map(s => s._id);
    if (!supIds.length) return res.json({ success: true, data: {} });

    const [direct, dists, rots] = await Promise.all([
      User.find({ role: traineeRole, isActive: { $ne: false }, supervisorId: { $in: supIds } })
        .select(traineeSelect).populate('specialtyId', 'name').lean(),
      Distribution.find({ ...trackQ, $or: [
        { supervisorId: { $in: supIds }, traineeId: { $ne: null } },
        { doctor: { $in: supIds }, student: { $ne: null } },
      ] }).select('supervisorId doctor traineeId student').lean(),
      Rotation.find({ ...trackQ, status: { $in: ['current', 'upcoming'] }, $or: [
        { supervisorId: { $in: supIds } },
        { doctor: { $in: supIds } },
      ] }).select('supervisorId doctor traineeId student').lean(),
    ]);

    // Trainee ids referenced only via distributions/rotations (not already a direct
    // trainee) get resolved in ONE query with the same track/active filter — the
    // safety net against legacy rows that point at other-track or inactive users.
    const directIds = new Set(direct.map(t => String(t._id)));
    const pairs = [];
    const extraIds = new Set();
    for (const d of [...dists, ...rots]) {
      const supId = d.supervisorId || d.doctor;
      const tId = d.traineeId || d.student;
      if (!supId || !tId) continue;
      pairs.push({ supId: String(supId), tId: String(tId) });
      if (!directIds.has(String(tId))) extraIds.add(String(tId));
    }

    const extra = extraIds.size
      ? await User.find({ _id: { $in: [...extraIds] }, role: traineeRole, isActive: { $ne: false } })
          .select(traineeSelect).populate('specialtyId', 'name').lean()
      : [];

    const byId = {};
    for (const t of [...direct, ...extra]) {
      byId[String(t._id)] = {
        _id: t._id, name: t.name, studentId: t.studentId || '', year: t.year || null,
        photoUrl: t.photoUrl || '', initials: t.initials || '',
        specialty: t.specialtyId?.name || '',
      };
    }

    const map = {};
    const seen = {};
    const add = (supId, tId) => {
      if (!byId[tId]) return; // dropped by the role/active filter → not clickable
      if (!map[supId]) { map[supId] = []; seen[supId] = new Set(); }
      if (seen[supId].has(tId)) return;
      seen[supId].add(tId);
      map[supId].push(byId[tId]);
    };
    for (const t of direct) add(String(t.supervisorId), String(t._id));
    for (const p of pairs) add(p.supId, p.tId);

    res.json({ success: true, data: map });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PROMOTIONS: secretary account-edit approvals ────────────────────────────

// GET /api/dio/change-requests?status=pending — edit requests in the DIO's track.
// EXCLUDES analyzer-reviewed clerk/CS registry requests (reviewerRole
// 'data_analyzer') so the DIO inbox only ever shows its own secretary/CS→DIO
// flow — the two approval pipelines never cross (RULINGS §E23).
router.get('/change-requests', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { ...trackFilter(req.track), reviewerRole: { $ne: 'data_analyzer' } };
    if (req.query.status) query.status = req.query.status;
    if (req.query.requestType) query.requestType = req.query.requestType;
    const items = await ChangeRequest.find(query)
      .populate('requestedBy', 'name email')
      .populate('reviewedBy', 'name')
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name')
      .sort({ createdAt: -1 })
      .limit(300);
    res.json({ success: true, data: items.map(viewChangeRequest) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/dio/change-requests/:id/approve — apply the queued change
router.patch('/change-requests/:id/approve', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { _id: req.params.id, status: 'pending', ...trackFilter(req.track), reviewerRole: { $ne: 'data_analyzer' } };
    const cr = await ChangeRequest.findOne(query);
    if (!cr) return res.status(404).json({ success: false, message: 'Pending request not found' });

    if (isCenterScopedOdio(req)) {
      let hospitalId = cr.hospitalId || null;
      if (cr.requestType === 'edit' && cr.targetId) {
        const target = await User.findById(cr.targetId).select('hospitalId hospital programId');
        hospitalId = await targetCenterId(target);
      }
      if (await blockedOutsideCenters(req, res, hospitalId)) return;
    }

    let updated;
    try {
      updated = await applyChangeRequest(cr);
    } catch (applyErr) {
      return res.status(applyErr.status || 400).json({ success: false, message: applyErr.message });
    }

    cr.status = 'approved';
    cr.reviewedBy = req.user._id;
    cr.reviewedAt = new Date();
    await cr.save();
    await writeAudit(req, 'dio_approve_change_request', 'ChangeRequest', cr._id, { targetId: cr.targetId, routeKey: cr.routeKey, requestType: cr.requestType });
    const approveMsg = cr.requestType === 'capacity_exception'
      ? `Your capacity request for ${cr.targetLabel || 'a trainee'} was approved — the trainee was added.`
      : `Your change to ${cr.targetLabel || 'an account'} was approved by the DIO.`;
    await Notification.create({
      user: cr.requestedBy,
      message: approveMsg,
      category: 'promotions'
    }).catch(() => {});

    res.json({ success: true, data: { changeRequest: viewChangeRequest(cr), user: updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/dio/change-requests/:id/reject
router.patch('/change-requests/:id/reject', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { _id: req.params.id, status: 'pending', ...trackFilter(req.track), reviewerRole: { $ne: 'data_analyzer' } };
    const cr = await ChangeRequest.findOne(query);
    if (!cr) return res.status(404).json({ success: false, message: 'Pending request not found' });

    if (isCenterScopedOdio(req)) {
      let hospitalId = cr.hospitalId || null;
      if (cr.requestType === 'edit' && cr.targetId) {
        const target = await User.findById(cr.targetId).select('hospitalId hospital programId');
        hospitalId = await targetCenterId(target);
      }
      if (await blockedOutsideCenters(req, res, hospitalId)) return;
    }

    cr.status = 'rejected';
    cr.reviewedBy = req.user._id;
    cr.reviewedAt = new Date();
    cr.reviewNote = req.body.note ? String(req.body.note).trim() : '';
    await cr.save();
    await writeAudit(req, 'dio_reject_change_request', 'ChangeRequest', cr._id, { targetId: cr.targetId, routeKey: cr.routeKey, requestType: cr.requestType });
    const rejectMsg = cr.requestType === 'capacity_exception'
      ? `Your capacity request for ${cr.targetLabel || 'a trainee'} was not approved by the DIO.`
      : `Your change to ${cr.targetLabel || 'an account'} was not approved by the DIO.`;
    await Notification.create({
      user: cr.requestedBy,
      message: rejectMsg,
      category: 'promotions'
    }).catch(() => {});
    res.json({ success: true, data: viewChangeRequest(cr) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dio/program-directors
router.get('/program-directors', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { role: coerceRoleToTrack('program_director', req.track) };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };

    const pds = await populateManagedUser(User.find(query)).sort({ name: 1 });

    res.json({ success: true, data: pds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/secretaries
router.get('/secretaries', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { role: coerceRoleToTrack('secretary', req.track) };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };

    const secretaries = await populateManagedUser(User.find(query)).sort({ name: 1 });

    res.json({ success: true, data: secretaries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/presidents — read-only: the DIO can see (but not manage) the
// president(s) of its track on the Users page.
router.get('/presidents', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { role: coerceRoleToTrack('president', req.track) };
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };

    const presidents = await populateManagedUser(User.find(query)).sort({ name: 1 });

    res.json({ success: true, data: presidents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/hospitals/:id
// Full detail for one hospital in the DIO's track: program director(s),
// specialties (each with secretary), supervisors, secretaries and trainees.
router.get('/hospitals/:id', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid hospital id' });
    }
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital || (req.user.role === 'dio' && (hospital.track || 'advanced') !== req.track)) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    const inHospital = { $or: [{ hospitalId: hospital._id }, { hospital: hospital._id }], isActive: { $ne: false } };

    const [supervisors, pds, secretaries, trainees, specialties] = await Promise.all([
      User.find({ role: coerceRoleToTrack('supervisor', req.track), ...inHospital })
        .select('name email phone specialtyId hospitalId hospital initials photoUrl').populate('specialtyId', 'name'),
      User.find({ role: coerceRoleToTrack('program_director', req.track), ...inHospital })
        .select('name email phone department hospitalId hospital initials photoUrl'),
      User.find({ role: coerceRoleToTrack('secretary', req.track), ...inHospital })
        .select('name email phone specialtyId hospitalId hospital initials photoUrl').populate('specialtyId', 'name'),
      User.find({ role: coerceRoleToTrack('trainee', req.track), ...inHospital })
        .select('name email studentId year specialtyId supervisorId hospitalId hospital initials photoUrl')
        .populate('specialtyId', 'name').populate('supervisorId', 'name').sort({ name: 1 }),
      Specialty.find({ ...trackFilter(req.track), isActive: { $ne: false }, hospitalId: hospital._id })
        .select('name hospitalId secretaryId').populate('secretaryId', 'name'),
    ]);

    const specMap = new Map();
    const addSpec = (id, name, secretary) => {
      const nm = String(name || '').trim();
      const k = nm ? nm.toLowerCase() : (id ? id.toString() : null); // dedup by name
      if (!k) return;
      const cur = specMap.get(k);
      if (cur) {
        if (!cur.secretary && secretary) cur.secretary = secretary;
        if (!cur._id && id) cur._id = id;
      } else {
        specMap.set(k, { _id: id || null, name: nm || '—', secretary: secretary || null });
      }
    };
    specialties.forEach(sp => addSpec(sp._id, sp.name, sp.secretaryId ? { _id: sp.secretaryId._id, name: sp.secretaryId.name } : null));
    secretaries.forEach(sec => { if (sec.specialtyId) addSpec(sec.specialtyId._id, sec.specialtyId.name, { _id: sec._id, name: sec.name }); });
    supervisors.forEach(s => { if (s.specialtyId) addSpec(s.specialtyId._id, s.specialtyId.name, null); });
    trainees.forEach(t => { if (t.specialtyId) addSpec(t.specialtyId._id, t.specialtyId.name, null); });
    (hospital.specialties || []).forEach(name => addSpec(null, name, null));

    res.json({
      success: true,
      data: {
        _id: hospital._id, name: hospital.name, city: hospital.city, governorate: hospital.governorate,
        address: hospital.address, phone: hospital.phone, email: hospital.email,
        programDirectors: pds.map(p => ({ _id: p._id, name: p.name, email: p.email, phone: p.phone, department: p.department || '' })),
        supervisors: supervisors.map(s => ({ _id: s._id, name: s.name, email: s.email, phone: s.phone, specialty: s.specialtyId?.name || '' })),
        secretaries: secretaries.map(s => ({ _id: s._id, name: s.name, email: s.email, specialty: s.specialtyId?.name || '' })),
        trainees: trainees.map(t => ({ _id: t._id, name: t.name, studentId: t.studentId, year: t.year, specialty: t.specialtyId?.name || '', supervisor: t.supervisorId?.name || '' })),
        specialties: [...specMap.values()].sort((a, b) => String(a.name).localeCompare(String(b.name))),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/hospitals/:id/capacity
// Per-specialty capacity settings + current-year usage for one hospital.
router.get('/hospitals/:id/capacity', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid hospital id' });
    }
    const hospital = await Hospital.findById(req.params.id).select('specialtySettings track');
    if (!hospital || (req.user.role === 'dio' && (hospital.track || 'advanced') !== req.track)) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    const settings = hospital.specialtySettings || [];
    const specs = await Specialty.find({ _id: { $in: settings.map(s => s.specialtyId) } }).select('name');
    const nameById = new Map(specs.map(s => [s._id.toString(), s.name]));

    const specialties = await Promise.all(settings.map(async s => {
      const { used, exceptionsUsed } = await computeCapacityUsage({
        hospitalId: hospital._id, specialtyId: s.specialtyId, track: req.track,
      });
      return {
        specialtyId: s.specialtyId,
        name: nameById.get(s.specialtyId.toString()) || '—',
        annualCapacity: s.annualCapacity ?? null,
        trainingDurationYears: s.trainingDurationYears ?? null,
        used,
        exceptionsUsed,
        maxExtra: maxExtraFor(s.annualCapacity),
      };
    }));

    res.json({ success: true, data: { hospitalId: hospital._id, specialties } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/dio/hospitals/:id/specialty-settings
// Upsert { specialtyId, annualCapacity, trainingDurationYears } for one specialty
// at one hospital. null/'' clears a value ("not set"); numbers must be >= 0.
router.patch('/hospitals/:id/specialty-settings', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid hospital id' });
    }
    const { specialtyId, annualCapacity, trainingDurationYears } = req.body;
    if (!isValidObjectId(specialtyId)) {
      return res.status(400).json({ success: false, message: 'Invalid specialtyId' });
    }

    const hospital = await Hospital.findById(req.params.id);
    if (!hospital || (req.user.role === 'dio' && (hospital.track || 'advanced') !== req.track)) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    const spec = await Specialty.findById(specialtyId).select('name track');
    if (!spec || (req.user.role === 'dio' && (spec.track || 'advanced') !== req.track)) {
      return res.status(404).json({ success: false, message: 'Specialty not found in your track' });
    }

    // null / '' / undefined → not set; otherwise a non-negative integer.
    const norm = v => {
      if (v === null || v === '' || v === undefined) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return NaN;
      return Math.floor(n);
    };
    const capacity = norm(annualCapacity);
    const duration = norm(trainingDurationYears);
    if (Number.isNaN(capacity) || Number.isNaN(duration)) {
      return res.status(400).json({ success: false, message: 'Capacity and duration must be non-negative numbers' });
    }

    const entry = (hospital.specialtySettings || []).find(s => s.specialtyId?.toString() === String(specialtyId));
    if (entry) {
      entry.annualCapacity = capacity;
      entry.trainingDurationYears = duration;
    } else {
      hospital.specialtySettings.push({ specialtyId, annualCapacity: capacity, trainingDurationYears: duration });
    }
    await hospital.save();
    await writeAudit(req, 'dio_update_specialty_settings', 'Hospital', hospital._id, {
      specialtyId, annualCapacity: capacity, trainingDurationYears: duration,
    });

    res.json({ success: true, data: { hospitalId: hospital._id, specialtySettings: hospital.specialtySettings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/dio/hospitals/:id/specialty-secretary
// Assign (or clear, secretaryId null) the secretary of one specialty at this
// hospital. Assigning is authoritative: it sets Specialty.secretaryId AND scopes
// the chosen secretary user to this specialty + hospital (their data access
// follows their own specialtyId), so the assignment actually takes effect.
router.patch('/hospitals/:id/specialty-secretary', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid hospital id' });
    }
    const { specialtyId, secretaryId } = req.body;
    if (!isValidObjectId(specialtyId)) {
      return res.status(400).json({ success: false, message: 'Invalid specialtyId' });
    }
    const clearing = secretaryId === null || secretaryId === '' || secretaryId === undefined;
    if (!clearing && !isValidObjectId(secretaryId)) {
      return res.status(400).json({ success: false, message: 'Invalid secretaryId' });
    }

    const hospital = await Hospital.findById(req.params.id).select('name track');
    if (!hospital || (req.user.role === 'dio' && (hospital.track || 'advanced') !== req.track)) {
      return res.status(404).json({ success: false, message: 'Hospital not found' });
    }
    const spec = await Specialty.findById(specialtyId).select('name secretaryId track');
    if (!spec || (req.user.role === 'dio' && (spec.track || 'advanced') !== req.track)) {
      return res.status(404).json({ success: false, message: 'Specialty not found in your track' });
    }

    let secretary = null;
    if (clearing) {
      spec.secretaryId = null;
    } else {
      const sec = await User.findOne({
        _id: secretaryId,
        role: coerceRoleToTrack('secretary', req.track),
        isActive: { $ne: false },
      });
      if (!sec) {
        return res.status(400).json({ success: false, message: 'Secretary not found in your track' });
      }
      // Scope the secretary to this specialty + hospital so the assignment takes effect.
      sec.specialtyId = spec._id;
      sec.hospitalId  = hospital._id;
      sec.hospital    = hospital._id; // legacy alias
      await sec.save();
      // A secretary is the recorded secretary of at most one specialty — drop any
      // stale back-reference from other specialties so displays stay consistent.
      await Specialty.updateMany({ secretaryId: sec._id, _id: { $ne: spec._id } }, { $set: { secretaryId: null } });
      spec.secretaryId = sec._id;
      secretary = { _id: sec._id, name: sec.name };
    }
    await spec.save();
    await writeAudit(req, 'dio_assign_specialty_secretary', 'Specialty', spec._id, {
      hospitalId: hospital._id, secretaryId: clearing ? null : secretary._id,
    });

    res.json({ success: true, data: { specialtyId: spec._id, secretary } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/dio/hospitals-overview
// Organisational view for the DIO: every hospital in its track with the
// program director(s), supervisors, and specialties — each specialty carrying
// its assigned secretary's name. Read-only.
router.get('/hospitals-overview', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const [hospitals, supervisors, pds, secretaries, specialties] = await Promise.all([
      Hospital.find({ ...trackFilter(req.track), isActive: { $ne: false } }).sort({ name: 1 }),
      User.find({ role: coerceRoleToTrack('supervisor', req.track), isActive: { $ne: false } })
        .select('name email hospitalId hospital specialtyId initials photoUrl')
        .populate('specialtyId', 'name'),
      User.find({ role: coerceRoleToTrack('program_director', req.track), isActive: { $ne: false } })
        .select('name email hospitalId hospital department initials photoUrl'),
      User.find({ role: coerceRoleToTrack('secretary', req.track), isActive: { $ne: false } })
        .select('name email hospitalId hospital specialtyId initials photoUrl')
        .populate('specialtyId', 'name'),
      Specialty.find({ ...trackFilter(req.track), isActive: { $ne: false } })
        .select('name hospitalId secretaryId')
        .populate('secretaryId', 'name'),
    ]);

    const hidOf = u => (u.hospitalId?._id || u.hospitalId || u.hospital?._id || u.hospital)?.toString();
    const idStr = ref => (ref?._id || ref)?.toString();

    const data = hospitals.map(h => {
      const key = h._id.toString();
      const hSup = supervisors.filter(s => hidOf(s) === key);
      const hPd  = pds.filter(p => hidOf(p) === key);
      const hSec = secretaries.filter(s => hidOf(s) === key);
      const hSpecDocs = specialties.filter(sp => idStr(sp.hospitalId) === key);

      // Union of every specialty this hospital touches, each with its secretary.
      const specMap = new Map();
      const addSpec = (id, name, secretary) => {
        const nm = String(name || '').trim();
        const k = nm ? nm.toLowerCase() : (id ? id.toString() : null); // dedup by name
        if (!k) return;
        const cur = specMap.get(k);
        if (cur) {
          if (!cur.secretary && secretary) cur.secretary = secretary;
          if (!cur._id && id) cur._id = id;
        } else {
          specMap.set(k, { _id: id || null, name: nm || '—', secretary: secretary || null });
        }
      };
      hSpecDocs.forEach(sp => addSpec(sp._id, sp.name, sp.secretaryId ? { _id: sp.secretaryId._id, name: sp.secretaryId.name } : null));
      hSec.forEach(sec => { if (sec.specialtyId) addSpec(sec.specialtyId._id, sec.specialtyId.name, { _id: sec._id, name: sec.name }); });
      hSup.forEach(s => { if (s.specialtyId) addSpec(s.specialtyId._id, s.specialtyId.name, null); });
      (h.specialties || []).forEach(name => addSpec(null, name, null)); // hospital's own specialty names

      return {
        _id: h._id,
        name: h.name,
        city: h.city,
        governorate: h.governorate,
        programDirectors: hPd.map(p => ({ _id: p._id, name: p.name, email: p.email, department: p.department || '' })),
        supervisors: hSup.map(s => ({ _id: s._id, name: s.name, email: s.email, specialty: s.specialtyId?.name || '' })),
        secretaries: hSec.map(s => ({ _id: s._id, name: s.name, specialty: s.specialtyId?.name || '' })),
        specialties: [...specMap.values()].sort((a, b) => String(a.name).localeCompare(String(b.name))),
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/certificates
// The DIO/ODIO is a system-wide certificate overseer: it lists EVERY certificate
// (all tracks, all hospitals). A center-scoped caller (dio_view / sub_dio, or an
// ODIO linked via dioId) instead sees only certificates of trainees in its
// assigned center set. Write actions (issue/revoke/delete) below remain scoped.
router.get('/certificates', auth, allowRoles(...DIO, 'dio_view', 'sub_dio', 'super_admin'), async (req, res) => {
  try {
    const scope = await certificateCenterScope(req);
    const query = scope.scoped
      ? { $or: [{ student: { $in: scope.ids } }, { traineeId: { $in: scope.ids } }] }
      : {};

    const certs = await Certificate.find(query)
      .populate('student',   'name email initials photoUrl studentId year')
      .populate('traineeId', 'name email initials photoUrl studentId year')
      .populate('doctor',    'name specialty initials')
      .populate('hospital',  'name city')
      .populate('issuedBy',  'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: certs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/dio/certificates
// DIO / DIO-view issues a certificate for a trainee. A center-scoped issuer
// (dio_view, or an ODIO linked via dioId) may only issue for a trainee in its
// assigned center set.
router.post('/certificates',
  auth,
  allowRoles(...DIO, 'dio_view', 'super_admin'),
  auditLog('issue_certificate', 'Certificate'),
  async (req, res) => {
    try {
      const { student, traineeId, issueDate, notes, type } = req.body;
      const targetTrainee = student || traineeId;
      if (!targetTrainee || !isValidObjectId(targetTrainee)) {
        return res.status(400).json({ success: false, message: 'A valid trainee is required' });
      }
      // Certificates are for TRAINEES only, and a DIO only for its own track.
      const traineeRole = req.user.role === 'super_admin'
        ? { $in: ['trainee', 'b_trainee'] }
        : coerceRoleToTrack('trainee', req.track);
      const trainee = await User.findOne({ _id: targetTrainee, role: traineeRole, isActive: { $ne: false } })
        .populate('hospitalId', 'name')
        .populate('supervisorId', 'name')
        .populate('specialtyId', 'name');

      if (!trainee) return res.status(404).json({ success: false, message: 'Trainee not found' });

      // Center-set guard for the new center-scoped issuers (dio_view, or an ODIO
      // linked via dioId). Legacy advanced ODIOs without a dioId, b_dio, and
      // super_admin keep their current behavior.
      if (req.track === 'advanced'
          && (req.user.role === 'dio_view' || (req.user.role === 'dio' && !!req.user.dioId))) {
        const set = await resolveCenterSet(req.user);
        if (!inCenterSet(set || [], await targetCenterId(trainee))) {
          return res.status(403).json({ success: false, message: 'Trainee is outside your assigned centers' });
        }
      }

      const traineeHospital = trainee.hospitalId?._id || trainee.hospital;

      const cert = await Certificate.create({
        student: trainee._id,
        traineeId: trainee._id,
        hospital: traineeHospital || null,
        track: req.track,
        supervisor: trainee.supervisorId?._id || trainee.supervisor,
        doctor: trainee.supervisorId?._id || trainee.supervisor,
        specialty: trainee.specialtyId?.name || trainee.specialty || '',
        issuedBy: req.user._id,
        issueDate: issueDate || new Date(),
        notes: notes || '',
        type: type || 'Completion',
        verifyCode: uuidv4()
      });
      const populated = await Certificate.findById(cert._id)
        .populate('student',   'name initials photoUrl studentId year')
        .populate('traineeId', 'name initials photoUrl studentId year')
        .populate('supervisor', 'name email')
        .populate('doctor', 'name email')
        .populate('hospital',  'name city')
        .populate('issuedBy',  'name');

      const certificateTraineeId = cert.student || cert.traineeId;
      if (certificateTraineeId) {
        await Notification.create({
          user:    certificateTraineeId,
          message: 'A certificate has been issued for you by the DIO.'
        }).catch(err => console.error('[Notification] Failed to write DIO certificate notice:', err.message));
      }

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/dio/certificates/:id/revoke
router.patch('/certificates/:id/revoke',
  auth,
  allowRoles(...DIO, 'super_admin'),
  auditLog('revoke_certificate', 'Certificate'),
  async (req, res) => {
    try {
      const cert = await Certificate.findById(req.params.id);
      if (!cert) return res.status(404).json({ message: 'Certificate not found' });

      // DIO can only revoke certificates belonging to their track
      if (req.user.role === 'dio' && (cert.track || 'advanced') !== req.track) {
        return res.status(403).json({ message: 'Access denied: certificate belongs to a different track' });
      }

      cert.revokedAt = new Date();
      await cert.save();
      res.json({ success: true, data: cert });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/dio/certificates/:id
router.delete('/certificates/:id',
  auth,
  allowRoles(...DIO, 'super_admin'),
  auditLog('delete_certificate', 'Certificate'),
  async (req, res) => {
    try {
      const cert = await Certificate.findById(req.params.id);
      if (!cert) return res.status(404).json({ message: 'Certificate not found' });

      // DIO can only delete certificates belonging to their track
      if (req.user.role === 'dio' && (cert.track || 'advanced') !== req.track) {
        return res.status(403).json({ message: 'Access denied: certificate belongs to a different track' });
      }

      await cert.deleteOne();
      res.json({ success: true, message: 'Certificate deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
