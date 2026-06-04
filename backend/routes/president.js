// backend/routes/president.js
const router         = require('express').Router();
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Distribution   = require('../models/Distribution');
const Rotation       = require('../models/Rotation');
const Report         = require('../models/Report');
const Evaluation     = require('../models/Evaluation');
const Certificate    = require('../models/Certificate');

const PRESIDENT = ['president'];

const USER_SELECT = 'name email phone role hospitalId hospital specialtyId specialty department studentId year isActive initials photoUrl createdAt updatedAt';

function activeRoleQuery(role) {
  return {
    role: { $in: Array.isArray(role) ? role : [role] },
    isActive: { $ne: false }
  };
}

function populateUser(query) {
  return query
    .select(USER_SELECT)
    .populate('hospitalId', 'name city governorate isActive')
    .populate('hospital', 'name city governorate isActive')
    .populate('specialtyId', 'name isActive')
    .populate('supervisorId', 'name email phone role')
    .sort({ name: 1 });
}

function serializeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    hospital: user.hospitalId || user.hospital || null,
    specialty: user.specialtyId || user.specialty || null,
    supervisor: user.supervisorId || null,
    studentId: user.studentId || '',
    year: user.year || null,
    department: user.department || '',
    initials: user.initials || '',
    photoUrl: user.photoUrl || '',
    isActive: user.isActive !== false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function listUsers(role) {
  const users = await populateUser(User.find(activeRoleQuery(role)));
  return users.map(serializeUser);
}

async function supervisorCountByHospital() {
  const rows = await User.aggregate([
    { $match: { role: 'supervisor', isActive: { $ne: false } } },
    { $group: { _id: { $ifNull: ['$hospitalId', '$hospital'] }, count: { $sum: 1 } } }
  ]);
  return new Map(rows.filter(r => r._id).map(r => [r._id.toString(), r.count]));
}

async function traineeCountByHospital() {
  const rows = await User.aggregate([
    { $match: { role: 'trainee', isActive: { $ne: false } } },
    { $group: { _id: { $ifNull: ['$hospitalId', '$hospital'] }, count: { $sum: 1 } } }
  ]);
  return new Map(rows.filter(r => r._id).map(r => [r._id.toString(), r.count]));
}

async function listHospitals() {
  const [hospitals, supervisorCounts, traineeCounts] = await Promise.all([
    Hospital.find({ isActive: { $ne: false } })
      .select('name city governorate address phone email specialties isActive programDirector supervisors capacity createdAt updatedAt')
      .populate('programDirector', 'name email phone role')
      .populate('supervisors', 'name email phone role specialty specialtyId')
      .sort({ name: 1 }),
    supervisorCountByHospital(),
    traineeCountByHospital()
  ]);

  return hospitals.map(h => ({
    _id: h._id,
    name: h.name,
    city: h.city || '',
    location: h.governorate || h.city || '',
    governorate: h.governorate || '',
    address: h.address || '',
    phone: h.phone || '',
    email: h.email || '',
    specialties: h.specialties || [],
    programDirector: h.programDirector || null,
    supervisors: h.supervisors || [],
    supervisorsCount: supervisorCounts.get(h._id.toString()) || 0,
    traineesCount: traineeCounts.get(h._id.toString()) || 0,
    capacity: h.capacity || null,
    isActive: h.isActive !== false,
    createdAt: h.createdAt,
    updatedAt: h.updatedAt
  }));
}

// President is full-system read-only oversight.
router.get('/trainees', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('trainee') });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/supervisors', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('supervisor') });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/program-directors', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('program_director') });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/dios', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('dio') });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/secretaries', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('secretary') });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hospitals', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listHospitals() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/stats', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    const [
      trainees,
      supervisors,
      programDirectors,
      dios,
      secretaries,
      hospitals,
      activeDistributions,
      currentRotations,
      reports,
      evaluations,
      certificates
    ] = await Promise.all([
      User.countDocuments(activeRoleQuery('trainee')),
      User.countDocuments(activeRoleQuery('supervisor')),
      User.countDocuments(activeRoleQuery('program_director')),
      User.countDocuments(activeRoleQuery('dio')),
      User.countDocuments(activeRoleQuery('secretary')),
      Hospital.countDocuments({ isActive: { $ne: false } }),
      Distribution.countDocuments({ status: 'active' }),
      Rotation.countDocuments({ status: 'current' }),
      Report.countDocuments(),
      Evaluation.countDocuments(),
      Certificate.countDocuments({ revokedAt: null })
    ]);

    res.json({
      success: true,
      data: {
        trainees,
        supervisors,
        programDirectors,
        dios,
        secretaries,
        hospitals,
        activeDistributions,
        currentRotations,
        reports,
        evaluations,
        validCertificates: certificates
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
