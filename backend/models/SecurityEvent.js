// backend/models/SecurityEvent.js
const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['honeypot', 'rate_limit', 'auth', 'suspicious_route'],
      required: true,
      index: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
      index: true
    },
    reason: { type: String, required: true },
    method: { type: String, default: '' },
    path: { type: String, default: '' },
    ip: { type: String, default: 'unknown', index: true },
    userAgent: { type: String, default: '' },
    referrer: { type: String, default: '' },
    statusCode: { type: Number, default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    toJSON: { virtuals: false }
  }
);

const retentionDays = Math.max(1, Number(process.env.SECURITY_EVENT_RETENTION_DAYS) || 90);

securityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: retentionDays * 24 * 60 * 60 });
securityEventSchema.index({ type: 1, createdAt: -1 });
securityEventSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
