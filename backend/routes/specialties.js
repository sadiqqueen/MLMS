// backend/routes/specialties.js
// Mounted at /api/specialties in server.js.
const router         = require('express').Router();
const fs             = require('fs');
const multer         = require('multer');
const path           = require('path');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { trackFilter } = require('../utils/track');
const auditLog       = require('../middleware/auditLogger');
const Specialty      = require('../models/Specialty');

// Any authenticated user may list specialties (needed for dropdowns)
const READ_ROLES  = ['super_admin', 'secretary', 'dio', 'supervisor', 'trainee', 'president', 'program_director', 'data_analyzer'];
// Edit/delete + legacy PDF-template management stay with super_admin + dio.
const WRITE_ROLES = ['super_admin', 'dio'];
// Who may CREATE a specialty. The data analyzer manages the council taxonomy
// (add specialties + sub-specialties) but is NOT granted edit/delete.
const CREATE_ROLES = ['super_admin', 'dio', 'data_analyzer'];
const SPECIALTY_FIELDS = ['name', 'hospitalId', 'secretaryId', 'weeklyReportPdf',
  'monthlyReportPdf', 'finalReportPdf', 'evaluationPdf1', 'evaluationPdf2',
  'evaluationPdf3', 'evaluationPdf4', 'evaluationPdf5', 'isActive',
  // Global council-taxonomy fields (taxonomy roles only, enforced below).
  'nameEn', 'type', 'code', 'councilId'];
// Council-taxonomy fields — only super_admin + data_analyzer may set them
// (dio is limited to legacy per-hospital specialty fields).
const TAXONOMY_FIELDS = ['nameEn', 'type', 'code', 'councilId'];
const TAXONOMY_ROLES  = ['super_admin', 'data_analyzer'];

function pick(body, allowed) {
  const data = {};
  allowed.forEach(k => { if (body[k] !== undefined) data[k] = body[k]; });
  return data;
}

// A DIO may only modify specialties in its own training track; super_admin is
// unrestricted. Returns false (and sends 404) when the caller is blocked.
async function ensureSpecialtyInTrack(req, res, id) {
  if (req.user.role === 'super_admin') return true;
  const s = await Specialty.findById(id).select('track');
  if (!s || (s.track || 'advanced') !== req.track) {
    res.status(404).json({ message: 'Specialty not found' });
    return false;
  }
  return true;
}

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = path.extname(file.originalname).toLowerCase() === '.pdf'
            && file.mimetype === 'application/pdf';
    ok ? cb(null, true) : cb(new Error('Only PDF files are allowed'));
  }
});

async function uploadSpecialtyPdf(req, res, field) {
  try {
    if (!(await ensureSpecialtyInTrack(req, res, req.params.id))) return;
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const fileUrl = `/uploads/${req.file.filename}`;
    const specialty = await Specialty.findByIdAndUpdate(
      req.params.id,
      { [field]: fileUrl },
      { new: true, runValidators: true }
    )
      .populate('hospitalId', 'name city')
      .populate('secretaryId', 'name email');

    if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
    res.json({ success: true, data: specialty });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/specialties
router.get('/', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const { hospital, active } = req.query;
    const query = {};
    if (hospital) query.hospitalId = hospital;
    if (active === 'true')  query.isActive = true;
    if (active === 'false') query.isActive = false;
    // Track isolation: every caller except super_admin sees only their own
    // track's specialties (a b_dio/b_secretary must never see Advanced rows,
    // and vice-versa). This keeps specialty dropdowns track-correct so an
    // assignment can't 400 with "Specialty is in a different track".
    if (req.user.role !== 'super_admin') Object.assign(query, trackFilter(req.track));

    const specialties = await Specialty.find(query)
      .populate('hospitalId',  'name city')
      .populate('secretaryId', 'name email')
      .sort({ name: 1 });

    res.json({ success: true, data: specialties });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/specialties/:id
router.get('/:id', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const specialty = await Specialty.findById(req.params.id)
      .populate('hospitalId',  'name city')
      .populate('secretaryId', 'name email');
    if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
    res.json({ success: true, data: specialty });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/specialties — super_admin, dio, or data_analyzer.
// Only super_admin + data_analyzer may set the council-taxonomy fields.
router.post('/',
  auth,
  allowRoles(...CREATE_ROLES),
  auditLog('create_specialty', 'Specialty'),
  async (req, res) => {
    try {
      const data = pick(req.body, SPECIALTY_FIELDS);
      if (!TAXONOMY_ROLES.includes(req.user.role)) {
        TAXONOMY_FIELDS.forEach(k => delete data[k]);
      }
      data.track = req.track; // specialty belongs to the creator's training track
      const specialty = await Specialty.create(data);
      res.status(201).json({ success: true, data: specialty });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
      }
      if (err.code === 11000) {
        return res.status(400).json({ message: 'A specialty with this code already exists.' });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/specialties/:id — super_admin or dio only
router.patch('/:id',
  auth,
  allowRoles(...WRITE_ROLES),
  auditLog('update_specialty', 'Specialty'),
  async (req, res) => {
    try {
      if (!(await ensureSpecialtyInTrack(req, res, req.params.id))) return;
      const updateData = pick(req.body, SPECIALTY_FIELDS);
      if (!TAXONOMY_ROLES.includes(req.user.role)) {
        TAXONOMY_FIELDS.forEach(k => delete updateData[k]);
      }
      const specialty = await Specialty.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
        .populate('hospitalId',  'name city')
        .populate('secretaryId', 'name email')
        .populate('councilId', 'name nameEn');
      if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
      res.json({ success: true, data: specialty });
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
      }
      if (err.code === 11000) {
        return res.status(400).json({ message: 'A specialty with this code already exists.' });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// POST /api/specialties/:id/upload-weekly
router.post('/:id/upload-weekly', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'weeklyReportPdf');
});

// POST /api/specialties/:id/upload-monthly
router.post('/:id/upload-monthly', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'monthlyReportPdf');
});

// POST /api/specialties/:id/upload-final
router.post('/:id/upload-final', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'finalReportPdf');
});

// POST /api/specialties/:id/upload-eval1
router.post('/:id/upload-eval1', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'evaluationPdf1');
});

// POST /api/specialties/:id/upload-eval2
router.post('/:id/upload-eval2', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'evaluationPdf2');
});

// POST /api/specialties/:id/upload-eval3
router.post('/:id/upload-eval3', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'evaluationPdf3');
});

// POST /api/specialties/:id/upload-eval4
router.post('/:id/upload-eval4', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'evaluationPdf4');
});

// POST /api/specialties/:id/upload-eval5
router.post('/:id/upload-eval5', auth, allowRoles(...WRITE_ROLES), upload.single('file'), (req, res) => {
  uploadSpecialtyPdf(req, res, 'evaluationPdf5');
});

// DELETE /api/specialties/:id — soft delete (super_admin only)
router.delete('/:id',
  auth,
  allowRoles('super_admin'),
  auditLog('deactivate_specialty', 'Specialty'),
  async (req, res) => {
    try {
      const specialty = await Specialty.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      if (!specialty) return res.status(404).json({ message: 'Specialty not found' });
      res.json({ success: true, message: 'Specialty deactivated', data: specialty });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
