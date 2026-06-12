const mongoose = require('mongoose');

// A ConsultantMemo mirrors the official paper form
// "استمارة العرض على المجلس العلمي الاستشاري" filled in by the DIO.
// Two-cell input rows are stored as { right, left } to match the
// form's 72% / 28% column split.
const consultantMemoSchema = new mongoose.Schema(
  {
    topicName:    { type: String, default: '' },   // اسم الموضوع column (rows under the header)
    source:       { type: String, default: '' },   // المصدر column
    attachments:  { type: [String], default: ['', ''] },  // المرفقات — one entry per input row
    presentation: { type: String, default: '' },   // العرض — large free-text area

    executiveCommittee: {                          // اللجنة التنفيذية للمجلس العلمي الاستشاري
      right: { type: String, default: '' },
      left:  { type: String, default: '' },
    },
    presidentRecommendation: {                     // توصية معالي رئيس المجلس الاستشاري
      right: { type: String, default: '' },
      left:  { type: String, default: '' },
    },
    jointCouncil: {                                // المجلس العلمي الاستشاري المشترك
      right: { type: String, default: '' },
      left:  { type: String, default: '' },
    },
  },
  { timestamps: true, collection: 'consultant_memos' }
);

module.exports = mongoose.model('ConsultantMemo', consultantMemoSchema);
