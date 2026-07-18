// backend/models/LogBookEntry.js
// A trainee's log-book entry (a procedure they performed). Created by the trainee
// (status 'pending'); a supervisor reviews it → 'signed_off' or 'rejected'
// (see routes/logbook.js).
const mongoose = require('mongoose');

const logBookEntrySchema = new mongoose.Schema(
  {
    traineeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    programId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null, index: true },
    date:          { type: Date, required: true },
    procedureType: { type: String, required: true, trim: true },
    notes:         { type: String, default: '' },
    status:        { type: String, enum: ['pending', 'signed_off', 'rejected'], default: 'pending', index: true },
    reviewedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:    { type: Date, default: null },
    reviewNote:    { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LogBookEntry', logBookEntrySchema);
