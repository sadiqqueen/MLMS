// backend/utils/bookOfChanges.js
// Shared multer instance for the required "book of changes" PDF that accompanies
// every clerk/CS edit/delete ChangeRequest (RULINGS §E24). Strict PDF-only, 10MB,
// dedicated subdir. Callers run `bocUpload.single('bookOfChanges')` INSIDE their
// handler so filter/size failures surface as 400 (never 500).
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const bocDir = path.join(__dirname, '../uploads/book-of-changes');
if (!fs.existsSync(bocDir)) fs.mkdirSync(bocDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, bocDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const bocUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = path.extname(file.originalname).toLowerCase() === '.pdf'
      && file.mimetype === 'application/pdf';
    ok ? cb(null, true) : cb(new Error('Only PDF files are allowed'));
  },
});

module.exports = { bocUpload, BOC_DIR: bocDir, BOC_URL_PREFIX: '/uploads/book-of-changes/' };
