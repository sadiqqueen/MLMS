// backend/routes/research.js
// Trainee researches & publications.
//   - A trainee submits a research; it is routed to their supervisor for approval.
//   - Supervisor approves  → status becomes 'approved' (it is now a Publication).
//   - Supervisor rejects   → status becomes 'rejected'.
//   - The trainee sets each publication Public or Private.
//       private → trainee + supervisor only
//       public  → trainee + supervisor + Program Directors + DIOs
const router         = require('express').Router();
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { decodeOriginalName } = require('../utils/filename');
const Research       = require('../models/Research');
const User           = require('../models/User');
const Rotation       = require('../models/Rotation');
const Distribution   = require('../models/Distribution');
const Notification   = require('../models/Notification');

// ── MULTER SETUP ──────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/research');
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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpeg|jpg|png/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase())
            && allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only PDF and image files are allowed'));
  }
});

const PUBLIC_VIEW_ROLES = ['program_director', 'dio', 'president'];

// Trainees assigned to a supervisor (direct link + research-supervisor link +
// rotations + legacy distributions).
async function getAssignedTraineeIds(supervisorId) {
  const [directTrainees, researchTrainees, distributions, rotations] = await Promise.all([
    User.find({ supervisorId, role: 'trainee', isActive: { $ne: false } }).select('_id'),
    User.find({ researchSupervisorId: supervisorId, role: 'trainee', isActive: { $ne: false } }).select('_id'),
    Distribution.find({
      $or: [
        { supervisorId, traineeId: { $ne: null } },
        { doctor: supervisorId, student: { $ne: null } }
      ]
    }).select('traineeId student'),
    // Only active/upcoming rotations count as an assignment — matches
    // supervisor.js so a former (completed/cancelled) supervisor does not
    // retain access to a trainee's private publications.
    Rotation.find({
      $or: [{ supervisorId }, { doctor: supervisorId }],
      status: { $in: ['current', 'upcoming'] }
    }).select('traineeId student'),
  ]);

  return new Set([
    ...directTrainees.map(t => t._id),
    ...researchTrainees.map(t => t._id),
    ...distributions.map(d => d.traineeId).filter(Boolean),
    ...distributions.map(d => d.student).filter(Boolean),
    ...rotations.map(r => r.traineeId).filter(Boolean),
    ...rotations.map(r => r.student).filter(Boolean),
  ].map(id => id.toString()));
}

// Resolve the supervisor a new research submission should be routed to.
// The dedicated research supervisor takes precedence; otherwise fall back to the
// current-rotation supervisor and then the trainee's clinical supervisor.
async function resolveSupervisorId(trainee) {
  if (trainee.researchSupervisorId) return trainee.researchSupervisorId;
  const rot = await Rotation.findOne({
    $or: [{ traineeId: trainee._id }, { student: trainee._id }],
    status: { $in: ['current', 'upcoming'] }
  }).sort({ startDate: -1 }).select('supervisorId doctor');
  const fromRot = rot?.supervisorId || rot?.doctor;
  return fromRot || trainee.supervisorId || trainee.supervisor || trainee.doctor || null;
}

const populateTrainee = q => q.populate('trainee', 'name email studentId initials photoUrl');

// ── TRAINEE ────────────────────────────────────────────────────────────────

// GET /api/research/mine — the trainee's own researches + publications
router.get('/mine', auth, allowRoles('trainee'), async (req, res) => {
  try {
    const items = await Research.find({ trainee: req.user._id })
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/research — trainee submits a research (optional file) → supervisor
router.post('/', auth, allowRoles('trainee'), (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const { title, authors, journal, abstract } = req.body;
      if (!title || !String(title).trim()) {
        return res.status(400).json({ message: 'Title is required' });
      }
      const supervisorId = await resolveSupervisorId(req.user);
      const doc = await Research.create({
        trainee:    req.user._id,
        supervisor: supervisorId,
        title:      String(title).trim(),
        authors:    authors ? String(authors).trim() : '',
        journal:    journal ? String(journal).trim() : '',
        abstract:   abstract ? String(abstract).trim() : '',
        fileUrl:    req.file ? `/uploads/research/${req.file.filename}` : '',
        fileName:   req.file ? decodeOriginalName(req.file) : '',
        status:     'pending',
        visibility: 'private',
        track:      req.track,
      });
      if (supervisorId) {
        await Notification.create({
          user:    supervisorId,
          message: `${req.user.name} submitted a research for your approval: "${doc.title}"`
        }).catch(e => console.error('[Notification] research submit:', e.message));
      }
      res.status(201).json({ success: true, data: doc });
    } catch (e) {
      res.status(500).json({ message: 'Server error', error: e.message });
    }
  });
});

