require('dotenv').config();

// Retargets registry ChangeRequests that a Data-Entry clerk submitted BEFORE the
// reviewerRole 'data_analyzer' -> 'head_ad' reroute. Those in-flight requests
// still carry reviewerRole:'data_analyzer' and therefore surface in the Data
// Analyzer / Head CS inbox instead of Head AD's — the approval separation the
// reroute establishes is skipped for the backlog. This sets reviewerRole to
// 'head_ad' for the pending edit/delete requests whose REQUESTER is a data_entry
// clerk. Central-secretary requests also use reviewerRole:'data_analyzer' but
// have a central_secretary requester, so the requester role is the discriminator
// and those are left untouched.
//
// Index-safe: touches only reviewerRole. DRY_RUN=true (default) reports only.
//   node backend/migrations/retargetClerkChangeRequests.js               # dry run
//   DRY_RUN=false node backend/migrations/retargetClerkChangeRequests.js  # apply

const mongoose = require('mongoose');
const ChangeRequest = require('../models/ChangeRequest');
const User = require('../models/User');

const DRY_RUN = process.env.DRY_RUN !== 'false'; // default: dry run

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

  const candidates = await ChangeRequest.find({
    status: 'pending',
    reviewerRole: 'data_analyzer',
    requestType: { $in: ['edit', 'delete'] },
  }).select('_id requestedBy routeKey requestType targetLabel').lean();

  const clerkIds = [];
  for (const cr of candidates) {
    const u = await User.findById(cr.requestedBy).select('role').lean();
    if (u && u.role === 'data_entry') clerkIds.push(cr._id);
  }

  console.log(`Pending data_analyzer edit/delete requests: ${candidates.length}`);
  console.log(`Of those, submitted by a data_entry clerk : ${clerkIds.length}`);

  if (!clerkIds.length) {
    console.log('Nothing to retarget.');
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    console.log('[DRY_RUN] Set DRY_RUN=false to apply. Would set reviewerRole -> head_ad on:');
    candidates
      .filter(cr => clerkIds.some(id => String(id) === String(cr._id)))
      .forEach(cr => console.log(`  - ${cr._id} ${cr.routeKey}/${cr.requestType} (${cr.targetLabel || 'record'})`));
    await mongoose.disconnect();
    return;
  }

  const res = await ChangeRequest.updateMany(
    { _id: { $in: clerkIds } },
    { $set: { reviewerRole: 'head_ad' } }
  );
  console.log(`Retargeted ${res.modifiedCount || 0} request(s) to head_ad.`);
  await mongoose.disconnect();
  console.log('Clerk ChangeRequest retarget complete.');
}

main().catch(async err => {
  console.error('Migration failed:', err.message);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
