// backend/utils/assignedTrainees.js
// The set of trainee ids assigned to a supervisor — via a direct User.supervisorId
// link, or a legacy Distribution / current-or-upcoming Rotation pairing. Extracted
// verbatim from routes/supervisor.js so trainer-scoped reads (e.g. the log book
// review queue) share one definition. Returns an array of id strings.
const User         = require('../models/User');
const Distribution = require('../models/Distribution');
const Rotation     = require('../models/Rotation');

async function getAssignedTraineeIds(supervisorId) {
  const directTrainees = await User.find({
    supervisorId,
    role: 'trainee',
    isActive: { $ne: false }
  }).select('_id');

  const distributions = await Distribution.find({
    $or: [
      { supervisorId, traineeId: { $ne: null } },
      { doctor: supervisorId, student: { $ne: null } }
    ]
  }).select('traineeId student');

  const rotations = await Rotation.find({
    $or: [
      { supervisorId },
      { doctor: supervisorId }
    ],
    status: { $in: ['current', 'upcoming'] }
  }).select('traineeId student');

  return [...new Set([
    ...directTrainees.map(t => t._id),
    ...distributions.map(d => d.traineeId).filter(Boolean),
    ...distributions.map(d => d.student).filter(Boolean),
    ...rotations.map(r => r.traineeId).filter(Boolean),
    ...rotations.map(r => r.student).filter(Boolean)
  ].map(id => id.toString()))];
}

module.exports = { getAssignedTraineeIds };
