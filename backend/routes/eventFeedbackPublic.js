// backend/routes/eventFeedbackPublic.js
// PUBLIC, NO-AUTH endpoints for the attendee mobile app. Gated only by a valid,
// open event code + rate limiting. Mirrors the public-route precedent in
// routes/certificateVerify.js. Never returns drafts, owner ids, or other
// responses; invalid/closed/unpublished always resolve to a uniform 404.
const router  = require('express').Router();
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');

const FeedbackEvent       = require('../models/FeedbackEvent');
const FeedbackForm        = require('../models/FeedbackForm');
const FeedbackFormVersion = require('../models/FeedbackFormVersion');
const FeedbackResponse    = require('../models/FeedbackResponse');
const { validateResponse } = require('../utils/feedbackValidateResponse');
const { efSubmitLimiter }  = require('../middleware/rateLimiter');

const NOT_FOUND = { success: false, message: 'This code is not valid, or the survey is closed.' };

// Resolve an OPEN event by code → its PUBLISHED form → the latest published
// version. Returns null for any miss so callers can 404 uniformly.
async function resolveOpenEvent(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return null;
  const code = rawCode.toUpperCase().trim();
  if (!code) return null;

  const event = await FeedbackEvent.findOne({ code, status: 'open' });
  if (!event) return null;

  const form = await FeedbackForm.findById(event.formId);
  if (!form || form.status !== 'published' || !form.version) return null;

  const version = await FeedbackFormVersion.findOne({ formId: form._id, version: form.version });
  if (!version) return null;

  return { event, form, version };
}

// GET /events/:code — fetch the published form to render.
router.get('/events/:code', async (req, res) => {
  try {
    const resolved = await resolveOpenEvent(req.params.code);
    if (!resolved) return res.status(404).json(NOT_FOUND);
    const { event, form, version } = resolved;

    res.json({
      success: true,
      data: {
        event: {
          id:           event._id,
          title:        event.title,
          date:         event.date,
          location:     event.location,
          facilitators: event.facilitators,
          code:         event.code,
        },
        form: {
          id:            form._id,
          version:       version.version,
          title:         version.title,
          titleAr:       version.titleAr,
          description:   version.description,
          descriptionAr: version.descriptionAr,
          fields:        version.fields,
          brand:         version.brand,
          footer:        version.footer,
          attachmentAvailable: !!form.attachmentUrl,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /events/:code/responses — submit an anonymous response.
router.post('/events/:code/responses', efSubmitLimiter, async (req, res) => {
  try {
    const resolved = await resolveOpenEvent(req.params.code);
    if (!resolved) return res.status(404).json(NOT_FOUND);
    const { event, form, version } = resolved;

    const body = req.body || {};

    // Honeypot: a hidden field real users never fill. Store as spam (excluded
    // from counts/analytics) but respond as success so bots aren't tipped off.
    const isSpam = !!(body.hp && String(body.hp).trim());

    const { ok, errors, answers, snapshot, contact } = validateResponse(version.fields, body.answers);
    if (!ok) {
      return res.status(422).json({ success: false, message: 'Some answers are invalid.', errors });
    }

    const submissionId = (typeof body.submissionId === 'string' && body.submissionId.trim())
      ? body.submissionId.trim().slice(0, 64)
      : undefined;

    // Dedup offline-queue retries before insert.
    if (submissionId) {
      const existing = await FeedbackResponse
        .findOne({ eventId: event._id, 'meta.submissionId': submissionId })
        .select('_id createdAt');
      if (existing) {
        return res.status(200).json({ success: true, data: { id: existing._id, submittedAt: existing.createdAt, duplicate: true } });
      }
    }

    // Store a hashed IP, never the raw address.
    const salt = process.env.FEEDBACK_IP_SALT || process.env.JWT_SECRET || '';
    const ipHash = req.ip ? crypto.createHash('sha256').update(req.ip + '|' + salt).digest('hex') : '';

    const participantName = typeof body.participantName === 'string'
      ? body.participantName.trim().slice(0, 120)
      : '';

    const doc = await FeedbackResponse.create({
      eventId:         event._id,
      formId:          form._id,
      formVersion:     version.version,
      answers,
      fieldsSnapshot:  snapshot,
      participantName,
      participantEmail: contact.email || '',
      lang:            body.lang === 'ar' ? 'ar' : 'en',
      meta: {
        submittedAt: new Date(),
        ipHash,
        userAgent:   String(req.headers['user-agent'] || '').slice(0, 300),
        appVersion:  typeof body.appVersion === 'string' ? body.appVersion.slice(0, 40) : '',
        submissionId,
      },
      status: isSpam ? 'flagged_spam' : 'valid',
    });

    if (!isSpam) {
      await FeedbackEvent.updateOne({ _id: event._id }, { $inc: { responseCount: 1 } });
    }

    res.status(201).json({ success: true, data: { id: doc._id, submittedAt: doc.meta.submittedAt } });
  } catch (err) {
    // Concurrent duplicate (partial unique index) → treat as idempotent success.
    if (err && err.code === 11000) {
      return res.status(200).json({ success: true, data: { duplicate: true } });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /events/:code/attachment — stream the form's uploaded docx/pdf.
// Served here (not via the auth-gated /uploads) so open events are public.
router.get('/events/:code/attachment', async (req, res) => {
  try {
    const resolved = await resolveOpenEvent(req.params.code);
    if (!resolved || !resolved.form.attachmentUrl) return res.status(404).json({ success: false, message: 'Not found' });

    // Reconstruct from basename only → no path traversal.
    const baseDir = path.join(__dirname, '../uploads/feedback-attachments');
    const abs = path.join(baseDir, path.basename(resolved.form.attachmentUrl));
    if (!abs.startsWith(baseDir) || !fs.existsSync(abs)) return res.status(404).json({ success: false, message: 'File missing' });

    res.sendFile(abs);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
