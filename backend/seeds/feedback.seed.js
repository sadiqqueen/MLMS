// backend/seeds/feedback.seed.js
// Seeds the AMETI CPD Activity Evaluation as an Event Feedback form and publishes
// v1. Bilingual (EN/AR) content is lifted from the approved design handoff so the
// seeded form reproduces the mobile design 1:1. Idempotent: re-running is a no-op
// once a seed form exists.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const FeedbackForm        = require('../models/FeedbackForm');
const FeedbackFormVersion = require('../models/FeedbackFormVersion');

// ── field builders ─────────────────────────────────────────────────────────
const SEC = {
  details:   { en: 'Activity details',            ar: 'تفاصيل النشاط' },
  mode:      { en: 'Mode of delivery',            ar: 'طريقة التقديم' },
  s1:        { en: 'Relevance & Objectives',      ar: 'الملاءمة والأهداف' },
  s2:        { en: 'Content Quality',             ar: 'جودة المحتوى' },
  s3:        { en: 'Delivery & Facilitation',     ar: 'التقديم والتيسير' },
  s4:        { en: 'Learning Environment',        ar: 'بيئة التعلّم' },
  s5:        { en: 'Outcomes & Impact',           ar: 'النتائج والأثر' },
  overall:   { en: 'Overall rating',              ar: 'التقييم العام' },
  comments:  { en: 'Comments',                    ar: 'ملاحظات' },
  reflection:{ en: 'Practice change reflection',  ar: 'التأمل في تغيير الممارسة' },
};

