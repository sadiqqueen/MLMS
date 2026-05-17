const mongoose = require('mongoose');

const distributionSchema = new mongoose.Schema(
  {
    doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    hospital:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    specialty: { type: String, required: true },
    startDate: { type: Date },
    endDate:   { type: Date },
    status:    { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Distribution', distributionSchema);
