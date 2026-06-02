/**
 * backend/migrations/fixDataRealism.js
 *
 * Data-realism fixes for MLMS/MTMS V2.
 *
 * Usage:
 *   DRY_RUN=true  node backend/migrations/fixDataRealism.js   (default — preview only)
 *   DRY_RUN=false node backend/migrations/fixDataRealism.js   (apply changes)
 *
 * Fixes applied:
 *   FIX-1  Future distributions (startDate > today) marked 'active' → 'upcoming'
 *   FIX-2  Program Directors without a specialtyId get one assigned by email
 *   FIX-3  Dummy / test trainee accounts are soft-deactivated (isActive → false)
 *
 * Safety rules:
 *   - Never hard-deletes any document.
 *   - Logs every intended change before applying it.
 *   - DRY_RUN=true (the default) makes zero writes.
 *   - Prints a summary report at the end.
 */

'use strict';

require('dotenv').config();

const mongoose   = require('mongoose');
const User         = require('../models/User');
const Specialty    = require('../models/Specialty');
const Distribution = require('../models/Distribution');

// ─── Configuration ───────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN !== 'false';   // true unless explicitly set to 'false'

// FIX-2 — which specialty (by name) each PD email should receive.
// Edit this map if the assignments ever change.
const PD_SPECIALTY_MAP = {
  'pd.baghdad@mtms.com': 'Internal Medicine',
  'pd.yarmouk@mtms.com': 'Obstetrics & Gynecology',
  'pd.kindi@mtms.com':   'Emergency Medicine',
};

// FIX-3 — patterns that identify dummy / test trainee accounts.
const DUMMY_TRAINEE_PATTERNS = [
  /^test/i,
  /dummy/i,
  /trainee 0\d/i,        // "Trainee 01", "Trainee 02", …
  /test trainee/i,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date();

function log(msg)  { console.log(msg); }
function info(msg) { console.log('  ' + msg); }
function warn(msg) { console.log('  ⚠  ' + msg); }
function ok(msg)   { console.log('  ✓  ' + msg); }
function skip(msg) { console.log('  –  ' + msg); }

function dryTag() { return DRY_RUN ? ' [DRY RUN — no write]' : ''; }

// ─── FIX-1: Future active distributions → upcoming ───────────────────────────

async function fixFutureDistributions() {
  log('\n━━━ FIX-1: Future active distributions → upcoming ━━━');

  const records = await Distribution.find({
    status:    'active',
    startDate: { $gt: NOW },
  }).lean();

  if (records.length === 0) {
    skip('No future "active" distributions found. Nothing to do.');
    return { found: 0, changed: 0 };
  }

  info(`Found ${records.length} distribution(s) with status "active" and startDate in the future:`);
  for (const d of records) {
    info(
      `  id=${d._id}  traineeId=${d.traineeId}` +
      `  start=${d.startDate.toISOString().slice(0, 10)}` +
      `  end=${d.endDate ? d.endDate.toISOString().slice(0, 10) : '?'}` +
      `  → status: "active" → "upcoming"` + dryTag()
    );
  }

  if (!DRY_RUN) {
    const ids    = records.map(r => r._id);
    const result = await Distribution.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'upcoming' } },
      { runValidators: true }        // model now accepts 'upcoming'
    );
    ok(`Updated ${result.modifiedCount} distribution(s) to "upcoming".`);
    return { found: records.length, changed: result.modifiedCount };
  }

  return { found: records.length, changed: 0 };
}

// ─── FIX-2: PDs missing specialtyId ─────────────────────────────────────────

async function fixPDSpecialties() {
  log('\n━━━ FIX-2: Program Directors missing specialtyId ━━━');

  // Build a name → ObjectId map from the live specialties collection
  const allSpecialties = await Specialty.find().lean();
  const specialtyByName = {};
  for (const s of allSpecialties) {
    specialtyByName[s.name] = s;
  }

  let found   = 0;
  let changed = 0;
  let errors  = 0;

  for (const [email, specialtyName] of Object.entries(PD_SPECIALTY_MAP)) {
    const pd = await User.findOne({ email, role: 'program_director' }).lean();

    if (!pd) {
      warn(`PD not found: ${email}  (skipping)`);
      errors++;
      continue;
    }

    if (pd.specialtyId) {
      skip(`${email} already has specialtyId=${pd.specialtyId}  (skipping)`);
      continue;
    }

    found++;

    const specialty = specialtyByName[specialtyName];
    if (!specialty) {
      warn(`Specialty "${specialtyName}" not found in DB for ${email}  (skipping)`);
      errors++;
      continue;
    }

    info(
      `${email}  (${pd.name})` +
      `  → specialtyId=${specialty._id} ("${specialty.name}")` +
      dryTag()
    );

    if (!DRY_RUN) {
      await User.updateOne(
        { _id: pd._id },
        { $set: { specialtyId: specialty._id, specialty: specialty.name } }
      );
      ok(`Assigned specialty "${specialty.name}" to ${email}.`);
      changed++;
    }
  }

  if (found === 0 && errors === 0) {
    skip('All PDs already have a specialtyId. Nothing to do.');
  }

  return { found, changed, errors };
}

