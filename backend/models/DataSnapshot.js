// backend/models/DataSnapshot.js
// One record per CSV file produced by the snapshot job (jobs/snapshots.js).
// Files live under backend/uploads/snapshots/<range>-<YYYY-MM-DD>/<dataset>.csv;
// `fileName` is the path relative to uploads/snapshots. Downloaded by the Data
// Analyzer via /api/analyzer/snapshots/:id/download.
const mongoose = require('mongoose');

const dataSnapshotSchema = new mongoose.Schema(
  {
    range:       { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true, index: true },
    fileName:    { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
    sizeBytes:   { type: Number, default: 0 },
    datasets:    { type: [String], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DataSnapshot', dataSnapshotSchema);
