// backend/middleware/auth.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;

  // Track the user ID claimed by the access token (even if expired)
  // so we can validate it matches the refresh cookie's user later.
  let claimedUserId = null;

  // Try access token from Authorization header first
  if (header && header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return res.status(401).json({ message: 'User not found' });
      if (user.isActive === false) return res.status(403).json({ message: 'Account deactivated' });
      // Check brute-force lock
      if (user.lockUntil && user.lockUntil > new Date()) {
        const mins = Math.ceil((user.lockUntil - new Date()) / 60000);
        return res.status(423).json({ message: `Account locked. Try again in ${mins} minute(s).` });
      }
      req.user = user;
      return next();
    } catch (err) {
      // Access token invalid/expired — decode without verification to get claimed user id
      try {
        const unverified = jwt.decode(token);
        if (unverified?.id) claimedUserId = unverified.id.toString();
      } catch { /* ignore malformed token */ }
    }
  }

  // Try refresh token from httpOnly cookie
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Security: if an (expired) access token was presented, its user id must match
    // the refresh token's user id. Prevents silent identity switch when a stale
    // refresh cookie from a different session is present in the browser.
    if (claimedUserId && decoded.id.toString() !== claimedUserId) {
      return res.status(401).json({ message: 'Session mismatch — please log in again' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.isActive === false) return res.status(403).json({ message: 'Account deactivated' });

    // Issue new access token
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Send new access token in response header
    res.setHeader('X-New-Access-Token', newAccessToken);
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
