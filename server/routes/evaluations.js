const router         = require('express').Router();
const Evaluation     = require('../models/Evaluation');
const Notification   = require('../models/Notification');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const STAFF  = ['admin', 'super_admin', 'professor'];
const SENIOR = ['super_admin', 'professor'];  // can edit/delete

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

router.post('/', auth, allowRoles(...STAFF), async (req, res) => {
  try {
    const evaluation = await Evaluation.create(req.body);
    const populated  = await Evaluation.findById(evaluation._id)
      .populate('student',  'name email photoUrl initials')
      .populate('doctor',   'name initials')
      .populate('hospital', 'name');

    if (evaluation.student) {
      await Notification.create({
        user:    evaluation.student,
        message: `You have a new evaluation submitted by ${req.user.name}`
      });
    }
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// only super_admin and professor can edit evaluations
router.put('/:id', auth, allowRoles(...SENIOR), async (req, res) => {
  try {
    const evaluation = await Evaluation.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('student',  'name email photoUrl initials')
      .populate('doctor',   'name initials')
      .populate('hospital', 'name');
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
