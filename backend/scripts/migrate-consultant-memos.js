// One-off migration: convert consultant_memos documents from the original
// table-form shape ({ right, left } objects, no status/memoNumber) to the
// current flat-string schema. Safe to re-run — already-migrated docs are
// left untouched. Run from backend/:  node scripts/migrate-consultant-memos.js
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

function flatten(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  // old shape: { right, left }
  const parts = [v.right, v.left].filter(s => typeof s === 'string' && s.trim() !== '');
  return parts.join('\n');
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.collection('consultant_memos');
  const docs = await col.find({}).toArray();
  let migrated = 0;

  for (const doc of docs) {
    const needsShape = ['executiveCommittee', 'presidentRecommendation', 'jointCouncil']
      .some(k => doc[k] != null && typeof doc[k] !== 'string');
    const needsStatus = !doc.status;
    if (!needsShape && !needsStatus && doc.memoNumber) continue;

    const year = new Date(doc.createdAt || Date.now()).getFullYear();
    const update = {
      executiveCommittee:      flatten(doc.executiveCommittee),
      presidentRecommendation: flatten(doc.presidentRecommendation),
      jointCouncil:            flatten(doc.jointCouncil),
      status:         doc.status || 'saved',
      movedToDraftAt: doc.movedToDraftAt || null,
      memoNumber:     doc.memoNumber || `${year}/${String(++migrated).padStart(3, '0')}`,
      topicDateTime:                   doc.topicDateTime || null,
      attachmentsDateTime:             doc.attachmentsDateTime || null,
      presentationDateTime:            doc.presentationDateTime || null,
      executiveCommitteeDateTime:      doc.executiveCommitteeDateTime || null,
      presidentRecommendationDateTime: doc.presidentRecommendationDateTime || null,
      jointCouncilDateTime:            doc.jointCouncilDateTime || null,
    };
    await col.updateOne({ _id: doc._id }, { $set: update });
  }

  console.log(`Checked ${docs.length} memo(s), migrated ${migrated}.`);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
