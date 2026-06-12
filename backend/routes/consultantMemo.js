const crypto         = require('crypto');
const router         = require('express').Router();
const ConsultantMemo = require('../models/ConsultantMemo');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const DIO = ['dio'];
const MEMO_FIELDS = [
  'topicName', 'source', 'topicDateTime',
  'attachments', 'attachmentsDateTime',
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

router.post('/translate', auth, allowRoles(...DIO), async (req, res) => {
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
        system: 'You are a professional Arabic→English translator for official medical-education council documents. '
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
router.get('/', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status === 'saved' || req.query.status === 'draft') filter.status = req.query.status;
    const memos = await ConsultantMemo.find(filter)
      .sort({ createdAt: -1 })
      .select('topicName source status presentation memoNumber movedToDraftAt createdAt updatedAt');
    res.json(memos.map(m => ({
      _id: m._id,
      topicName: m.topicName,
      source: m.source,
      status: m.status,
      memoNumber: m.memoNumber,
      movedToDraftAt: m.movedToDraftAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      presentationPreview: (m.presentation || '').slice(0, 200),
    })));
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

// Create — used by save, first-time autosave, and duplicate (نسخ).
router.post('/', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const data = pick(req.body, MEMO_FIELDS);
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
router.put('/:id', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const data = pick(req.body, MEMO_FIELDS);
    if (data.status === 'draft') data.movedToDraftAt = new Date();
    if (data.status === 'saved') data.movedToDraftAt = null;
    const memo = await ConsultantMemo.findByIdAndUpdate(req.params.id, data, { new: true });
    if (!memo) return res.status(404).json({ message: 'Memo not found' });
    res.json(memo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Permanent delete — server-side enforcement of the two-stage flow:
// only memos already moved to draft (مسودة) can be deleted.
router.delete('/:id', auth, allowRoles(...DIO), async (req, res) => {
  try {
    const memo = await ConsultantMemo.findById(req.params.id);
    if (!memo) return res.status(404).json({ message: 'Memo not found' });
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
