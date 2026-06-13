// backend/routes/initiatives.js
// Training Program Initiatives API. Every route is gated by
// `auth → requireInitiativeAccess` (account-level allowlist; 403 otherwise).
// Request bodies/queries are strictly field-whitelisted — nothing from the
// client is ever spread into a Mongo filter (injection-safe).
const router       = require('express').Router();
const mongoose     = require('mongoose');
const Initiative   = require('../models/Initiative');
const auth         = require('../middleware/auth');
const requireInitiativeAccess = require('../middleware/requireInitiativeAccess');
const auditLog     = require('../middleware/auditLogger');
const {
  STAGES,
  LEVELS,
  CHECKPOINT_STATUSES,
  isValidStage,
  isValidCheckpointForStage,
} = require('../utils/initiativeCheckpoints');

// All initiative routes require login + allowlist membership.
router.use(auth, requireInitiativeAccess);

const notFound = (res) => res.status(404).json({ message: 'Initiative not found' });
const validId  = (id) => mongoose.isValidObjectId(id);

// Sanitize an uploaded-attachment array to the known fields only.
function cleanAttachmentFiles(input) {
  if (!Array.isArray(input)) return null;
  return input.map(f => ({
    name:       typeof f?.name === 'string' ? f.name : '',
    url:        typeof f?.url === 'string' ? f.url : '',
    fileId:     typeof f?.fileId === 'string' ? f.fileId : '',
    mimeType:   typeof f?.mimeType === 'string' ? f.mimeType : '',
    size:       typeof f?.size === 'number' ? f.size : undefined,
    uploadedAt: f?.uploadedAt ? new Date(f.uploadedAt) : new Date(),
  }));
}

// ── GET / — list (optional ?stage=) ───────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = { deletedAt: null };
    if (req.query.stage !== undefined) {
      if (!isValidStage(req.query.stage)) return res.status(400).json({ message: 'Invalid stage' });
      filter.stage = req.query.stage;
    }
    const items = await Initiative.find(filter).sort({ updatedAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST / — create ────────────────────────────────────────────────────────
router.post('/', auditLog('initiative_create', 'Initiative'), async (req, res) => {
  try {
    const { name, source, level, stage } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required' });
    if (level !== undefined && !LEVELS.includes(level)) return res.status(400).json({ message: 'Invalid level' });
    if (stage !== undefined && !isValidStage(stage)) return res.status(400).json({ message: 'Invalid stage' });

    const doc = await Initiative.create({
      name:   String(name).trim(),
      source: source !== undefined ? String(source) : '',
      level:  level || 'primary',
      stage:  stage || 'under_study',
      createdBy: req.user._id,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── GET /:id — one ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const doc = await Initiative.findOne({ _id: req.params.id, deletedAt: null });
    if (!doc) return notFound(res);
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /:id — edit basic fields (whitelisted) ───────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const update = {};
    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) return res.status(400).json({ message: 'Name cannot be empty' });
      update.name = String(req.body.name).trim();
    }
    if (req.body.source !== undefined) update.source = String(req.body.source);
    if (req.body.level !== undefined) {
      if (!LEVELS.includes(req.body.level)) return res.status(400).json({ message: 'Invalid level' });
      update.level = req.body.level;
    }
    if (req.body.notes !== undefined) update.notes = String(req.body.notes);
    if (req.body.attachmentFiles !== undefined) {
      const files = cleanAttachmentFiles(req.body.attachmentFiles);
      if (!files) return res.status(400).json({ message: 'attachmentFiles must be an array' });
      update.attachmentFiles = files;
    }

    const doc = await Initiative.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      update,
      { new: true, runValidators: true }
    );
    if (!doc) return notFound(res);
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /:id/stage — move stage (allowed anytime) ────────────────────────
router.patch('/:id/stage', auditLog('initiative_stage_change', 'Initiative'), async (req, res) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const { stage } = req.body;
    if (!isValidStage(stage)) return res.status(400).json({ message: 'Invalid stage' });
    const doc = await Initiative.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { stage },
      { new: true }
    );
    if (!doc) return notFound(res);
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── PATCH /:id/checkpoint — update one checkpoint ──────────────────────────
router.patch('/:id/checkpoint', async (req, res) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const { key, status, date, note } = req.body;

    const doc = await Initiative.findOne({ _id: req.params.id, deletedAt: null });
    if (!doc) return notFound(res);

    if (!key || !isValidCheckpointForStage(doc.stage, key)) {
      return res.status(400).json({ message: 'Invalid checkpoint key for this stage' });
    }
    if (status !== undefined && !CHECKPOINT_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const existing = doc.checkpoints.get(key) || {};
    const nextStatus = status !== undefined ? status : (existing.status || 'pending');
    let nextDate = date !== undefined
      ? (date ? new Date(date) : null)
      : (existing.date ?? null);
    // Auto-stamp the date when a checkpoint is marked done without one.
    if (nextStatus === 'done' && !nextDate) nextDate = new Date();

    doc.checkpoints.set(key, {
      status: nextStatus,
      date:   nextDate,
      note:   note !== undefined ? String(note) : (existing.note || ''),
    });
    await doc.save();
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── DELETE /:id — soft delete ──────────────────────────────────────────────
router.delete('/:id', auditLog('initiative_delete', 'Initiative'), async (req, res) => {
  try {
    if (!validId(req.params.id)) return notFound(res);
    const doc = await Initiative.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { deletedAt: new Date() },
      { new: true }
    );
    if (!doc) return notFound(res);
    res.locals.targetId = doc._id;
    res.json({ success: true, message: 'Initiative deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
