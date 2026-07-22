'use strict';
// backend/migrations/importRegistryData.js
//
// ONE-TIME bulk import of registry data + accounts from File 1 (SICAP/ABHS
// "البيانات الكاملة"), pre-parsed and specialty-resolved into the committed,
// self-contained dataset: backend/migrations/data/registryImport.json.
//   • 36 training centers (Hospital)      — matched to an existing Country
//   • 36 DIOs (User role 'dio')           — idNumber DIO-<accreditationNumber>
//   • 135 programs (Program)              — matched to an existing Specialty (by code)
//   • 135 program directors (User 'program_director') — idNumber PD-<seq>
//
// READS THE DB FIRST: countries + specialties must already be seeded; the import
// MATCHES them and HALTS if anything is unresolved (never creates a country or
// specialty). Every account's password is '123456' (User pre-save hashes it);
// all log in by idNumber.
//
// GATED exactly like seedCouncilsSpecialties.js — DRY RUN by default (zero writes).
// To apply against production you must pass all three gates:
//   DRY_RUN=false CONFIRM_IMPORT=yes ALLOW_PROD=1 node backend/migrations/importRegistryData.js
// Dry run (safe, read-only, prints the full plan):
//   node backend/migrations/importRegistryData.js
// If your host needs a direct (non-SRV, single-node proxy) connection, add MONGO_DIRECT=1.
//
// IDEMPOTENT: re-running creates nothing new. Natural keys —
//   center  by (name + countryId), user by idNumber,
//   program by (trainingCenterId + specialtyId + programDirectorId)   ← note the PD:
//   one center legitimately runs two programs in the same specialty with different
//   PDs (Royal Medical Services · Orthopedics), so the PD is part of the key.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Program = require('../models/Program');
const Country = require('../models/Country');
const Specialty = require('../models/Specialty');
const { normalizeArabic } = require('../utils/arabic');

const dataset = require('./data/registryImport.json');

const DRY_RUN = process.env.DRY_RUN !== 'false';          // default: dry run
const CONFIRMED = process.env.CONFIRM_IMPORT === 'yes';
const ALLOW_PROD = process.env.ALLOW_PROD === '1';
const PASSWORD = '123456';
const CAP_PLACEHOLDER = dataset.meta?.yearlyCapacityPlaceholder || 10;
const MAX_PROGRAMS_PER_CENTER = 100;
const MARKER_KEY = 'importRegistryData:v1';

// —— tiny report helpers ————————————————————————————————————————————————
const plan = { centersNew: 0, centersExisting: 0, diosNew: 0, diosExisting: 0,
  pdsNew: 0, pdsExisting: 0, programsNew: 0, programsExisting: 0,
  emailSuppressed: 0, links: 0 };
const halts = [];
const notes = [];
const credentials = []; // { idNumber, name, role, scope }

function log(s) { console.log(s); }

// —— country / specialty resolution ————————————————————————————————————
function buildCountryIndex(countries) {
  const idx = new Map();
  for (const c of countries) {
    for (const v of [c.officialNameAr, c.shortNameAr, c.name]) {
      if (v) { const k = normalizeArabic(v); if (!idx.has(k)) idx.set(k, c); }
    }
  }
  return idx;
}
function resolveCountry(idx, raw) {
  const k = normalizeArabic(raw);
  if (idx.has(k)) return idx.get(k);
  for (const [nk, c] of idx) if (nk.includes(k) || k.includes(nk)) return c;
  return null;
}

