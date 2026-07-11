// backend/routes/traineeCourses.js
// Trainee-uploaded courses & certificates (self-reported portfolio items).
// The trainee owns write access; Supervisor / PD / DIO / super_admin / president
// can read a trainee's items to surface them on the trainee card. Mirrors the
// multer + /uploads convention from routes/reports.js.
const router         = require('express').Router();
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { decodeOriginalName } = require('../utils/filename');
const TraineeCourse  = require('../models/TraineeCourse');

// ── MULTER SETUP ──────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/trainee-courses');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB max
  fileFilter: (req, file, cb) => {
    // Validate BOTH extension and mimetype (same as reports.js).
    const allowed = /pdf|jpeg|jpg|png/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase())
            && allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only PDF and image files are allowed'));
  }
});

// Staff roles allowed to READ a trainee's uploads (mirrors reports.js /student/:id
// staff set, plus president, who also views trainee cards). Backend is the source
// of truth; the frontend guards are UX only.
const STAFF = ['supervisor', 'program_director', 'dio', 'super_admin', 'president'];

// GET /api/trainee-courses/mine — the trainee's own uploads
router.get('/mine', auth, allowRoles('trainee'), async (req, res) => {
  try {
    const items = await TraineeCourse.find({ trainee: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/trainee-courses/trainee/:traineeId — staff view a trainee's uploads
router.get('/trainee/:traineeId', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const items = await TraineeCourse.find({ trainee: req.params.traineeId }).sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/trainee-courses — trainee uploads a course/certificate (optional file)
router.post('/', auth, allowRoles('trainee'), (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const { title, issuer, kind, completedDate } = req.body;
      if (!title || !String(title).trim()) {
        return res.status(400).json({ message: 'Title is required' });
      }
      const doc = await TraineeCourse.create({
        trainee:       req.user._id,
        title:         String(title).trim(),
        issuer:        issuer ? String(issuer).trim() : '',
        kind:          kind === 'course' ? 'course' : 'certificate',
        completedDate: completedDate || null,
        fileUrl:       req.file ? `/uploads/trainee-courses/${req.file.filename}` : '',
        fileName:      req.file ? decodeOriginalName(req.file) : '',
        track:         req.track,
      });
      res.status(201).json({ success: true, data: doc });
    } catch (e) {
      res.status(500).json({ message: 'Server error', error: e.message });
    }
  });
});

// DELETE /api/trainee-courses/:id — trainee removes their own upload
router.delete('/:id', auth, allowRoles('trainee'), async (req, res) => {
  try {
    const doc = await TraineeCourse.findOneAndDelete({ _id: req.params.id, trainee: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.fileUrl) {
      const abs = path.join(__dirname, '..', doc.fileUrl.replace(/^\//, ''));
      fs.promises.unlink(abs).catch(() => {});   // best-effort file cleanup
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
