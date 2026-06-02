const router      = require('express').Router();
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const auth        = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const DIRECTOR = ['program_director', 'president', 'super_admin'];

const populate = q => q
  .populate('student',  'name initials photoUrl studentId year')
  .populate('traineeId', 'name initials photoUrl studentId year')
  .populate('doctor',   'name specialty initials')
  .populate('supervisor', 'name specialty initials')
  .populate('hospital', 'name city')
  .populate('issuedBy', 'name');

// GET /api/certificates
router.get('/', auth, allowRoles(...DIRECTOR), async (req, res) => {
  try {
    const certs = await populate(Certificate.find().sort({ createdAt: -1 }));
    res.json(certs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/certificates
router.post('/', auth, allowRoles(...DIRECTOR), async (req, res) => {
  try {
    const ALLOWED_CREATE = ['student', 'traineeId', 'rotation', 'distributionId',
                            'specialty', 'type', 'doctor', 'supervisor',
                            'hospital', 'issueDate', 'notes', 'fileUrl'];
    const data = {};
    ALLOWED_CREATE.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    data.issuedBy = req.user._id;

    const cert = await Certificate.create(data);
    const populated = await populate(Certificate.findById(cert._id));

    const hospitalName = populated.hospital?.name || 'your hospital';
    const specialty = populated.specialty ? ` in ${populated.specialty}` : '';
    const recipient = populated.student?._id || populated.traineeId?._id || cert.student || cert.traineeId;
    if (recipient) {
      await Notification.create({
        user: recipient,
        message: `A certificate has been issued for you${specialty} at ${hospitalName}.`,
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/certificates/:id
router.delete('/:id', auth, allowRoles(...DIRECTOR), async (req, res) => {
  try {
    await Certificate.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
