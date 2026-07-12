const crypto         = require('crypto');
const router         = require('express').Router();
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const ConsultantMemo = require('../models/ConsultantMemo');
const AuditLog       = require('../models/AuditLog');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { decodeOriginalName } = require('../utils/filename');

const ASG = ['asg1', 'asg2'];  // ASG.1 / ASG.2 — the only roles with access
const MEMO_FIELDS = [
  'topicName', 'source', 'council', 'councilName', 'topicDateTime',
  'attachments', 'attachmentFiles', 'attachmentsDateTime',
  'presentation', 'presentationDateTime',
  'executiveCommittee', 'executiveCommitteeDateTime',
  'presidentRecommendation', 'presidentRecommendationDateTime',
  'jointCouncil', 'jointCouncilDateTime',
  'status', 'movedToDraftAt',
];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

// A memo may only be approved once ALL main content sections are filled.
// `presidentRecommendation` is intentionally excluded (dormant field, not
// rendered in the builder). Server-side completeness is the real gate — the
// client's own "is complete" check is never trusted.
const REQUIRED_SECTIONS = ['topicName', 'councilName', 'presentation', 'executiveCommittee', 'jointCouncil'];
function missingSections(doc) {
  return REQUIRED_SECTIONS.filter(k => !((doc[k] || '').trim()));
}

// ── Attachment file uploads (pdf, word, excel, images …) ─────────────────
// Same multer pattern as routes/users.js photo uploads; files are served
// statically from /uploads by server.js.
const attachDir = path.join(__dirname, '../uploads/consultant-memos');
if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });

const attachStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, attachDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});
const ATTACH_EXT = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|png|jpg|jpeg)$/;
const uploadAttachment = multer({
  storage: attachStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ATTACH_EXT.test(path.extname(file.originalname).toLowerCase())
      ? cb(null, true)
      : cb(new Error('Allowed file types: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, png, jpg'));
  },
});

router.post('/upload', auth, allowRoles(...ASG), (req, res) => {
  uploadAttachment.single('file')(req, res, err => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    res.status(201).json({
      // recover UTF-8 names (busboy latin1-decodes multipart filenames)
      name: decodeOriginalName(req.file),
      url: `/uploads/consultant-memos/${req.file.filename}`,
      fileId: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    });
  });
});

// Sequential memo number per year, e.g. "2026/014" (zero-padded so the
// string sort below matches numeric order).
async function nextMemoNumber() {
  const year = new Date().getFullYear();
  const last = await ConsultantMemo.findOne({ memoNumber: new RegExp(`^${year}/`) })
    .sort({ memoNumber: -1 })
    .select('memoNumber');
  const n = last ? parseInt(last.memoNumber.split('/')[1], 10) + 1 : 1;
  return `${year}/${String(n).padStart(3, '0')}`;
}

// ── Translation (Arabic → English, for the EN display mode) ───────────────
// Uses the Anthropic API; key comes from ANTHROPIC_API_KEY in the env.
// Results are cached in memory per text hash so repeated language switching
// doesn't re-call the API.
const translationCache = new Map();  // sha256(text) → english
const CACHE_MAX = 2000;

