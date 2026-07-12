// backend/models/FeedbackFormVersion.js
// An immutable snapshot of a FeedbackForm written on each publish. The public
// (mobile) endpoint always serves the latest published version, and each
// FeedbackResponse records the version it answered — so editing a form later
// never corrupts historical responses.
const mongoose = require('mongoose');
const { feedbackFieldSchema, brandSchema, footerSchema } = require('./feedbackSchemas');

const feedbackFormVersionSchema = new mongoose.Schema(
  {
    formId:  { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackForm', required: true, index: true },
    version: { type: Number, required: true },

    title:   { type: String, default: '' },
    titleAr: { type: String, default: '' },
    description:   { type: String, default: '' },
    descriptionAr:{ type: String, default: '' },

    fields:  { type: [feedbackFieldSchema], default: [] },
    brand:   { type: brandSchema,  default: () => ({}) },
    footer:  { type: footerSchema, default: () => ({}) },

    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One snapshot per (form, version).
feedbackFormVersionSchema.index({ formId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('FeedbackFormVersion', feedbackFormVersionSchema);
