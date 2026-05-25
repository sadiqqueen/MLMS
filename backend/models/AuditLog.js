// backend/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action:      { type: String, required: true },
    targetId:    { type: mongoose.Schema.Types.ObjectId },
    targetModel: { type: String },
    ip:          { type: String }
  },
  {
    timestamps: true,
    // Only keep createdAt — no updatedAt needed for logs
    toJSON: { virtuals: false }
  }
);

// Index for fast queries by date range (audit log page sorts by this)
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
