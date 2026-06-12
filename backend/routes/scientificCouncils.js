const router            = require('express').Router();
const ScientificCouncil = require('../models/ScientificCouncil');
const auth              = require('../middleware/auth');
const { allowRoles }    = require('../middleware/roles');
const { normalizeArabic } = require('../utils/arabic');

// Same access pattern as the consultant-memo routes.
const ASG = ['asg1', 'asg2'];

const DEFAULT_COUNCILS = [
  'المجلس العلمي للجراحة',
  'المجلس العلمي للأمراض الباطنة',
  'المجلس العلمي للولادة وأمراض النساء',
  'المجلس العلمي لطب الأطفال',
  'المجلس العلمي لطب الأسرة',
  'المجلس العلمي لطب المجتمع',
  'المجلس العلمي للطب النفسي',
  'المجلس العلمي للتخدير والعناية المركزة',
  'المجلس العلمي للأمراض الجلدية والتناسلية',
  'المجلس العلمي لطب العيون وجراحتها',
  'المجلس العلمي للأذن والأنف والحنجرة والرأس والعنق وجراحتها',
  'المجلس العلمي لجراحة الفم والوجه والفكين',
  'المجلس العلمي لطب الطوارئ',
  'المجلس العلمي للأشعة والتصوير الطبي',
  'المجلس العلمي لجراحة العظام',
  'المجلس العلمي لجراحة المسالك البولية',
  'المجلس العلمي لعلم الأمراض',
  'المجلس العلمي للتمريض والقبالة',
  'المجلس العلمي للجراحة العصبية',
  'المجلس العلمي للأورام',
  'أخرى',
];

// Seed the 21 defaults once (idempotent — keyed on normalizedName).
let seedPromise = null;
function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await ScientificCouncil.countDocuments();
      if (count > 0) return;
      await ScientificCouncil.insertMany(
        DEFAULT_COUNCILS.map(name => ({
          name,
          normalizedName: normalizeArabic(name),
          isDefault: true,
        })),
        { ordered: false }
      ).catch(err => { if (err.code !== 11000) throw err; });
    })().catch(err => { seedPromise = null; throw err; });
  }
  return seedPromise;
}

// GET /api/scientific-councils — full list, alphabetically sorted,
// with أخرى always pinned last.
router.get('/', auth, allowRoles(...ASG), async (req, res) => {
  try {
    await ensureSeeded();
    const councils = await ScientificCouncil.find().select('name isDefault');
    councils.sort((a, b) => {
      if (a.name === 'أخرى') return 1;
      if (b.name === 'أخرى') return -1;
      return a.name.localeCompare(b.name, 'ar');
    });
    res.json(councils);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/scientific-councils — create-if-not-exists (the أخرى flow).
// Returns the existing entry when the normalized name already exists.
router.post('/', auth, allowRoles(...ASG), async (req, res) => {
  try {
    await ensureSeeded();
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
    if (!name) return res.status(400).json({ message: 'Council name is required' });

    const normalizedName = normalizeArabic(name);
    const existing = await ScientificCouncil.findOne({ normalizedName }).select('name isDefault');
    if (existing) return res.json(existing);

    try {
      const created = await ScientificCouncil.create({ name, createdBy: req.user._id });
      return res.status(201).json({ _id: created._id, name: created.name, isDefault: created.isDefault });
    } catch (err) {
      if (err.code === 11000) {  // unique-index race — someone inserted it first
        const winner = await ScientificCouncil.findOne({ normalizedName }).select('name isDefault');
        if (winner) return res.json(winner);
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
