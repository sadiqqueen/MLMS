// backend/routes/countries.js
// Mounted at /api/countries in server.js.
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const Country        = require('../models/Country');
const Hospital       = require('../models/Hospital');
const User           = require('../models/User');

// Create is direct for the clerk and Developer; edit/delete are Developer
// (super_admin) only — there is no approval-gated country edit/delete flow.
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
    const countries = await Country.find(filter).sort({ order: 1, name: 1 });
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
      const officialNameAr = (req.body.officialNameAr || '').trim();
      const shortNameAr    = (req.body.shortNameAr || '').trim();
      const officialNameEn = (req.body.officialNameEn || '').trim();
      const shortNameEn    = (req.body.shortNameEn || '').trim();
      const code           = (req.body.code || '').trim().toUpperCase();
      const order          = Number(req.body.order);

      if (!officialNameAr || !shortNameAr || !officialNameEn || !shortNameEn) {
        return res.status(400).json({ message: 'All four name fields (official/short, Arabic/English) are required' });
      }
      if (!Number.isInteger(order) || order < 1) {
        return res.status(400).json({ message: 'Sequence (التسلسل) must be a positive whole number' });
      }

      const doc = {
        officialNameAr, shortNameAr, officialNameEn, shortNameEn,
        name: shortNameAr,          // back-compat display key mirrors the short Arabic name
        order,
        createdBy: req.user._id,
      };
      if (code) doc.code = code;    // omit entirely when blank so the sparse index skips it

      const country = await Country.create(doc);
      res.status(201).json({ success: true, data: country });
    } catch (err) {
      if (err.code === 11000) {
        const label = err.keyPattern && err.keyPattern.code ? 'code' : 'short Arabic name';
        return res.status(409).json({ message: `A country with this ${label} already exists` });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/countries/:id — super_admin (Developer) only; the clerk cannot edit
// countries. Accepts the source-sheet fields (order + the four names) and code;
// `name` is kept in sync with shortNameAr for back-compat display.
router.patch('/:id',
  auth,
  allowRoles(...EDIT_ROLES),
  auditLog('update_country', 'Country'),
  async (req, res) => {
    try {
      const fields = {};
      const unset  = {};

      for (const k of ['officialNameAr', 'shortNameAr', 'officialNameEn', 'shortNameEn']) {
        if (req.body[k] !== undefined) {
          const v = String(req.body[k]).trim();
          if (v === '') return res.status(400).json({ message: `${k} cannot be empty` });
          fields[k] = v;
        }
      }
      // The back-compat display key tracks the short Arabic name.
      if (fields.shortNameAr !== undefined) fields.name = fields.shortNameAr;

      if (req.body.order !== undefined) {
        const order = Number(req.body.order);
        if (!Number.isInteger(order) || order < 1) return res.status(400).json({ message: 'Sequence must be a positive whole number' });
        fields.order = order;
      }

      if (req.body.code !== undefined) {
        const code = String(req.body.code).trim().toUpperCase();
        if (code) fields.code = code;
        else unset.code = '';        // clearing the code removes the field (keeps the sparse index clean)
      }

      if (req.body.isActive !== undefined) fields.isActive = req.body.isActive;

      const update = {};
      if (Object.keys(fields).length) update.$set = fields;
      if (Object.keys(unset).length) update.$unset = unset;
      if (!Object.keys(update).length) return res.status(400).json({ message: 'No changes to apply' });

      const country = await Country.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
      if (!country) return res.status(404).json({ message: 'Country not found' });
      res.json({ success: true, data: country });
    } catch (err) {
      if (err.code === 11000) {
        const label = err.keyPattern && err.keyPattern.code ? 'code' : 'short Arabic name';
        return res.status(409).json({ message: `A country with this ${label} already exists` });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/countries/:id — super_admin (Developer) only.
//   default            → soft delete (reversible deactivation, isActive:false)
//   ?hard=true         → permanent delete, but only when no training center or
//                        user still references the country (guarded to never
//                        orphan Hospital.countryId / User.countryId).
router.delete('/:id',
  auth,
  allowRoles(...EDIT_ROLES),
  auditLog('deactivate_country', 'Country'),
  async (req, res) => {
    try {
      const hard = req.query.hard === 'true';

      if (hard) {
        // Referential-integrity guard — refuse to leave dangling references.
        const [centers, users] = await Promise.all([
          Hospital.countDocuments({ countryId: req.params.id }),
          User.countDocuments({ countryId: req.params.id }),
        ]);
        if (centers > 0 || users > 0) {
          const parts = [];
          if (centers > 0) parts.push(`${centers} training center${centers === 1 ? '' : 's'}`);
          if (users > 0) parts.push(`${users} user${users === 1 ? '' : 's'}`);
          return res.status(409).json({
            message: `Cannot permanently delete: this country is still linked to ${parts.join(' and ')}. Reassign or remove them first, or deactivate the country instead.`,
          });
        }
        res.locals.auditAction = 'delete_country';
        const country = await Country.findByIdAndDelete(req.params.id);
        if (!country) return res.status(404).json({ message: 'Country not found' });
        return res.json({ success: true, message: 'Country permanently deleted', data: country });
      }

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
