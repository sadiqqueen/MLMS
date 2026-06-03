require('dotenv').config();

const mongoose = require('mongoose');
const Distribution = require('../models/Distribution');
const Rotation = require('../models/Rotation');
const AuditLog = require('../models/AuditLog');

const DRY_RUN = process.env.DRY_RUN !== 'false';

function normalizeId(id) {
  return id?._id || id || null;
}

function inferStatus(startDate, endDate) {
  if (!startDate || !endDate) return 'current';
  const today = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < today) return 'completed';
  if (start > today) return 'upcoming';
  return 'current';
}

async function writeAudit(action, targetId, metadata) {
  if (DRY_RUN) return;
  await AuditLog.create({
    action,
    targetId,
    targetModel: 'Migration',
    metadata,
    ip: 'migration'
  }).catch(err => console.error('[AuditLog] Migration audit failed:', err.message));
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected. DRY_RUN=${DRY_RUN}`);

  const summary = {
    oldTraineeDistributions: 0,
    rotationsExisting: 0,
    rotationsToCreate: 0,
    distributionsToInactivate: 0,
    duplicateCurrentTrainees: 0
  };

  const oldDistributions = await Distribution.find({
    $or: [
      { traineeId: { $ne: null } },
      { student: { $ne: null } }
    ]
  });
  summary.oldTraineeDistributions = oldDistributions.length;

  for (const dist of oldDistributions) {
    const traineeId = normalizeId(dist.traineeId) || normalizeId(dist.student);
    const hospitalId = normalizeId(dist.hospitalId) || normalizeId(dist.hospital);
    if (!traineeId || !hospitalId) {
      console.log(`SKIP distribution ${dist._id}: missing trainee or hospital`);
      continue;
    }

    const existing = await Rotation.findOne({
      $and: [
        { $or: [{ traineeId }, { student: traineeId }] },
        { $or: [{ hospitalId }, { hospital: hospitalId }] },
        { startDate: dist.startDate || null },
        { endDate: dist.endDate || null }
      ]
    });

    if (existing) {
      summary.rotationsExisting += 1;
      console.log(`OK distribution ${dist._id}: rotation already exists ${existing._id}`);
    } else {
      summary.rotationsToCreate += 1;
      console.log(`CREATE rotation for distribution ${dist._id}: trainee=${traineeId} hospital=${hospitalId}`);
      if (!DRY_RUN) {
        await Rotation.create({
          traineeId,
          student: traineeId,
          hospitalId,
          hospital: hospitalId,
          supervisorId: normalizeId(dist.supervisorId) || normalizeId(dist.doctor),
          doctor: normalizeId(dist.supervisorId) || normalizeId(dist.doctor),
          specialtyId: normalizeId(dist.specialtyId),
          startDate: dist.startDate || new Date(),
          endDate: dist.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: inferStatus(dist.startDate, dist.endDate)
        });
      }
    }

    if (dist.status !== 'inactive') {
      summary.distributionsToInactivate += 1;
      console.log(`INACTIVATE legacy trainee distribution ${dist._id}`);
      if (!DRY_RUN) {
        dist.status = 'inactive';
        await dist.save();
      }
    }
  }

  const duplicateCurrent = await Rotation.aggregate([
    { $match: { status: 'current' } },
    { $group: { _id: { $ifNull: ['$traineeId', '$student'] }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { _id: { $ne: null }, count: { $gt: 1 } } }
  ]);
  summary.duplicateCurrentTrainees = duplicateCurrent.length;
  duplicateCurrent.forEach(row => {
    console.log(`WARNING trainee ${row._id} has ${row.count} current rotations: ${row.ids.join(', ')}`);
  });

  await writeAudit('refactor_distribution_rotation_meaning', null, summary);
  console.log('Summary:', summary);
  await mongoose.disconnect();
}

main().catch(async err => {
  console.error('Migration failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
