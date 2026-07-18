// backend/models/Announcement.js
// A program announcement authored by a Program Director. Posting fans out a
// Notification (category 'announcement') to the program's active trainees and
// trainers (see routes/announcements.js).
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
    authorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:     { type: String, required: true, trim: true },
    body:      { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Announcement', announcementSchema);
