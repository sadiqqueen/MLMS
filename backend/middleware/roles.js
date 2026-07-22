// allowRoles is a function that RETURNS a middleware function.
// This pattern is called a "middleware factory" — you call it with the roles you want,
// and it gives you back a middleware that enforces that rule.
//
// Usage example:
//   router.post('/', auth, allowRoles('odio', 'developer'), createHospital)
//   This means: "to POST here, you must be logged in AND have one of those roles"

const allowRoles = (...roles) => (req, res, next) => {
  //                 ↑ rest parameter — collects all arguments into an array
  //                              ↑ returns a middleware function

  if (!req.user || !roles.includes(req.user.role)) {
    // 403 = "Forbidden" — you're logged in, but you don't have permission
    return res.status(403).json({ message: 'Access denied: insufficient permissions' });
  }

  next(); // ✅ role check passed — continue
};

module.exports = { allowRoles };
