// backend/routes/supervisor.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const Distribution   = require('../models/Distribution');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const Notification   = require('../models/Notification');
const User           = require('../models/User');

const SUPERVISOR = ['supervisor'];

async function getAssignedTraineeIds(supervisorId) {
  const directTrainees = await User.find({
    supervisorId,
    role: 'trainee',
    isActive: { $ne: false }
  }).select('_id');

  const distributions = await Distribution.find({
    $or: [
      { supervisorId },
      { doctor: supervisorId }
    ]
  }).select('traineeId student');

  return [...new Set([
    ...directTrainees.map(t => t._id),
    ...distributions.map(d => d.traineeId).filter(Boolean),
    ...distributions.map(d => d.student).filter(Boolean)
  ].map(id => id.toString()))];
}

async function isAssignedTrainee(supervisorId, traineeId) {
  if (!traineeId) return false;
  const assigned = await getAssignedTraineeIds(supervisorId);
  return assigned.includes(traineeId.toString());
}

// GET /api/supervisor/trainees
// Returns all trainees assigned to this supervisor with their distribution info
router.get('/trainees', auth, allowRoles(...SUPERVISOR), async (req, res) => {
  try {
    const directTrainees = await User.find({
      supervisorId: req.user._id,
      role: 'trainee',
      isActive: { $ne: false }
    })
      .select('name email studentId specialtyId hospitalId photoUrl initials year phone')
      .populate('specialtyId', 'name')
      .populate('hospitalId', 'name city');

    const distributionDocs = await Distribution.find({
      $or: [
        { supervisorId: req.user._id },
        { doctor: req.user._id }
      ]
    })
      .populate({
        path: 'traineeId',
        match: { role: 'trainee', isActive: { $ne: false } },
        select: 'name email studentId specialtyId hospitalId photoUrl initials year phone',
        populate: [
          { path: 'specialtyId', select: 'name' },
          { path: 'hospitalId', select: 'name city' }
        ]
      })
      .populate({
        path: 'student',
        match: { role: 'trainee', isActive: { $ne: false } },
        select: 'name email studentId specialtyId hospitalId photoUrl initials year phone',
        populate: [
          { path: 'specialtyId', select: 'name' },
          { path: 'hospitalId', select: 'name city' }
        ]
      })
      .populate('supervisorId', 'name email')
      .populate('hospitalId', 'name city')
      .populate('specialtyId','name')
      .sort({ startDate: -1 });

    const seen = new Set();
    const data = [];

    for (const doc of distributionDocs) {
      const d = doc.toObject();
      const trainee = d.traineeId || d.student;
      const traineeId = trainee?._id?.toString?.() || trainee?.toString?.();
      if (!trainee || !traineeId) continue;
      d.traineeId = trainee;
      d.student = trainee;
      seen.add(traineeId);
      data.push(d);
    }

    for (const doc of directTrainees) {
      const trainee = doc.toObject();
      const traineeId = trainee?._id?.toString?.();
      if (!traineeId || seen.has(traineeId)) continue;
      data.push({
        _id: `direct-${traineeId}`,
        traineeId: trainee,
        student: trainee,
        supervisorId: req.user._id,
        hospitalId: trainee.hospitalId || null,
        specialtyId: trainee.specialtyId || null,
        status: 'active'
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/supervisor/reports
// Returns weekly and monthly reports for supervisor's assigned trainees (NOT final)
router.get('/reports', auth, allowRoles(...SUPERVISOR), async (req, res) => {
  try {
    const traineeIds = await getAssignedTraineeIds(req.user._id);

    const reports = await Report.find({
      student: { $in: traineeIds },
      type:    { $in: ['weekly', 'monthly'] }
    })
      .populate('student',  'name initials photoUrl studentId')
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
      .populate('distribution', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });

    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/supervisor/reports/:id
// Approve or reject a weekly/monthly report
router.patch('/reports/:id',
  auth,
  allowRoles(...SUPERVISOR),
  auditLog('review_report', 'Report'),
  async (req, res) => {
    try {
      const { status, reviewNote, grade, globalRating, assessmentCriteria, assessorComments } = req.body;
      if (!['approved', 'rejected', 'graded'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved, rejected, or graded' });
      }

      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ message: 'Report not found' });

      if (report.type === 'final') {
        return res.status(403).json({ message: 'Final reports can only be graded by the Program Director' });
      }
      if (!(await isAssignedTrainee(req.user._id, report.student))) {
        return res.status(403).json({ message: 'Access denied: report belongs to another supervisor' });
      }

      report.status     = status;
      report.reviewNote = reviewNote || '';
      if (grade !== undefined) report.grade = grade;
      if (globalRating !== undefined) report.globalRating = globalRating;
      if (assessmentCriteria !== undefined) report.assessmentCriteria = assessmentCriteria || {};
      if (assessorComments !== undefined) report.assessorComments = assessorComments || '';
      report.reviewedBy = req.user._id;
      report.gradedBy   = req.user._id;
      report.gradedAt   = new Date();
      await report.save();

      const populated = await Report.findById(report._id)
        .populate('student',  'name initials photoUrl')
        .populate('hospital', 'name')
        .populate('gradedBy', 'name initials');

      await Notification.create({
        user:    report.student,
        message: `Your ${report.type} report has been ${status} by your supervisor.`
      });

      res.json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/supervisor/reports/:id/grade
// Grade a weekly/monthly report. Final reports are reserved for program directors.
router.patch('/reports/:id/grade',
  auth,
  allowRoles(...SUPERVISOR),
  auditLog('grade_supervisor_report', 'Report'),
  async (req, res) => {
    try {
      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
      if (report.type === 'final') {
        return res.status(403).json({ success: false, message: 'Supervisor cannot grade final reports' });
      }
      if (!(await isAssignedTrainee(req.user._id, report.student))) {
        return res.status(403).json({ success: false, message: 'Access denied: report belongs to another supervisor' });
      }

      const { grade, globalRating, assessmentCriteria, assessorComments, reviewNote } = req.body;
      report.grade = grade || report.grade;
      if (globalRating !== undefined) report.globalRating = globalRating;
      report.assessmentCriteria = assessmentCriteria || report.assessmentCriteria || {};
      report.assessorComments = assessorComments || reviewNote || report.assessorComments || '';
      report.reviewNote = reviewNote || assessorComments || report.reviewNote || '';
      report.status = 'graded';
      report.reviewedBy = req.user._id;
      report.gradedBy = req.user._id;
      report.gradedAt = new Date();
      await report.save();

      const populated = await Report.findById(report._id)
        .populate('student', 'name initials photoUrl studentId')
        .populate('hospital', 'name')
        .populate('gradedBy', 'name initials');

      await Notification.create({
        user: report.student,
        message: `Your ${report.type} report has been graded by your supervisor.`
      });

      res.json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// GET /api/supervisor/evaluations
// Returns all evaluations submitted by this supervisor
router.get('/evaluations', auth, allowRoles(...SUPERVISOR), async (req, res) => {
  try {
    const evaluations = await Evaluation.find({
      $or: [
        { doctor:       req.user._id },
        { supervisorId: req.user._id }
      ]
    })
      .populate('student',   'name email initials photoUrl studentId')
      .populate('traineeId', 'name email initials photoUrl studentId')
      .populate('hospital',  'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: evaluations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/supervisor/evaluations
// Create a new evaluation for an assigned trainee
router.post('/evaluations',
  auth,
  allowRoles(...SUPERVISOR),
  auditLog('create_evaluation', 'Evaluation'),
  async (req, res) => {
    try {
      const { traineeId, distributionId, scores, comments, grade, specialty, hospitalId, notes } = req.body;
      const evaluationType = req.body.evaluationType || req.body.type || '';

      const targetTrainee = traineeId || req.body.student;
      if (!targetTrainee) return res.status(400).json({ message: 'traineeId is required' });
      if (!(await isAssignedTrainee(req.user._id, targetTrainee))) {
        return res.status(403).json({ success: false, message: 'Access denied: trainee is not assigned to this supervisor' });
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthCount = await Evaluation.countDocuments({
        $and: [
          { $or: [{ traineeId: targetTrainee }, { student: targetTrainee }] },
          { $or: [{ supervisorId: req.user._id }, { doctor: req.user._id }] },
          { createdAt: { $gte: monthStart, $lt: monthEnd } }
        ]
      });
      if (monthCount >= 5) {
        return res.status(400).json({ success: false, message: 'Monthly evaluation limit (5) reached for this trainee' });
      }

      // Calculate totalScore from scores object
      let totalScore = null;
      if (scores && typeof scores === 'object') {
        const values = Object.values(scores).map(Number).filter(n => !isNaN(n));
        totalScore = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      }

      const evaluation = await Evaluation.create({
        student:        targetTrainee,
        traineeId:      targetTrainee,
        doctor:         req.user._id,
        supervisorId:   req.user._id,
        distributionId: distributionId || null,
        hospital:       hospitalId     || null,
        specialty:      specialty      || '',
        evaluationType: evaluationType || '',
        notes:          notes || comments || '',
        comments:       comments || notes || '',
        scores:         scores   || {},
        totalScore,
        grade:          grade    || '',
        isFinalized:    false,
        status:         'pending'
      });

      const populated = await Evaluation.findById(evaluation._id)
        .populate('student',   'name email initials photoUrl')
        .populate('traineeId', 'name email initials photoUrl')
        .populate('hospital',  'name');

      await Notification.create({
        user:    targetTrainee,
        message: `You have a new evaluation submitted by ${req.user.name}`
      });

      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/supervisor/evaluations/:id/finalize
// Finalize evaluation — makes it visible on trainee's grades page
router.patch('/evaluations/:id/finalize',
  auth,
  allowRoles(...SUPERVISOR),
  auditLog('finalize_evaluation', 'Evaluation'),
  async (req, res) => {
    try {
      const evaluation = await Evaluation.findById(req.params.id);
      if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });

      const isMine = evaluation.supervisorId?.toString() === req.user._id.toString()
                  || evaluation.doctor?.toString()       === req.user._id.toString();
      if (!isMine) return res.status(403).json({ message: 'Access denied' });

      if (evaluation.isFinalized) {
        return res.status(409).json({ message: 'Evaluation is already finalized and cannot be changed' });
      }

      evaluation.isFinalized     = true;
      evaluation.sentToTraineeAt = new Date();
      evaluation.status          = 'completed';
      await evaluation.save();

      const targetId = evaluation.student || evaluation.traineeId;
      if (targetId) {
        await Notification.create({
          user:    targetId,
          message: 'Your evaluation has been finalized and is now visible in your grades page.'
        });
      }

      const populated = await Evaluation.findById(evaluation._id)
        .populate('student',   'name initials photoUrl')
        .populate('traineeId', 'name initials photoUrl')
        .populate('hospital',  'name');

      res.json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
