// backend/models/Country.js
const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true, unique: true },
    code:      { type: String, required: true, uppercase: true, trim: true, unique: true },
    isActive:  { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Country', countrySchema);
