const mongoose = require('mongoose');

// A pending edit a secretary made to an account. It is NOT applied until the DIO
// approves it (queued model). Only account edits (trainee/supervisor) flow here;
// creates and deactivations still happen directly.
const changeRequestSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // secretary
    targetModel: { type: String, default: 'User' },
    targetId:    { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    routeKey:    { type: String, enum: ['trainees', 'supervisors'], required: true }, // which apply-rules to re-run
    targetLabel: { type: String, default: '' },   // denormalized account name for the list

    changes:     { type: mongoose.Schema.Types.Mixed, required: true },   // raw allowlist-picked fields to apply
    before:      { type: mongoose.Schema.Types.Mixed, default: {} },      // raw snapshot of the same keys
    display:     { type: [mongoose.Schema.Types.Mixed], default: [] },    // [{ label, from, to }] for the DIO diff

    status:      { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // DIO
    reviewedAt:  { type: Date, default: null },
    reviewNote:  { type: String, default: '' },

    specialtyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', default: null }, // secretary scope snapshot
    track:       { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
