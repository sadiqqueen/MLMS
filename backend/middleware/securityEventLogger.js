// backend/middleware/securityEventLogger.js
const SecurityEvent = require('../models/SecurityEvent');

const SECRET_KEY_RE = /(pass|password|secret|token|cookie|authorization|jwt|key|credential|session)/i;
const MAX_TEXT = 512;

function truncate(value, max = MAX_TEXT) {
  if (value === undefined || value === null) return '';
  return String(value).slice(0, max);
}

function safeIp(req) {
  return truncate(req.ip || req.socket?.remoteAddress || 'unknown', 128);
}

function safeMetadata(metadata = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEY_RE.test(key)) continue;
    if (value === undefined || value === null) continue;
    if (['string', 'number', 'boolean'].includes(typeof value)) {
      safe[key] = truncate(value);
    }
  }
  return safe;
}

function securityEventFromRequest(req, details = {}) {
  return {
    type: details.type || 'suspicious_route',
    severity: details.severity || 'low',
    reason: truncate(details.reason || 'security_event'),
    method: truncate(req.method, 16),
    path: truncate(req.originalUrl || req.url || '', 512),
    ip: safeIp(req),
    userAgent: truncate(req.get('user-agent') || ''),
    referrer: truncate(req.get('referer') || req.get('referrer') || ''),
    statusCode: details.statusCode || null,
    userId: req.user?._id || null,
    metadata: safeMetadata(details.metadata)
  };
}

function logSecurityEvent(req, details = {}) {
  const event = securityEventFromRequest(req, details);
  return SecurityEvent.create(event).catch((err) => {
    console.error('[SecurityEvent] Failed to write:', err.message);
  });
}

module.exports = { logSecurityEvent };
