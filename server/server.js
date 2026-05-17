// dotenv reads the .env file and makes those values available as process.env.SOMETHING
require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

// Create the Express application
const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────
// These run on EVERY request before it reaches any route.

// CORS = Cross-Origin Resource Sharing.
// By default, browsers block requests from one origin (localhost:5173)
// to a different origin (https://mlms-production.up.railway.app). This tells the server to allow it.
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://mlmsksb-24yydioq-sadiqqueens-projects.vercel.app',
    'https://mlmsksb-git-main-sadiqqueens-projects.vercel.app',
  ],
  credentials: true,
}));

// Parse incoming JSON request bodies so req.body works
app.use(express.json());

// Parse URL-encoded form data (used by some form submissions)
app.use(express.urlencoded({ extended: true }));

// Serve the uploads folder as static files.
// If a report has fileUrl = "/uploads/abc123.pdf", the browser can access it
// directly at http://https://mlms-production.up.railway.app/uploads/abc123.pdf
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the landing page (index.html) from the project root.
// When the user visits http://https://mlms-production.up.railway.app, Express finds index.html there.
app.use(express.static(path.join(__dirname, '..')));

// ── ROUTES ────────────────────────────────────────────────────────────────
// Connect each router to a URL prefix.
// Any route inside routes/auth.js will be available at /api/auth/...
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/hospitals',     require('./routes/hospitals'));
app.use('/api/universities',  require('./routes/universities'));
app.use('/api/distributions', require('./routes/distributions'));
app.use('/api/evaluations',   require('./routes/evaluations'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/rotations',     require('./routes/rotations'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/certificates',   require('./routes/certificates'));

// A simple health-check route — useful to test that the server is up
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── START SERVER ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// First connect to MongoDB, THEN start listening for requests.
// If the database connection fails, there's no point starting the server.
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);   // exit the Node process with error code 1
  });
