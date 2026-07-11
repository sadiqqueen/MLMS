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
const { coerceRoleToTrack } = require('../utils/track');
const Research       = require('../models/Research');
const User           = require('../models/User');
const Rotation       = require('../models/Rotation');
const Distribution   = require('../models/Distribution');
const Notification   = require('../models/Notification');
const AuditLog       = require('../models/AuditLog');

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
    // Exclude deactivated (soft-deleted) placements so a former supervisor
    // does not retain access to a trainee's private publications.
    Distribution.find({
      status: { $ne: 'inactive' },
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

// ── APPROVAL PIPELINE (supervisor sign → secretary forward → DIO publish) ─────

async function ensureSupervisorCanReview(req, doc) {
  if (req.user.role === 'super_admin') return true;
  if (doc.supervisor && doc.supervisor.toString() === req.user._id.toString()) return true;
  const assigned = await getAssignedTraineeIds(req.user._id);
  return assigned.has(doc.trainee.toString());
}

function clientIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || 'unknown';
}

// Notify every active secretary of the trainee's specialty.
async function notifySecretariesForTrainee(traineeId, track, message) {
  const trainee = await User.findById(traineeId).select('specialtyId');
  if (!trainee?.specialtyId) return;
  const secs = await User.find({
    role: coerceRoleToTrack('secretary', track),
    specialtyId: trainee.specialtyId,
    isActive: { $ne: false }
  }).select('_id');
  await Promise.all(secs.map(s =>
    Notification.create({ user: s._id, message, category: 'research' }).catch(() => {})));
}

// Notify every active DIO of the track.
async function notifyDios(track, message) {
  const dios = await User.find({
    role: coerceRoleToTrack('dio', track),
    isActive: { $ne: false }
  }).select('_id');
  await Promise.all(dios.map(d =>
    Notification.create({ user: d._id, message, category: 'research' }).catch(() => {})));
}

// GET /api/research/queue — the pending items for the caller's stage.
router.get('/queue', auth, allowRoles('supervisor', 'secretary', 'dio', 'super_admin'), async (req, res) => {
  try {
    const role = req.user.role;
    let filter;
    if (role === 'supervisor') {
      const assigned = await getAssignedTraineeIds(req.user._id);
      filter = { status: 'pending', $or: [{ supervisor: req.user._id }, { trainee: { $in: [...assigned] } }] };
    } else if (role === 'secretary') {
      if (!req.user.specialtyId) return res.json({ success: true, data: [] });
      const ids = (await User.find({ role: coerceRoleToTrack('trainee', req.track), specialtyId: req.user.specialtyId }).select('_id')).map(u => u._id);
      filter = { status: 'supervisor_approved', trainee: { $in: ids } };
    } else if (role === 'dio') {
      filter = { status: 'forwarded_dio', track: req.track };
    } else { // super_admin
      filter = { status: { $in: ['pending', 'supervisor_approved', 'forwarded_dio'] } };
    }
    const items = await populateTrainee(Research.find(filter).populate('signedBy', 'name').populate('reviewedBy', 'name'))
      .sort({ createdAt: -1 });
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/research/:id/approve — research supervisor approves AND signs
router.patch('/:id/approve', auth, allowRoles('supervisor', 'super_admin'), async (req, res) => {
  try {
    const doc = await Research.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'pending') {
      return res.status(400).json({ message: 'This research is not awaiting supervisor approval' });
    }
    if (!(await ensureSupervisorCanReview(req, doc))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const signatureName = String(req.body.signatureName || '').trim();
    if (!signatureName) {
      return res.status(400).json({ message: 'Type your full name to sign the approval' });
    }
    const now = new Date();
    doc.status        = 'supervisor_approved';
    doc.reviewedBy    = req.user._id;
    doc.reviewedAt    = now;
    doc.reviewNote    = req.body.note ? String(req.body.note).trim() : '';
    doc.signedBy      = req.user._id;
    doc.signedByName  = req.user.name;
    doc.signatureName = signatureName;
    doc.signedAt      = now;
    if (!doc.supervisor) doc.supervisor = req.user._id;
    await doc.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'research_sign_approve',
      targetId: doc._id,
      targetModel: 'Research',
      metadata: { signatureName, title: doc.title },
      ip: clientIp(req)
    }).catch(e => console.error('[AuditLog] research sign:', e.message));

    await Notification.create({
      user: doc.trainee,
      message: `Your research "${doc.title}" was approved and signed by ${req.user.name}; it was sent to the secretary.`,
      category: 'research'
    }).catch(() => {});
    await notifySecretariesForTrainee(doc.trainee, doc.track, `A signed research "${doc.title}" is ready to forward to the DIO.`);

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/research/:id/forward — secretary forwards a signed research to the DIO
router.patch('/:id/forward', auth, allowRoles('secretary'), async (req, res) => {
  try {
    const doc = await Research.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'supervisor_approved') {
      return res.status(400).json({ message: 'This research is not ready to forward' });
    }
    const trainee = await User.findById(doc.trainee).select('specialtyId');
    if (!trainee || !req.user.specialtyId || String(trainee.specialtyId) !== String(req.user.specialtyId)) {
      return res.status(403).json({ message: 'This research is outside your specialty' });
    }
    doc.status      = 'forwarded_dio';
    doc.forwardedBy = req.user._id;
    doc.forwardedAt = new Date();
    await doc.save();

    await Notification.create({
      user: doc.trainee,
      message: `Your research "${doc.title}" was forwarded to the DIO for final approval.`,
      category: 'research'
    }).catch(() => {});
    await notifyDios(doc.track, `A research "${doc.title}" is awaiting your final approval.`);

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/research/:id/final-approve — DIO publishes the research
router.patch('/:id/final-approve', auth, allowRoles('dio', 'super_admin'), async (req, res) => {
  try {
    const doc = await Research.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    if (doc.status !== 'forwarded_dio') {
      return res.status(400).json({ message: 'This research is not awaiting final approval' });
    }
    if (req.user.role === 'dio' && doc.track !== req.track) {
      return res.status(403).json({ message: 'This research belongs to a different track' });
    }
    doc.status          = 'approved';
    doc.finalReviewedBy = req.user._id;
    doc.finalReviewedAt = new Date();
    await doc.save();

    await Notification.create({
      user: doc.trainee,
      message: `Your research "${doc.title}" was approved and published. You can now set it public or private.`,
      category: 'research'
    }).catch(() => {});
    if (doc.signedBy) {
      await Notification.create({
        user: doc.signedBy,
        message: `Research you signed, "${doc.title}", was published by the DIO.`,
        category: 'research'
      }).catch(() => {});
    }

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/research/:id/reject — stage-aware rejection by the current owner
router.patch('/:id/reject', auth, allowRoles('supervisor', 'secretary', 'dio', 'super_admin'), async (req, res) => {
  try {
    const doc = await Research.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const role = req.user.role;
    let stage = null;

    if (role === 'super_admin') {
      if (doc.status === 'pending') stage = 'supervisor';
      else if (doc.status === 'supervisor_approved') stage = 'secretary';
      else if (doc.status === 'forwarded_dio') stage = 'dio';
    } else if (role === 'supervisor') {
      if (doc.status === 'pending' && await ensureSupervisorCanReview(req, doc)) stage = 'supervisor';
    } else if (role === 'secretary') {
      if (doc.status === 'supervisor_approved') {
        const trainee = await User.findById(doc.trainee).select('specialtyId');
        if (trainee && req.user.specialtyId && String(trainee.specialtyId) === String(req.user.specialtyId)) stage = 'secretary';
      }
    } else if (role === 'dio') {
      if (doc.status === 'forwarded_dio' && doc.track === req.track) stage = 'dio';
    }

    if (!stage) return res.status(403).json({ message: 'You cannot reject this research at its current stage' });

    doc.status          = 'rejected';
    doc.rejectedAtStage = stage;
    doc.reviewNote      = req.body.note ? String(req.body.note).trim() : '';
    if (stage === 'supervisor') { doc.reviewedBy = req.user._id; doc.reviewedAt = new Date(); }
    await doc.save();

    const who = stage === 'supervisor' ? 'your supervisor' : stage === 'secretary' ? 'the secretary' : 'the DIO';
    await Notification.create({
      user: doc.trainee,
      message: `Your research "${doc.title}" was not approved by ${who}.`,
      category: 'research'
    }).catch(() => {});

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