// ─── FIX-3: Soft-deactivate dummy trainee accounts ───────────────────────────

async function fixDummyTrainees() {
  log('\n━━━ FIX-3: Soft-deactivate dummy / test trainee accounts ━━━');

  // Fetch all active trainees then filter by pattern in JS
  // (MongoDB $regex can't combine multiple patterns in a single $or on the same field cleanly)
  const allActiveTrainees = await User.find({ role: 'trainee', isActive: true })
    .select('_id name email studentId')
    .lean();

  function isDummy(u) {
    return DUMMY_TRAINEE_PATTERNS.some(rx => rx.test(u.name) || rx.test(u.email));
  }

  const dummies = allActiveTrainees.filter(isDummy);

  if (dummies.length === 0) {
    skip('No dummy or test trainee accounts found. Nothing to do.');
    return { found: 0, changed: 0 };
  }

  info(`Found ${dummies.length} dummy/test trainee(s):`);
  for (const u of dummies) {
    info(
      `  id=${u._id}  email=${u.email}  name="${u.name}"` +
      `  studentId="${u.studentId || ''}"` +
      `  → isActive: true → false` + dryTag()
    );
  }

  if (!DRY_RUN) {
    const ids    = dummies.map(u => u._id);
    const result = await User.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive: false, deletedAt: NOW } }
    );
    ok(`Deactivated ${result.modifiedCount} dummy trainee account(s).`);
    return { found: dummies.length, changed: result.modifiedCount };
  }

  return { found: dummies.length, changed: 0 };
}

// ─── Summary report ──────────────────────────────────────────────────────────

function printSummary(results) {
  const mode = DRY_RUN ? 'DRY RUN (no changes written)' : 'LIVE RUN (changes applied)';

  log('\n' + '═'.repeat(58));
  log('  SUMMARY REPORT — fixDataRealism migration');
  log('  Mode : ' + mode);
  log('  Time : ' + NOW.toISOString());
  log('─'.repeat(58));
  log(`  FIX-1  Future distributions found     : ${results.fix1.found}`);
  log(`         Changed to "upcoming"           : ${DRY_RUN ? '(pending)' : results.fix1.changed}`);
  log(`  FIX-2  PDs without specialtyId found  : ${results.fix2.found}`);
  log(`         Specialties assigned            : ${DRY_RUN ? '(pending)' : results.fix2.changed}`);
  if (results.fix2.errors > 0)
  log(`         Errors / not found              : ${results.fix2.errors}`);
  log(`  FIX-3  Dummy trainee accounts found   : ${results.fix3.found}`);
  log(`         Deactivated                     : ${DRY_RUN ? '(pending)' : results.fix3.changed}`);
  log('─'.repeat(58));

  const totalFound   = results.fix1.found + results.fix2.found + results.fix3.found;
  const totalChanged = results.fix1.changed + results.fix2.changed + results.fix3.changed;

  if (DRY_RUN) {
    log(`  ${totalFound} issue(s) identified.`);
    log('  Re-run with DRY_RUN=false to apply all changes.');
  } else {
    log(`  ${totalChanged} of ${totalFound} record(s) updated successfully.`);
  }
  log('═'.repeat(58) + '\n');
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI environment variable is required.');
    process.exit(1);
  }

  log('\nfixDataRealism — MLMS/MTMS V2');
  log('Mode: ' + (DRY_RUN ? '🔍  DRY RUN — no data will be modified' : '✏️   LIVE RUN — changes will be written'));

  await mongoose.connect(process.env.MONGO_URI);
  log('Connected to MongoDB.\n');

  const results = {
    fix1: await fixFutureDistributions(),
    fix2: await fixPDSpecialties(),
    fix3: await fixDummyTrainees(),
  };

  printSummary(results);

  await mongoose.disconnect();
  log('Disconnected from MongoDB.');
}

main().catch(async err => {
  console.error('\nMigration failed:', err.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
