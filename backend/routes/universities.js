const router         = require('express').Router();
const University     = require('../models/University');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const MANAGERS = ['super_admin', 'professor'];

router.get('/', auth, async (req, res) => {
  try {
    const universities = await University.find().sort({ name: 1 });
    res.json(universities);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const university = await University.create(req.body);
    res.status(201).json(university);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const university = await University.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!university) return res.status(404).json({ message: 'University not found' });
    res.json(university);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, allowRoles(...MANAGERS), async (req, res) => {
  try {
    const university = await University.findByIdAndDelete(req.params.id);
    if (!university) return res.status(404).json({ message: 'University not found' });
    res.json({ message: 'University deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
