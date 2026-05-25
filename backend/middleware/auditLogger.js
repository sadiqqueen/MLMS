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

        AuditLog.create({
          userId:      req.user._id,
          action,
          targetId,
          targetModel,
          ip:          req.ip || req.headers['x-forwarded-for'] || 'unknown'
        }).catch(() => {}); // silently ignore audit log failures
      }
      return originalJson(body);
    };
    next();
  };
};
