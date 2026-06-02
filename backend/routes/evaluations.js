const router         = require('express').Router();
const Evaluation     = require('../models/Evaluation');
const Notification   = require('../models/Notification');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const STAFF       = ['super_admin', 'dio', 'program_director', 'president'];
const SENIOR      = ['super_admin', 'dio', 'program_director'];
const CAN_SUBMIT  = ['super_admin', 'dio', 'supervisor'];
const MONTHLY_CAP = 5;

// GET /api/evaluations — all evaluations (staff only)
router.get('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const evaluations = await Evaluation.find()
      .populate('student',  'name email photoUrl initials')
      .populate('doctor',   'name initials')
      .populate('hospital', 'name')
      .sort({ date: -1 });
    res.json(evaluations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/evaluations/by-doctor/:doctorId — all evals submitted by this doctor
router.get('/by-doctor/:doctorId', auth, async (req, res) => {
  try {
    const isOwner = req.params.doctorId === req.user._id.toString();
    const isStaff = ['super_admin', 'dio',
                     'program_director', 'president'].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const evaluations = await Evaluation.find({ doctor: req.params.doctorId })
      .populate('student',  'name email photoUrl initials studentId year')
      .populate('hospital', 'name')
      .sort({ date: -1 });
    res.json(evaluations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/evaluations/student/:studentId — all evals for one student
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const isOwner = req.params.studentId === req.user._id.toString();
    const isStaff = ['super_admin', 'supervisor', 'program_director', 'dio'].includes(req.user.role);
    if (!isOwner && !isStaff) return res.status(403).json({ success: false, message: 'Access denied' });

    const evaluations = await Evaluation.find({ student: req.params.studentId })
      .populate('doctor',   'name initials')
      .populate('hospital', 'name')
      .sort({ date: -1 });
    res.json(evaluations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/evaluations — create evaluation (doctors + staff)
router.post('/', auth, allowRoles(...CAN_SUBMIT), async (req, res) => {
  try {
    // Enforce 5-per-student-per-month cap
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const canAssignDoctor = ['super_admin', 'dio'].includes(req.user.role);
    const doctorId = canAssignDoctor && req.body.doctor ? req.body.doctor : req.user._id;
    const monthCount = await Evaluation.countDocuments({
      student: req.body.student,
      doctor:  doctorId,
      date:    { $gte: startOfMonth, $lte: endOfMonth },
    });

    if (monthCount >= MONTHLY_CAP) {
      return res.status(400).json({
        message: `Monthly evaluation limit (${MONTHLY_CAP}) reached for this student.`,
      });
    }

    const ALLOWED_CREATE = ['student', 'hospital', 'specialty', 'date', 'evaluationType',
                            'grade', 'notes', 'scores', 'totalScore', 'comments'];
    const data = {};
    ALLOWED_CREATE.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    data.doctor = doctorId;

    const evaluation = await Evaluation.create(data);
    const populated  = await Evaluation.findById(evaluation._id)
      .populate('student',  'name email photoUrl initials')
      .populate('doctor',   'name initials')
      .populate('hospital', 'name');

    if (evaluation.student) {
      await Notification.create({
        user:    evaluation.student,
        message: `You have a new evaluation submitted by ${req.user.name}`,
      });
    }
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/evaluations/:id — edit (senior staff only)
router.put('/:id', auth, allowRoles(...SENIOR), async (req, res) => {
  try {
    const ALLOWED = ['scores', 'totalScore', 'grade', 'notes', 'comments',
                     'assessorComments', 'isFinalized', 'status', 'specialty'];
    const updates = {};
    ALLOWED.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const evaluation = await Evaluation.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('student',  'name email photoUrl initials')
      .populate('doctor',   'name initials')
      .populate('hospital', 'name');
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/evaluations/:id — senior staff only
router.delete('/:id', auth, allowRoles(...SENIOR), async (req, res) => {
  try {
    const evaluation = await Evaluation.findByIdAndDelete(req.params.id);
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
