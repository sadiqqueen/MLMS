// backend/routes/programDirector.js
const router         = require('express').Router();
const mongoose       = require('mongoose');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const { coerceRoleToTrack } = require('../utils/track');
const { specialtyIdsForName, specialtyUserMatch } = require('../utils/pdScope');
const { averageScore, isWpbaForm, wpbaAlreadyThisMonth } = require('../utils/evalScoring');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');
const { currentYearRange, inYear } = require('../utils/capacity');
const User           = require('../models/User');
const Rotation       = require('../models/Rotation');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const Notification   = require('../models/Notification');
const AuditLog       = require('../models/AuditLog');
const Program        = require('../models/Program');

// GET endpoints are shared by the Program Director and the read-only Sub-PD.
const PD = ['program_director'];
const PD_READ = ['program_director', 'sub_pd'];

// The PD identity to scope read queries by. A Sub-PD mirrors its PD (pdId); a PD
// is itself. Author-keyed reads (evaluations) and program lookups use this so a
// Sub-PD sees exactly what its PD would.
function effectivePdId(req) {
  return req.user.role === 'sub_pd' ? (req.user.pdId || req.user._id) : req.user._id;
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

// Resolve the PD's specialty scope (all same-named Specialty rows in this track).
// A Program Director oversees ONE specialty across every hospital that offers it.
// Sends a 403 and returns null when the PD has no specialty assigned.
async function requirePdSpecialty(req, res) {
  const info = await specialtyIdsForName(req.user.specialtyId, req.track);
  if (!info) {
    res.status(403).json({ success: false, message: 'Program Director has no specialty assigned' });
    return null;
  }
  return info;
}

// GET /api/program-director/trainees
// All trainees in this program director's specialty, across all hospitals.
router.get('/trainees', auth, allowRoles(...PD_READ), async (req, res) => {
  try {
    const info = await requirePdSpecialty(req, res);
    if (!info) return;

    const trainees = await User.find({
      role:     coerceRoleToTrack('trainee', req.track),
      isActive: { $ne: false },
      ...specialtyUserMatch(info)
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .populate('supervisorId', 'name')
      .sort({ name: 1 });

    const traineeIds = trainees.map(t => t._id);
    const distributions = await Rotation.find({
      $or: [
        { traineeId: { $in: traineeIds } },
        { student:   { $in: traineeIds } }
      ]
    })
      .populate('traineeId', 'name email studentId')
      .populate('student', 'name email studentId')
      .populate('specialtyId',  'name')
      .populate('supervisorId', 'name email')
      .populate('doctor', 'name email')
      .populate('hospitalId', 'name city')
      .populate('hospital', 'name city')
      .sort({ startDate: -1 });

    res.json({ success: true, data: { trainees, distributions } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/program-director/supervisors
// All supervisors in this program director's specialty, across all hospitals.
router.get('/supervisors', auth, allowRoles(...PD_READ), async (req, res) => {
  try {
    const info = await requirePdSpecialty(req, res);
    if (!info) return;

    const supervisors = await User.find({
      role:     coerceRoleToTrack('supervisor', req.track),
      isActive: { $ne: false },
      ...specialtyUserMatch(info)
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    const supervisorIds = supervisors.map(s => s._id);
    const distCounts = await Rotation.aggregate([
      { $match: { $or: [
        { supervisorId: { $in: supervisorIds } },
        { doctor:       { $in: supervisorIds } }
      ]}},
      { $group: { _id: { $ifNull: ['$supervisorId', '$doctor'] }, count: { $sum: 1 } } }
    ]);

    const countMap = {};
    distCounts.forEach(d => { countMap[d._id?.toString()] = d.count; });

    const result = supervisors.map(s => ({
      ...s.toObject(),
      traineeCount: countMap[s._id.toString()] || 0
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/program-director/reports
// Final reports only — for grading by program director (specialty-scoped).
router.get('/reports', auth, allowRoles(...PD_READ), async (req, res) => {
  try {
    const info = await requirePdSpecialty(req, res);
    if (!info) return;

    const trainees = await User.find({
      role: coerceRoleToTrack('trainee', req.track),
      ...specialtyUserMatch(info)
    }).select('_id');
    const traineeIds = trainees.map(t => t._id);

    const reports = await Report.find({
      student: { $in: traineeIds },
      type:    'final'
    })
      .populate('student',    'name initials photoUrl studentId')
      .populate('hospital',   'name')
      .populate('rotation',   'startDate endDate status')
      .populate('gradedBy',   'name initials')
      .populate('reviewedBy', 'name initials')
      .sort({ date: -1 });

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/program-director/evaluations
// Every evaluation authored by this program director (trainee + supervisor
// subjects), scoped by evaluator identity — mirrors GET /api/dio/evaluations.
// The client splits rows by evaluateeRole (a missing value is treated as
// 'trainee'). Author-scoping is inherently specialty-safe: a PD can only create
// evaluations for subjects in its own specialty (enforced on create below).
router.get('/evaluations', auth, allowRoles(...PD_READ), async (req, res) => {
  try {
    const pdId = effectivePdId(req);
    const query = {
      $or: [{ evaluatorId: pdId }, { doctor: pdId }, { createdBy: pdId }]
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/program-director/stats
// Dashboard for the PD's ONE program (Sub-PD mirrors its PD via effectivePdId).
// Counts: specialty-scoped trainees (matches the /trainees page), program
// trainers, pending final reports (specialty scope), evaluations authored, and
// program capacity usage (current-year trainees vs yearlyCapacity).
router.get('/stats', auth, allowRoles(...PD_READ), async (req, res) => {
  try {
    const pdId = effectivePdId(req);
    const program = await Program.findOne({ programDirectorId: pdId, isActive: { $ne: false } })
      .populate({ path: 'trainingCenterId', select: 'name city accreditationNumber countryId dioId', populate: { path: 'dioId', select: 'name' } })
      .populate('specialtyId', 'name')
      .populate('programDirectorId', 'name')
      .populate('subProgramDirectorId', 'name');
    if (!program) return res.status(403).json({ success: false, message: 'No program assigned' });

    const info = await requirePdSpecialty(req, res);
    if (!info) return;

    const specialtyTrainees = await User.find({
      role: coerceRoleToTrack('trainee', req.track),
      isActive: { $ne: false },
      ...specialtyUserMatch(info)
    }).select('_id');
    const specialtyTraineeIds = specialtyTrainees.map(t => t._id);

    const [trainers, pendingFinalReports, evaluationsAuthored, capacityUsed] = await Promise.all([
      User.countDocuments({ role: coerceRoleToTrack('supervisor', req.track), isActive: { $ne: false }, programId: program._id }),
      Report.countDocuments({ student: { $in: specialtyTraineeIds }, type: 'final', status: 'pending' }),
      Evaluation.countDocuments({ $or: [{ evaluatorId: pdId }, { doctor: pdId }, { createdBy: pdId }] }),
      capacityUsedFor(program._id),
    ]);

    res.json({
      success: true,
      data: {
        program: withAccreditation(program),
        counts: {
          trainees: specialtyTraineeIds.length,
          trainers,
          pendingFinalReports,
          evaluationsAuthored,
          capacityUsed,
          yearlyCapacity: program.yearlyCapacity
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/program-director/reports/:id/grade
// Grade a final report — only program director can do this
router.patch('/reports/:id/grade',
  auth,
  allowRoles(...PD),
  auditLog('grade_final_report', 'Report'),
  async (req, res) => {
    try {
      const info = await requirePdSpecialty(req, res);
      if (!info) return;

      const { grade, globalRating, assessmentCriteria, assessorComments, reviewNote } = req.body;

      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ message: 'Report not found' });
      if (report.type !== 'final') {
        return res.status(403).json({ success: false, message: 'Program Director can only grade final reports' });
      }
      const trainee = await User.findOne({
        _id: report.student,
        role: coerceRoleToTrack('trainee', req.track),
        ...specialtyUserMatch(info)
      });
      if (!trainee) {
        return res.status(403).json({ success: false, message: 'Report belongs to a trainee outside this specialty' });
      }

      report.grade              = grade || (globalRating === 'competent' ? 'Competent' : 'Not-Competent');
      report.globalRating       = globalRating       || null;
      report.assessmentCriteria = assessmentCriteria || {};
      report.assessorComments   = assessorComments   || reviewNote || '';
      report.reviewNote         = reviewNote         || assessorComments || '';
      report.reviewedBy         = req.user._id;
      report.gradedBy           = req.user._id;
      report.gradedByRole       = req.user.role;
      report.gradedAt           = new Date();
      report.status             = 'graded';
      await report.save();

      const populated = await Report.findById(report._id)
        .populate('student',  'name initials photoUrl studentId')
        .populate('hospital', 'name')
        .populate('gradedBy', 'name initials');

      await Notification.create({
        user:     report.student,
        message:  `Your final report has been graded by the Program Director: ${report.grade}`,
        category: 'program_director'
      });

      res.json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// POST /api/program-director/trainees/:id/evaluations
// PD creates a finalized-on-create evaluation for a trainee in its specialty.
router.post('/trainees/:id/evaluations', auth, allowRoles(...PD), async (req, res) => {
  try {
    const info = await requirePdSpecialty(req, res);
    if (!info) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid trainee id' });
    }

    // Subject must be a trainee IN this PD's specialty (specialtyUserMatch),
    // which is what confines the PD to its own trainees across all hospitals.
    const trainee = await User.findOne({
      _id: req.params.id,
      role: coerceRoleToTrack('trainee', req.track),
      isActive: { $ne: false },
      ...specialtyUserMatch(info)
    })
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name');

    if (!trainee) {
      return res.status(404).json({ success: false, message: 'Trainee not found' });
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
      && await wpbaAlreadyThisMonth(req.user._id, trainee._id, evaluationType)) {
      return res.status(400).json({ success: false, message: `A ${evaluationType} evaluation has already been submitted for this trainee this month.` });
    }

    // Derive hospital from the already-scoped subject; never trust a client id.
    const hospital = trainee.hospitalId?._id || trainee.hospital || null;
    const specialty = req.body.specialty || trainee.specialtyId?.name || trainee.specialty || '';

    const evaluation = await Evaluation.create({
      student:        trainee._id,
      traineeId:      trainee._id,
      evaluateeId:    trainee._id,
      evaluateeRole:  'trainee',
      track:          req.track,
      formData,
      doctor:         req.user._id,
      evaluatorId:    req.user._id,
      evaluatorRole:  'program_director',
      createdBy:      req.user._id,
      createdByRole:  'program_director',
      hospital,
      specialty,
      date:           req.body.date || new Date(),
      evaluationType,
      grade:          req.body.grade || '',
      notes:          req.body.notes || req.body.comments || '',
      comments:       req.body.comments || req.body.notes || '',
      scores,
      totalScore,
      isFinalized:    true,
      status:         'completed',
      sentToTraineeAt: new Date()
    });

    await AuditLog.create({
      userId: req.user._id,
      action: 'pd_create_evaluation',
      targetId: evaluation._id,
      targetModel: 'Evaluation',
      metadata: { traineeId: trainee._id, evaluationType },
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    }).catch(err => console.error('[AuditLog] Failed to write PD evaluation:', err.message));

    await Notification.create({
      user: trainee._id,
      message: `You have a new evaluation submitted by ${req.user.name}`,
      category: 'program_director'
    }).catch(err => console.error('[Notification] Failed to write PD evaluation notice:', err.message));

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
});

// POST /api/program-director/supervisors/:id/evaluations
// PD evaluates a supervisor in its specialty. Stored with
// evaluateeRole:'supervisor' (student/evaluateeId hold the supervisor id,
// traineeId left null) so trainee-facing queries never surface it. Finalized.
router.post('/supervisors/:id/evaluations', auth, allowRoles(...PD), async (req, res) => {
  try {
    const info = await requirePdSpecialty(req, res);
    if (!info) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid supervisor id' });
    }

    const supervisor = await User.findOne({
      _id: req.params.id,
      role: coerceRoleToTrack('supervisor', req.track),
      isActive: { $ne: false },
      ...specialtyUserMatch(info)
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

    const hospital = supervisor.hospitalId?._id || supervisor.hospital || null;
    const specialty = req.body.specialty || supervisor.specialtyId?.name || supervisor.specialty || '';

    const evaluation = await Evaluation.create({
      student:        supervisor._id,
      evaluateeId:    supervisor._id,
      evaluateeRole:  'supervisor',
      track:          req.track,
      doctor:         req.user._id,
      evaluatorId:    req.user._id,
      evaluatorRole:  'program_director',
      createdBy:      req.user._id,
      createdByRole:  'program_director',
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
      action: 'pd_create_supervisor_evaluation',
      targetId: evaluation._id,
      targetModel: 'Evaluation',
      metadata: { supervisorId: supervisor._id, evaluationType },
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    }).catch(err => console.error('[AuditLog] Failed to write PD supervisor evaluation:', err.message));

    await Notification.create({
      user: supervisor._id,
      message: `You have a new evaluation submitted by ${req.user.name}`
    }).catch(err => console.error('[Notification] Failed to write PD supervisor evaluation notice:', err.message));

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
});

module.exports = router;
