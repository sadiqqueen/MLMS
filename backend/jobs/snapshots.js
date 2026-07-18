// backend/jobs/snapshots.js
// Scheduled data snapshots. Every enabled run exports a fixed whitelist of
// collections to per-dataset CSV files under
//   backend/uploads/snapshots/<range>-<YYYY-MM-DD>/<dataset>.csv
// and records one DataSnapshot document per file.
//
// SAFETY: the WHITELIST is the single source of truth for what leaves the DB.
// It NEVER includes ChangeRequest (bcrypt hashes live in `changes`),
// SecurityEvent, or any Feedback* model, and the User export drops the
// password / loginAttempts / lockUntil / __v fields via .select(). The
// scripts/assertExportSafety.js guard fails the build if any of that regresses.
//
// scheduleSnapshots() is registered from server.js ONLY when
// SNAPSHOTS_ENABLED === 'true' (opt-in: PM2 fork = single instance; Railway may
// lack a persistent disk).
const fs   = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { buildCsv } = require('../utils/csv');
const DataSnapshot = require('../models/DataSnapshot');

const User         = require('../models/User');
const Hospital     = require('../models/Hospital');
const Specialty    = require('../models/Specialty');
const Country      = require('../models/Country');
const Program      = require('../models/Program');
const Rotation     = require('../models/Rotation');
const Distribution = require('../models/Distribution');
const Report       = require('../models/Report');
const Evaluation   = require('../models/Evaluation');
const Research     = require('../models/Research');
const Certificate  = require('../models/Certificate');
const TraineeCourse= require('../models/TraineeCourse');
const Announcement = require('../models/Announcement');
const LogBookEntry = require('../models/LogBookEntry');
const Notification = require('../models/Notification');
const AuditLog     = require('../models/AuditLog');

const RANGES = ['weekly', 'monthly', 'yearly'];
const SNAPSHOTS_DIR = path.join(__dirname, '../uploads/snapshots');

// Dataset whitelist: model → optional projection. The ONLY collections that may
// be exported. User is projected to strip credential/lockout internals; every
// other model exports all fields. NEVER add ChangeRequest, SecurityEvent, or
// any Feedback* model here (enforced by scripts/assertExportSafety.js).
const WHITELIST = {
  User:          { model: User, select: '-password -loginAttempts -lockUntil -__v' },
  Hospital:      { model: Hospital },
  Specialty:     { model: Specialty },
  Country:       { model: Country },
  Program:       { model: Program },
  Rotation:      { model: Rotation },
  Distribution:  { model: Distribution },
  Report:        { model: Report },
  Evaluation:    { model: Evaluation },
  Research:      { model: Research },
  Certificate:   { model: Certificate },
  TraineeCourse: { model: TraineeCourse },
  Announcement:  { model: Announcement },
  LogBookEntry:  { model: LogBookEntry },
  Notification:  { model: Notification },
  AuditLog:      { model: AuditLog },
};

// Flatten a single field value for a CSV cell:
//   ObjectId        → hex string
//   Date            → ISO string
//   array           → each element flattened, joined with '; '
//   nested object   → JSON.stringify
//   null/undefined  → '' (csvCell also handles this, but keep it explicit)
function isObjectId(v) {
  return v instanceof mongoose.Types.ObjectId
    || (v && typeof v === 'object' && v._bsontype === 'ObjectID');
}

function flattenValue(v) {
  if (v == null) return '';
  if (isObjectId(v)) return String(v);
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(flattenValue).join('; ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// Turn one collection into a CSV document. Header = union of all keys across
// documents (_id first, then the rest sorted for a stable layout).
async function datasetToCsv({ model, select }) {
  let query = model.find({});
  if (select) query = query.select(select);
  const docs = await query.lean();

  const keySet = new Set();
  docs.forEach(d => Object.keys(d).forEach(k => keySet.add(k)));
  keySet.delete('_id');
  const header = ['_id', ...Array.from(keySet).sort()];

  const rows = docs.map(d => header.map(k => flattenValue(d[k])));
  return { csv: buildCsv(header, rows), count: docs.length };
}

// Run a snapshot for one range now. Writes one CSV per whitelist dataset and
// one DataSnapshot document per file. Returns the created documents.
async function runSnapshot(range) {
  if (!RANGES.includes(range)) throw new Error(`Invalid snapshot range: ${range}`);

  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const folder  = `${range}-${dateStr}`;
  const dirAbs  = path.join(SNAPSHOTS_DIR, folder);
  fs.mkdirSync(dirAbs, { recursive: true });

  const created = [];
  for (const [name, cfg] of Object.entries(WHITELIST)) {
    const { csv } = await datasetToCsv(cfg);
    const fileAbs = path.join(dirAbs, `${name}.csv`);
    fs.writeFileSync(fileAbs, csv, 'utf8');
    const { size } = fs.statSync(fileAbs);

    // Relative path under uploads/snapshots (forward slashes for portability).
    // Upsert on (range, fileName) so re-running a range on the same day updates
    // the existing document instead of inserting a duplicate.
    const fileName = `${folder}/${name}.csv`;
    const doc = await DataSnapshot.findOneAndUpdate(
      { range, fileName },
      { $set: { generatedAt: new Date(), sizeBytes: size, datasets: [name] } },
      { upsert: true, new: true }
    );
    created.push(doc);
  }
  console.log(`[snapshots] ${range}: wrote ${created.length} dataset files → ${folder}`);
  return created;
}

// Register the cron schedules (weekly Mon 03:30, monthly 1st 04:00, yearly
// Jan-1 04:30). Called from server.js only when SNAPSHOTS_ENABLED === 'true'.
function scheduleSnapshots() {
  const cron = require('node-cron');
  const guard = range => () => runSnapshot(range).catch(err =>
    console.error(`[snapshots] ${range} run failed:`, err.message));

  cron.schedule('30 3 * * 1', guard('weekly'));   // Monday 03:30
  cron.schedule('0 4 1 * *',  guard('monthly'));  // 1st of month 04:00
  cron.schedule('30 4 1 1 *', guard('yearly'));   // Jan 1 04:30

  console.log('[snapshots] scheduled weekly/monthly/yearly export jobs');
}

module.exports = { runSnapshot, scheduleSnapshots, WHITELIST, RANGES, SNAPSHOTS_DIR };
