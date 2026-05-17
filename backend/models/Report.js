const mongoose = require('mongoose');

// A Report is one document submitted by a student during a rotation.
const reportSchema = new mongoose.Schema(
  {
    student:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    rotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Rotation' },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

    title:    { type: String, required: true },         // e.g. "Week 3 Report"
    type:     { type: String, enum: ['weekly', 'monthly', 'final'], required: true },
    date:     { type: Date, required: true },
    fileUrl:  { type: String },                         // path to uploaded PDF/image, e.g. "/uploads/abc123.pdf"

    // Status starts as "pending", becomes "graded" after a doctor grades it
    status:   { type: String, enum: ['pending', 'graded'], default: 'pending' },

    grade:    { type: String, default: null },   // 'Competent' | 'Not-Competent'

    // Assessment form data
    globalRating:       { type: String, enum: ['competent', 'not-competent'] },
    assessmentCriteria: { type: mongoose.Schema.Types.Mixed, default: {} },
    assessorComments:   { type: String,  default: '' },
    assessorSignature:  { type: String,  default: '' },
    traineeSignature:   { type: String,  default: '' },

    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt: { type: Date },

    locked:   { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
