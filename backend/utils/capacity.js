// Shared helpers for per-hospital-per-specialty trainee capacity.
//
// Capacity is stored on Hospital.specialtySettings (set by the DIO). "Usage" is
// always computed for the CURRENT calendar year, so the count resets implicitly
// each January with no cron job. A trainee counts toward the year of its
// `enrolledSince` date, falling back to `createdAt` when unset.
const User          = require('../models/User');
const ChangeRequest = require('../models/ChangeRequest');
const { coerceRoleToTrack, trackFilter } = require('./track');

function sameId(a, b) {
  if (!a || !b) return false;
  return (a._id || a).toString() === (b._id || b).toString();
}

function currentYearRange() {
  const yr = new Date().getFullYear();
  return { yr, start: new Date(yr, 0, 1), end: new Date(yr + 1, 0, 1) };
}

function inYear(date, yr) {
  if (!date) return false;
  const d = new Date(date);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === yr;
}

// Extra slots allowed above capacity, via DIO-approved exceptions.
// capacity 5 → 1, 10 → 2, 15 → 3 … always at least 1 when a capacity is set.
function maxExtraFor(capacity) {
  if (capacity === null || capacity === undefined) return 0;
  return Math.max(1, Math.floor(Number(capacity) / 5));
}

// The DIO setting entry for one specialty at one hospital (or null).
function settingFor(hospital, specialtyId) {
  return (hospital?.specialtySettings || []).find(s => sameId(s.specialtyId, specialtyId)) || null;
}

// Current-year usage for a (hospital, specialty, track):
//   used           — active trainees enrolled this year at this hospital+specialty
//   exceptionsUsed — pending + approved capacity requests this year (the ceiling
//                    counter, so already-created exception trainees are not
//                    double-counted against the cap for future requests)
async function computeCapacityUsage({ hospitalId, specialtyId, track }) {
  const { yr, start, end } = currentYearRange();

  const trainees = await User.find({
    role: coerceRoleToTrack('trainee', track),
    specialtyId,
    $or: [{ hospitalId }, { hospital: hospitalId }],
    isActive: { $ne: false },
  }).select('enrolledSince createdAt');
  const used = trainees.filter(t => inYear(t.enrolledSince || t.createdAt, yr)).length;

  const exceptionsUsed = await ChangeRequest.countDocuments({
    requestType: 'capacity_exception',
    status: { $in: ['pending', 'approved'] },
    hospitalId,
    specialtyId,
    ...trackFilter(track),
    createdAt: { $gte: start, $lt: end },
  });

  return { used, exceptionsUsed };
}

module.exports = { sameId, settingFor, maxExtraFor, computeCapacityUsage, currentYearRange, inYear };