async function main() {
  if (!process.env.MONGO_URI) { console.error('ERROR: MONGO_URI is required in backend/.env'); process.exit(1); }
  if (!DRY_RUN && (!CONFIRMED || !ALLOW_PROD)) {
    console.error('ERROR: Apply mode requires CONFIRM_IMPORT=yes AND ALLOW_PROD=1');
    console.error('  DRY_RUN=false CONFIRM_IMPORT=yes ALLOW_PROD=1 node backend/migrations/importRegistryData.js');
    process.exit(1);
  }

  log(`\nRegistry bulk import — DRY_RUN=${DRY_RUN} CONFIRM_IMPORT=${CONFIRMED} ALLOW_PROD=${ALLOW_PROD}`);
  log(`dataset: ${dataset.centers.length} centers · ${dataset.programs.length} programs (source: ${dataset.meta?.source})`);

  const connectOpts = process.env.MONGO_DIRECT === '1' ? { directConnection: true } : {};
  await mongoose.connect(process.env.MONGO_URI, connectOpts);

  // marker (informational; the import is idempotent regardless)
  const markers = mongoose.connection.db.collection('migration_markers');
  const priorMarker = await markers.findOne({ key: MARKER_KEY });
  if (priorMarker) notes.push(`marker present (previously applied ${priorMarker.appliedAt || '?'}) — re-run is safe/idempotent.`);

  // 1) INVENTORY (read-only) ------------------------------------------------
  const [countries, specialties, nHosp, nDio, nPd] = await Promise.all([
    Country.find({}, 'name officialNameAr shortNameAr').lean(),
    Specialty.find({}, 'name nameEn code type').lean(),
    Hospital.countDocuments({}),
    User.countDocuments({ role: 'dio' }),
    User.countDocuments({ role: 'program_director' }),
  ]);
  log(`\nDB inventory: countries=${countries.length} specialties=${specialties.length} centers=${nHosp} dios=${nDio} pds=${nPd}`);
  if (countries.length === 0 || specialties.length === 0) {
    halts.push('countries and/or specialties are NOT seeded — run the country seed and seedCouncilsSpecialties.js first.');
  }
  const countryIdx = buildCountryIndex(countries);
  const specByCode = new Map(specialties.filter(s => s.code).map(s => [String(s.code), s]));
  const importUser = await User.findOne({ role: 'developer' }, '_id').lean();
  const createdBy = importUser ? importUser._id : null;

  // 2) RESOLVE countries + specialties; halt on anything unresolved -----------
  const centerCountry = new Map(); // centerKey -> country doc
  for (const c of dataset.centers) {
    const country = resolveCountry(countryIdx, c.countryAr);
    if (!country) halts.push(`country unresolved: "${c.countryAr}" (center "${c.name}")`);
    else centerCountry.set(c.key, country);
  }
  const unresolvedSpec = new Set();
  for (const p of dataset.programs) {
    if (!p.specialtyCode || !specByCode.has(String(p.specialtyCode))) {
      unresolvedSpec.add(`${p.specialtyRaw} (code ${p.specialtyCode})`);
    }
  }
  unresolvedSpec.forEach(s => halts.push(`specialty unresolved in DB: ${s}`));

  if (halts.length) { await finishAndReport(); return; }

  // 3) CENTERS + DIOs -------------------------------------------------------
  const centerIdByKey = new Map();
  for (const c of dataset.centers) {
    const country = centerCountry.get(c.key);
    // DIO (by idNumber)
    let dio = await User.findOne({ idNumber: c.dioIdNumber });
    if (dio) { plan.diosExisting++; }
    else {
      plan.diosNew++;
      credentials.push({ idNumber: c.dioIdNumber, name: c.dioName, role: 'dio', scope: c.name });
      if (!DRY_RUN) {
        dio = new User({ name: c.dioName, idNumber: c.dioIdNumber, password: PASSWORD,
          role: 'dio', countryId: country._id, assignedCenterIds: [] });
        await dio.save();
      }
    }
    // Center (by name + countryId)
    let center = await Hospital.findOne({ name: c.name, countryId: country._id });
    if (center) { plan.centersExisting++; }
    else {
      plan.centersNew++;
      if (!DRY_RUN) {
        center = await Hospital.create({ name: c.name, countryId: country._id,
          accreditationNumber: c.accreditationNumber || '', city: '', track: 'advanced',
          isActive: true, dioId: dio ? dio._id : null });
      }
    }
    // Dual-write link (idempotent)
    if (!DRY_RUN && center && dio) {
      if (String(center.dioId || '') !== String(dio._id)) { center.dioId = dio._id; await center.save(); plan.links++; }
      await User.updateOne({ _id: dio._id, role: 'dio' }, { $addToSet: { assignedCenterIds: center._id } });
    }
    if (center) centerIdByKey.set(c.key, { id: center._id, name: center.name, countryId: country._id });
    else centerIdByKey.set(c.key, { id: null, name: c.name, countryId: country._id }); // dry-run placeholder
  }

  // 4) PROGRAMS + PDs -------------------------------------------------------
  const perCenterCount = new Map();
  for (const p of dataset.programs) {
    const center = centerIdByKey.get(p.centerKey);
    const spec = specByCode.get(String(p.specialtyCode));
    if (!center) { halts.push(`program seq ${p.seq}: center not built (${p.centerName})`); continue; }

    // PD (by idNumber)
    let pd = await User.findOne({ idNumber: p.pdIdNumber });
    if (pd) { plan.pdsExisting++; }
    else {
      plan.pdsNew++;
      credentials.push({ idNumber: p.pdIdNumber, name: p.pdName, role: 'program_director', scope: (spec?.nameEn || spec?.name || p.specialtyRaw) });
      if (!DRY_RUN) {
        const payload = { name: p.pdName, idNumber: p.pdIdNumber, password: PASSWORD,
          role: 'program_director', specialtyId: spec._id, countryId: center.countryId };
        if (p.email) payload.email = p.email;
        if (p.phone) payload.phone = p.phone;
        try {
          pd = new User(payload); await pd.save();
        } catch (err) {
          if (err && err.code === 11000 && err.keyPattern && err.keyPattern.email) {
            delete payload.email; plan.emailSuppressed++;
            notes.push(`PD ${p.pdIdNumber} (${p.pdName}): email "${p.email}" already in DB — created without email.`);
            pd = new User(payload); await pd.save();
          } else { throw err; }
        }
      }
    }

    // Program (by center + specialty + PD)
    const pdId = pd ? pd._id : null;
    let program = null;
    if (center.id && pdId) program = await Program.findOne({ trainingCenterId: center.id, specialtyId: spec._id, programDirectorId: pdId });
    if (program) { plan.programsExisting++; }
    else {
      plan.programsNew++;
      perCenterCount.set(p.centerKey, (perCenterCount.get(p.centerKey) || 0) + 1);
      if (!DRY_RUN) {
        const name = `${spec.name} — ${center.name}`;
        program = await Program.create({ name, trainingCenterId: center.id, specialtyId: spec._id,
          programDirectorId: pdId, yearlyCapacity: CAP_PLACEHOLDER, durationYears: null,
          isActive: true, createdBy });
        // link PD -> program
        if (pdId) await User.updateOne({ _id: pdId }, { $set: { programId: program._id } });
      }
    }
  }

  // capacity assertion (report only) — busiest center here is 31, well under the cap.
  for (const [key, added] of perCenterCount) {
    if (added > MAX_PROGRAMS_PER_CENTER) notes.push(`center ${key} would exceed ${MAX_PROGRAMS_PER_CENTER} programs (${added} new).`);
  }

  // marker on apply
  if (!DRY_RUN) {
    await markers.updateOne({ key: MARKER_KEY },
      { $set: { key: MARKER_KEY, appliedAt: new Date().toISOString(), centers: dataset.centers.length, programs: dataset.programs.length } },
      { upsert: true });
    // credentials manifest (contains the shared initial password 123456) — written
    // locally next to the dataset; gitignored, never committed. Distribute securely.
    const csv = ['idNumber,name,role,center/specialty,password']
      .concat(credentials.map(c => `${c.idNumber},"${String(c.name).replace(/"/g, "'")}",${c.role},"${String(c.scope).replace(/"/g, "'")}",${PASSWORD}`))
      .join('\n');
    const csvPath = path.join(__dirname, 'data', 'registryImport_credentials.csv');
    try { fs.writeFileSync(csvPath, csv, 'utf8'); notes.push(`credentials manifest written: ${csvPath} (${credentials.length} accounts).`); }
    catch (e) { notes.push(`could not write credentials CSV: ${e.message}`); }
  }

  await finishAndReport();
}

