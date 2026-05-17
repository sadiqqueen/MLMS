const router         = require('express').Router();
const User           = require('../models/User');
const Hospital       = require('../models/Hospital');
const Distribution   = require('../models/Distribution');
const Evaluation     = require('../models/Evaluation');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

// GET /api/dashboard/stats
router.get('/stats', auth, allowRoles('admin', 'super_admin', 'professor'), async (req, res) => {
  try {
    // Basic counts
    const [totalHospitals, totalDoctors, totalDistributions, totalEvaluations, pendingEvaluations] =
      await Promise.all([
        Hospital.countDocuments(),
        User.countDocuments({ role: 'doctor' }),
        Distribution.countDocuments(),
        Evaluation.countDocuments(),
        Evaluation.countDocuments({ status: 'pending' })
      ]);

    // Distinct specialties across all distributions
    const specialtyList   = await Distribution.distinct('specialty');
    const totalSpecialties = specialtyList.length;

    // Doctors grouped by specialty (for donut chart)
    const doctorsBySpecialty = await User.aggregate([
      { $match: { role: 'doctor', specialty: { $exists: true, $ne: '' } } },
      { $group: { _id: '$specialty', count: { $sum: 1 } } },
      { $project: { specialty: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    // Number of distribution slots per hospital (for bar chart)
    const doctorsByHospital = await Distribution.aggregate([
      { $group: { _id: '$hospital', count: { $sum: 1 } } },
      {
        $lookup: {
          from:         'hospitals',
          localField:   '_id',
          foreignField: '_id',
          as:           'hospitalDoc'
        }
      },
      { $unwind: { path: '$hospitalDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          hospital: { $ifNull: ['$hospitalDoc.name', 'Unknown'] },
          count:    1,
          _id:      0
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Most recent 5 evaluations
    const recentEvaluations = await Evaluation.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('student',  'name')
      .populate('doctor',   'name')
      .populate('hospital', 'name');

    res.json({
      totalHospitals,
      totalDoctors,
      totalDistributions,
      totalEvaluations,
      totalSpecialties,
      pendingEvaluations,
      doctorsBySpecialty,
      doctorsByHospital,
      recentEvaluations
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
