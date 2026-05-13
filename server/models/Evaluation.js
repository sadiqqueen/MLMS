const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    student:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
    doctor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hospital:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    specialty: { type: String, default: '' },
    date:      { type: Date, default: Date.now },
    grade:     { type: String, default: '' },
    status:    { type: String, enum: ['pending', 'completed'], default: 'pending' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Evaluation', evaluationSchema);
