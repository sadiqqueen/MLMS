// backend/routes/programDirector.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const { coerceRoleToTrack } = require('../utils/track');
const { specialtyIdsForName, specialtyUserMatch } = require('../utils/pdScope');
const User           = require('../models/User');
const Rotation       = require('../models/Rotation');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const Notification   = require('../models/Notification');

const PD = ['program_director'];

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
router.get('/trainees', auth, allowRoles(...PD), async (req, res) => {
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
router.get('/supervisors', auth, allowRoles(...PD), async (req, res) => {
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
router.get('/reports', auth, allowRoles(...PD), async (req, res) => {
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
// All trainee evaluations for this program director's specialty.
router.get('/evaluations', auth, allowRoles(...PD), async (req, res) => {
  try {
    const info = await requirePdSpecialty(req, res);
    if (!info) return;

    const trainees = await User.find({
      role: coerceRoleToTrack('trainee', req.track),
      isActive: { $ne: false },
      ...specialtyUserMatch(info)
    }).select('_id');
    const traineeIds = trainees.map(t => t._id);

    const evaluations = await Evaluation.find({
      // Never surface supervisor-subject evaluations (DIO-authored) in this
      // trainee-evaluations list. Legacy docs have no evaluateeRole and are
      // kept via $ne.
      evaluateeRole: { $ne: 'supervisor' },
      $or: [
        { traineeId: { $in: traineeIds } },
        { student:    { $in: traineeIds } }
      ]
    })
      .populate('student',      'name email initials photoUrl studentId')
      .populate('traineeId',    'name email initials photoUrl studentId')
      .populate('doctor',       'name initials')
      .populate('supervisorId', 'name initials')
      .populate('hospital',     'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: evaluations });
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