function cacheKey(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

router.post('/translate', auth, allowRoles(...ASG), async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ message: 'Translation is not configured (ANTHROPIC_API_KEY missing)' });
    }
    const texts = req.body?.texts;
    if (!texts || typeof texts !== 'object' || Array.isArray(texts)) {
      return res.status(400).json({ message: 'Body must be { texts: { key: "arabic text" } }' });
    }

    const translations = {};
    const pending = {};  // key → text, only what's not cached
    for (const [key, value] of Object.entries(texts)) {
      if (typeof value !== 'string' || value.trim() === '') { translations[key] = value || ''; continue; }
      const hit = translationCache.get(cacheKey(value));
      if (hit !== undefined) translations[key] = hit;
      else pending[key] = value;
    }

    if (Object.keys(pending).length > 0) {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic();

      // Constrain the response to a JSON object with exactly the same keys.
      const schema = {
        type: 'object',
        properties: Object.fromEntries(Object.keys(pending).map(k => [k, { type: 'string' }])),
        required: Object.keys(pending),
        additionalProperties: false,
      };

      const response = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 16000,
        system: 'You are a professional Arabic-to-English translator for official medical-education council documents. '
          + 'Translate the Arabic values of the JSON object the user sends into formal English. '
          + 'Return a JSON object with exactly the same keys and the translated values. '
          + 'Preserve line breaks within values. Do not add commentary.',
        messages: [{ role: 'user', content: JSON.stringify(pending) }],
        output_config: { format: { type: 'json_schema', schema } },
      });

      const textBlock = response.content.find(b => b.type === 'text');
      const result = JSON.parse(textBlock.text);
      for (const [key, english] of Object.entries(result)) {
        translations[key] = english;
        if (translationCache.size >= CACHE_MAX) {
          translationCache.delete(translationCache.keys().next().value);
        }
        translationCache.set(cacheKey(pending[key]), english);
      }
    }

    res.json({ translations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── CRUD ──────────────────────────────────────────────────────────────────

// List — optional ?status=saved|draft filter; returns card-sized projections.
router.get('/', auth, allowRoles(...ASG), async (req, res) => {
  try {
    const filter = {};
    if (['saved', 'draft', 'approved'].includes(req.query.status)) {
      filter.status = req.query.status;
    } else {
      // Default list excludes approved memos — they live on the read-only
      // "Approved memos" page (fetched explicitly with ?status=approved).
      filter.status = { $ne: 'approved' };
    }
    const memos = await ConsultantMemo.find(filter)
      .sort({ createdAt: -1 })
      .select('topicName source councilName status presentation memoNumber movedToDraftAt approvedAt approvedBy createdAt updatedAt')
      .populate('approvedBy', 'name');
    res.json(memos.map(m => ({
      _id: m._id,
      topicName: m.topicName,
      source: m.source,
      councilName: m.councilName,
      status: m.status,
      memoNumber: m.memoNumber,
      movedToDraftAt: m.movedToDraftAt,
      approvedAt: m.approvedAt,
      approvedByName: m.approvedBy?.name || '',
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      presentationPreview: (m.presentation || '').slice(0, 200),
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', auth, allowRoles(...ASG), async (req, res) => {
  try {
    const memo = await ConsultantMemo.findById(req.params.id);
    if (!memo) return res.status(404).json({ message: 'Memo not found' });
    res.json(memo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create — used by save, first-time autosave, and duplicate (نسخ).
router.post('/', auth, allowRoles(...ASG), async (req, res) => {
  try {
    const data = pick(req.body, MEMO_FIELDS);
    if (data.status === 'approved') {
      return res.status(400).json({ message: 'Use POST /:id/approve to approve a memo' });
    }
    data.memoNumber = await nextMemoNumber();
    data.createdBy  = req.user._id;
    const memo = await ConsultantMemo.create(data);
    res.status(201).json(memo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update — save/autosave content, and status transitions (move-to-draft,
// restore) via the `status` field.
router.put('/:id', auth, allowRoles(...ASG), async (req, res) => {
  try {
    const data = pick(req.body, MEMO_FIELDS);
    if (data.status === 'approved') {
      return res.status(400).json({ message: 'Use POST /:id/approve to approve a memo' });
    }
    if (data.status === 'draft') data.movedToDraftAt = new Date();
    if (data.status === 'saved') data.movedToDraftAt = null;

    // Approved memos are permanently locked — reject any edit, including an
    // attempt to revert status to saved/draft. The read check gives a clear
    // message; the conditional write closes the approve/edit race window.
    const existing = await ConsultantMemo.findById(req.params.id).select('status');
    if (!existing) return res.status(404).json({ message: 'Memo not found' });
    if (existing.status === 'approved') {
      return res.status(409).json({ message: 'Approved memos are locked and cannot be modified' });
    }
    const memo = await ConsultantMemo.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'approved' } },
      data,
      { new: true }
    );
    if (!memo) return res.status(409).json({ message: 'Approved memos are locked and cannot be modified' });
    res.json(memo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve (اعتماد) — permanent, irreversible lock. Only a saved memo with
// ALL required sections filled can be approved; it then appears on the
// read-only "Approved memos" page. There is no un-approve endpoint (mirrors
// the certificate precedent: immutability by absence of a reverse endpoint).
router.post('/:id/approve', auth, allowRoles(...ASG), async (req, res) => {
  try {
    const memo = await ConsultantMemo.findById(req.params.id);
    if (!memo) return res.status(404).json({ message: 'Memo not found' });
    if (memo.status === 'approved') return res.status(409).json({ message: 'Memo is already approved' });
    if (memo.status !== 'saved') return res.status(409).json({ message: 'Only saved memos can be approved' });

    const missing = missingSections(memo);
    if (missing.length) {
      return res.status(422).json({ message: 'All main sections must be filled before approval', missing });
    }

    // Terminal-state query guard (ChangeRequest precedent) — the conditional
    // filter makes the transition atomic and single-shot.
    const updated = await ConsultantMemo.findOneAndUpdate(
      { _id: memo._id, status: 'saved' },
      { $set: { status: 'approved', approvedBy: req.user._id, approvedAt: new Date(), movedToDraftAt: null } },
      { new: true }
    );
    if (!updated) return res.status(409).json({ message: 'Memo status changed, reload and try again' });

    AuditLog.create({
      userId: req.user._id,
      action: 'asg_approve_consultant_memo',
      targetId: updated._id,
      targetModel: 'ConsultantMemo',
      metadata: { memoNumber: updated.memoNumber, topicName: updated.topicName },
      ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    }).catch(err => console.error('[AuditLog] consultant memo approve:', err.message));

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Permanent delete — server-side enforcement of the two-stage flow:
// only memos already moved to draft (مسودة) can be deleted.
router.delete('/:id', auth, allowRoles(...ASG), async (req, res) => {
  try {
    const memo = await ConsultantMemo.findById(req.params.id);
    if (!memo) return res.status(404).json({ message: 'Memo not found' });
    if (memo.status === 'approved') {
      return res.status(409).json({ message: 'Approved memos are permanent and cannot be deleted' });
    }
    if (memo.status !== 'draft') {
      return res.status(409).json({ message: 'Only draft memos can be permanently deleted. Move it to draft first.' });
    }
    await memo.deleteOne();
    res.json({ message: 'Memo permanently deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
