// backend/models/AnalysisReport.js
// A PDF/PPTX analysis report uploaded by a Data Analyzer for the Secretary
// General + Assistant Secretary inbox (see routes/analyzer.js + routes/sg.js).
// The file lives under backend/uploads/analysis-reports/<fileId>; `name` is the
// original (possibly Arabic) filename recovered via decodeOriginalName.
const mongoose = require('mongoose');

const analysisReportSchema = new mongoose.Schema(
  {
    range:      { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true, index: true },
    name:       { type: String, required: true },
    url:        { type: String, required: true },
    fileId:     { type: String, required: true },
    mimeType:   { type: String, default: '' },
    sizeBytes:  { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AnalysisReport', analysisReportSchema);
