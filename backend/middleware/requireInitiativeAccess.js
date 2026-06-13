// backend/middleware/requireInitiativeAccess.js
// Role-based access gate for the Training Program Initiatives feature.
// Only the ASG roles (asg1 / asg2) may use any /api/initiatives route —
// the same accounts that own the consultant-memo area. super_admin and all
// other roles are denied. Must run AFTER `auth` (it needs req.user). The 403
// here is the real access guarantee — the frontend only mirrors it for UX.

const ASG_ROLES = ['asg1', 'asg2'];

// Used by routes/auth.js to compute permissions.initiatives for login / me.
function hasInitiativeAccess(user) {
  return !!user && ASG_ROLES.includes(user.role);
}

function requireInitiativeAccess(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
  if (!hasInitiativeAccess(req.user)) {
    return res.status(403).json({ message: 'Access denied: initiatives are restricted' });
  }
  next();
}

module.exports = requireInitiativeAccess;
module.exports.hasInitiativeAccess = hasInitiativeAccess;
module.exports.ASG_ROLES = ASG_ROLES;
