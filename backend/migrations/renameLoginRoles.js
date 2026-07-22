require('dotenv').config();

// Renames the login-role identifiers on existing User documents to match the
// code rename (super_admin→developer, dio→odio, dio_view→dio, supervisor→trainer,
// and the Basic mirrors b_dio→b_odio, b_supervisor→b_trainer).
//
//   • president / b_president accounts are LEFT AS-IS (kept as RETIRED enum
//     values; auth.js denies them a login). They are NOT touched here.
//   • The dio→odio and dio_view→dio pair is a COLLISION, so a single updateMany
//     with an aggregation-pipeline $switch maps every document against its
//     ORIGINAL role in one atomic pass — never sequential updateManys.
//   • A marker doc in the `migrations` collection blocks a re-run (a second pass
//     would remap the new `dio` users to `odio` — unrecoverable from data alone).
//
// Run order on the server (see the deploy notes):
//   node backend/migrations/renameLoginRoles.js                  # dry run (default)
//   DRY_RUN=false node backend/migrations/renameLoginRoles.js    # apply
//   DRY_RUN=false MIGRATE_AUDIT_FIELDS=1 node ...                # also fix historical audit-role labels
//   (production) add ALLOW_PROD=1
//
// TAKE A `mongodump` OF users (and evaluations/reports if MIGRATE_AUDIT_FIELDS=1)
// BEFORE APPLYING — a reversed/re-run collision cannot be undone from data alone.

const mongoose = require('mongoose');
const User = require('../models/User');
const Evaluation = require('../models/Evaluation');
const Report = require('../models/Report');

const DRY_RUN = process.env.DRY_RUN !== 'false';          // default: dry run
const MIGRATE_AUDIT_FIELDS = process.env.MIGRATE_AUDIT_FIELDS === '1';
const MARKER_ID = 'rename-login-roles-v1';

// old identifier -> new identifier. Order is irrelevant for the $switch (it maps
// against each document's original value), but this is the authoritative map.
const ROLE_MAP = {
  super_admin:   'developer',
  dio:           'odio',
  b_dio:         'b_odio',
  dio_view:      'dio',
  supervisor:    'trainer',
  b_supervisor:  'b_trainer',
};
const OLD_ROLES = Object.keys(ROLE_MAP);
const NEW_ROLES = Object.values(ROLE_MAP);

// Build a $switch expression on `field` using ROLE_MAP; unmatched values pass
// through unchanged (default: '$field').
function switchExpr(field) {
  return {
    $switch: {
      branches: OLD_ROLES.map(old => ({ case: { $eq: [`$${field}`, old] }, then: ROLE_MAP[old] })),
      default: `$${field}`,
    },
  };
}

async function countByRole(Model, field, values) {
  const rows = await Model.aggregate([
    { $match: { [field]: { $in: values } } },
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(rows.map(r => [r._id, r.n]));
  return values.map(v => `    ${String(v).padEnd(16)} ${map[v] || 0}`).join('\n');
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD !== '1') {
    console.error('Refusing to run against production without ALLOW_PROD=1');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const markers = mongoose.connection.db.collection('migrations');

  const already = await markers.findOne({ _id: MARKER_ID });
  if (already) {
    console.error(`STOP: marker "${MARKER_ID}" already present (applied ${already.appliedAt}).`);
    console.error('The role rename has already run. Re-running would remap the new roles — refusing.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'APPLY (will write)'}`);
  console.log('\nUser.role — BEFORE (old identifiers):');
  console.log(await countByRole(User, 'role', OLD_ROLES));
  console.log('User.role — current holders of the NEW identifiers (should be 0 on a first run):');
  console.log(await countByRole(User, 'role', NEW_ROLES));

  if (DRY_RUN) {
    console.log('\nWould remap User.role:', JSON.stringify(ROLE_MAP));
    if (MIGRATE_AUDIT_FIELDS) console.log('Would also remap audit-role labels on Evaluation/Report.');
    console.log('\nDry run only. Re-run with DRY_RUN=false to apply.');
    await mongoose.disconnect();
    return;
  }

  // ── Phase 1: User.role (the auth-critical field) ────────────────────────────
  const res = await User.updateMany(
    { role: { $in: OLD_ROLES } },
    [{ $set: { role: switchExpr('role') } }],
  );
  console.log(`\nUser.role remapped: matched ${res.matchedCount}, modified ${res.modifiedCount}`);

  // ── Phase 2 (opt-in): historical audit-role display labels ──────────────────
  // evaluatorRole/createdByRole (Evaluation) and gradedByRole + gradeHistory[]
  // .changedByRole (Report) are free-string snapshots of who acted. Without this,
  // a historical 'dio' (meaning ODIO) would render as "DIO" after the rename.
  if (MIGRATE_AUDIT_FIELDS) {
    const ev1 = await Evaluation.updateMany(
      { evaluatorRole: { $in: OLD_ROLES } },
      [{ $set: { evaluatorRole: switchExpr('evaluatorRole') } }],
    );
    const ev2 = await Evaluation.updateMany(
      { createdByRole: { $in: OLD_ROLES } },
      [{ $set: { createdByRole: switchExpr('createdByRole') } }],
    );
    const rp1 = await Report.updateMany(
      { gradedByRole: { $in: OLD_ROLES } },
      [{ $set: { gradedByRole: switchExpr('gradedByRole') } }],
    );
    // gradeHistory is an array of { ..., changedByRole } — remap each element.
    const rp2 = await Report.updateMany(
      { 'gradeHistory.changedByRole': { $in: OLD_ROLES } },
      [{ $set: { gradeHistory: { $map: {
        input: '$gradeHistory', as: 'h',
        in: { $mergeObjects: ['$$h', { changedByRole: {
          $switch: {
            branches: OLD_ROLES.map(old => ({ case: { $eq: ['$$h.changedByRole', old] }, then: ROLE_MAP[old] })),
            default: '$$h.changedByRole',
          },
        } }] },
      } } } }],
    );
    console.log(`Audit fields — Evaluation.evaluatorRole:${ev1.modifiedCount} createdByRole:${ev2.modifiedCount}` +
      ` Report.gradedByRole:${rp1.modifiedCount} gradeHistory:${rp2.modifiedCount}`);
  }

  await markers.insertOne({ _id: MARKER_ID, appliedAt: new Date(), map: ROLE_MAP, auditFields: MIGRATE_AUDIT_FIELDS });

  console.log('\nUser.role — AFTER (new identifiers):');
  console.log(await countByRole(User, 'role', NEW_ROLES));
  console.log('\nLogin-role rename complete.');
  await mongoose.disconnect();
}

main().catch(async err => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
