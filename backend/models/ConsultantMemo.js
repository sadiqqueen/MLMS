const mongoose = require('mongoose');

// A ConsultantMemo is the DIO's "استمارة العرض على المجلس العلمي الاستشاري"
// submission form. Each content section carries its own manually-set
// date/time. `status: 'draft'` (مسودة) is the pre-delete stage of the
// two-stage delete flow — permanent deletion is only allowed on drafts.
const consultantMemoSchema = new mongoose.Schema(
  {
    topicName:     { type: String, default: '' },   // اسم الموضوع
    source:        { type: String, default: '' },   // المصدر
    topicDateTime: { type: Date, default: null },

    attachments:         { type: [String], default: ['', ''] },  // المرفقات (text rows)
    attachmentFiles:     {                                       // uploaded files (pdf/doc/…)
      // name = original (display) filename, UTF-8; the file on disk is
      // always saved under the generated `fileId`, never the user's name.
      type: [{
        _id: false,
        name: String,
        url: String,
        fileId: String,
        mimeType: String,
        size: Number,
        uploadedAt: Date,
      }],
      default: [],
    },
    attachmentsDateTime: { type: Date, default: null },

    presentation:         { type: String, default: '' },         // العرض
    presentationDateTime: { type: Date, default: null },

    executiveCommittee:         { type: String, default: '' },   // اللجنة التنفيذية
    executiveCommitteeDateTime: { type: Date, default: null },

    presidentRecommendation:         { type: String, default: '' },  // توصية معالي رئيس المجلس
    presidentRecommendationDateTime: { type: Date, default: null },

    jointCouncil:         { type: String, default: '' },         // المجلس العلمي الاستشاري المشترك
    jointCouncilDateTime: { type: Date, default: null },

    status:         { type: String, enum: ['saved', 'draft'], default: 'saved', index: true },
    movedToDraftAt: { type: Date, default: null },

    memoNumber: { type: String, default: '' },  // auto-generated sequential, e.g. "2026/014"
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'consultant_memos' }
);

module.exports = mongoose.model('ConsultantMemo', consultantMemoSchema);
