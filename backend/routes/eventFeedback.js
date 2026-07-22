// backend/routes/eventFeedback.js
// AUTHENTICATED admin API for the Event Feedback subsystem. Locked to the single
// super_admin account. Manages forms (build/edit/publish/upload), events
// (create/code/open-close) and results (responses/analytics/CSV). Fully separate
// from /api/evaluations and the medical Evaluation model.
const router   = require('express').Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const FeedbackForm        = require('../models/FeedbackForm');
const FeedbackFormVersion = require('../models/FeedbackFormVersion');
const FeedbackEvent       = require('../models/FeedbackEvent');
const FeedbackResponse    = require('../models/FeedbackResponse');
const { generateUniqueCode } = require('../utils/eventCode');
const { buildCsv }           = require('../utils/csv');

// Every route in this file requires a logged-in super_admin.
router.use(auth, allowRoles('developer'));

// ── Multer: form attachment uploads (docx/pdf) ─────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/feedback-attachments');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(pdf|docx?|)$/i;
    const okExt = /pdf|doc|docx/.test(path.extname(file.originalname).toLowerCase());
    const okMime = /pdf|msword|officedocument|octet-stream/.test(file.mimetype);
    okExt && okMime ? cb(null, true) : cb(new Error('Only PDF or Word (doc/docx) files are allowed'));
  },
});

// ── helpers ────────────────────────────────────────────────────────────────
const pick = (obj, keys) => keys.reduce((o, k) => (obj[k] !== undefined ? (o[k] = obj[k], o) : o), {});

