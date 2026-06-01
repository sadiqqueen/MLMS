const router = require('express').Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET /api/notifications/:userId — fetch all notifications for one user
// (sorted newest first so the latest shows at the top of the bell panel)
router.get('/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const notifications = await Notification.find({ user: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/notifications/:id/read — mark a single notification as read
// Called when the user clicks a specific notification in the panel
router.put('/:id/read', auth, async (req, res) => {
  try {
    const existing = await Notification.findById(req.params.id);
    if (existing && existing.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const notification = existing
      ? await Notification.findByIdAndUpdate(
        req.params.id,
        { read: true },
        { new: true }
      )
      : null;
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/notifications/read-all/:userId — mark ALL notifications as read
// Called when the user clicks "Mark all as read"
router.put('/read-all/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Notification.updateMany({ user: req.params.userId }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/notifications/clear/:userId — delete all notifications for current user
router.delete('/clear/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await Notification.deleteMany({ user: req.params.userId });
    res.json({ success: true, message: 'Notifications cleared', deletedCount: result.deletedCount || 0 });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/notifications/:id — delete one notification owned by current user
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
