const router = require('express').Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

// GET /api/notifications/:userId — fetch all notifications for one user
// (sorted newest first so the latest shows at the top of the bell panel)
router.get('/:userId', auth, async (req, res) => {
  try {
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
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
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
    await Notification.updateMany({ user: req.params.userId }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
