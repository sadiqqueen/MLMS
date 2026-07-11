const mongoose = require('mongoose');

// A course or certificate the trainee uploaded themselves (self-reported CPD).
// This is DISTINCT from the official issued/verifiable Certificate model — these
// are attachments the trainee adds to their own portfolio, visible to their
// Supervisor / Program Director / DIO on the trainee card.
const traineeCourseSchema = new mongoose.Schema(
  {
    trainee:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:         { type: String, required: true, trim: true },
    issuer:        { type: String, default: '', trim: true },      // issuing body / provider
    kind:          { type: String, enum: ['course', 'certificate'], default: 'certificate' },
    completedDate: { type: Date, default: null },
    fileUrl:       { type: String, default: '' },                  // /uploads/trainee-courses/<file>
    fileName:      { type: String, default: '' },                  // original (decoded) filename
    // Kept in sync with the uploading trainee's portal so Basic/Advanced stay separate.
    track:         { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TraineeCourse', traineeCourseSchema);
