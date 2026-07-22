// backend/middleware/scopeGuard.js
// Attaches a scope object to req.scope based on the user's role.
// Route handlers use this to filter database queries automatically.
// This ensures data isolation at the API level, not just the frontend.

module.exports = function scopeGuard() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    const { role, _id, hospitalId, hospital, specialtyId, councilId, secretaryType } = req.user;
    const effectiveHospital = hospitalId || hospital;

    switch (role) {
      case 'trainee':
        req.scope = { traineeId: _id };
        break;
      case 'trainer':
        req.scope = { supervisorId: _id };
        break;
      case 'program_director':
        // A Program Director is scoped to their single specialty (they oversee
        // that specialty across every hospital that offers it).
        req.scope = { specialtyId };
        break;
      case 'secretary':
        req.scope = { specialtyId };
        break;
      // Head of Council: oversight limited to its assigned Scientific Council.
      // Route handlers resolve councilId → specialty set (utils/councilScope.js);
      // this only carries the council id.
      case 'hoc':
        req.scope = { councilId };
        break;
      // Central Secretary: a main-type CS is scoped to its council; the single
      // precise-type CS covers every precise specialty. The concrete specialty
      // set is resolved async in the route handlers (utils/councilScope.js).
      case 'central_secretary':
        req.scope = { councilId, secretaryType };
        break;
      case 'odio':
        req.scope = { hospitalId: effectiveHospital };
        break;
      case 'developer':
        req.scope = {}; // sees everything
        break;
      default:
        req.scope = { userId: _id };
    }

    next();
  };
};
