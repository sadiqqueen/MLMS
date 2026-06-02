// backend/models/Distribution.js
const mongoose = require('mongoose');

const distributionSchema = new mongoose.Schema(
  {
    // V2: renamed and new fields
    traineeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supervisorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    specialtyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', required: true, index: true },
    hospitalId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    startDate:     { type: Date },
    endDate:       {
      type: Date,
      validate: {
        validator: function (v) {
          return !this.startDate || !v || v > this.startDate;
        },
        message: 'endDate must be after startDate'
      }
    },
    durationWeeks: { type: Number },
    status:        { type: String, enum: ['upcoming', 'active', 'completed', 'cancelled'], default: 'active', index: true },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Keep legacy fields for backwards compatibility with existing data
    student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospital:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    specialty: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Distribution', distributionSchema);
