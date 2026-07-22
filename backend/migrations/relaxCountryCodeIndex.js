require('dotenv').config();

// Relaxes the Country code index after `code` became optional.
//
// Before: a unique index on { code: 1 } (code was required + unique).
// After:  the source sheet has no code column, so `code` is optional and its
//         index must be unique + SPARSE — otherwise a SECOND code-less country
//         (missing field indexes as null) collides on E11000.
//
// Because the old { code: 1 } index has the SAME key but DIFFERENT options
// (sparse), Mongoose autoIndex cannot replace it in place — it would raise
// IndexOptionsConflict. This migration drops the stale index and rebuilds all
// current indexes from the schema via syncIndexes(), which recreates code_1
// sparse.
//
// Safe to run repeatedly. Index-only; touches no documents. DRY_RUN=true (the
// default) only reports what it would do; set DRY_RUN=false to apply.

const mongoose = require('mongoose');
const Country = require('../models/Country');

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: dry run

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const coll = Country.collection;

  const existing = await coll.indexes();
  const stale = existing.find(ix =>
    ix.name === 'code_1' &&
    ix.unique === true &&
    ix.sparse !== true
  );

  if (DRY_RUN) {
    console.log('[DRY_RUN] Set DRY_RUN=false to apply.');
    console.log(stale
      ? '[DRY_RUN] Would DROP stale index "code_1" then syncIndexes() (recreates code_1 unique+sparse).'
      : '[DRY_RUN] No stale non-sparse code_1 found; would syncIndexes() to reconcile indexes.');
    await mongoose.disconnect();
    return;
  }

  if (stale) {
    await coll.dropIndex('code_1');
    console.log('Dropped stale index "code_1".');
  }

  const dropped = await Country.syncIndexes();
  console.log('syncIndexes() complete. Removed extra indexes:', dropped);
  console.log('Current indexes:', (await coll.indexes()).map(ix => ix.name).join(', '));

  await mongoose.disconnect();
  console.log('Country code index relaxation complete.');
}

main().catch(async err => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
