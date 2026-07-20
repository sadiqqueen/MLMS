// backend/utils/changeHistory.js
// Derives the "change-history footer" for account/entity cards from approved
// ChangeRequests (RULINGS §E26) — no schema duplication. Returns FIELD LABELS
// and the requester's name only, never the changed values.
const ChangeRequest = require('../models/ChangeRequest');

// For a set of target ids → { [targetId]: [{ date, labels:[String], by:String }] },
// newest approved change first, capped at `perTarget` entries each.
async function changeHistoryFor(targetIds, perTarget = 5) {
  const ids = [...new Set((targetIds || []).filter(Boolean).map(String))];
  if (!ids.length) return {};

  const crs = await ChangeRequest.find({ targetId: { $in: ids }, status: 'approved' })
    .populate('requestedBy', 'name')
    .select('targetId display reviewedAt requestType requestedBy')
    .sort({ reviewedAt: -1, createdAt: -1 })
    .limit(ids.length * perTarget + 200);

  const out = {};
  for (const cr of crs) {
    const key = String(cr.targetId);
    if (!out[key]) out[key] = [];
    if (out[key].length >= perTarget) continue;
    const labels = cr.requestType === 'delete'
      ? ['Deleted']
      : (Array.isArray(cr.display) ? cr.display.map(d => d && d.label).filter(Boolean) : []);
    out[key].push({ date: cr.reviewedAt, labels, by: (cr.requestedBy && cr.requestedBy.name) || '' });
  }
  return out;
}

module.exports = { changeHistoryFor };
