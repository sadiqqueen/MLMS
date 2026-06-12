// One-off migration: repair mojibake'd attachment filenames in
// consultant_memos (UTF-8 names that busboy latin1-decoded on upload,
// e.g. "ÙØ°ÙØ±Ø©.docx" → "مذكرة.docx").
//
//   node scripts/fix-attachment-names.js --dry-run   # report only
//   node scripts/fix-attachment-names.js             # apply
//
// Only entries where the re-decoded result is valid UTF-8 *containing
// Arabic* are touched; every change is logged.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');
const ARABIC = /[؀-ۿ]/;

function repair(name) {
  if (!name || typeof name !== 'string') return null;
  // must look mojibake'd: has 0x80–0xFF chars and nothing above U+00FF
  if ([...name].some(c => c.codePointAt(0) > 0xff)) return null;
  if (![...name].some(c => { const p = c.codePointAt(0); return p >= 0x80 && p <= 0xff; })) return null;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  if (decoded.includes('�')) return null;   // not valid UTF-8 bytes
  if (!ARABIC.test(decoded)) return null;        // only repair when result is Arabic
  return decoded;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection('consultant_memos');
  const docs = await col.find({ 'attachmentFiles.0': { $exists: true } }).toArray();

  let changedDocs = 0, changedNames = 0;
  for (const doc of docs) {
    let touched = false;
    const files = doc.attachmentFiles.map(f => {
      const fixed = repair(f.name);
      if (fixed) {
        console.log(`memo ${doc._id} (${doc.memoNumber || 'no number'}):`);
        console.log(`    before: ${f.name}`);
        console.log(`    after : ${fixed}`);
        touched = true;
        changedNames++;
        return { ...f, name: fixed };
      }
      return f;
    });
    if (touched) {
      changedDocs++;
      if (!DRY_RUN) await col.updateOne({ _id: doc._id }, { $set: { attachmentFiles: files } });
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] would fix' : 'Fixed'} ${changedNames} filename(s) across ${changedDocs} memo(s) (scanned ${docs.length}).`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
