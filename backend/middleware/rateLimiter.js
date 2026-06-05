// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const { logSecurityEvent } = require('./securityEventLogger');

function rateLimitHandler(reason, message) {
  return (req, res, next, options) => {
    logSecurityEvent(req, {
      type: 'rate_limit',
      severity: reason === 'login_rate_limit' ? 'medium' : 'low',
      reason,
      statusCode: options.statusCode,
      metadata: {
        limit: options.limit,
        windowMs: options.windowMs
      }
    });

    return res.status(options.statusCode).json(message);
  };
}

// Applied only to /api/auth/login — 10 attempts per 15 min per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
  handler: rateLimitHandler('login_rate_limit', { message: 'Too many login attempts. Please try again in 15 minutes.' })
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many refresh requests. Please try again shortly.' },
  handler: rateLimitHandler('refresh_rate_limit', { message: 'Too many refresh requests. Please try again shortly.' })
});

// Applied globally to all routes — 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down' },
  handler: rateLimitHandler('global_rate_limit', { success: false, message: 'Too many requests, please slow down' })
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many write requests' },
  handler: rateLimitHandler('write_rate_limit', { success: false, message: 'Too many write requests' })
});

module.exports = { loginLimiter, refreshLimiter, globalLimiter, writeLimiter };
