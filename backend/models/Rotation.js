const mongoose = require('mongoose');

// A Rotation is a trainee hospital movement over time.
// Keep student/hospital/doctor legacy names alongside V2 aliases.
const rotationSchema = new mongoose.Schema(
  {
    traineeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    hospitalId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', index: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    specialtyId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', index: true },

    // Training portal this record belongs to (default 'advanced' incl. legacy).
    track:        { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true },

    student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true, index: true },
    hospital:   { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    doctor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },    // legacy supervisor field
    startDate:  { type: Date, required: true },
    endDate:    { type: Date, required: true },

    // Status tracks where this rotation is in time
    status: {
      type: String,
      enum: ['completed', 'current', 'upcoming', 'cancelled'],
      default: 'upcoming'
    },

    // These are calculated and stored when a rotation ends
    weeklyAvg:  { type: String },   // e.g. "A"
    monthlyAvg: { type: String },   // e.g. "B+"
    finalGrade: { type: String }    // e.g. "A-"
  },
  { timestamps: true }
);

rotationSchema.index({ traineeId: 1, status: 1 });
rotationSchema.index({ traineeId: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Rotation', rotationSchema);
