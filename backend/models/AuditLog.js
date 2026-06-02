// backend/models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action:      { type: String, required: true },
    targetId:    { type: mongoose.Schema.Types.ObjectId },
    targetModel: { type: String },
    metadata:    { type: mongoose.Schema.Types.Mixed, default: {} },
    ip:          { type: String }
  },
  {
    timestamps: true,
    // Only keep createdAt — no updatedAt needed for logs
    toJSON: { virtuals: false }
  }
);

const retentionDays = Math.max(1, Number(process.env.AUDIT_LOG_RETENTION_DAYS) || 180);

// Keep audit logs queryable by user/date and automatically expire old entries.
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: retentionDays * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