async function finishAndReport() {
  log('\n──────── PLAN / RESULT ────────');
  log(`centers:  ${plan.centersNew} new, ${plan.centersExisting} existing`);
  log(`DIOs:     ${plan.diosNew} new, ${plan.diosExisting} existing`);
  log(`PDs:      ${plan.pdsNew} new, ${plan.pdsExisting} existing`);
  log(`programs: ${plan.programsNew} new, ${plan.programsExisting} existing`);
  log(`links written: ${plan.links}   email suppressions (existing-email clashes): ${plan.emailSuppressed}`);
  log(`yearlyCapacity placeholder for every new program: ${CAP_PLACEHOLDER} (review/adjust later)`);
  if (notes.length) { log('\nNotes:'); notes.forEach(n => log('  • ' + n)); }
  if (halts.length) {
    log('\n⛔ HALT — unresolved items (no data was written):');
    halts.forEach(h => log('  ✗ ' + h));
  }
  if (DRY_RUN) {
    log('\nDRY RUN — no writes performed. To apply against production:');
    log('  DRY_RUN=false CONFIRM_IMPORT=yes ALLOW_PROD=1 node backend/migrations/importRegistryData.js');
  } else if (!halts.length) {
    log('\n✅ APPLIED. Re-run this script (dry) to verify idempotency (expect 0 new).');
  }
  await mongoose.disconnect().catch(() => {});
}

if (require.main === module) {
  main().catch(async err => {
    console.error('\nImport failed:', err && err.message ? err.message : err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { dataset };
