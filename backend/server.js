// backend/server.js
require('dotenv').config();
const crypto = require('crypto');

const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
REQUIRED_ENV.forEach(key => {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
});
if (!process.env.JWT_REFRESH_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: Missing required environment variable: JWT_REFRESH_SECRET');
    process.exit(1);
  }
  process.env.JWT_REFRESH_SECRET = crypto.randomBytes(64).toString('hex');
  console.warn('WARNING: JWT_REFRESH_SECRET missing; generated temporary development-only secret.');
}

const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const path         = require('path');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const { globalLimiter, writeLimiter, efReadLimiter } = require('./middleware/rateLimiter');
const honeypot = require('./middleware/honeypot');
const auth = require('./middleware/auth');

const app = express();
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const writeMethodsOnly = (req, res, next) => (
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ? writeLimiter(req, res, next)
    : next()
);

// ── SECURITY MIDDLEWARE ───────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
    }
  }
}));

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, mobile apps, same-origin)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// Download with the ORIGINAL (possibly Arabic) filename:
// /uploads/consultant-memos/<file>?dl=<original name> sets an RFC 5987
// Content-Disposition before the static handler streams the file.
const { contentDisposition } = require('./utils/filename');
app.use('/uploads/consultant-memos', (req, res, next) => {
  if (typeof req.query.dl === 'string' && req.query.dl) {
    res.setHeader('Content-Disposition', contentDisposition(req.query.dl));
  }
  next();
});

// Uploaded training/report files require an authenticated session.
app.use('/uploads', auth, express.static(path.join(__dirname, 'uploads')));

app.use('/api/evaluations', writeMethodsOnly);
app.use('/api/reports', writeMethodsOnly);
app.use('/api/certificates', writeMethodsOnly);
app.use('/api/trainee-courses', writeMethodsOnly);
app.use('/api/research', writeMethodsOnly);

// ── HEALTH CHECK ─────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ── EXISTING ROUTES (unchanged) ───────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/hospitals',     require('./routes/hospitals'));
app.use('/api/universities',  require('./routes/universities'));
app.use('/api/distributions', require('./routes/distributions'));
app.use('/api/evaluations',   require('./routes/evaluations'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/rotations',     require('./routes/rotations'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/certificates/verify', require('./routes/certificateVerify'));
app.use('/api/certificates',  require('./routes/certificates'));

// ── NEW V2 ROUTES ─────────────────────────────────────────────────────────
app.use('/api/specialties',       require('./routes/specialties'));
app.use('/api/supervisor',        require('./routes/supervisor'));
app.use('/api/program-director',  require('./routes/programDirector'));
app.use('/api/secretary',         require('./routes/secretary'));
app.use('/api/dio',               require('./routes/dio'));
app.use('/api/president',         require('./routes/president'));
app.use('/api/trainee',           require('./routes/trainee'));
app.use('/api/trainee-courses',   require('./routes/traineeCourses'));
app.use('/api/research',          require('./routes/research'));
app.use('/api/admin',             require('./routes/adminV2'));
app.use('/api/consultant-memo',   require('./routes/consultantMemo'));
app.use('/api/scientific-councils', require('./routes/scientificCouncils'));
app.use('/api/initiatives',       require('./routes/initiatives'));

// ── EVENT FEEDBACK (separate subsystem) ────────────────────────────────────
// Public, no-auth attendee endpoints (gated by event code + rate limiting).
app.use('/api/event-feedback/public', efReadLimiter, require('./routes/eventFeedbackPublic'));
// Authenticated admin endpoints (super_admin only).
app.use('/api/event-feedback',        require('./routes/eventFeedback'));

app.use(honeypot());

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ── START SERVER ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('✅ MongoDB connected');
      app.listen(PORT, () => console.log(`✅ MTMS V2 Server running on port ${PORT}`));
    })
    .catch(err => {
      console.error('❌ MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
