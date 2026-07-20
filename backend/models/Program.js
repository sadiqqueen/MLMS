// backend/models/Program.js
const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    trainingCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    specialtyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true, index: true },
    programDirectorId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    // Redesign v2 — a program may carry a Sub-Program-Director (read-only mirror
    // of the PD). Distinct from User.pdId (which links a sub_pd account to its PD).
    subProgramDirectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // Redesign v2 — explicit training duration in years (the Add-Program modal
    // input). When present, utils/accreditation.js derives expiry from it; the
    // legacy accreditationType (partly=2y / fully=6y) is now OPTIONAL and kept
    // only for existing programs that predate durationYears.
    durationYears:          { type: Number, min: 1, default: null },
    accreditationType:      { type: String, enum: ['partly', 'fully'], default: null },
    accreditationGrantDate: { type: Date, default: null },
    accreditationNumber:    { type: String, default: '' },
    accreditationWithdrawn: { type: Boolean, default: false },

    yearlyCapacity:        { type: Number, min: 0, required: true },
    // Optional in v2 (the redesign modal omits it); defaulted when unset.
    trainingStartDate:     { type: Date, default: null },
    renewalApplicationDate:{ type: Date, default: null },

    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Program', programSchema);
