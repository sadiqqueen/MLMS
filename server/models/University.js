const mongoose = require('mongoose');

const universitySchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    city:         { type: String, default: '' },
    address:      { type: String, default: '' },
    contactEmail: { type: String, default: '' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('University', universitySchema);
