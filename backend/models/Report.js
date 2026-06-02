const mongoose = require('mongoose');

// A Report is one document submitted by a student during a rotation.
const reportSchema = new mongoose.Schema(
  {
    student:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true, index: true },
    rotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Rotation' },
    distribution: { type: mongoose.Schema.Types.ObjectId, ref: 'Distribution', index: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },

    title:    { type: String, required: true },         // e.g. "Week 3 Report"
    type:     { type: String, enum: ['weekly', 'monthly', 'final'], required: true, index: true },
    date:     { type: Date, required: true },
    fileUrl:  { type: String },                         // path to uploaded PDF/image, e.g. "/uploads/abc123.pdf"

    // Status lifecycle: pending → approved/rejected (supervisor) → graded (program director)
    status:   { type: String, enum: ['pending', 'approved', 'rejected', 'graded'], default: 'pending', index: true },

    grade:    { type: String, default: null },   // e.g. 'Competent', 'Not-Competent', A, B+
    score:    { type: Number, min: 0, max: 100, default: null },

    // Assessment form data
    globalRating:       { type: String, enum: ['competent', 'not-competent'] },
    assessmentCriteria: { type: mongoose.Schema.Types.Mixed, default: {} },
    assessorComments:   { type: String,  default: '' },
    assessorSignature:  { type: String,  default: '' },
    traineeSignature:   { type: String,  default: '' },

    gradedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedByRole: { type: String, default: '' },
    gradedAt:     { type: Date },
    gradeHistory: [{
      grade:             { type: String, default: null },
      score:             { type: Number, default: null },
      status:            { type: String, default: '' },
      globalRating:      { type: String, default: '' },
      assessorComments:  { type: String, default: '' },
      reviewNote:        { type: String, default: '' },
      gradedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      gradedByRole:      { type: String, default: '' },
      gradedAt:          { type: Date },
      changedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedByRole:     { type: String, default: '' },
      changedAt:         { type: Date, default: Date.now },
      action:            { type: String, enum: ['grade', 'override'], default: 'grade' }
    }],

    locked:   { type: Boolean, default: false },

    // V2: review fields set by supervisor (weekly/monthly) or program director (final)
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewNote:  { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