// Ensure every field/option carries a stable id (Mongoose strips unknown keys).
function sanitizeFields(fields) {
  if (!Array.isArray(fields)) return undefined;
  return fields.map(f => {
    const out = { ...f };
    if (!out.id) out.id = uuidv4();
    if (Array.isArray(out.options)) out.options = out.options.map(o => ({ ...o, id: o.id || uuidv4() }));
    return out;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// FORMS
// ─────────────────────────────────────────────────────────────────────────

// GET /forms — list all forms (summary).
router.get('/forms', async (req, res) => {
  try {
    const forms = await FeedbackForm.find()
      .select('title titleAr status version isSeed updatedAt fields attachmentName')
      .sort({ updatedAt: -1 })
      .lean();
    const data = forms.map(f => ({
      id: f._id, title: f.title, titleAr: f.titleAr, status: f.status,
      version: f.version, isSeed: f.isSeed, updatedAt: f.updatedAt,
      fieldCount: Array.isArray(f.fields) ? f.fields.length : 0,
      attachmentName: f.attachmentName || '',
    }));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /forms — create a form (blank or with fields).
router.post('/forms', async (req, res) => {
  try {
    const b = req.body || {};
    const doc = await FeedbackForm.create({
      title:         b.title || 'Untitled form',
      titleAr:       b.titleAr || '',
      description:   b.description || '',
      descriptionAr: b.descriptionAr || '',
      fields:        sanitizeFields(b.fields) || [],
      brand:         b.brand || undefined,
      footer:        b.footer || undefined,
      ownerId:       req.user._id,
      status:        'draft',
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// GET /forms/:id
router.get('/forms/:id', async (req, res) => {
  try {
    const form = await FeedbackForm.findById(req.params.id);
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    res.json({ success: true, data: form });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /forms/:id — edit the draft. Changes go live only on publish.
router.patch('/forms/:id', async (req, res) => {
  try {
    const update = pick(req.body || {}, ['title', 'titleAr', 'description', 'descriptionAr', 'brand', 'footer']);
    if (req.body && req.body.fields !== undefined) update.fields = sanitizeFields(req.body.fields);
    const form = await FeedbackForm.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    res.json({ success: true, data: form });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// DELETE /forms/:id — blocked while an event still references the form.
router.delete('/forms/:id', async (req, res) => {
  try {
    const inUse = await FeedbackEvent.exists({ formId: req.params.id });
    if (inUse) return res.status(409).json({ success: false, message: 'This form is attached to an event. Detach or delete the event first.' });
    const form = await FeedbackForm.findByIdAndDelete(req.params.id);
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    await FeedbackFormVersion.deleteMany({ formId: form._id });
    if (form.attachmentUrl) {
      fs.promises.unlink(path.join(uploadDir, path.basename(form.attachmentUrl))).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /forms/:id/publish — snapshot the draft into a new immutable version and
// mark the form published (visible in the app when attached to an open event).
router.post('/forms/:id/publish', async (req, res) => {
  try {
    const form = await FeedbackForm.findById(req.params.id);
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    if (!Array.isArray(form.fields) || form.fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one field before publishing.' });
    }
    const nextVersion = (form.version || 0) + 1;
    await FeedbackFormVersion.create({
      formId: form._id, version: nextVersion,
      title: form.title, titleAr: form.titleAr,
      description: form.description, descriptionAr: form.descriptionAr,
      fields: form.fields, brand: form.brand, footer: form.footer,
      publishedBy: req.user._id, publishedAt: new Date(),
    });
    form.version = nextVersion;
    form.status = 'published';
    await form.save();
    res.json({ success: true, data: { id: form._id, status: form.status, version: form.version } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /forms/:id/unpublish — hide from the app (existing versions kept).
router.post('/forms/:id/unpublish', async (req, res) => {
  try {
    const form = await FeedbackForm.findByIdAndUpdate(req.params.id, { status: 'unpublished' }, { new: true });
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    res.json({ success: true, data: { id: form._id, status: form.status } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /forms/:id/attachment — upload a replacement form file (docx/pdf).
router.post('/forms/:id/attachment', (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      const form = await FeedbackForm.findById(req.params.id);
      if (!form) {
        fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ success: false, message: 'Form not found' });
      }
      if (form.attachmentUrl) {
        fs.promises.unlink(path.join(uploadDir, path.basename(form.attachmentUrl))).catch(() => {});
      }
      form.attachmentUrl = `/uploads/feedback-attachments/${req.file.filename}`;
      form.attachmentName = req.file.originalname;
      await form.save();
      res.json({ success: true, data: { attachmentUrl: form.attachmentUrl, attachmentName: form.attachmentName } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });
});

// DELETE /forms/:id/attachment
router.delete('/forms/:id/attachment', async (req, res) => {
  try {
    const form = await FeedbackForm.findById(req.params.id);
    if (!form) return res.status(404).json({ success: false, message: 'Form not found' });
    if (form.attachmentUrl) {
      fs.promises.unlink(path.join(uploadDir, path.basename(form.attachmentUrl))).catch(() => {});
    }
    form.attachmentUrl = '';
    form.attachmentName = '';
    await form.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /forms/:id/versions
router.get('/forms/:id/versions', async (req, res) => {
  try {
    const versions = await FeedbackFormVersion.find({ formId: req.params.id })
      .select('version publishedAt publishedBy')
      .sort({ version: -1 })
      .lean();
    res.json({ success: true, data: versions });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /forms/:id/duplicate — copy as a new draft.
router.post('/forms/:id/duplicate', async (req, res) => {
  try {
    const src = await FeedbackForm.findById(req.params.id).lean();
    if (!src) return res.status(404).json({ success: false, message: 'Form not found' });
    const copy = await FeedbackForm.create({
      title: `${src.title} (copy)`, titleAr: src.titleAr,
      description: src.description, descriptionAr: src.descriptionAr,
      fields: src.fields, brand: src.brand, footer: src.footer,
      ownerId: req.user._id, status: 'draft', version: 0, isSeed: false,
    });
    res.status(201).json({ success: true, data: copy });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────

// GET /events — list events with form title + response count.
router.get('/events', async (req, res) => {
  try {
    const events = await FeedbackEvent.find()
      .populate('formId', 'title status version')
      .sort({ createdAt: -1 })
      .lean();
    const data = events.map(e => ({
      id: e._id, title: e.title, date: e.date, location: e.location,
      facilitators: e.facilitators, code: e.code, status: e.status,
      responseCount: e.responseCount,
      form: e.formId ? { id: e.formId._id, title: e.formId.title, status: e.formId.status, version: e.formId.version } : null,
      createdAt: e.createdAt,
    }));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /events — create an event and mint a unique public code.
router.post('/events', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.formId) return res.status(400).json({ success: false, message: 'Choose a form for this event.' });
    const form = await FeedbackForm.findById(b.formId);
    if (!form) return res.status(400).json({ success: false, message: 'Form not found' });

    const code = await generateUniqueCode(async c => !!(await FeedbackEvent.exists({ code: c })));
    const event = await FeedbackEvent.create({
      title:        b.title || form.title || 'Untitled event',
      date:         b.date || null,
      location:     b.location || '',
      facilitators: Array.isArray(b.facilitators) ? b.facilitators : (b.facilitators ? [b.facilitators] : []),
      formId:       form._id,
      code,
      ownerId:      req.user._id,
      status:       'open',
    });
    res.status(201).json({ success: true, data: event });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// GET /events/:id
router.get('/events/:id', async (req, res) => {
  try {
    const event = await FeedbackEvent.findById(req.params.id).populate('formId', 'title status version');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /events/:id
router.patch('/events/:id', async (req, res) => {
  try {
    const update = pick(req.body || {}, ['title', 'date', 'location', 'facilitators', 'formId', 'status']);
    if (update.status && !['open', 'closed'].includes(update.status)) delete update.status;
    if (update.facilitators && !Array.isArray(update.facilitators)) update.facilitators = [update.facilitators];
    const event = await FeedbackEvent.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: event });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
});

// DELETE /events/:id — also removes its responses.
router.delete('/events/:id', async (req, res) => {
  try {
    const event = await FeedbackEvent.findByIdAndDelete(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    await FeedbackResponse.deleteMany({ eventId: event._id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /events/:id/regenerate-code
router.post('/events/:id/regenerate-code', async (req, res) => {
  try {
    const code = await generateUniqueCode(async c => !!(await FeedbackEvent.exists({ code: c })));
    const event = await FeedbackEvent.findByIdAndUpdate(req.params.id, { code }, { new: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: { code: event.code } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /events/:id/open  ·  POST /events/:id/close
router.post('/events/:id/:action(open|close)', async (req, res) => {
  try {
    const status = req.params.action === 'open' ? 'open' : 'closed';
    const event = await FeedbackEvent.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: { id: event._id, status: event.status } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ─────────────────────────────────────────────────────────────────────────
// RESPONSES & ANALYTICS
// ─────────────────────────────────────────────────────────────────────────

// Canonical field set for an event = its form's latest published version, else
// the current draft fields.
async function canonicalFields(event) {
  const form = await FeedbackForm.findById(event.formId).lean();
  if (!form) return [];
  const version = form.version
    ? await FeedbackFormVersion.findOne({ formId: form._id, version: form.version }).lean()
    : null;
  return (version && version.fields) || form.fields || [];
}

// GET /events/:id/responses — paginated (valid only).
router.get('/events/:id/responses', async (req, res) => {
  try {
    const event = await FeedbackEvent.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const query = { eventId: event._id, status: 'valid' };
    const [items, total] = await Promise.all([
      FeedbackResponse.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      FeedbackResponse.countDocuments(query),
    ]);
    res.json({ success: true, data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /responses/:id
router.get('/responses/:id', async (req, res) => {
  try {
    const r = await FeedbackResponse.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ success: false, message: 'Response not found' });
    res.json({ success: true, data: r });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /events/:id/analytics — rating averages by section + distributions + comments.
router.get('/events/:id/analytics', async (req, res) => {
  try {
    const event = await FeedbackEvent.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const fields = await canonicalFields(event);
    const responses = await FeedbackResponse.find({ eventId: event._id, status: 'valid' }).select('answers').lean();

    const ratings = fields.filter(f => f.type === 'rating').map(f => {
      const vals = responses.map(r => r.answers && r.answers[f.id]).filter(v => typeof v === 'number');
      const distribution = {};
      const min = f.rating?.min ?? 1, max = f.rating?.max ?? 5;
      for (let i = min; i <= max; i++) distribution[i] = 0;
      vals.forEach(v => { if (distribution[v] != null) distribution[v]++; });
      const average = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      return { id: f.id, label: f.label, section: f.section || '', count: vals.length, average, distribution };
    });

    const comments = fields.filter(f => f.type === 'long_text').map(f => ({
      id: f.id, label: f.label,
      entries: responses.map(r => r.answers && r.answers[f.id]).filter(v => v && String(v).trim()),
    }));

    // Overall mean across all rating items that have any responses.
    const withVals = ratings.filter(r => r.average != null);
    const overallAverage = withVals.length
      ? withVals.reduce((a, r) => a + r.average, 0) / withVals.length
      : null;

    res.json({ success: true, data: { responseCount: responses.length, overallAverage, ratings, comments } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /events/:id/responses/export?format=csv
router.get('/events/:id/responses/export', async (req, res) => {
  try {
    const event = await FeedbackEvent.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const fields = (await canonicalFields(event)).filter(f => f.type !== 'section_header');
    const responses = await FeedbackResponse.find({ eventId: event._id, status: 'valid' }).sort({ createdAt: -1 }).lean();

    const header = ['Submitted At', 'Participant Name', 'Participant Email', 'Language', ...fields.map(f => f.label || f.id)];
    const rows = responses.map(r => {
      const base = [
        r.meta?.submittedAt ? new Date(r.meta.submittedAt).toISOString() : '',
        r.participantName || '', r.participantEmail || '', r.lang || '',
      ];
      const answers = fields.map(f => (r.answers ? r.answers[f.id] : ''));
      return [...base, ...answers];
    });
    const csv = buildCsv(header, rows);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="event-${event._id}-responses.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
