// backend/routes/announcements.js
// Mounted at /api/announcements in server.js.
// Program announcements: a Program Director posts to his own program; trainees,
// trainers, sub-PDs and oversight roles read a scoped board.
const router         = require('express').Router();
const mongoose       = require('mongoose');
const auth           = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const { resolveCenterSet } = require('../utils/centerScope');
const Announcement   = require('../models/Announcement');
const Program        = require('../models/Program');
const Notification   = require('../models/Notification');
const User           = require('../models/User');
const AuditLog       = require('../models/AuditLog');

// Roles allowed to READ the board (each with its own scoping below).
const READ_ROLES = [
  'program_director', 'sub_pd', 'trainee', 'supervisor',
  'dio_view', 'dio', 'sub_dio',
  'secretary_general', 'assistant_secretary', 'data_analyzer', 'super_admin'
];
// Oversight roles that see every announcement (optional ?programId= filter).
const GLOBAL_ROLES = ['secretary_general', 'assistant_secretary', 'data_analyzer', 'super_admin'];

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
  }).catch(err => console.error('[AuditLog] Failed to write announcement audit:', err.message));
}

// Fan out a Notification to every active trainee + trainer of a program. The
// message MUST contain the word 'announcement' so the Navbar notifLink routes it.
async function notifyProgramMembers(programId, message) {
  const members = await User.find({
    programId,
    role: { $in: ['trainee', 'supervisor'] },
    isActive: { $ne: false }
  }).select('_id');
  await Promise.all(members.map(m =>
    Notification.create({ user: m._id, message, category: 'announcement' }).catch(() => {})));
}

// The active program directed by this PD (programDirectorId match). null → none.
async function pdProgram(userId) {
  return Program.findOne({ programDirectorId: userId, isActive: { $ne: false } }).select('_id');
}

// POST /api/announcements — a Program Director posts to his own program.
router.post('/', auth, allowRoles('program_director'), async (req, res) => {
  try {
    const title = req.body.title != null ? String(req.body.title).trim() : '';
    const body  = req.body.body  != null ? String(req.body.body).trim()  : '';
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!body)  return res.status(400).json({ success: false, message: 'Body is required' });

    const program = await pdProgram(req.user._id);
    if (!program) return res.status(403).json({ success: false, message: 'No program assigned' });

    const announcement = await Announcement.create({
      programId: program._id,
      authorId:  req.user._id,
      title,
      body
    });

    await notifyProgramMembers(program._id, `New announcement: "${title}"`);
    await writeAudit(req, 'pd_create_announcement', 'Announcement', announcement._id, { programId: String(program._id), title });

    const populated = await Announcement.findById(announcement._id)
      .populate('authorId', 'name')
      .populate('programId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/announcements — scoped board (see per-role scoping below).
router.get('/', auth, allowRoles(...READ_ROLES), async (req, res) => {
  try {
    const role = req.user.role;
    const query = {};

    if (role === 'program_director') {
      const program = await pdProgram(req.user._id);
      if (!program) return res.json({ success: true, data: [] });
      query.programId = program._id;
    } else if (role === 'sub_pd') {
      if (!req.user.pdId) return res.json({ success: true, data: [] });
      const progs = await Program.find({ programDirectorId: req.user.pdId, isActive: { $ne: false } }).select('_id');
      query.programId = { $in: progs.map(p => p._id) };
    } else if (role === 'trainee' || role === 'supervisor') {
      if (!req.user.programId) return res.json({ success: true, data: [] });
      query.programId = req.user.programId;
    } else if (role === 'dio_view' || role === 'dio' || role === 'sub_dio') {
      const set = await resolveCenterSet(req.user);
      if (!set || set.length === 0) return res.json({ success: true, data: [] });
      const progs = await Program.find({ trainingCenterId: { $in: set }, isActive: { $ne: false } }).select('_id');
      query.programId = { $in: progs.map(p => p._id) };
    } else if (GLOBAL_ROLES.includes(role)) {
      if (req.query.programId && isValidObjectId(req.query.programId)) query.programId = req.query.programId;
    }

    const items = await Announcement.find(query)
      .populate('authorId', 'name')
      .populate('programId', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/announcements/:id — the author PD, or a super_admin.
router.delete('/:id', auth, allowRoles('program_director', 'super_admin'), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });

    const isAuthor = String(announcement.authorId) === String(req.user._id);
    if (req.user.role !== 'super_admin' && !isAuthor) {
      return res.status(403).json({ success: false, message: 'You can only delete your own announcements' });
    }

    await announcement.deleteOne();
    await writeAudit(req, 'delete_announcement', 'Announcement', announcement._id, { programId: String(announcement.programId) });
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
