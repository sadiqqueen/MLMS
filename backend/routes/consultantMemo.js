const router         = require('express').Router();
const ConsultantMemo = require('../models/ConsultantMemo');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const DIO = ['dio'];
const MEMO_FIELDS = [
  'topicName', 'source', 'attachments', 'presentation',
  'executiveCommittee', 'presidentRecommendation', 'jointCouncil',
];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

router.get('/', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const memos = await ConsultantMemo.find().sort({ createdAt: -1 });
    res.json(memos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const memo = await ConsultantMemo.findById(req.params.id);
    if (!memo) return res.status(404).json({ message: 'Memo not found' });
    res.json(memo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const memo = await ConsultantMemo.create(pick(req.body, MEMO_FIELDS));
    res.status(201).json(memo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const memo = await ConsultantMemo.findByIdAndUpdate(
      req.params.id,
      pick(req.body, MEMO_FIELDS),
      { new: true }
    );
    if (!memo) return res.status(404).json({ message: 'Memo not found' });
    res.json(memo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
