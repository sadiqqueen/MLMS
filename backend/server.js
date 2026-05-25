// backend/server.js
require('dotenv').config();

const express      = require('express');
const mongoose     = require('mongoose');
const cors         = require('cors');
const path         = require('path');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── SECURITY MIDDLEWARE ───────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(globalLimiter);

// Serve uploads as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/certificates',  require('./routes/certificates'));

// ── NEW V2 ROUTES ─────────────────────────────────────────────────────────
app.use('/api/specialties',       require('./routes/specialties'));
app.use('/api/supervisor',        require('./routes/supervisor'));
app.use('/api/program-director',  require('./routes/programDirector'));
app.use('/api/secretary',         require('./routes/secretary'));
app.use('/api/dio',               require('./routes/dio'));
app.use('/api/president',         require('./routes/president'));
app.use('/api/trainee',           require('./routes/trainee'));
app.use('/api/admin',             require('./routes/adminV2'));
app.use('/api/certificates/verify', require('./routes/certificateVerify'));

// ── START SERVER ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

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
