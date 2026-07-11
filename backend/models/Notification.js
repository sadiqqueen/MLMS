const mongoose = require('mongoose');

// A Notification is a message sent to a user — e.g. "Your report was graded: A"
const notificationSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false },  // false = unread (shows red badge)
    // Origin of the notification, so a role can filter its own feed (e.g. a
    // trainee's "PD Notifications" page shows category 'program_director').
    // Legacy notifications have no category and default to 'general'.
    category: { type: String, default: 'general', index: true }
  },
  { timestamps: true }   // createdAt tells us when it was sent
);

module.exports = mongoose.model('Notification', notificationSchema);
