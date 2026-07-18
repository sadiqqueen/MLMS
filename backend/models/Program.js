// backend/models/Program.js
const mongoose = require('mongoose');

const programSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    trainingCenterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    specialtyId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true, index: true },
    programDirectorId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // partly = 2 years, fully = 6 years (expiry computed in utils/accreditation.js — never stored)
    accreditationType:      { type: String, enum: ['partly', 'fully'], required: true },
    accreditationGrantDate: { type: Date, required: true },
    accreditationNumber:    { type: String, default: '' },
    accreditationWithdrawn: { type: Boolean, default: false },

    yearlyCapacity:        { type: Number, min: 0, required: true },
    trainingStartDate:     { type: Date, required: true },
    renewalApplicationDate:{ type: Date, default: null },

    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Program', programSchema);
