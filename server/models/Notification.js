const mongoose = require('mongoose');

// A Notification is a message sent to a user — e.g. "Your report was graded: A"
const notificationSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false }  // false = unread (shows red badge)
  },
  { timestamps: true }   // createdAt tells us when it was sent
);

module.exports = mongoose.model('Notification', notificationSchema);
