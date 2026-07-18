require('dotenv').config();

// Relaxes the User email index after email became optional.
//
// Before: a unique index on { email: 1 } (email was required + unique).
// After:  email is optional, so the index must be unique + SPARSE, and a new
//         unique + sparse index on { idNumber: 1 } (the login identifier) is
//         added.
//
// Because the old { email: 1 } index has the SAME key but DIFFERENT options
// (sparse), Mongoose autoIndex cannot replace it in place — it would raise
// IndexOptionsConflict. This migration drops the stale index and rebuilds all
// current indexes from the schema via syncIndexes(), which recreates email_1
// sparse and creates idNumber_1.
//
// Safe to run repeatedly. Index-only; touches no documents. DRY_RUN=true (the
// default) only reports what it would do.

const mongoose = require('mongoose');
const User = require('../models/User');

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: dry run

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const coll = User.collection;

  const existing = await coll.indexes();
  const stale = existing.find(ix =>
    ix.name === 'email_1' &&
    ix.unique === true &&
    ix.sparse !== true
  );

  if (DRY_RUN) {
    console.log('[DRY_RUN] Set DRY_RUN=false to apply.');
    console.log(stale
      ? '[DRY_RUN] Would DROP stale index "email_1" then syncIndexes() (recreates email_1 sparse + adds idNumber_1).'
      : '[DRY_RUN] No stale non-sparse email_1 found; would syncIndexes() to add the sparse email_1 / idNumber_1 indexes.');
    await mongoose.disconnect();
    return;
  }

  if (stale) {
    await coll.dropIndex('email_1');
    console.log('Dropped stale index "email_1".');
  }

  const dropped = await User.syncIndexes();
  console.log('syncIndexes() complete. Removed extra indexes:', dropped);
  console.log('Current indexes:', (await coll.indexes()).map(ix => ix.name).join(', '));

  await mongoose.disconnect();
  console.log('User email index relaxation complete.');
}

main().catch(async err => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
