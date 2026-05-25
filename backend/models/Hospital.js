// backend/models/Hospital.js
const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    // Existing fields — keep all
    name:           { type: String, required: true, trim: true },
    city:           { type: String, default: '' },
    address:        { type: String, default: '' },
    specialties:    [{ type: String }],
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // V2 NEW FIELDS
    governorate:    { type: String, default: '' },
    dioId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    presidentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive:       { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);
