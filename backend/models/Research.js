const mongoose = require('mongoose');

// A research submission by a trainee. It is sent to the trainee's supervisor for
// approval; once approved it becomes a Publication (status === 'approved'). The
// trainee then controls its visibility:
//   private → visible to the trainee and their supervisor only
//   public  → visible to the trainee, supervisor, Program Directors and DIOs
const researchSchema = new mongoose.Schema(
  {
    trainee:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // The supervisor this submission is routed to for approval (resolved at submit).
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    title:      { type: String, required: true, trim: true },
    authors:    { type: String, default: '' },
    journal:    { type: String, default: '' },   // journal / venue (for publications)
    abstract:   { type: String, default: '' },
    fileUrl:    { type: String, default: '' },    // /uploads/research/<file>
    fileName:   { type: String, default: '' },    // original (decoded) filename

    status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    visibility: { type: String, enum: ['private', 'public'], default: 'private' },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' },    // rejection reason / approval note

    track:      { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Research', researchSchema);
