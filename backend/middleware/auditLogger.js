// backend/middleware/auditLogger.js
const AuditLog = require('../models/AuditLog');

// Factory: auditLog('create_user', 'User')
// Returns middleware that logs the action AFTER a successful response.
// Non-blocking — errors here never affect the route response.

module.exports = function auditLog(action, targetModel) {
  return (req, res, next) => {
    // Wrap res.json to intercept the response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only log successful write operations (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const targetId = res.locals.targetId
          || body?._id
          || body?.data?._id
          || null;

        // A handler may override the logged action per-request (e.g. soft vs hard
        // delete on the same route) by setting res.locals.auditAction.
        AuditLog.create({
          userId:      req.user._id,
          action:      res.locals.auditAction || action,
          targetId,
          targetModel,
          ip:          req.ip || req.headers['x-forwarded-for'] || 'unknown'
        }).catch((err) => console.error('[AuditLog] Failed to write:', err.message));
      }
      return originalJson(body);
    };
    next();
  };
};
