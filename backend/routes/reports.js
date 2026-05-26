const router         = require('express').Router();
const multer         = require('multer');
const path           = require('path');
const Report         = require('../models/Report');
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
    const reports = await Report.find({ student: req.params.id })
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });   // -1 = newest first
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/reports/hospital/:hospitalId — all reports from students at a hospital (for doctors)
router.get('/hospital/:hospitalId', auth, allowRoles('doctor', 'professor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const reports = await Report.find({ hospital: req.params.hospitalId })
      .populate('student',  'name initials photoUrl')
      .populate('hospital', 'name')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/doctor/:doctorId — all reports from students assigned to this doctor (via rotations)
router.get('/doctor/:doctorId', auth, allowRoles('doctor', 'professor', 'admin', 'super_admin'), async (req, res) => {
  try {
    const Rotation = require('../models/Rotation');
    const rotations = await Rotation.find({ doctor: req.params.doctorId }).select('_id');
    if (!rotations.length) return res.json([]);
    const rotationIds = rotations.map(r => r._id);
    const reports = await Report.find({ rotation: { $in: rotationIds } })
      .populate('student',  'name initials photoUrl studentId email phone')
      .populate('hospital', 'name')
      .populate('rotation', 'startDate endDate status')
      .populate('gradedBy', 'name initials')
      .sort({ date: -1 });
    res.json(reports);
  } catch (err) {
    console.error('GET /reports/doctor error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reports/rotation/:rotationId — reports grouped under one rotation
router.get('/rotation/:rotationId', auth, async (req, res) => {
  try {
    const reports = await Report.find({ rotation: req.params.rotationId })
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
router.post('/', auth, allowRoles('student', 'trainee'), upload.single('file'), async (req, res) => {
  try {
    const { title, type, date, rotation, hospital } = req.body;

    // If a file was uploaded, req.file will have the file info
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const report = await Report.create({
      student: req.user._id,
      rotation,
      hospital,
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
router.put('/:id/grade', auth, allowRoles('doctor', 'professor'), async (req, res) => {
  try {
    const { grade: letterGrade, globalRating, assessmentCriteria, assessorComments, assessorSignature, traineeSignature } = req.body;
    if (!globalRating) return res.status(400).json({ message: 'Global rating is required' });

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
        gradedAt: new Date()
      },
      { new: true }
    ).populate('student', 'name initials photoUrl studentId').populate('hospital', 'name').populate('gradedBy', 'name initials');

    if (!report) return res.status(404).json({ message: 'Report not found' });

    await Notification.create({
      user:    report.student._id,
      message: `Your ${report.type} report "${report.title}" has been assessed: ${report.grade}`
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
