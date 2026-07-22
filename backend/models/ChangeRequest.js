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
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // secretary / clerk / CS
    // 'edit' — change an existing account/entity; 'delete' — soft-delete it
    // (both reviewed by the Data Analyzer in the redesign clerk/CS flow);
    // 'capacity_exception' — legacy secretary→DIO create-above-capacity flow.
    requestType: { type: String, enum: ['edit', 'delete', 'capacity_exception'], default: 'edit', index: true },
    targetModel: { type: String, default: 'User' },
    // Required for edits/deletes, null for capacity_exception (no account yet).
    targetId:    { type: mongoose.Schema.Types.ObjectId, default: null },
    // The hospital a capacity_exception is scoped to (also traceability for edits).
    hospitalId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },
    // Which apply-rules to re-run on approval. The original two (trainees,
    // supervisors) drive the legacy DIO-reviewed flow; the rest are the redesign
    // clerk/CS registry targets reviewed by the Data Analyzer (see
    // utils/registryChanges.js).
    routeKey:    {
      type: String,
      enum: [
        'trainees', 'supervisors',
        'dios', 'odios', 'sub_dios', 'pds', 'sub_pds',
        'centers', 'programs', 'countries',
        'clerks', 'central_secretaries', 'hocs'
      ],
      required: true
    },
    targetLabel: { type: String, default: '' },   // denormalized account/entity name for the list

    changes:     { type: mongoose.Schema.Types.Mixed, required: true },   // raw allowlist-picked fields to apply
    before:      { type: mongoose.Schema.Types.Mixed, default: {} },      // raw snapshot of the same keys
    display:     { type: [mongoose.Schema.Types.Mixed], default: [] },    // [{ label, from, to }] diff

    // Who approves this request: 'dio' (legacy secretary/CS→DIO/ODIO inbox),
    // 'data_analyzer' (redesign central-secretary→Analyzer inbox), or 'head_ad'
    // (Head AD reviews the data-entry clerk's registry edits/deletes). Legacy
    // rows have no value and are treated as 'dio'; the DIO inbox filters
    // { $nin:['data_analyzer','head_ad'] } and each redesign inbox filters its
    // own reviewerRole, so the pipelines never cross.
    reviewerRole: { type: String, enum: ['dio', 'data_analyzer', 'head_ad'], default: 'dio', index: true },

    // Required book-of-changes PDF for clerk/CS analyzer-reviewed requests.
    bookOfChangesPdf: {
      fileUrl:   { type: String, default: '' },   // /uploads/book-of-changes/<file>
      fileName:  { type: String, default: '' },   // decoded original filename
      sizeBytes: { type: Number, default: 0 },
    },

    status:      { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // DIO or Data Analyzer
    reviewedAt:  { type: Date, default: null },
    reviewNote:  { type: String, default: '' },

    specialtyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', default: null }, // requester scope snapshot
    track:       { type: String, enum: ['basic', 'advanced'], default: 'advanced', index: true },
  },
  { timestamps: true }
);

// EDIT + DELETE: at most one PENDING change per target (backstop for the
// check-then-create race in the submit routes; the E11000 is surfaced as 409).
// Keyed on targetId TYPE so it covers edit and delete (both carry a real
// targetId) but never capacity_exception (targetId null). $type is used because
// $in is not permitted in a partialFilterExpression. Existing databases must run
// migrations/reconcileChangeRequestIndexes.js to drop the old edit-only index.
changeRequestSchema.index(
  { targetId: 1 },
  { unique: true, name: 'cr_pending_target_unique',
    partialFilterExpression: { status: 'pending', targetId: { $type: 'objectId' } } }
);

// CAPACITY: at most one PENDING capacity request per
// (secretary, hospital, specialty, trainee email). Same race backstop, surfaced
// as 409. `changes.email` is normalised to lowercase before it is stored.
changeRequestSchema.index(
  { requestedBy: 1, hospitalId: 1, specialtyId: 1, 'changes.email': 1 },
  { unique: true, partialFilterExpression: { status: 'pending', requestType: 'capacity_exception' } }
);

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
