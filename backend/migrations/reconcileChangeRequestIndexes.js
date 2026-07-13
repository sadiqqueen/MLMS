require('dotenv').config();

// Reconciles the ChangeRequest indexes after the capacity-exception feature.
//
// Before: a single partial-unique index on { targetId: 1 } with
//         partialFilterExpression { status: 'pending' }.
// After:  that index is scoped to edits (adds requestType: 'edit') and a second
//         partial-unique index is added for capacity requests.
//
// Because the old index has the SAME key ({ targetId: 1 }) but DIFFERENT options,
// Mongoose autoIndex cannot replace it in place — it would raise
// IndexOptionsConflict. This migration drops the stale index and rebuilds all
// current indexes from the schema via syncIndexes().
//
// Safe to run repeatedly. Index-only; touches no documents. DRY_RUN=true (the
// default) only reports what it would do.

const mongoose = require('mongoose');
const ChangeRequest = require('../models/ChangeRequest');

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: dry run

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const coll = ChangeRequest.collection;

  const existing = await coll.indexes();
  const stale = existing.find(ix =>
    ix.name === 'targetId_1' &&
    ix.partialFilterExpression &&
    ix.partialFilterExpression.status === 'pending' &&
    ix.partialFilterExpression.requestType === undefined
  );

  if (DRY_RUN) {
    console.log('[DRY_RUN] Set DRY_RUN=false to apply.');
    console.log(stale
      ? '[DRY_RUN] Would DROP stale index "targetId_1" then syncIndexes().'
      : '[DRY_RUN] No stale index found; would syncIndexes() to add the capacity index.');
    await mongoose.disconnect();
    return;
  }

  if (stale) {
    await coll.dropIndex('targetId_1');
    console.log('Dropped stale index "targetId_1".');
  }

  const dropped = await ChangeRequest.syncIndexes();
  console.log('syncIndexes() complete. Removed extra indexes:', dropped);
  console.log('Current indexes:', (await coll.indexes()).map(ix => ix.name).join(', '));

  await mongoose.disconnect();
  console.log('ChangeRequest index reconciliation complete.');
}

main().catch(async err => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
