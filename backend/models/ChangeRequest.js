const mongoose = require('mongoose');

// A pending change a secretary made that the DIO must approve (queued model).
//   • requestType 'edit'  — an edit to an existing trainee/supervisor account.
//     `targetId` is that account; `changes` are the allowlist-picked fields.
//   • requestType 'capacity_exception' — a request to create a trainee ABOVE the
//     hospital+specialty annual capacity. `targetId` is null (no account yet) and
//     `changes` holds the full new-trainee payload; approving CREATES the trainee.
// Creates within capacity and deactivations still happen directly (not queued).
const changeRequestSchema = new mongoose.Schema(
  {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // secretary
    requestType: { type: String, enum: ['edit', 'capacity_exception'], default: 'edit', index: true },
    targetModel: { type: String, default: 'User' },
    // Required for edits, null for capacity_exception (the account does not exist yet).
    targetId:    { type: mongoose.Schema.Types.ObjectId, default: null },
    // The hospital a capacity_exception is scoped to (also traceability for edits).
    hospitalId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },
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

// EDITS: at most one PENDING edit request per target account (backstop for the
// check-then-create race in the secretary routes; the E11000 is surfaced as 409).
// Scoped to requestType 'edit' so capacity requests (targetId null) never collide.
changeRequestSchema.index(
  { targetId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending', requestType: 'edit' } }
);

// CAPACITY: at most one PENDING capacity request per
// (secretary, hospital, specialty, trainee email). Same race backstop, surfaced
// as 409. `changes.email` is normalised to lowercase before it is stored.
changeRequestSchema.index(
  { requestedBy: 1, hospitalId: 1, specialtyId: 1, 'changes.email': 1 },
  { unique: true, partialFilterExpression: { status: 'pending', requestType: 'capacity_exception' } }
);

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
