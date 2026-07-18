// backend/routes/programs.js
// Mounted at /api/programs in server.js.
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const auditLog       = require('../middleware/auditLogger');
const Program        = require('../models/Program');
const Hospital       = require('../models/Hospital');
const Specialty      = require('../models/Specialty');
const User           = require('../models/User');
const { accreditationExpiry, accreditationStatus } = require('../utils/accreditation');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const READ_ROLES = ['data_entry', 'data_analyzer', 'super_admin', 'central_secretary',
  'dio', 'dio_view', 'sub_dio', 'secretary_general', 'assistant_secretary',
  'program_director', 'sub_pd'];
const WRITE_ROLES = ['data_entry', 'super_admin'];

const MAX_PROGRAMS_PER_CENTER = 70;

// Inject computed accreditation fields (never stored) into a program object.
function withAccreditation(program) {
  const doc = typeof program.toObject === 'function' ? program.toObject() : program;
  return {
    ...doc,
    accreditationExpiry: accreditationExpiry(doc),
    accreditationStatus: accreditationStatus(doc)
  };
}

// GET /api/programs?centerId=&specialtyId=&countryId=
router.get('/', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const role = req.user.role;

    // Center-set scoping for DIO roles lands in Phase 4 — return nothing for now.
    if (role === 'dio' || role === 'dio_view' || role === 'sub_dio') {
      return res.json({ success: true, data: [] });
    }

    const filter = { isActive: { $ne: false } };
    if (role === 'program_director') {
      filter.programDirectorId = req.user._id;
    } else if (role === 'sub_pd') {
      if (!req.user.pdId) return res.json({ success: true, data: [] });
      filter.programDirectorId = req.user.pdId;
    }

    const { centerId, specialtyId, countryId } = req.query;
    if (centerId) filter.trainingCenterId = centerId;
    if (specialtyId) filter.specialtyId = specialtyId;
    if (countryId) {
      const centers = await Hospital.find({ countryId }).select('_id');
      const ids = centers.map(c => c._id);
      if (filter.trainingCenterId) {
        if (!ids.some(id => String(id) === String(filter.trainingCenterId))) {
          return res.json({ success: true, data: [] });
        }
      } else {
        filter.trainingCenterId = { $in: ids };
      }
    }

    const programs = await Program.find(filter)
      .populate('trainingCenterId', 'name accreditationNumber countryId')
      .populate('specialtyId', 'name')
      .populate('programDirectorId', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: programs.map(withAccreditation) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/programs/pd-candidates?specialtyId=&search=
router.get('/pd-candidates', auth, allowRoles(...WRITE_ROLES), async (req, res) => {
  try {
    const { specialtyId, search } = req.query;
    const query = { role: 'program_director', isActive: { $ne: false } };
    if (specialtyId) query.specialtyId = specialtyId;
    if (search) query.name = new RegExp(escapeRegex(String(search).slice(0, 100)), 'i');

    const pds = await User.find(query)
      .select('name idNumber specialtyId')
      .populate('specialtyId', 'name')
      .sort({ name: 1 });

    // Exclude PDs who already direct an active program.
    const taken = await Program.find({
      isActive: { $ne: false },
      programDirectorId: { $in: pds.map(p => p._id) }
    }).select('programDirectorId');
    const takenSet = new Set(taken.map(t => String(t.programDirectorId)));

    res.json({ success: true, data: pds.filter(p => !takenSet.has(String(p._id))) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Validate a proposed program director: must be an active program_director whose
// specialty matches the program, and not already directing another active
// program. Returns an error string, or null when valid.
async function validateProgramDirector(pdId, specialtyId, excludeProgramId) {
  const pd = await User.findById(pdId).select('role specialtyId isActive');
  if (!pd || pd.isActive === false) return 'Selected program director not found';
  if (pd.role !== 'program_director') return 'Selected user is not a program director';
  if (specialtyId && String(pd.specialtyId) !== String(specialtyId)) {
    return 'Program director does not match the program specialty';
  }
  const clashQuery = { isActive: { $ne: false }, programDirectorId: pdId };
  if (excludeProgramId) clashQuery._id = { $ne: excludeProgramId };
  const clash = await Program.findOne(clashQuery).select('_id');
  if (clash) return 'This program director already directs an active program';
  return null;
}

// POST /api/programs
router.post('/',
  auth,
  allowRoles(...WRITE_ROLES),
  auditLog('create_program', 'Program'),
  async (req, res) => {
    try {
      const {
        name, trainingCenterId, specialtyId, programDirectorId,
        accreditationType, accreditationGrantDate, accreditationNumber,
        accreditationWithdrawn, yearlyCapacity, trainingStartDate,
        renewalApplicationDate
      } = req.body;

      if (!name || !String(name).trim()) return res.status(400).json({ message: 'Program name is required' });
      if (!trainingCenterId) return res.status(400).json({ message: 'Training center is required' });
      if (!specialtyId) return res.status(400).json({ message: 'Specialty is required' });
      if (!accreditationType || !['partly', 'fully'].includes(accreditationType)) {
        return res.status(400).json({ message: 'Accreditation type must be partly or fully' });
      }
      if (!accreditationGrantDate) return res.status(400).json({ message: 'Accreditation grant date is required' });
      if (yearlyCapacity === undefined || yearlyCapacity === null || Number(yearlyCapacity) < 0) {
        return res.status(400).json({ message: 'Yearly capacity is required' });
      }
      if (!trainingStartDate) return res.status(400).json({ message: 'Training start date is required' });

      const center = await Hospital.findById(trainingCenterId).select('isActive');
      if (!center || center.isActive === false) return res.status(400).json({ message: 'Training center not found' });

      const specialty = await Specialty.findById(specialtyId).select('_id');
      if (!specialty) return res.status(400).json({ message: 'Specialty not found' });

      // Max 70 active programs per center.
      const count = await Program.countDocuments({ trainingCenterId, isActive: { $ne: false } });
      if (count >= MAX_PROGRAMS_PER_CENTER) {
        return res.status(409).json({ message: `This training center already has the maximum of ${MAX_PROGRAMS_PER_CENTER} programs`, count });
      }

      if (programDirectorId) {
        const pdError = await validateProgramDirector(programDirectorId, specialtyId, null);
        if (pdError) return res.status(409).json({ message: pdError });
      }

      const program = await Program.create({
        name: String(name).trim(),
        trainingCenterId,
        specialtyId,
        programDirectorId: programDirectorId || null,
        accreditationType,
        accreditationGrantDate,
        accreditationNumber: accreditationNumber || '',
        accreditationWithdrawn: accreditationWithdrawn === true,
        yearlyCapacity: Number(yearlyCapacity),
        trainingStartDate,
        renewalApplicationDate: renewalApplicationDate || null,
        createdBy: req.user._id
      });

      res.status(201).json({ success: true, data: withAccreditation(program) });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PATCH /api/programs/:id
router.patch('/:id',
  auth,
  allowRoles(...WRITE_ROLES),
  auditLog('update_program', 'Program'),
  async (req, res) => {
    try {
      const existing = await Program.findById(req.params.id);
      if (!existing || existing.isActive === false) return res.status(404).json({ message: 'Program not found' });

      const EDITABLE = ['name', 'trainingCenterId', 'specialtyId', 'programDirectorId',
        'accreditationType', 'accreditationGrantDate', 'accreditationNumber',
        'accreditationWithdrawn', 'yearlyCapacity', 'trainingStartDate',
        'renewalApplicationDate'];
      const fields = {};
      EDITABLE.forEach(k => { if (req.body[k] !== undefined) fields[k] = req.body[k]; });
      if (fields.name !== undefined) {
        fields.name = String(fields.name).trim();
        if (!fields.name) return res.status(400).json({ message: 'Program name cannot be empty' });
      }

      // Re-validate the PD whenever the PD (or the specialty behind it) changes.
      const nextPd = fields.programDirectorId !== undefined ? fields.programDirectorId : existing.programDirectorId;
      const nextSpecialty = fields.specialtyId !== undefined ? fields.specialtyId : existing.specialtyId;
      if (nextPd && (fields.programDirectorId !== undefined || fields.specialtyId !== undefined)) {
        const pdError = await validateProgramDirector(nextPd, nextSpecialty, req.params.id);
        if (pdError) return res.status(409).json({ message: pdError });
      }
      if (fields.programDirectorId === '' || fields.programDirectorId === null) {
        fields.programDirectorId = null;
      }

      const program = await Program.findByIdAndUpdate(req.params.id, fields, { new: true, runValidators: true })
        .populate('trainingCenterId', 'name accreditationNumber countryId')
        .populate('specialtyId', 'name')
        .populate('programDirectorId', 'name');
      if (!program) return res.status(404).json({ message: 'Program not found' });
      res.json({ success: true, data: withAccreditation(program) });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE /api/programs/:id — soft delete (isActive: false)
router.delete('/:id',
  auth,
  allowRoles(...WRITE_ROLES),
  auditLog('deactivate_program', 'Program'),
  async (req, res) => {
    try {
      const program = await Program.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );
      if (!program) return res.status(404).json({ message: 'Program not found' });
      res.json({ success: true, message: 'Program deactivated', data: program });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
