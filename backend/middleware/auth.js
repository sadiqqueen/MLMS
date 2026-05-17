const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// This function is a middleware — it takes (req, res, next) as arguments.
// req  = the incoming request (what the browser sent)
// res  = the outgoing response (what we send back)
// next = a function to call when we're done, telling Express to continue to the route handler

module.exports = async (req, res, next) => {

  // Every protected request must include a header like:
  //   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  const header = req.headers.authorization;

  // If the header is missing or doesn't start with "Bearer ", reject the request
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
    //          ↑ 401 means "Unauthorized" — you need to log in first
  }

  // Extract just the token part after "Bearer "
  const token = header.split(' ')[1];

  try {
    // jwt.verify checks:
    //   1. Was this token signed with our JWT_SECRET? (proves it's real, not forged)
    //   2. Has it expired?
    // If both pass, it returns the data we encoded inside the token (the payload)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //   decoded = { id: "665a3f...", role: "student", iat: ..., exp: ... }

    // Look up the actual user from the database using the id in the token
    // .select('-password') means "give me everything EXCEPT the password field"
    const user = await User.findById(decoded.id).select('-password');

    if (!user) return res.status(401).json({ message: 'User not found' });

    // Attach the user to the request object so any route after this can access it
    // as req.user — e.g. req.user._id, req.user.role
    req.user = user;

    next(); // ✅ security check passed — continue to the route handler
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
