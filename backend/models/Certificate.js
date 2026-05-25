// backend/models/Certificate.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const certificateSchema = new mongoose.Schema(
  {
    // Existing fields — keep all
    student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rotation:  { type: mongoose.Schema.Types.ObjectId, ref: 'Rotation' },
    specialty: { type: String, default: '' },
    doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospital:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    issueDate: { type: Date, default: Date.now },
    notes:     { type: String, default: '' },
    issuedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // V2 aliases
    traineeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    distributionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Distribution' },

    // V2 NEW FIELDS
    verifyCode: { type: String, unique: true, default: () => uuidv4(), sparse: true },
    fileUrl:    { type: String, default: '' },
    revokedAt:  { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Certificate', certificateSchema);
