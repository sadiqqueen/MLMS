// backend/routes/programDirector.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const User           = require('../models/User');
const Distribution   = require('../models/Distribution');
const Report         = require('../models/Report');
const Notification   = require('../models/Notification');

const PD = ['program_director'];

function getHospital(user) {
  return user.hospitalId || user.hospital || null;
}

// GET /api/program-director/trainees
// All trainees in this program director's hospital, across all specialties
router.get('/trainees', auth, allowRoles(...PD), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);

    const trainees = await User.find({
      role:     'trainee',
      $or:      [{ hospitalId }, { hospital: hospitalId }],
      isActive: { $ne: false }
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    const traineeIds = trainees.map(t => t._id);
    const distributions = await Distribution.find({
      $or: [
        { traineeId: { $in: traineeIds } },
        { hospitalId }
      ]
    })
      .populate('specialtyId',  'name')
      .populate('supervisorId', 'name')
      .sort({ startDate: -1 });

    res.json({ success: true, data: { trainees, distributions } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/program-director/supervisors
// All supervisors in this hospital
router.get('/supervisors', auth, allowRoles(...PD), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);

    const supervisors = await User.find({
      role:     'supervisor',
      $or:      [{ hospitalId }, { hospital: hospitalId }],
      isActive: { $ne: false }
    })
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    const supervisorIds = supervisors.map(s => s._id);
    const distCounts = await Distribution.aggregate([
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
// Final reports only — for grading by program director
router.get('/reports', auth, allowRoles(...PD), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);

    const trainees = await User.find({
      role: 'trainee',
      $or:  [{ hospitalId }, { hospital: hospitalId }]
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

// PATCH /api/program-director/reports/:id/grade
// Grade a final report — only program director can do this
router.patch('/reports/:id/grade',
  auth,
  allowRoles(...PD),
  auditLog('grade_final_report', 'Report'),
  async (req, res) => {
    try {
      const { grade, globalRating, assessmentCriteria, assessorComments, reviewNote } = req.body;

      const report = await Report.findById(req.params.id);
      if (!report) return res.status(404).json({ message: 'Report not found' });
      if (report.type !== 'final') {
        return res.status(400).json({ message: 'Only final reports can be graded by the Program Director' });
      }

      report.grade              = grade || (globalRating === 'competent' ? 'Competent' : 'Not-Competent');
      report.globalRating       = globalRating       || null;
      report.assessmentCriteria = assessmentCriteria || {};
      report.assessorComments   = assessorComments   || reviewNote || '';
      report.reviewNote         = reviewNote         || assessorComments || '';
      report.reviewedBy         = req.user._id;
      report.gradedBy           = req.user._id;
      report.gradedAt           = new Date();
      report.status             = 'graded';
      await report.save();

      const populated = await Report.findById(report._id)
        .populate('student',  'name initials photoUrl studentId')
        .populate('hospital', 'name')
        .populate('gradedBy', 'name initials');

      await Notification.create({
        user:    report.student,
        message: `Your final report has been graded by the Program Director: ${report.grade}`
      });

      res.json({ success: true, data: populated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
