const router         = require('express').Router();
const mongoose       = require('mongoose');
const multer         = require('multer');
const path           = require('path');
const Report         = require('../models/Report');
const Distribution   = require('../models/Distribution');
const Rotation       = require('../models/Rotation');
const Notification   = require('../models/Notification');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// ── MULTER SETUP ──────────────────────────────────────────────────────────
// Multer handles multipart/form-data requests (requests that include files).
// Without Multer, you can't receive uploaded files in Express.

// "diskStorage" saves the file to disk (as opposed to memory)
const storage = multer.diskStorage({

  // Where to save the file
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),

  // What to name the file — we generate a unique name to avoid collisions
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
    //                  ↑ keeps the original extension, e.g. ".pdf"
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB max
  fileFilter: (req, file, cb) => {
    // Only allow PDF and image files
    const allowed = /pdf|jpeg|jpg|png/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase())
            && allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only PDF and image files are allowed'));
  }
});

// ── ROUTES ────────────────────────────────────────────────────────────────

// GET /api/reports/student/:id — all reports for a student
router.get('/student/:id', auth, async (req, res) => {
  try {
    const isOwner = req.params.id === req.user._id.toString();
    const isStaff = ['trainer', 'program_director', 'developer', 'odio'].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const reports = await Report.find({ student: req.params.id })
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
      .populate('distribution', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });   // -1 = newest first
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reports/hospital/:hospitalId — all reports from students at a hospital (for doctors)
router.get('/hospital/:hospitalId', auth, allowRoles('trainer', 'program_director', 'odio', 'developer'), async (req, res) => {
  try {
    const reports = await Report.find({ hospital: req.params.hospitalId })
      .populate('student',  'name initials photoUrl')
      .populate('hospital', 'name')
      .populate('distribution', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/doctor/:doctorId — all reports from students assigned to this doctor (via rotations)
router.get('/doctor/:doctorId', auth, allowRoles('trainer', 'program_director', 'odio', 'developer'), async (req, res) => {
  try {
    const isOwner = req.params.doctorId === req.user._id.toString();
    const isElevated = ['program_director', 'odio', 'developer'].includes(req.user.role);
    if (!isOwner && !isElevated) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const rotations = await Rotation.find({
      $or: [
        { doctor: req.params.doctorId },
        { supervisorId: req.params.doctorId }
      ]
    }).select('_id traineeId student');
    const distributions = await Distribution.find({
      $or: [
        { supervisorId: req.params.doctorId },
        { doctor: req.params.doctorId }
      ]
    }).select('_id traineeId student');

    const rotationIds = rotations.map(r => r._id);
    const distributionIds = distributions.map(d => d._id);
    const traineeIds = [
      ...rotations.map(r => r.traineeId).filter(Boolean),
      ...rotations.map(r => r.student).filter(Boolean),
      ...distributions.map(d => d.traineeId).filter(Boolean),
      ...distributions.map(d => d.student).filter(Boolean)
    ];

    const reports = await Report.find({
      $or: [
        { rotation: { $in: rotationIds } },
        { distribution: { $in: distributionIds } },
        { student: { $in: traineeIds } }
      ]
    })
      .populate('student',  'name initials photoUrl studentId email phone')
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
      .populate('distribution', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });
    res.json(reports);
  } catch (err) {
    console.error('GET /reports/doctor error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/rotation/:rotationId — reports grouped under one rotation
router.get('/rotation/:rotationId', auth, allowRoles('trainer', 'program_director', 'developer', 'odio'), async (req, res) => {
  try {
    const reports = await Report.find({
      $or: [
        { rotation: req.params.rotationId },
        { distribution: req.params.rotationId }
      ]
    })
      .populate('student', 'name initials studentId')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/reports — student submits a report (with optional file)
// Note: "upload.single('file')" is middleware that processes one uploaded file
//       named "file" from the form data, then puts it on req.file
router.post('/', auth, allowRoles('trainee'), upload.single('file'), async (req, res) => {
  try {
    const { title, type, date, rotation, hospital } = req.body;
    const assignmentId = req.body.distribution || req.body.distributionId || rotation;
    let rotationId = null;
    let distributionId = null;
    let hospitalId = hospital || null;

    if (assignmentId && mongoose.Types.ObjectId.isValid(assignmentId)) {
      const rotationDoc = await Rotation.findOne({
        _id: assignmentId,
        $or: [
          { traineeId: req.user._id },
          { student: req.user._id }
        ]
      });

      if (rotationDoc) {
        rotationId = rotationDoc._id;
        hospitalId = rotationDoc.hospitalId || rotationDoc.hospital || hospitalId;
      } else {
        const legacyDistribution = await Distribution.findOne({
          _id: assignmentId,
          $or: [
            { traineeId: req.user._id },
            { student: req.user._id }
          ]
        });
        if (legacyDistribution) {
          distributionId = legacyDistribution._id;
          hospitalId = legacyDistribution.hospitalId || legacyDistribution.hospital || hospitalId;
        }
      }
    }

    // If a file was uploaded, req.file will have the file info
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const report = await Report.create({
      student: req.user._id,
      rotation: rotationId,
      distribution: distributionId,
      hospital: hospitalId,
      title,
      type,
      date,
      fileUrl,
      locked: true,       // locked immediately — student can't change it after submitting
      status: 'pending'
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/reports/:id/grade — doctor submits assessment form
router.put('/:id/grade', auth, allowRoles('trainer', 'program_director', 'developer'), async (req, res) => {
  try {
    const { grade: letterGrade, globalRating, assessmentCriteria, assessorComments, assessorSignature, traineeSignature } = req.body;
    if (!globalRating) return res.status(400).json({ message: 'Global rating is required' });

    const existing = await Report.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Report not found' });

    if (!['developer', 'odio'].includes(req.user.role)) {
      const rotation = await Rotation.findOne({
        $or: [
          { traineeId: existing.student, supervisorId: req.user._id },
          { student: existing.student, doctor: req.user._id },
          { traineeId: existing.student, doctor: req.user._id },
          { _id: existing.rotation, supervisorId: req.user._id },
          { _id: existing.rotation, doctor: req.user._id }
        ]
      });
      const dist = !rotation ? await Distribution.findOne({
        $or: [
          { traineeId: existing.student, supervisorId: req.user._id },
          { student: existing.student, doctor: req.user._id },
          { traineeId: existing.student, doctor: req.user._id },
          { _id: existing.distribution, supervisorId: req.user._id },
          { _id: existing.distribution, doctor: req.user._id }
        ]
      }) : null;
      if (!dist && !rotation) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this trainee' });
      }
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        grade:       letterGrade || (globalRating === 'competent' ? 'Competent' : 'Not-Competent'),
        globalRating,
        assessmentCriteria: assessmentCriteria || {},
        assessorComments:   assessorComments   || '',
        assessorSignature:  assessorSignature  || '',
        traineeSignature:   traineeSignature   || '',
        status:   'graded',
        gradedBy: req.user._id,
        gradedByRole: req.user.role,
        gradedAt: new Date()
      },
      { new: true }
    ).populate('student', 'name initials photoUrl studentId').populate('hospital', 'name').populate('distribution', 'startDate endDate status').populate('gradedBy', 'name initials');

    if (!report) return res.status(404).json({ message: 'Report not found' });

    if (report.student?._id) {
      await Notification.create({
        user:    report.student._id,
        message: `Your ${report.type} report "${report.title}" has been assessed: ${report.grade}`
      });
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
