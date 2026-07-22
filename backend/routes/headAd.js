// backend/routes/headAd.js
// Mounted at /api/head-ad in server.js.
// Head AD is the data-entry clerk's approver: it reviews the clerk's registry
// edit & delete requests (ChangeRequest reviewerRole 'head_ad') and approves or
// rejects them. Head AD's read-only registry pages are served by /api/registry
// (it is in REGISTRY_READ_ROLES there); THIS router is its only write surface —
// the "Permissions" inbox. Contracts mirror /api/analyzer/change-requests, the
// central-secretary → Data-Analyzer sibling pipeline.
const router          = require('express').Router();
const auth            = require('../middleware/auth');
const { allowRoles }  = require('../middleware/roles');
const { trackFilter } = require('../utils/track');
const { applyChangeRequest } = require('../utils/applyChangeRequest');
const Notification    = require('../models/Notification');
const ChangeRequest   = require('../models/ChangeRequest');
const AuditLog        = require('../models/AuditLog');

// head_ad reviews its inbox; super_admin retains oversight.
const HEAD_AD_ROLES = ['head_ad', 'super_admin'];

function sanitizeAuditMetadata(data) {
  const clone = { ...data };
  delete clone.password;
  delete clone.newPassword;
  return clone;
}

async function writeAudit(req, action, targetModel, targetId, metadata = {}) {
  await AuditLog.create({
    userId: req.user._id,
    action,
    targetId,
    targetModel,
    metadata: sanitizeAuditMetadata(metadata),
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
  }).catch(err => console.error('[AuditLog] Failed to write head-ad audit:', err.message));
}

// Strip any password key from the diff before it reaches the client.
function viewChangeRequest(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  if (o.changes && typeof o.changes === 'object') { const c = { ...o.changes }; delete c.password; o.changes = c; }
  return o;
}

// GET /api/head-ad/change-requests?status=pending|approved|rejected&requestType=edit|delete
router.get('/change-requests', auth, allowRoles(...HEAD_AD_ROLES), async (req, res) => {
  try {
    const query = { reviewerRole: 'head_ad', ...trackFilter(req.track) };
    if (req.query.status) query.status = req.query.status;
    if (req.query.requestType) query.requestType = req.query.requestType;
    const items = await ChangeRequest.find(query)
      .populate('requestedBy', 'name role')
      .populate('reviewedBy', 'name')
      .populate('hospitalId', 'name')
      .populate('specialtyId', 'name')
      .sort({ createdAt: -1 })
      .limit(300);
    res.json({ success: true, data: items.map(viewChangeRequest) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/head-ad/change-requests/:id/approve — apply the change + notify requester.
router.patch('/change-requests/:id/approve', auth, allowRoles(...HEAD_AD_ROLES), async (req, res) => {
  try {
    // Atomically CLAIM the pending request so two concurrent approvals (or an
    // approve racing a cancel) can't both apply it — the loser gets 404.
    const cr = await ChangeRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending', reviewerRole: 'head_ad', ...trackFilter(req.track) },
      { $set: { status: 'approved', reviewedBy: req.user._id, reviewedAt: new Date(),
                ...(req.body && req.body.note ? { reviewNote: String(req.body.note) } : {}) } },
      { new: true }
    );
    if (!cr) return res.status(404).json({ success: false, message: 'Pending request not found' });

    let updated;
    try {
      updated = await applyChangeRequest(cr);
    } catch (applyErr) {
      // Apply failed — release the claim so the request stays reviewable.
      await ChangeRequest.updateOne(
        { _id: cr._id, status: 'approved', reviewedBy: req.user._id },
        { $set: { status: 'pending', reviewedBy: null, reviewedAt: null, reviewNote: '' } }
      ).catch(e => console.error('[head-ad] CRITICAL: revert to pending failed for', String(cr._id), e.message));
      return res.status(applyErr.status || 400).json({ success: false, message: applyErr.message });
    }

    await writeAudit(req, 'head_ad_approve_change_request', 'ChangeRequest', cr._id, { routeKey: cr.routeKey, requestType: cr.requestType, targetId: cr.targetId });
    await Notification.create({
      user: cr.requestedBy,
      message: `Your ${cr.requestType === 'delete' ? 'deletion of' : 'change to'} ${cr.targetLabel || 'a record'} was approved by the Head AD.`,
      category: 'promotions',
    }).catch(() => {});
    res.json({ success: true, data: { changeRequest: viewChangeRequest(cr), target: updated } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/head-ad/change-requests/:id/reject — review note REQUIRED.
router.patch('/change-requests/:id/reject', auth, allowRoles(...HEAD_AD_ROLES), async (req, res) => {
  try {
    const note = req.body && req.body.note;
    if (!note || !String(note).trim()) return res.status(400).json({ success: false, message: 'A rejection note is required' });
    const cr = await ChangeRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending', reviewerRole: 'head_ad', ...trackFilter(req.track) },
      { $set: { status: 'rejected', reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: String(note).trim() } },
      { new: true }
    );
    if (!cr) return res.status(404).json({ success: false, message: 'Pending request not found' });
    await writeAudit(req, 'head_ad_reject_change_request', 'ChangeRequest', cr._id, { routeKey: cr.routeKey, requestType: cr.requestType });
    await Notification.create({
      user: cr.requestedBy,
      message: `Your ${cr.requestType === 'delete' ? 'deletion of' : 'change to'} ${cr.targetLabel || 'a record'} was rejected by the Head AD.`,
      category: 'promotions',
    }).catch(() => {});
    res.json({ success: true, data: viewChangeRequest(cr) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
