// backend/models/Country.js
const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true, unique: true },
    code:      { type: String, required: true, uppercase: true, trim: true, unique: true },
    // Display rank. Seeded countries carry their source-sheet sequence (1..N);
    // countries added later default to 9999 so they sort after the seeded set.
    order:     { type: Number, default: 9999 },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Country', countrySchema);
