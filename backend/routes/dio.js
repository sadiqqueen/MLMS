// backend/routes/dio.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const { v4: uuidv4 } = require('uuid');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Distribution   = require('../models/Distribution');
const Certificate    = require('../models/Certificate');
const Notification   = require('../models/Notification');

const DIO = ['dio'];

function getHospital(user) {
  return user.hospitalId || user.hospital || null;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      User.countDocuments({ role: 'trainee',          ...hospitalQuery, isActive: { $ne: false } }),
      User.countDocuments({ role: 'supervisor',       ...hospitalQuery, isActive: { $ne: false } }),
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
router.get('/trainees', auth, allowRoles(...DIO, 'professor'), async (req, res) => {
  try {
    const hospitalId = getHospital(req.user);
    const { search } = req.query;
    const query = { role: { $in: ['trainee', 'student'] }, isActive: { $ne: false } };
    if (hospitalId) query.$or = [{ hospitalId }, { hospital: hospitalId }];
    if (search) {
      const rx = new RegExp(escapeRegex(search.slice(0, 100)), 'i');
      const searchOr = [{ name: rx }, { studentId: rx }];
      query.$and = [
        ...(query.$or ? [{ $or: query.$or }] : []),
        { $or: searchOr }
      ];
      delete query.$or;
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
  allowRoles(...DIO, 'professor', 'super_admin'),
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
        ...req.body,
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
