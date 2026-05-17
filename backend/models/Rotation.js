const mongoose = require('mongoose');

// A Rotation is one hospital placement for a student.
// One student can have many rotations (one per hospital, over time).
const rotationSchema = new mongoose.Schema(
  {
    student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    hospital:   { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    doctor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },    // doctor supervising this rotation
    startDate:  { type: Date, required: true },
    endDate:    { type: Date, required: true },

    // Status tracks where this rotation is in time
    status: {
      type: String,
      enum: ['completed', 'current', 'upcoming'],
      default: 'upcoming'
    },

    // These are calculated and stored when a rotation ends
    weeklyAvg:  { type: String },   // e.g. "A"
    monthlyAvg: { type: String },   // e.g. "B+"
    finalGrade: { type: String }    // e.g. "A-"
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rotation', rotationSchema);
