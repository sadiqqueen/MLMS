// backend/models/FeedbackResponse.js
// One anonymous submission from an attendee for a given event. Stores the answers
// keyed by stable field id, plus a denormalized snapshot of the fields answered
// so results always render correctly even if the form is later edited.
const mongoose = require('mongoose');

const feedbackResponseSchema = new mongoose.Schema(
  {
    eventId:     { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackEvent', required: true, index: true },
    formId:      { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackForm', index: true },
    formVersion: { type: Number },

    // { fieldId: value } — value type depends on the field (string, number,
    // array of strings for multi_choice, 'yes'/'no', etc.).
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },

    // { fieldId: { label, type, section } } captured at submit time for durable
    // historical rendering/aggregation.
    fieldsSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Opt-in identity fields (form-dependent; usually blank/anonymous).
    participantName:  { type: String, default: '' },
    participantEmail: { type: String, default: '' },

    lang: { type: String, enum: ['en', 'ar'], default: 'en' },

    meta: {
      submittedAt:  { type: Date, default: Date.now },
      ipHash:       { type: String, default: '' },   // sha256(ip + salt) — never the raw IP
      userAgent:    { type: String, default: '' },
      appVersion:   { type: String, default: '' },
      submissionId: { type: String },                // client-generated uuid for offline dedup
    },

    // flagged_spam responses are stored but excluded from counts/analytics.
    status: { type: String, enum: ['valid', 'flagged_spam'], default: 'valid', index: true },
  },
  { timestamps: true }
);

// Dedup offline-queue retries: at most one response per (event, submissionId).
// Partial index so responses without a submissionId are unaffected.
feedbackResponseSchema.index(
  { eventId: 1, 'meta.submissionId': 1 },
  { unique: true, partialFilterExpression: { 'meta.submissionId': { $type: 'string' } } }
);

module.exports = mongoose.model('FeedbackResponse', feedbackResponseSchema);
