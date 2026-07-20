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
    // Redesign v2 — the Sub-DIO assigned to this center on the training-center
    // form (the DIO's assignedCenterIds is dual-written for scope; the Sub-DIO
    // resolves centers through its parent DIO). Optional center identifier field
    // from the Add-Center modal ("ID", distinct from accreditationNumber).
    subDioId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    idNumber:       { type: String, default: '', trim: true },
    presidentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Registry v2 — training-center country + accreditation (expiry may be stored
    // directly for centers; status computed in utils/accreditation.js).
    countryId:              { type: mongoose.Schema.Types.ObjectId, ref: 'Country', default: null, index: true },
    accreditationNumber:    { type: String, default: '' },
    accreditationGrantDate: { type: Date, default: null },
    accreditationExpiry:    { type: Date, default: null },
    accreditationWithdrawn: { type: Boolean, default: false },

    programDirector:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    supervisors:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    phone:          { type: String, default: '' },
    email:          { type: String, default: '' },
    isActive:       { type: Boolean, default: true },

    // Per-specialty DIO settings, scoped to THIS hospital. Emergency Medicine at
    // Hospital A has its own capacity/duration, independent of the same specialty
    // at Hospital B. `null` means the DIO has not set that value yet.
    specialtySettings: [{
      specialtyId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true },
      annualCapacity:         { type: Number, min: 0, default: null },   // null = not set
      trainingDurationYears:  { type: Number, min: 0, default: null }    // null = not set (whole years)
    }],

    // Training portal this hospital belongs to (default 'advanced' incl. legacy).
    track:          { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);
