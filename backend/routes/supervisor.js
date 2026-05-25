// backend/routes/supervisor.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const Distribution   = require('../models/Distribution');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const Notification   = require('../models/Notification');

const SUPERVISOR = ['supervisor'];

// GET /api/supervisor/trainees
// Returns all trainees assigned to this supervisor with their distribution info
router.get('/trainees', auth, allowRoles(...SUPERVISOR), async (req, res) => {
  try {
    const distributions = await Distribution.find({
      $or: [
        { supervisorId: req.user._id },
        { doctor:       req.user._id }
      ]
    })
      .populate('traineeId',  'name email initials photoUrl studentId year phone city')
      .populate('hospitalId', 'name city')
      .populate('specialtyId','name')
      .populate('hospital',   'name city')
      .sort({ startDate: -1 });

    res.json({ success: true, data: distributions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/supervisor/reports
// Returns weekly and monthly reports for supervisor's assigned trainees (NOT final)
router.get('/reports', auth, allowRoles(...SUPERVISOR), async (req, res) => {
  try {
    const distributions = await Distribution.find({
      $or: [
        { supervisorId: req.user._id },
        { doctor:       req.user._id }
      ]
    }).select('traineeId student');

    const traineeIds = [
      ...distributions.map(d => d.traineeId).filter(Boolean),
      ...distributions.map(d => d.student).filter(Boolean)
    ];

    const reports = await Report.find({
      student: { $in: traineeIds },
      type:    { $in: ['weekly', 'monthly'] }
    })
      .populate('student',  'name initials photoUrl studentId')
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
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
      const { status, reviewNote } = req.body;
      if (!['approved', 'rejected', 'graded'].includes(status)) {
        return res.status(400).json({ message: 'Status must be approved, rejected, or graded' });
      }

      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ message: 'Report not found' });

      if (report.type === 'final') {
        return res.status(403).json({ message: 'Final reports can only be graded by the Program Director' });
      }

      report.status     = status;
      report.reviewNote = reviewNote || '';
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
      const { traineeId, distributionId, scores, comments, grade, specialty, hospitalId, evaluationType, notes } = req.body;

      const targetTrainee = traineeId || req.body.student;
      if (!targetTrainee) return res.status(400).json({ message: 'traineeId is required' });

      // Calculate totalScore from scores object
      let totalScore = 0;
      if (scores && typeof scores === 'object') {
        const values = Object.values(scores).map(Number).filter(n => !isNaN(n));
        totalScore = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
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
