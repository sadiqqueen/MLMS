const mongoose = require('mongoose');
const { normalizeArabic } = require('../utils/arabic');

// One source of truth for the المجلس العلمي dropdown: the 21 seeded
// defaults plus every custom council added through the أخرى flow.
// `normalizedName` carries the unique index so أ/ا, ة/ه, ى/ي variants
// can never produce duplicates.
const scientificCouncilSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    // English council name (redesign v2). Optional so the Arabic-only
    // consultant-memo seed rows are never broken; set by the councils/specialties
    // seed for the 20 real councils.
    nameEn:         { type: String, default: '' },
    normalizedName: { type: String, required: true, unique: true, index: true },
    isDefault:      { type: Boolean, default: false },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'scientific_councils' }
);

scientificCouncilSchema.pre('validate', function (next) {
  if (this.name) this.normalizedName = normalizeArabic(this.name);
  next();
});

module.exports = mongoose.model('ScientificCouncil', scientificCouncilSchema);