const text = (id, sec, label, labelAr, extra = {}) => ({
  id, type: 'short_text', section: sec.en, sectionAr: sec.ar, label, labelAr,
  required: !!extra.required, ...extra,
});
const longText = (id, sec, label, labelAr, extra = {}) => ({
  id, type: 'long_text', section: sec.en, sectionAr: sec.ar, label, labelAr,
  placeholder: 'Type your answer…', required: false, ...extra,
});
const rating = (id, sec, label, labelAr) => ({
  id, type: 'rating', section: sec.en, sectionAr: sec.ar, label, labelAr, required: true,
  rating: { min: 1, max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree', style: 'emoji' },
});
const yesNo = (id, sec, label, labelAr) => ({
  id, type: 'yes_no', section: sec.en, sectionAr: sec.ar, label, labelAr, required: false,
});

const FIELDS = [
  // Section A — Activity details
  // Title of activity / Date / Facilitator(s) are NOT attendee questions — they
  // are admin-set per-event metadata (FeedbackEvent.title/date/facilitators),
  // entered in the web "New event" dialog and shown read-only in the app. They
  // were removed here so attendees don't re-enter them.
  text('location',    SEC.details, 'Location / Platform', 'المكان / المنصة'),
  text('participant', SEC.details, 'Participant name', 'اسم المشارك'),   // optional
  text('linked',      SEC.details, 'Linked event', 'الفعالية المرتبطة'),

  // Section B — Mode of delivery
  {
    id: 'mode', type: 'single_choice', section: SEC.mode.en, sectionAr: SEC.mode.ar,
    label: 'How was this activity delivered?', labelAr: 'كيف قُدِّم هذا النشاط؟', required: false,
    options: [
      { id: 'in_person',   value: 'in_person',   label: 'In-person',     labelAr: 'حضوري' },
      { id: 'online_live', value: 'online_live', label: 'Online (live)', labelAr: 'عبر الإنترنت (مباشر)' },
      { id: 'recorded',    value: 'recorded',    label: 'Recorded',      labelAr: 'مسجّل' },
      { id: 'blended',     value: 'blended',     label: 'Blended',       labelAr: 'مدمج' },
      { id: 'other',       value: 'other',       label: 'Other',         labelAr: 'أخرى' },
    ],
  },

  // Sections 1–5 — the 16 Likert statements
  rating('s1a', SEC.s1, 'The objectives of the activity were clearly stated', 'كانت أهداف النشاط محددة بوضوح'),
  rating('s1b', SEC.s1, 'The activity was relevant to my clinical practice', 'كان النشاط ذا صلة بممارستي السريرية'),
  rating('s1c', SEC.s1, 'The content met my learning needs', 'لبّى المحتوى احتياجاتي التعليمية'),

  rating('s2a', SEC.s2, 'The content was evidence-based and up to date', 'كان المحتوى قائمًا على الأدلة وحديثًا'),
  rating('s2b', SEC.s2, 'The material was well-organized and structured', 'كانت المادة منظمة ومهيكلة جيدًا'),
  rating('s2c', SEC.s2, 'The depth of content was appropriate', 'كان عمق المحتوى مناسبًا'),

  rating('s3a', SEC.s3, 'The presenter communicated clearly', 'تواصل المُقدِّم بوضوح'),
  rating('s3b', SEC.s3, 'The presenter engaged participants effectively', 'أشرك المُقدِّم المشاركين بفعالية'),
  rating('s3c', SEC.s3, 'Teaching methods (lecture, discussion, cases) were appropriate', 'كانت أساليب التدريس (محاضرة، نقاش، حالات) مناسبة'),

  rating('s4a', SEC.s4, 'The environment / platform supported learning', 'دعمت البيئة / المنصة عملية التعلّم'),
  rating('s4b', SEC.s4, 'The activity was well-organized', 'كان النشاط منظمًا جيدًا'),
  rating('s4c', SEC.s4, 'Time was managed effectively', 'تمت إدارة الوقت بفعالية'),

  rating('s5a', SEC.s5, 'I gained new knowledge and skills', 'اكتسبت معارف ومهارات جديدة'),
  rating('s5b', SEC.s5, 'This activity will improve my clinical practice', 'سيُحسّن هذا النشاط ممارستي السريرية'),
  rating('s5c', SEC.s5, 'I feel confident applying what I learned', 'أشعر بالثقة في تطبيق ما تعلمته'),

  // Overall
  rating('ov', SEC.overall, 'Overall, I am satisfied with this CPD activity', 'بشكل عام، أنا راضٍ عن هذا النشاط للتطوير المهني المستمر'),

  // Section C — Comments
  longText('c_valuable', SEC.comments, 'What did you find most valuable?', 'ما الذي وجدته الأكثر قيمة؟'),
  longText('c_improve',  SEC.comments, 'What could be improved?', 'ما الذي يمكن تحسينه؟'),
  longText('c_suggest',  SEC.comments, 'Suggestions for future CPD activities', 'اقتراحات لأنشطة تطوير مهني مستقبلية'),

  // Section D — Practice change reflection (with conditional reveals)
  yesNo('reflect_q1', SEC.reflection, 'Do you plan to change your practice based on this activity?', 'هل تخطط لتغيير ممارستك بناءً على هذا النشاط؟'),
  longText('reflect_desc', SEC.reflection, 'If yes, please describe', 'إذا كانت الإجابة نعم، يُرجى الوصف',
    { showIf: { fieldId: 'reflect_q1', op: 'equals', value: 'yes' } }),
  yesNo('reflect_q2', SEC.reflection, 'Would you like further materials or future activity announcements?', 'هل ترغب في مواد إضافية أو إعلانات عن الأنشطة المستقبلية؟'),
  {
    id: 'reflect_email', type: 'email', section: SEC.reflection.en, sectionAr: SEC.reflection.ar,
    label: 'If yes, your email', labelAr: 'إذا كانت الإجابة نعم، بريدك الإلكتروني', placeholder: 'name@example.com',
    required: false, showIf: { fieldId: 'reflect_q2', op: 'equals', value: 'yes' },
  },
];

const SEED = {
  title: 'Activity Evaluation',
  titleAr: 'تقييم النشاط',
  description: 'This survey gathers feedback on the educational activity organized by AMETI. Your responses are confidential and highly appreciated. Please complete it right after attending — your feedback helps us evaluate session quality and continuously improve the learning experience.',
  descriptionAr: 'يجمع هذا الاستبيان ملاحظاتك حول النشاط التعليمي الذي نظّمته أكاديمية AMETI. إجاباتك سرّية ومحل تقدير كبير. يُرجى إكماله مباشرة بعد الحضور — فملاحظاتك تساعدنا في تقييم جودة الجلسات وتحسين تجربة التعلّم باستمرار.',
  brand: { primary: '#F0892B', secondary: '#4C94D8' },
  footer: { org: 'Qimam Foundation', email: 'cpd@ksb-med.org', ref: 'CPDEF.V2-2020' },
  fields: FIELDS,
  isSeed: true,
};

async function seed() {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI not set (checked backend/.env and repo .env)');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await FeedbackForm.findOne({ isSeed: true });
    if (existing) {
      console.log(`⏭  Seed form already exists (id ${existing._id}, status ${existing.status}, v${existing.version}) — skipping.`);
      return;
    }

    const form = await FeedbackForm.create({ ...SEED, status: 'draft', version: 0 });
    await FeedbackFormVersion.create({
      formId: form._id, version: 1,
      title: form.title, titleAr: form.titleAr,
      description: form.description, descriptionAr: form.descriptionAr,
      fields: form.fields, brand: form.brand, footer: form.footer,
      publishedAt: new Date(),
    });
    form.version = 1;
    form.status = 'published';
    await form.save();

    console.log(`✅ Seeded & published "${form.title}" (id ${form._id}, ${form.fields.length} fields, v1).`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

if (require.main === module) seed();

module.exports = { SEED, FIELDS, seed };
