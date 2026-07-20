// backend/models/Specialty.js
const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    // Redesign v2 — Scientific-Council hierarchy. The authoritative global
    // specialties (seeded from the Excel via migrations/seedCouncilsSpecialties.js)
    // carry: an English name, a رئيس/دقيق type, a numeric/string code (unique when
    // present), and the owning ScientificCouncil. Legacy per-hospital specialty
    // rows leave these unset (councilId null, no code) so they stay OUT of any
    // council/CS/HOC scope.
    nameEn:           { type: String, default: '' },
    type:             { type: String, enum: ['main', 'precise'], default: 'precise', index: true },
    councilId:        { type: mongoose.Schema.Types.ObjectId, ref: 'ScientificCouncil', default: null, index: true },
    code:             { type: String, trim: true, unique: true, sparse: true, index: true },

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
    isActive:         { type: Boolean, default: true },

    // Training portal this specialty belongs to (default 'advanced' incl. legacy).
    track:            { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Specialty', specialtySchema);
