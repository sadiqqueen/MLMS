// backend/models/Initiative.js
// A training-program "initiative" (مبادرة استحداث برنامج تدريبي) — a proposal
// to create a new medical specialty. It moves through three sequential stages
// (under_study → foundational → final), ticking off approval checkpoints along
// the way. Deletes are soft (deletedAt) so history is preserved.
const mongoose = require('mongoose');
const {
  STAGES,
  LEVELS,
  CHECKPOINT_STATUSES,
  ALL_CHECKPOINT_KEYS,
} = require('../utils/initiativeCheckpoints');

// One approval checkpoint. Stored in a Map keyed by the checkpoint KEY (see
// utils/initiativeCheckpoints) — labels are never persisted.
const checkpointSchema = new mongoose.Schema(
  {
    status: { type: String, enum: CHECKPOINT_STATUSES, default: 'pending' },
    date:   { type: Date, default: null },
    note:   { type: String, default: '' },
  },
  { _id: false }
);

// Uploaded attachment (pdf/word/…). Same shape as ConsultantMemo.attachmentFiles
// so the existing /api/consultant-memo/upload endpoint and UI can be reused.
const attachmentFileSchema = new mongoose.Schema(
  {
    name:       String,
    url:        String,
    fileId:     String,
    mimeType:   String,
    size:       Number,
    uploadedAt: Date,
  },
  { _id: false }
);

const initiativeSchema = new mongoose.Schema(
  {
    name:   { type: String, required: true, trim: true },   // اسم المبادرة
    source: { type: String, default: '', trim: true },      // مصدر المبادرة
    level:  { type: String, enum: LEVELS, default: 'primary' },        // رئيسي / دقيق
    stage:  { type: String, enum: STAGES, default: 'under_study', index: true },

    // keyed by checkpoint KEY → { status, date, note }
    checkpoints: { type: Map, of: checkpointSchema, default: () => ({}) },

    attachmentFiles: { type: [attachmentFileSchema], default: [] },     // المرفقات
    notes:           { type: String, default: '' },                    // ملاحظات

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null, index: true },             // soft delete
  },
  { timestamps: true, collection: 'initiatives' }
);

// Guard: never persist a checkpoint key that isn't a known key.
initiativeSchema.path('checkpoints').validate(function (map) {
  if (!map) return true;
  for (const key of map.keys()) {
    if (!ALL_CHECKPOINT_KEYS.includes(key)) return false;
  }
  return true;
}, 'Invalid checkpoint key');

// Return exactly the documented API contract (+ attachmentFiles). The Map
// serializes to a plain object; internal fields are dropped.
initiativeSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.deletedAt;
    delete ret.createdBy;
    return ret;
  },
});

module.exports = mongoose.model('Initiative', initiativeSchema);
