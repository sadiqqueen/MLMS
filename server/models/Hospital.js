const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema(
  {
    name:           { type: String, required: true, trim: true },
    city:           { type: String, default: '' },
    address:        { type: String, default: '' },
    specialties:    [{ type: String }],
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hospital', hospitalSchema);
