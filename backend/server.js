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
const { allowRoles } = require('./middleware/roles');

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
// Object-level authorization on the sensitive upload prefixes: mirror each
// document's owning-API roles so a logged-in trainee/supervisor can't fetch a
// registry change justification or an ASG memo by guessing its filename. It also
// sets the RFC 5987 Content-Disposition for ?dl=<original name> downloads.
// Broadly-shared assets (profile photos, research/report files) stay on the
// auth-only /uploads gate below.
const bocHeader = (req, res, next) => {
  if (typeof req.query.dl === 'string' && req.query.dl) {
    res.setHeader('Content-Disposition', contentDisposition(req.query.dl));
  }
  next();
};
// Consultant memos — ASG.1 / ASG.2 only (mirrors routes/consultantMemo.js).
app.use('/uploads/consultant-memos', auth, allowRoles('asg1', 'asg2', 'developer'), bocHeader);
// Book-of-changes PDFs — the registry change-request submitters + reviewers only.
app.use('/uploads/book-of-changes', auth,
  allowRoles('data_entry', 'central_secretary', 'head_ad', 'data_analyzer', 'head_cs', 'odio', 'developer'),
  bocHeader);

// Uploaded training/report files require an authenticated session.
app.use('/uploads', auth, express.static(path.join(__dirname, 'uploads')));

app.use('/api/evaluations', writeMethodsOnly);
app.use('/api/reports', writeMethodsOnly);
app.use('/api/certificates', writeMethodsOnly);
app.use('/api/trainee-courses', writeMethodsOnly);
app.use('/api/research', writeMethodsOnly);
app.use('/api/logbook', writeMethodsOnly);
app.use('/api/central', writeMethodsOnly);
app.use('/api/registry', writeMethodsOnly);
app.use('/api/analyzer', writeMethodsOnly);
app.use('/api/head-ad', writeMethodsOnly);
app.use('/api/dio-view', writeMethodsOnly);
app.use('/api/announcements', writeMethodsOnly);

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
app.use('/api/trainee',           require('./routes/trainee'));
app.use('/api/trainee-courses',   require('./routes/traineeCourses'));
app.use('/api/research',          require('./routes/research'));
app.use('/api/admin',             require('./routes/adminV2'));
app.use('/api/countries',         require('./routes/countries'));
app.use('/api/registry',          require('./routes/registry'));
app.use('/api/programs',          require('./routes/programs'));
app.use('/api/analyzer',          require('./routes/analyzer'));
app.use('/api/head-ad',           require('./routes/headAd'));
app.use('/api/central',           require('./routes/centralSecretary'));
app.use('/api/hoc',               require('./routes/hoc'));
app.use('/api/sg',                require('./routes/sg'));
app.use('/api/dio-view',          require('./routes/dioView'));
app.use('/api/announcements',     require('./routes/announcements'));
app.use('/api/logbook',           require('./routes/logbook'));
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
  const status = err.status || 500;
  // 4xx and explicitly-exposed errors keep their message; 5xx are made generic in
  // production so internal schema/paths/driver strings never leak (CWE-209). Full
  // detail is always in the server log above.
  const expose = status < 500 || err.expose === true || process.env.NODE_ENV !== 'production';
  res.status(status).json({
    success: false,
    message: expose ? (err.message || 'Request failed') : 'Internal server error',
  });
});

// ── START SERVER ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log('✅ MongoDB connected');
      // Opt-in scheduled data snapshots (weekly/monthly/yearly CSV exports).
      // Off by default — PM2 fork runs a single instance and Railway may lack a
      // persistent disk. See jobs/snapshots.js + SNAPSHOTS_ENABLED in .env.example.
      if (process.env.SNAPSHOTS_ENABLED === 'true') {
        require('./jobs/snapshots').scheduleSnapshots();
      }
      app.listen(PORT, () => console.log(`✅ MTMS V2 Server running on port ${PORT}`));
    })
    .catch(err => {
      console.error('❌ MongoDB connection failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;
