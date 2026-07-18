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
const { trackFilter } = require('../utils/track');

const PRESIDENT = ['president', 'dio_view'];

const USER_SELECT = 'name email phone role hospitalId hospital specialtyId specialty department studentId year isActive initials photoUrl createdAt updatedAt';

function activeRoleQuery(role, tf = {}) {
  return {
    role: { $in: Array.isArray(role) ? role : [role] },
    isActive: { $ne: false },
    ...tf
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

async function listUsers(role, tf = {}) {
  const users = await populateUser(User.find(activeRoleQuery(role, tf)));
  return users.map(serializeUser);
}

async function supervisorCountByHospital(tf = {}) {
  const rows = await User.aggregate([
    { $match: { role: 'supervisor', isActive: { $ne: false }, ...tf } },
    { $group: { _id: { $ifNull: ['$hospitalId', '$hospital'] }, count: { $sum: 1 } } }
  ]);
  return new Map(rows.filter(r => r._id).map(r => [r._id.toString(), r.count]));
}

async function traineeCountByHospital(tf = {}) {
  const rows = await User.aggregate([
    { $match: { role: 'trainee', isActive: { $ne: false }, ...tf } },
    { $group: { _id: { $ifNull: ['$hospitalId', '$hospital'] }, count: { $sum: 1 } } }
  ]);
  return new Map(rows.filter(r => r._id).map(r => [r._id.toString(), r.count]));
}

async function listHospitals(tf = {}) {
  const [hospitals, supervisorCounts, traineeCounts] = await Promise.all([
    Hospital.find({ isActive: { $ne: false }, ...tf })
      .select('name city governorate address phone email specialties isActive programDirector supervisors capacity createdAt updatedAt')
      .populate('programDirector', 'name email phone role')
      .populate('supervisors', 'name email phone role specialty specialtyId')
      .sort({ name: 1 }),
    supervisorCountByHospital(tf),
    traineeCountByHospital(tf)
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
    res.json({ success: true, data: await listUsers('trainee', trackFilter(req.track)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/supervisors', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('supervisor', trackFilter(req.track)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/program-directors', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('program_director', trackFilter(req.track)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/dios', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('dio', trackFilter(req.track)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/secretaries', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listUsers('secretary', trackFilter(req.track)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hospitals', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    res.json({ success: true, data: await listHospitals(trackFilter(req.track)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/stats', auth, allowRoles(...PRESIDENT), async (req, res) => {
  try {
    const tf = trackFilter(req.track);
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
      User.countDocuments(activeRoleQuery('trainee', tf)),
      User.countDocuments(activeRoleQuery('supervisor', tf)),
      User.countDocuments(activeRoleQuery('program_director', tf)),
      User.countDocuments(activeRoleQuery('dio', tf)),
      User.countDocuments(activeRoleQuery('secretary', tf)),
      Hospital.countDocuments({ isActive: { $ne: false }, ...tf }),
      Distribution.countDocuments({ status: 'active', ...tf }),
      Rotation.countDocuments({ status: 'current', ...tf }),
      Report.countDocuments({ ...tf }),
      Evaluation.countDocuments({ ...tf }),
      Certificate.countDocuments({ revokedAt: null, ...tf })
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
