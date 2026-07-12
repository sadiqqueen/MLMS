// backend/models/FeedbackForm.js
// The editable "head" of an Event Feedback form. The admin edits this draft in
// the web builder; publishing snapshots it into an immutable FeedbackFormVersion
// and bumps `version`. Kept fully separate from the medical Evaluation model.
const mongoose = require('mongoose');
const { feedbackFieldSchema, brandSchema, footerSchema } = require('./feedbackSchemas');

const feedbackFormSchema = new mongoose.Schema(
  {
    title:         { type: String, required: true },
    titleAr:       { type: String, default: '' },
    description:   { type: String, default: '' },
    descriptionAr: { type: String, default: '' },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // The draft fields (edited in the builder). Published copies live in
    // FeedbackFormVersion so past responses stay tied to what they answered.
    fields: { type: [feedbackFieldSchema], default: [] },

    brand:  { type: brandSchema,  default: () => ({}) },
    footer: { type: footerSchema, default: () => ({}) },

    // Optional uploaded replacement form file (docx/pdf).
    attachmentUrl:  { type: String, default: '' },
    attachmentName: { type: String, default: '' },

    // draft: never published · published: live (visible in the app when attached
    // to an open event) · unpublished: hidden in the app · archived: retired.
    status: { type: String, enum: ['draft', 'published', 'unpublished', 'archived'], default: 'draft', index: true },

    // Highest published version number (0 = never published).
    version: { type: Number, default: 0 },

    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeedbackForm', feedbackFormSchema);
