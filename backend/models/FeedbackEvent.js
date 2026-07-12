// backend/models/FeedbackEvent.js
// An event the admin hosts. Attendees open the mobile app, enter the event's
// public `code` (or scan its QR), and submit the attached form's responses.
// Responses are collected and analyzed per event.
const mongoose = require('mongoose');

const feedbackEventSchema = new mongoose.Schema(
  {
    title:        { type: String, required: true },
    date:         { type: Date },
    location:     { type: String, default: '' },
    facilitators: { type: [String], default: [] },

    // The form served to attendees for this event.
    formId: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackForm', required: true, index: true },

    // Public short code entered/scanned in the app. Stored uppercase; matched
    // case-insensitively in the public route.
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },

    // open: accepting responses · closed: rejects new responses (404 in the app).
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },

    responseCount: { type: Number, default: 0 },

    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeedbackEvent', feedbackEventSchema);
