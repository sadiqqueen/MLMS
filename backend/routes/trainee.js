// backend/routes/trainee.js
const router       = require('express').Router();
const auth         = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const scopeGuard   = require('../middleware/scopeGuard');
const Distribution = require('../models/Distribution');
const Report       = require('../models/Report');
const Evaluation   = require('../models/Evaluation');

const TRAINEE = ['trainee', 'student'];

// GET /api/trainee/timeline
// Returns all distributions (rotations) for this trainee
router.get('/timeline', auth, allowRoles(...TRAINEE), scopeGuard(), async (req, res) => {
  try {
    const distributions = await Distribution.find({ traineeId: req.user._id })
      .populate('supervisorId', 'name specialty initials photoUrl')
      .populate('specialtyId',  'name')
      .populate('hospitalId',   'name city')
      .sort({ startDate: 1 });

    // Also support legacy field
    const legacy = await Distribution.find({ doctor: req.user._id })
      .populate('doctor',   'name specialty initials photoUrl')
      .populate('hospital', 'name city')
      .sort({ startDate: 1 });

    const combined = distributions.length ? distributions : legacy;
    res.json({ success: true, data: combined });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trainee/reports
// Returns active distribution info (with specialty PDF links) + all submitted reports
router.get('/reports', auth, allowRoles(...TRAINEE), scopeGuard(), async (req, res) => {
  try {
    // Find active distribution
    const distribution = await Distribution.findOne({
      traineeId: req.user._id,
      status: 'active'
    })
      .populate('specialtyId', 'name weeklyReportPdf monthlyReportPdf finalReportPdf')
      .populate('hospitalId',  'name')
      .populate('supervisorId','name');

    // Get all reports for this trainee
    const reports = await Report.find({ student: req.user._id })
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });

    res.json({ success: true, data: { distribution, reports } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trainee/grades
// Returns finalized evaluations from supervisor + final report grades from program director
router.get('/grades', auth, allowRoles(...TRAINEE), scopeGuard(), async (req, res) => {
  try {
    // Evaluations that have been finalized and sent to trainee
    const evaluations = await Evaluation.find({
      $or: [
        { student:   req.user._id, isFinalized: true },
        { traineeId: req.user._id, isFinalized: true }
      ]
    })
      .populate('doctor',       'name initials specialty')
      .populate('supervisorId', 'name initials specialty')
      .populate('hospital',     'name')
      .sort({ sentToTraineeAt: -1 });

    // Final reports that have been graded by program director
    const finalReports = await Report.find({
      student: req.user._id,
      type:    'final',
      grade:   { $exists: true, $ne: null }
    })
      .populate('gradedBy', 'name initials')
      .populate('hospital', 'name')
      .sort({ gradedAt: -1 });

    res.json({ success: true, data: { evaluations, finalReports } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
