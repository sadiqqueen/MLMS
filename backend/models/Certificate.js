const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    rotation:  { type: mongoose.Schema.Types.ObjectId, ref: 'Rotation' },
    specialty: { type: String, default: '' },
    doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospital:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    issueDate: { type: Date, default: Date.now },
    notes:     { type: String, default: '' },
    issuedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Certificate', certificateSchema);
