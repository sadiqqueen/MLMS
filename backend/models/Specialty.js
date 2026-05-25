// backend/models/Specialty.js
const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: ['Internal Medicine', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology', 'Emergency Medicine']
    },
    hospitalId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    secretaryId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    weeklyReportPdf:  { type: String, default: '' },
    monthlyReportPdf: { type: String, default: '' },
    finalReportPdf:   { type: String, default: '' },
    isActive:         { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Specialty', specialtySchema);
