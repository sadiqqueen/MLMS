// backend/models/Country.js
const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    // Source-sheet columns (أسماء الدول العربية.xlsx):
    //   التسلسل → order · الاسم الرسمي بالعربية → officialNameAr
    //   الاسم المختصر بالعربية → shortNameAr · الاسم الرسمي بالإنجليزية → officialNameEn
    //   الاسم المختصر بالإنجليزية → shortNameEn
    // These are enforced as required in the route (POST), not the schema, so the
    // 22 legacy rows and older payloads never fail validation on read/edit.
    officialNameAr: { type: String, trim: true },
    shortNameAr:    { type: String, trim: true },
    officialNameEn: { type: String, trim: true },
    shortNameEn:    { type: String, trim: true },

    // Back-compat display key — mirrors shortNameAr. Every existing consumer
    // (dropdowns, populates, registry tables) reads `country.name`, so the routes
    // keep it in sync instead of renaming 50+ call sites.
    name:      { type: String, required: true, trim: true, unique: true },

    // ISO alpha-2. Optional now (the source sheet has no code column); sparse so
    // multiple code-less countries don't collide on a null unique index.
    code:      { type: String, uppercase: true, trim: true, unique: true, sparse: true },

    // Display rank (التسلسل). Seeded countries carry their sheet sequence (1..N);
    // countries added without one default to 9999 so they sort after the set.
    order:     { type: Number, default: 9999 },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Country', countrySchema);
