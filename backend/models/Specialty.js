// backend/models/Specialty.js
const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    hospitalId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    secretaryId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    weeklyReportPdf:  { type: String, default: '' },
    monthlyReportPdf: { type: String, default: '' },
    finalReportPdf:   { type: String, default: '' },
    evaluationPdf1:   { type: String, default: '' },
    evaluationPdf2:   { type: String, default: '' },
    evaluationPdf3:   { type: String, default: '' },
    evaluationPdf4:   { type: String, default: '' },
    evaluationPdf5:   { type: String, default: '' },
    isActive:         { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Specialty', specialtySchema);
