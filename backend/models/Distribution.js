// backend/models/Distribution.js
const mongoose = require('mongoose');

const distributionSchema = new mongoose.Schema(
  {
    // V2 supervisor placement: which supervisor is assigned to which hospital/specialty.
    // traineeId/student/startDate/endDate remain optional legacy fields for old data only.
    traineeId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
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
    status:        { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
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
