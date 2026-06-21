// backend/routes/dio.js
const router         = require('express').Router();
const mongoose       = require('mongoose');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
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

const DIO = ['dio'];
const DIO_USER_FIELDS = ['name', 'email', 'phone', 'gender', 'city', 'department',
  'specialty', 'year', 'studentId', 'enrolledSince', 'hospitalId', 'specialtyId',
  'supervisorId', 'hospital', 'supervisor', 'photoUrl', 'isActive'];
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

async function ensureDioCanAccessReport(req, res, report) {
  const hospitalId = getDioHospitalOrFail(req, res);
  if (hospitalId === false) return false;
  if (!hospitalId) return true;
  if (sameId(report.hospital, hospitalId)) return true;
  if (report.student) {
    const trainee = await User.findById(report.student).select('hospitalId hospital');
    if (trainee && belongsToHospital(trainee, hospitalId)) return true;
  }
  res.status(403).json({ success: false, message: 'Access denied: report belongs to a different hospital' });
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

function averageScore(scores) {
  if (!scores || typeof scores !== 'object') return null;
  const values = Object.values(scores).map(Number).filter(n => Number.isFinite(n));
  return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
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
  if (role === 'trainee') return ['name', 'email', 'password', 'hospitalId', 'specialtyId', 'studentId'];
  if (role === 'supervisor') return ['name', 'email', 'password', 'phone', 'hospitalId', 'specialtyId'];
  if (role === 'program_director') return ['name', 'email', 'password', 'phone', 'hospitalId'];
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
  const dioHospitalId = req ? getDioHospitalOrFail(req, res) : null;
  if (dioHospitalId === false) return false;
  if (dioHospitalId && data.hospitalId && !sameId(data.hospitalId, dioHospitalId)) {
    res.status(403).json({ success: false, message: 'DIO users can only manage their assigned hospital' });
    return false;
  }

  const invalid = validateObjectIdFields(data, ['hospitalId', 'hospital', 'specialtyId', 'supervisorId', 'supervisor']);
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
    if (dioHospitalId && specialty.hospitalId && !sameId(specialty.hospitalId, dioHospitalId)) {
      res.status(403).json({ success: false, message: 'Specialty belongs to a different hospital' });
      return false;
    }
  }

  if (data.supervisorId) {
    const supervisor = await User.findOne({ _id: data.supervisorId, role: 'supervisor', isActive: { $ne: false } });
    if (!supervisor) {
      res.status(400).json({ success: false, message: 'Supervisor not found or inactive' });
      return false;
    }
    if (dioHospitalId && !belongsToHospital(supervisor, dioHospitalId)) {
      res.status(403).json({ success: false, message: 'Supervisor belongs to a different hospital' });
      return false;
    }
  }

  if (role === 'program_director') {
    delete data.specialtyId;
    delete data.specialty;
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
    .populate('supervisor', 'name email');
}

// GET /api/dio/stats
// Dashboard statistics — scoped to this DIO's hospital
router.get('/stats', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
    if (!hospitalId) {
      return res.status(403).json({ success: false, message: 'DIO account is not assigned to a hospital' });
    }
    const hospitalQuery = hospitalId
      ? { $or: [{ hospitalId }, { hospital: hospitalId }] }
      : {};

    const [
      trainees,
      supervisors,
      programDirectors,
      secretaries,
      activeRotations,
      certificates
    ] = await Promise.all([
      User.countDocuments({ role: 'trainee', ...hospitalQuery, isActive: { $ne: false } }),
      User.countDocuments({ role: 'supervisor', ...hospitalQuery, isActive: { $ne: false } }),
      User.countDocuments({ role: 'program_director', ...hospitalQuery, isActive: { $ne: false } }),
      User.countDocuments({ role: 'secretary',        ...hospitalQuery, isActive: { $ne: false } }),
      Rotation.countDocuments({
        ...(hospitalId ? { $or: [{ hospitalId }, { hospital: hospitalId }] } : {}),
        status: 'current'
      }),
      Certificate.countDocuments({ hospital: hospitalId, revokedAt: null })
    ]);

    const hospitals = hospitalId ? 1 : await Hospital.countDocuments();

    // Chart: trainees by specialty
    const traineesBySpecialty = await User.aggregate([
      { $match: { role: 'trainee', ...(hospitalId ? { $or: [{ hospitalId }, { hospital: hospitalId }] } : {}) } },
      { $lookup: { from: 'specialties', localField: 'specialtyId', foreignField: '_id', as: 'spec' } },
      { $unwind: { path: '$spec', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$spec.name', '$specialty', 'Unknown'] }, count: { $sum: 1 } } },
      { $project: { specialty: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    // Chart: rotations by specialty, kept under old key for frontend compatibility
    const distributionsBySpecialty = await Rotation.aggregate([
      { $match: hospitalId ? { $or: [{ hospitalId }, { hospital: hospitalId }] } : {} },
      { $lookup: { from: 'specialties', localField: 'specialtyId', foreignField: '_id', as: 'spec' } },
      { $unwind: { path: '$spec', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ['$spec.name', '$specialty', 'Unknown'] }, count: { $sum: 1 } } },
      { $project: { specialty: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    // Chart: supervisors by specialty
    const supervisorsBySpecialty = await User.aggregate([
      { $match: { role: 'supervisor', ...(hospitalId ? { $or: [{ hospitalId }, { hospital: hospitalId }] } : {}) } },
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
      { $match: { hospital: hospitalId, issueDate: { $gte: twelveMonthsAgo } } },
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
router.get('/trainees', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const { search, includeInactive } = req.query;
    const query = { role: 'trainee' };
    const hospitalId = getDioHospitalOrFail(req, res);
    if (hospitalId === false) return;
    if (hospitalId) addAnd(query, hospitalCondition(hospitalId));
    if (includeInactive !== 'true') query.isActive = { $ne: false };
    if (search) {
      const rx = new RegExp(escapeRegex(search.slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { studentId: rx }];
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
  data.role = role;
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
  data.password = req.body.password;

  const user = new User(data);
  await user.save();
  await writeAudit(req, `dio_create_${role}`, 'User', user._id, { role, fields: Object.keys(data) });
  return populateManagedUser(User.findById(user._id));
}

async function updateManagedUser(req, res, role, id) {
  if (!isValidObjectId(id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
  const existing = await User.findById(id).select('role isActive hospitalId hospital');
  if (!existing || existing.role !== role) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!ensureDioCanAccessHospitalDoc(req, res, existing, 'Access denied: user belongs to a different hospital')) return null;
  if (req.body.role && req.body.role !== role) {
    return res.status(403).json({ success: false, message: 'Cannot change role through this endpoint' });
  }

  const updates = normalizeUserPayload(req.body);
  delete updates.email;
  delete updates.password;
  if (!(await validateUserReferences(role, updates, res, req))) return null;

  const user = await populateManagedUser(User.findByIdAndUpdate(id, updates, { new: true }));
  await writeAudit(req, `dio_update_${role}`, 'User', id, { role, fields: Object.keys(updates) });
  return user;
}

function registerManagedUserRoutes(routeName, role) {
  router.post(`/${routeName}`, auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
    try {
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
      const user = await updateManagedUser(req, res, role, req.params.id);
      if (!user) return;
      res.json({ success: true, data: user });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  router.delete(`/${routeName}/:id`, auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
    try {
      if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
      if (req.params.id === (req.user._id || req.user.id).toString()) {
        return res.status(403).json({ success: false, message: 'You cannot deactivate your own account' });
      }
      const existing = await User.findById(req.params.id).select('role isActive hospitalId hospital');
      if (!existing || existing.role !== role || existing.isActive === false) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (!ensureDioCanAccessHospitalDoc(req, res, existing, 'Access denied: user belongs to a different hospital')) return;
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
      const existing = await User.findById(req.params.id).select('role');
      if (!existing || existing.role !== role) {
        return res.status(404).json({ success: false, message: 'User not found' });
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
        role: 'trainee',
        isActive: { $ne: false }
      })
        .populate('hospitalId', 'name')
        .populate('specialtyId', 'name');

      if (!trainee) {
        return res.status(404).json({ success: false, message: 'Trainee not found' });
      }
      if (!ensureDioCanAccessHospitalDoc(req, res, trainee, 'Access denied: trainee belongs to a different hospital')) return;

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
      const hospital = req.body.hospitalId || trainee.hospitalId?._id || trainee.hospital || null;
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

      const evaluation = await Evaluation.create({
        student:        trainee._id,
        traineeId:      trainee._id,
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

// GET /api/dio/trainees/:id/details
// Full DIO trainee profile with reports and grading summary.
router.get('/trainees/:id/details', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid trainee id' });
    }

    const trainee = await User.findOne({
      _id: req.params.id,
      role: 'trainee',
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
    if (!ensureDioCanAccessHospitalDoc(req, res, trainee, 'Access denied: trainee belongs to a different hospital')) return;

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
      hospitalId
        ? User.findOne({
            role: 'program_director',
            isActive: { $ne: false },
            $or: [{ hospitalId }, { hospital: hospitalId }]
          }).select('name email phone hospitalId hospital')
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
    const query = { role: 'supervisor' };
    const hospitalId = getDioHospitalOrFail(req, res);
    if (hospitalId === false) return;
    if (hospitalId) addAnd(query, hospitalCondition(hospitalId));
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };

    const supervisors = await populateManagedUser(User.find(query)).sort({ name: 1 });

    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/program-directors
router.get('/program-directors', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const query = { role: 'program_director' };
    const hospitalId = getDioHospitalOrFail(req, res);
    if (hospitalId === false) return;
    if (hospitalId) addAnd(query, hospitalCondition(hospitalId));
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
    const query = { role: 'secretary' };
    const hospitalId = getDioHospitalOrFail(req, res);
    if (hospitalId === false) return;
    if (hospitalId) addAnd(query, hospitalCondition(hospitalId));
    if (req.query.includeInactive !== 'true') query.isActive = { $ne: false };

    const secretaries = await populateManagedUser(User.find(query)).sort({ name: 1 });

    res.json({ success: true, data: secretaries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/certificates
router.get('/certificates', auth, allowRoles(...DIO, 'super_admin'), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
    const query = hospitalId ? { hospital: hospitalId } : {};
    if (req.user.role === 'dio' && !hospitalId) {
      return res.status(403).json({ success: false, message: 'DIO account is not assigned to a hospital' });
    }

    const certs = await Certificate.find(query)
      .populate('student',   'name initials photoUrl studentId year')
      .populate('traineeId', 'name initials photoUrl studentId year')
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
// DIO issues a certificate for a trainee
router.post('/certificates',
  auth,
  allowRoles(...DIO, 'super_admin'),
  auditLog('issue_certificate', 'Certificate'),
  async (req, res) => {
    try {
      const hospitalId = getHospital(req.user);
      if (req.user.role === 'dio' && !hospitalId) {
        return res.status(403).json({ success: false, message: 'DIO account is not assigned to a hospital' });
      }
      const { student, traineeId, issueDate, notes, type } = req.body;
      const targetTrainee = student || traineeId;
      const trainee = await User.findById(targetTrainee)
        .populate('hospitalId', 'name')
        .populate('supervisorId', 'name')
        .populate('specialtyId', 'name');

      if (!trainee) return res.status(404).json({ success: false, message: 'Trainee not found' });
      const traineeHospital = trainee.hospitalId?._id || trainee.hospital;
      if (req.user.role === 'dio' && hospitalId && traineeHospital?.toString() !== hospitalId.toString()) {
        return res.status(403).json({ success: false, message: 'Trainee belongs to a different hospital' });
      }

      const cert = await Certificate.create({
        student: trainee._id,
        traineeId: trainee._id,
        hospital: traineeHospital || hospitalId,
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

      // DIO can only revoke certificates belonging to their hospital
      if (req.user.role === 'dio') {
        const hospitalId = getHospital(req.user);
        const certHosp = cert.hospital?.toString();
        if (!hospitalId || certHosp !== hospitalId.toString()) {
          return res.status(403).json({ message: 'Access denied: certificate belongs to a different hospital' });
        }
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

      // DIO can only delete certificates belonging to their hospital
      if (req.user.role === 'dio') {
        const hospitalId = getHospital(req.user);
        const certHosp = cert.hospital?.toString();
        if (!hospitalId || certHosp !== hospitalId.toString()) {
          return res.status(403).json({ message: 'Access denied: certificate belongs to a different hospital' });
        }
      }

      await cert.deleteOne();
      res.json({ success: true, message: 'Certificate deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
