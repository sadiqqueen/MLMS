// backend/routes/logbook.js
// Mounted at /api/logbook in server.js.
// Trainees record procedure log-book entries; their supervisor reviews them
// (sign-off / reject). Trainer scoping reuses utils/assignedTrainees.js.
const router         = require('express').Router();
const mongoose       = require('mongoose');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { getAssignedTraineeIds } = require('../utils/assignedTrainees');
const { coerceRoleToTrack } = require('../utils/track');
const { specialtyIdsForName, specialtyUserMatch } = require('../utils/pdScope');
const User           = require('../models/User');
const LogBookEntry   = require('../models/LogBookEntry');
const Notification   = require('../models/Notification');
const AuditLog       = require('../models/AuditLog');

const REVIEW_STATUSES = ['signed_off', 'rejected'];
// Roles that can view the sign-off queue: the trainee's supervisor (legacy) and
// the Program Director (redesign, RULINGS §D20). Sub-PD sees it read-only.
const REVIEW_QUEUE_ROLES = ['supervisor', 'program_director', 'sub_pd'];
// Roles that can act (sign-off / reject): supervisor + program_director.
const REVIEW_ACTION_ROLES = ['supervisor', 'program_director'];

// The trainee-id set a reviewer may sign off. A supervisor keeps its assigned
// trainees (utils/assignedTrainees). A Program Director / Sub-PD oversees a whole
// specialty, so it reviews every trainee in that specialty across all hospitals.
async function reviewTraineeIds(req) {
  if (req.user.role === 'supervisor') {
    return getAssignedTraineeIds(req.user._id);
  }
  const info = await specialtyIdsForName(req.user.specialtyId, req.track);
  if (!info) return [];
  const trainees = await User.find({
    role: coerceRoleToTrack('trainee', req.track),
    isActive: { $ne: false },
    ...specialtyUserMatch(info),
  }).select('_id');
  return trainees.map(t => String(t._id));
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

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
  }).catch(err => console.error('[AuditLog] Failed to write logbook audit:', err.message));
}

// GET /api/logbook/mine — the trainee's own entries, newest first.
router.get('/mine', auth, allowRoles('trainee'), async (req, res) => {
  try {
    const entries = await LogBookEntry.find({ traineeId: req.user._id }).sort({ date: -1, createdAt: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/logbook — the trainee adds a pending entry.
router.post('/', auth, allowRoles('trainee'), async (req, res) => {
  try {
    const { date, procedureType, notes } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ success: false, message: 'Invalid date' });
    if (!procedureType || !String(procedureType).trim()) {
      return res.status(400).json({ success: false, message: 'Procedure type is required' });
    }

    const entry = await LogBookEntry.create({
      traineeId:     req.user._id,
      programId:     req.user.programId || null,
      date:          parsedDate,
      procedureType: String(procedureType).trim(),
      notes:         notes !== undefined ? String(notes) : '',
      status:        'pending'
    });
    await writeAudit(req, 'trainee_create_logbook', 'LogBookEntry', entry._id, { procedureType: entry.procedureType });
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/logbook/:id — the trainee removes one of their own PENDING entries.
router.delete('/:id', auth, allowRoles('trainee'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const entry = await LogBookEntry.findOne({ _id: req.params.id, traineeId: req.user._id });
    if (!entry) return res.status(404).json({ success: false, message: 'Log book entry not found' });
    if (entry.status !== 'pending') {
      return res.status(403).json({ success: false, message: 'Only pending entries can be deleted' });
    }
    await entry.deleteOne();
    await writeAudit(req, 'trainee_delete_logbook', 'LogBookEntry', entry._id, {});
    res.json({ success: true, message: 'Log book entry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/logbook/review?status= — the reviewer's queue (supervisor: assigned
// trainees; PD/Sub-PD: the specialty's trainees). Defaults to status 'pending';
// ?status=all lifts the status filter.
router.get('/review', auth, allowRoles(...REVIEW_QUEUE_ROLES), async (req, res) => {
  try {
    const traineeIds = await reviewTraineeIds(req);
    const query = { traineeId: { $in: traineeIds } };

    const status = req.query.status || 'pending';
    if (status !== 'all') {
      if (!['pending', ...REVIEW_STATUSES].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      query.status = status;
    }

    const entries = await LogBookEntry.find(query)
      .populate('traineeId', 'name idNumber studentId')
      .sort({ date: -1, createdAt: -1 });
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/logbook/:id/review — a supervisor OR Program Director signs off or
// rejects an entry of a trainee within their scope.
router.patch('/:id/review', auth, allowRoles(...REVIEW_ACTION_ROLES), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const { status, reviewNote } = req.body;
    if (!REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be signed_off or rejected' });
    }

    const entry = await LogBookEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Log book entry not found' });

    const scoped = await reviewTraineeIds(req);
    if (!scoped.includes(String(entry.traineeId))) {
      return res.status(403).json({ success: false, message: 'This trainee is not within your scope' });
    }

    entry.status     = status;
    entry.reviewNote = reviewNote !== undefined ? String(reviewNote) : '';
    entry.reviewedBy = req.user._id;
    entry.reviewedAt = new Date();
    await entry.save();

    const reviewerLabel = req.user.role === 'program_director' ? 'Program Director' : 'trainer';
    await Notification.create({
      user: entry.traineeId,
      message: status === 'signed_off'
        ? `Your log book entry has been signed off by your ${reviewerLabel}.`
        : `Your log book entry was rejected by your ${reviewerLabel}.`,
      category: 'logbook'
    }).catch(() => {});
    await writeAudit(req, `${req.user.role}_review_logbook`, 'LogBookEntry', entry._id, { status });

    res.json({ success: true, data: entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
