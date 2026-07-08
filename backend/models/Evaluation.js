// backend/models/Evaluation.js
const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    // Existing fields — keep all
    student:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospital:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    specialty:      { type: String, default: '' },
    date:           { type: Date, default: Date.now },
    evaluationType: { type: String, default: '' },
    grade:          { type: String, default: '' },
    notes:          { type: String, default: '' },
    status:         { type: String, enum: ['pending', 'completed'], default: 'pending' },

    // Training portal this record belongs to (default 'advanced' incl. legacy).
    track:          { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true },

    // V2 aliases (point to same concepts, new names)
    traineeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    supervisorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    distributionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Distribution' },
    rotationId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Rotation' },
    evaluatorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    evaluatorRole:  { type: String, default: '' },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByRole:  { type: String, default: '' },

    // V2 NEW FIELDS
    scores:          { type: mongoose.Schema.Types.Mixed, default: {} },
    // Structured WPBA form contents (header, overall rating, supervision level,
    // feedback, times) for the CBD / DOPS / Mini-CEX forms.
    formData:        { type: mongoose.Schema.Types.Mixed, default: {} },
    totalScore:      { type: Number, index: true },
    comments:        { type: String, default: '' },
    isFinalized:     { type: Boolean, default: false },
    sentToTraineeAt: { type: Date, default: null }
  },
  { timestamps: true }
);

evaluationSchema.index(
  { traineeId: 1, supervisorId: 1, monthYear: 1 },
  { unique: false }
);

module.exports = mongoose.model('Evaluation', evaluationSchema);
