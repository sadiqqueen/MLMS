// backend/routes/countries.js
// Mounted at /api/countries in server.js.
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const Country        = require('../models/Country');

// Create is direct for the clerk; edit/delete are approval-gated via
// routes/registry.js (RULINGS §E22), so direct PATCH/DELETE is super_admin-only.
const WRITE_ROLES = ['data_entry', 'super_admin'];
const EDIT_ROLES  = ['super_admin'];

// GET /api/countries — any authenticated user (dropdown source): active only.
// super_admin may pass ?includeInactive=true to also see deactivated rows (for
// the Developer Countries page); the param is ignored for every other role, so
// dropdown consumers always get active-only.
router.get('/', auth, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true' && req.user.role === 'super_admin';
    const filter = includeInactive ? {} : { isActive: { $ne: false } };
    const countries = await Country.find(filter).sort({ name: 1 });
    res.json({ success: true, data: countries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/countries
router.post('/',
  auth,
  allowRoles(...WRITE_ROLES),
  auditLog('create_country', 'Country'),
  async (req, res) => {
    try {
      const name = (req.body.name || '').trim();
      const code = (req.body.code || '').trim().toUpperCase();
      if (!name || !code) return res.status(400).json({ message: 'Name and code are required' });

      const country = await Country.create({ name, code, createdBy: req.user._id });
      res.status(201).json({ success: true, data: country });
    } catch (err) {
      if (err.code === 11000) {
        const field = err.keyPattern && err.keyPattern.code ? 'code' : 'name';
        return res.status(409).json({ message: `A country with this ${field} already exists` });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/countries/:id — direct edit is super_admin only (clerk edits go
// through POST-style approval at /api/registry/countries/:id, RULINGS §E22).
router.patch('/:id',
  auth,
  allowRoles(...EDIT_ROLES),
  auditLog('update_country', 'Country'),
  async (req, res) => {
    try {
      const fields = {};
      if (req.body.name !== undefined) fields.name = String(req.body.name).trim();
      if (req.body.code !== undefined) fields.code = String(req.body.code).trim().toUpperCase();
      if (req.body.isActive !== undefined) fields.isActive = req.body.isActive;
      if (fields.name === '') return res.status(400).json({ message: 'Name cannot be empty' });
      if (fields.code === '') return res.status(400).json({ message: 'Code cannot be empty' });

      const country = await Country.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true });
      if (!country) return res.status(404).json({ message: 'Country not found' });
      res.json({ success: true, data: country });
    } catch (err) {
      if (err.code === 11000) {
        const field = err.keyPattern && err.keyPattern.code ? 'code' : 'name';
        return res.status(409).json({ message: `A country with this ${field} already exists` });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/countries/:id — soft delete; super_admin only (clerk deletes go
// through approval at /api/registry/countries/:id, RULINGS §E22).
router.delete('/:id',
  auth,
  allowRoles(...EDIT_ROLES),
  auditLog('deactivate_country', 'Country'),
  async (req, res) => {
    try {
      const country = await Country.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      if (!country) return res.status(404).json({ message: 'Country not found' });
      res.json({ success: true, message: 'Country deactivated', data: country });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
