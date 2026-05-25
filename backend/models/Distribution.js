// backend/models/Distribution.js
const mongoose = require('mongoose');

const distributionSchema = new mongoose.Schema(
  {
    // V2: renamed and new fields
    traineeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    specialtyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true },
    hospitalId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    startDate:     { type: Date },
    endDate:       { type: Date },
    durationWeeks: { type: Number },
    status:        { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Keep legacy fields for backwards compatibility with existing data
    doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospital:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    specialty: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Distribution', distributionSchema);
