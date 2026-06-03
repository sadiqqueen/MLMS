// backend/routes/trainee.js
const router       = require('express').Router();
const auth         = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const scopeGuard   = require('../middleware/scopeGuard');
const Distribution = require('../models/Distribution');
const Rotation     = require('../models/Rotation');
const Report       = require('../models/Report');
const Evaluation   = require('../models/Evaluation');

const TRAINEE = ['trainee'];

function uniqueById(items) {
  const seen = new Set();
  return items.filter(item => {
    const id = item?._id?.toString();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// GET /api/trainee/timeline
// Returns all rotations for this trainee. Legacy trainee distributions are appended
// only if no real rotations exist, preserving old data without making it authoritative.
router.get('/timeline', auth, allowRoles(...TRAINEE), scopeGuard(), async (req, res) => {
  try {
    const rotations = await Rotation.find({
      $or: [
        { traineeId: req.user._id },
        { student: req.user._id }
      ]
    })
      .populate('supervisorId', 'name specialty initials photoUrl')
      .populate('doctor',       'name specialty initials photoUrl')
      .populate('specialtyId',  'name')
      .populate('hospitalId',   'name city')
      .populate('hospital',     'name city')
      .sort({ startDate: 1 });

    if (rotations.length) {
      return res.json({ success: true, data: uniqueById(rotations) });
    }

    const legacyDistributions = await Distribution.find({
      $or: [
        { traineeId: req.user._id },
        { student: req.user._id }
      ]
    })
      .populate('supervisorId', 'name specialty initials photoUrl')
      .populate('doctor',       'name specialty initials photoUrl')
      .populate('specialtyId',  'name')
      .populate('hospitalId',   'name city')
      .populate('hospital',     'name city')
      .sort({ startDate: 1 });

    res.json({ success: true, data: uniqueById(legacyDistributions) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/trainee/reports
// Returns active distribution info (with specialty PDF links) + all submitted reports
router.get('/reports', auth, allowRoles(...TRAINEE), scopeGuard(), async (req, res) => {
  try {
    const currentRotation = await Rotation.findOne({
      $or: [
        { traineeId: req.user._id },
        { student: req.user._id }
      ],
      status: 'current'
    })
      .populate('specialtyId', 'name weeklyReportPdf monthlyReportPdf finalReportPdf')
      .populate('hospitalId',  'name')
      .populate('hospital',    'name')
      .populate('supervisorId','name')
      .populate('doctor',      'name');

    // Legacy fallback only for old data that has not yet been migrated.
    const distribution = currentRotation || await Distribution.findOne({
      $or: [
        { traineeId: req.user._id },
        { student: req.user._id }
      ],
      status: 'active'
    })
      .populate('specialtyId', 'name weeklyReportPdf monthlyReportPdf finalReportPdf')
      .populate('hospitalId',  'name')
      .populate('hospital',    'name')
      .populate('supervisorId','name')
      .populate('doctor',      'name');

    // Get all reports for this trainee
    const reports = await Report.find({ student: req.user._id })
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
      .populate('distribution', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });

    res.json({ success: true, data: { distribution, currentRotation, reports } });
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

    // Final reports that have been graded by program director, DIO, or super admin.
    // Score-only grades must still show on the trainee grades page.
    const finalReports = await Report.find({
      student: req.user._id,
      type:    'final',
      $or: [
        { grade: { $exists: true, $nin: [null, ''] } },
        { score: { $exists: true, $ne: null } },
        { globalRating: { $exists: true, $nin: [null, ''] } },
        { status: 'graded' }
      ]
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
