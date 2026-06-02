// backend/routes/dio.js
const router         = require('express').Router();
const mongoose       = require('mongoose');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const { v4: uuidv4 } = require('uuid');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Distribution   = require('../models/Distribution');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const Certificate    = require('../models/Certificate');
const Notification   = require('../models/Notification');
const AuditLog       = require('../models/AuditLog');

const DIO = ['dio'];

function getHospital(user) {
  return user.hospitalId || user.hospital || null;
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

// GET /api/dio/stats
// Dashboard statistics — scoped to this DIO's hospital
router.get('/stats', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
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
      Distribution.countDocuments({
        ...(hospitalId ? { $or: [{ hospitalId }, { hospital: hospitalId }] } : {}),
        status: 'active'
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

    // Chart: distributions by specialty
    const distributionsBySpecialty = await Distribution.aggregate([
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
    const { search } = req.query;
    const query = { role: 'trainee', isActive: { $ne: false } };
    if (search) {
      const rx = new RegExp(escapeRegex(search.slice(0, 100)), 'i');
      query.$or = [{ name: rx }, { studentId: rx }];
    }

    const trainees = await User.find(query)
      .select('name email studentId specialtyId hospitalId supervisorId supervisor initials photoUrl year specialty hospital')
      .populate('hospitalId',  'name city')
      .populate('hospital',    'name city')
      .populate('specialtyId', 'name')
      .populate('supervisorId', 'name email')
      .populate('supervisor', 'name email')
      .sort({ name: 1 });
    if (search) trainees.splice(20);
    else trainees.splice(200);

    res.json({ success: true, data: trainees });
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

    const hospitalId = trainee.hospitalId?._id || trainee.hospital?._id || trainee.hospitalId || trainee.hospital;
    const [currentRotation, programDirector, reports, evaluations, certificates] = await Promise.all([
      Distribution.findOne({
        $or: [{ traineeId: trainee._id }, { student: trainee._id }],
        status: 'active'
      })
        .sort({ startDate: -1 })
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
router.get('/supervisors', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
    const query = { role: 'supervisor', isActive: { $ne: false } };
    if (hospitalId) query.$or = [{ hospitalId }, { hospital: hospitalId }];

    const supervisors = await User.find(query)
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/program-directors
router.get('/program-directors', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
    const query = { role: 'program_director', isActive: { $ne: false } };
    if (hospitalId) query.$or = [{ hospitalId }, { hospital: hospitalId }];

    const pds = await User.find(query)
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: pds });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/dio/secretaries
router.get('/secretaries', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
    const query = { role: 'secretary', isActive: { $ne: false } };
    if (hospitalId) query.$or = [{ hospitalId }, { hospital: hospitalId }];

    const secretaries = await User.find(query)
      .select('-password')
      .populate('hospitalId',  'name city')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    res.json({ success: true, data: secretaries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/dio/secretaries/:id
// DIO can assign secretary to specialty or activate/deactivate
router.patch('/secretaries/:id',
  auth,
  allowRoles(...DIO),
  auditLog('update_secretary', 'User'),
  async (req, res) => {
    try {
      const secretary = await User.findById(req.params.id);
      if (!secretary) return res.status(404).json({ message: 'User not found' });

      // Scope: DIO can only modify secretaries within their own hospital
      const hospitalId = getHospital(req.user);
      const secHosp = secretary.hospitalId?.toString() || secretary.hospital?.toString();
      if (hospitalId && secHosp !== hospitalId.toString()) {
        return res.status(403).json({ message: 'Access denied: secretary belongs to a different hospital' });
      }

      const { specialtyId, isActive } = req.body;
      const update = {};
      if (specialtyId !== undefined) update.specialtyId = specialtyId;
      if (isActive    !== undefined) update.isActive    = isActive;

      const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true })
        .select('-password')
        .populate('hospitalId',  'name')
        .populate('specialtyId', 'name');

      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// GET /api/dio/certificates
router.get('/certificates', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
    const query = hospitalId ? { hospital: hospitalId } : {};

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
        });
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