// PATCH /api/research/:id/visibility — trainee sets Public/Private on own approved research
router.patch('/:id/visibility', auth, allowRoles('trainee'), async (req, res) => {
  try {
    const visibility = req.body.visibility === 'public' ? 'public' : 'private';
    const doc = await Research.findOne({ _id: req.params.id, trainee: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved publications can be made public or private' });
    }
    doc.visibility = visibility;
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/research/:id — trainee removes their own submission
router.delete('/:id', auth, allowRoles('trainee'), async (req, res) => {
  try {
    const doc = await Research.findOneAndDelete({ _id: req.params.id, trainee: req.user._id });
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.fileUrl) {
      const abs = path.join(__dirname, '..', doc.fileUrl.replace(/^\//, ''));
      fs.promises.unlink(abs).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ── STAFF (view a trainee's researches/publications on the trainee card) ─────

// GET /api/research/trainee/:traineeId — role-scoped view:
//   supervisor (assigned) / super_admin → all submissions (needed to approve; sees private)
//   program_director / dio / president  → approved + public publications only
router.get('/trainee/:traineeId',
  auth,
  allowRoles('supervisor', 'program_director', 'dio', 'president', 'super_admin'),
  async (req, res) => {
    try {
      const traineeId = req.params.traineeId;
      let filter;
      if (req.user.role === 'supervisor') {
        const assigned = await getAssignedTraineeIds(req.user._id);
        if (!assigned.has(traineeId.toString())) {
          return res.status(403).json({ message: 'Access denied' });
        }
        filter = { trainee: traineeId };
      } else if (req.user.role === 'super_admin') {
        filter = { trainee: traineeId };
      } else {
        // PD / DIO / president → only public publications
        filter = { trainee: traineeId, status: 'approved', visibility: 'public' };
      }
      const items = await populateTrainee(Research.find(filter).populate('reviewedBy', 'name'))
        .sort({ createdAt: -1 });
      res.json({ success: true, data: items });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

// ── SUPERVISOR (approve / reject) ────────────────────────────────────────────

async function ensureSupervisorCanReview(req, doc) {
  if (req.user.role === 'super_admin') return true;
  if (doc.supervisor && doc.supervisor.toString() === req.user._id.toString()) return true;
  const assigned = await getAssignedTraineeIds(req.user._id);
  return assigned.has(doc.trainee.toString());
}

// PATCH /api/research/:id/approve — supervisor approves → auto-moves to Publications
router.patch('/:id/approve', auth, allowRoles('supervisor', 'super_admin'), async (req, res) => {
  try {
    const doc = await Research.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (!(await ensureSupervisorCanReview(req, doc))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    doc.status     = 'approved';
    doc.reviewedBy = req.user._id;
    doc.reviewedAt = new Date();
    doc.reviewNote = req.body.note ? String(req.body.note).trim() : '';
    if (!doc.supervisor) doc.supervisor = req.user._id;
    await doc.save();
    await Notification.create({
      user:    doc.trainee,
      message: `Your research "${doc.title}" was approved and moved to Publications.`
    }).catch(e => console.error('[Notification] research approve:', e.message));
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/research/:id/reject — supervisor rejects
router.patch('/:id/reject', auth, allowRoles('supervisor', 'super_admin'), async (req, res) => {
  try {
    const doc = await Research.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (!(await ensureSupervisorCanReview(req, doc))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    doc.status     = 'rejected';
    doc.reviewedBy = req.user._id;
    doc.reviewedAt = new Date();
    doc.reviewNote = req.body.note ? String(req.body.note).trim() : '';
    if (!doc.supervisor) doc.supervisor = req.user._id;
    await doc.save();
    await Notification.create({
      user:    doc.trainee,
      message: `Your research "${doc.title}" was not approved by your supervisor.`
    }).catch(e => console.error('[Notification] research reject:', e.message));
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
