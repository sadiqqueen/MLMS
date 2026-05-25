// backend/middleware/scopeGuard.js
// Attaches a scope object to req.scope based on the user's role.
// Route handlers use this to filter database queries automatically.
// This ensures data isolation at the API level, not just the frontend.

module.exports = function scopeGuard() {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });

    const { role, _id, hospitalId, hospital, specialtyId } = req.user;
    const effectiveHospital = hospitalId || hospital;

    switch (role) {
      case 'trainee':
        req.scope = { traineeId: _id };
        break;
      case 'supervisor':
        req.scope = { supervisorId: _id };
        break;
      case 'program_director':
        req.scope = { hospitalId: effectiveHospital };
        break;
      case 'secretary':
        req.scope = { specialtyId };
        break;
      case 'dio':
        req.scope = { hospitalId: effectiveHospital };
        break;
      case 'president':
        req.scope = { hospitalId: effectiveHospital };
        break;
      case 'super_admin':
        req.scope = {}; // sees everything
        break;
      default:
        req.scope = { userId: _id };
    }

    next();
  };
};
