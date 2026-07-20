'use strict';
// backend/migrations/seedCouncilsSpecialties.js
// Seeds the authoritative Scientific-Council hierarchy from the Excel export
// (scratchpad/specialties_dump.txt): 20 councils → 67 specialties (34 main/رئيس +
// 33 precise/دقيق), with string codes. Idempotent — councils upsert by
// normalized Arabic name, specialties upsert by code.
//
// GATED exactly like migrations/reseedProfessionalData.js: DRY RUN by default
// (zero writes); apply ONLY with both flags:
//   DRY_RUN=false CONFIRM_SEED_SPECIALTIES=yes node backend/migrations/seedCouncilsSpecialties.js
//
// Reuses the shared ScientificCouncil model (adds nameEn; does not touch the
// consultant-memo council rows, which carry different names).
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ScientificCouncil = require('../models/ScientificCouncil');
const Specialty = require('../models/Specialty');
const { normalizeArabic } = require('../utils/arabic');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const CONFIRMED = process.env.CONFIRM_SEED_SPECIALTIES === 'yes';

// 20 Scientific Councils (Arabic name from the dump's council column + English).
// English names for councils without a same-named main specialty (Nursing,
// Oncology, Pathology) are standard translations of the field.
const COUNCILS = [
  { ar: 'اختصاصات التمريض والقبالة', en: 'Nursing and Midwifery' },
  { ar: 'الأذن والأنف والحنجرة والرأس والعنق وجراحتها', en: 'Otolaryngology and Head and Neck Surgery' },
  { ar: 'الأشعة والتصوير الطبي', en: 'Radiology and Medical Imaging' },
  { ar: 'الأمراض الباطنة', en: 'Internal Medicine' },
  { ar: 'الأمراض الجلدية والتناسلية', en: 'Dermatology and Venereology' },
  { ar: 'الأورام', en: 'Oncology' },
  { ar: 'التخدير والعناية المركزة', en: 'Anesthesia and Intensive Care' },
  { ar: 'الجراحة العامة', en: 'General Surgery' },
  { ar: 'الجراحة العصبية', en: 'Neurosurgery' },
  { ar: 'الطب النفسي', en: 'Psychiatry' },
  { ar: 'الولادة وأمراض النساء', en: 'Obstetrics and Gynecology' },
  { ar: 'جراحة العظام', en: 'Orthopedics' },
  { ar: 'جراحة الفم والوجه والفكين', en: 'Oral and Maxillofacial Surgery' },
  { ar: 'جراحة المسالك البولية', en: 'Urology' },
  { ar: 'طب الأسرة', en: 'Family Medicine' },
  { ar: 'طب الأطفال', en: 'Pediatrics' },
  { ar: 'طب الطوارئ', en: 'Emergency Medicine' },
  { ar: 'طب العيون وجراحتها', en: 'Ophthalmology' },
  { ar: 'طب المجتمع', en: 'Community Medicine' },
  { ar: 'علم الأمراض', en: 'Pathology' },
];

// 67 specialties: { councilAr, nameAr, nameEn, type, code }. type from رئيس→main,
// دقيق→precise. Council lookup is normalized, so hamza/ta-marbuta variants match.
const SPECIALTIES = [
  { councilAr: 'اختصاصات التمريض والقبالة', nameAr: 'تمريض الطوارئ والكوارث', nameEn: 'Emergency & Disaster Nursing', type: 'main', code: '30' },
  { councilAr: 'الأذن والأنف والحنجرة والرأس والعنق وجراحتها', nameAr: 'الأذن والأنف والحنجرة والرأس والعنق وجراحتها', nameEn: 'Otolaryngology and Head and Neck Surgery', type: 'main', code: '12' },
  { councilAr: 'الأشعة والتصوير الطبي', nameAr: 'الأشعة والتصوير الطبي', nameEn: 'Radiology and Medical Imaging', type: 'main', code: '17' },
  { councilAr: 'الأشعة والتصوير الطبي', nameAr: 'تصوير وتشخيص أمراض الثدي', nameEn: 'Breast Imaging', type: 'precise', code: '27' },
  { councilAr: 'الأشعة والتصوير الطبي', nameAr: 'أشعة العظام والعضلات', nameEn: 'Musculoskeletal Imaging', type: 'precise', code: '28' },
  { councilAr: 'الأشعة والتصوير الطبي', nameAr: 'أشعة الجملة العصبية والرأس والعنق', nameEn: 'Neuroradiology and Head & Neck Imaging', type: 'precise', code: '29' },
  { councilAr: 'الأشعة والتصوير الطبي', nameAr: 'التصوير الطبي للآفات الورمية', nameEn: 'Oncology Imaging', type: 'precise', code: '43' },
  { councilAr: 'الأشعة والتصوير الطبي', nameAr: 'الأشعة التداخلية', nameEn: 'Vascular & Interventional Radiology', type: 'precise', code: '44' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'الامراض الباطنة', nameEn: 'Internal Medicine', type: 'main', code: '02' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'أمراض القلب والأوعية الدموية', nameEn: 'Cardiovascular Diseases', type: 'precise', code: '07' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'أمراض الكلى', nameEn: 'Nephrology', type: 'precise', code: '18' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'أمراض الجهاز الهضمي والكبد', nameEn: 'Gastrointestinal Diseases', type: 'precise', code: '19' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'الأمراض العصبية', nameEn: 'Neurology', type: 'main', code: '40' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'أمراض السكري والغدد الصم والاستقلاب', nameEn: 'Diabetes, Endocrine and Metabolism', type: 'precise', code: '42' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'الأمراض المعدية', nameEn: 'Infectious Diseases', type: 'precise', code: '45' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'أمراض الجهاز التنفسي عند البالغين', nameEn: 'Adult Respiratory Medicine', type: 'precise', code: '53' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'الأمراض الرثوية', nameEn: 'Adult Rheumatology', type: 'precise', code: '56' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'أمراض الدم السريرية', nameEn: 'Clinical Hematology', type: 'main', code: '58' },
  { councilAr: 'الأمراض الباطنة', nameAr: 'الفسلجة العصبية السريرية', nameEn: 'Clinical Neurophysiology', type: 'main', code: '65' },
  { councilAr: 'الأمراض الجلدية والتناسلية', nameAr: 'الأمراض الجلدية والتناسلية', nameEn: 'Dermatology and Venereology', type: 'main', code: '10' },
  { councilAr: 'الأورام', nameAr: 'جراحة الأورام', nameEn: 'Surgical Oncology', type: 'precise', code: '41' },
  { councilAr: 'الأورام', nameAr: 'طب الأورام', nameEn: 'Medical Oncology', type: 'main', code: '57' },
  { councilAr: 'الأورام', nameAr: 'الطب النووي', nameEn: 'Nuclear Medicine', type: 'main', code: '62' },
  { councilAr: 'الأورام', nameAr: 'الطب التلطيفي', nameEn: 'Palliative Medicine', type: 'precise', code: '63' },
  { councilAr: 'الأورام', nameAr: 'الأشعة العلاجية', nameEn: 'Radiation Therapy', type: 'main', code: '64' },
  { councilAr: 'التخدير والعناية المركزة', nameAr: 'التخدير والعناية المركزة', nameEn: 'Anesthesia and Intensive Care', type: 'main', code: '09' },
  { councilAr: 'التخدير والعناية المركزة', nameAr: 'طب الألم', nameEn: 'Pain Medicine', type: 'precise', code: '46' },
  { councilAr: 'التخدير والعناية المركزة', nameAr: 'العناية المركزة عند البالغين', nameEn: 'Adult Critical Care Medicine', type: 'precise', code: '47' },
  { councilAr: 'الجراحة العامة', nameAr: 'الجراحة العامة', nameEn: 'General Surgery', type: 'main', code: '01' },
  { councilAr: 'الجراحة العامة', nameAr: 'جراحة الأطفال', nameEn: 'Pediatric Surgery', type: 'main', code: '15' },
  { councilAr: 'الجراحة العامة', nameAr: 'جراحة التجميل', nameEn: 'Plastic Surgery', type: 'main', code: '24' },
  { councilAr: 'الجراحة العامة', nameAr: 'جراحة القلب', nameEn: 'Cardiac Surgery', type: 'main', code: '25' },
  { councilAr: 'الجراحة العامة', nameAr: 'جراحة الأوعية الدموية', nameEn: 'Vascular Surgery', type: 'main', code: '54' },
  { councilAr: 'الجراحة العصبية', nameAr: 'الجراحة العصبية', nameEn: 'Neurosurgery', type: 'main', code: '13' },
  { councilAr: 'الطب النفسي', nameAr: 'الطب النفسي', nameEn: 'Psychiatry', type: 'main', code: '08' },
  { councilAr: 'الطب النفسي', nameAr: 'الطب النفسي عند الاطفال والمراهقين', nameEn: 'Child and Adolescent Psychiatry', type: 'precise', code: '26' },
  { councilAr: 'الطب النفسي', nameAr: 'الطب النفسي لكبار السن', nameEn: 'Geriatric Psychiatry', type: 'precise', code: '52' },
  { councilAr: 'الطب النفسي', nameAr: 'علاج الادمـان', nameEn: 'Addiction Psychiatry', type: 'precise', code: '59' },
  { councilAr: 'الولادة وأمراض النساء', nameAr: 'الولادة وامراض النساء', nameEn: 'Obstetrics and Gynecology', type: 'main', code: '03' },
  { councilAr: 'الولادة وأمراض النساء', nameAr: 'طب الإخصاب', nameEn: 'Fertility Medicine and Assisted Reproduction', type: 'precise', code: '60' },
  { councilAr: 'الولادة وأمراض النساء', nameAr: 'طب الأم والجنين', nameEn: 'Maternal-Fetal Medicine', type: 'precise', code: '61' },
  { councilAr: 'جراحة العظام', nameAr: 'جراحة العظام', nameEn: 'Orthopedics', type: 'main', code: '20' },
  { councilAr: 'جراحة الفم والوجه والفكين', nameAr: 'جراحة الفم والوجه والفكين', nameEn: 'Oral and Maxillofacial Surgery', type: 'main', code: '14' },
  { councilAr: 'جراحة المسالك البولية', nameAr: 'جراحة المسالك البولية', nameEn: 'Urology', type: 'main', code: '21' },
  { councilAr: 'جراحة المسالك البولية', nameAr: 'جراحة المسالك البولية للأطفال', nameEn: 'Pediatric Urology', type: 'precise', code: '55' },
  { councilAr: 'طب الأسرة', nameAr: 'طب الأسرة', nameEn: 'Family Medicine', type: 'main', code: '05' },
  { councilAr: 'طب الأسرة', nameAr: 'الدبلوم المهني لطب الأسرة', nameEn: 'Professional Diploma in Family Medicine', type: 'precise', code: '05d1' },
  { councilAr: 'طب الأطفال', nameAr: 'طب الأطفال', nameEn: 'Pediatrics', type: 'main', code: '04' },
  { councilAr: 'طب الأطفال', nameAr: 'العناية المركزة عند حديثي الولادة', nameEn: 'Pediatrics Neonatology', type: 'precise', code: '22' },
  { councilAr: 'طب الأطفال', nameAr: 'أمراض الكلى عند الاطفال', nameEn: 'Pediatric Nephrology', type: 'precise', code: '32' },
  { councilAr: 'طب الأطفال', nameAr: 'أمراض الجهاز الهضمي، الكبد والتغذية للأطفال', nameEn: 'Pediatric Gastroenterology, Hepatology and Nutrition', type: 'precise', code: '33' },
  { councilAr: 'طب الأطفال', nameAr: 'أمراض القلب عند الأطفال', nameEn: 'Pediatric Cardiology', type: 'precise', code: '34' },
  { councilAr: 'طب الأطفال', nameAr: 'أمراض الدم والاورام عند الاطفال', nameEn: 'Pediatric Hematology-Oncology', type: 'precise', code: '35' },
  { councilAr: 'طب الأطفال', nameAr: 'امراض الدماغ والاعصاب عند الاطفال', nameEn: 'Pediatric Neurology', type: 'precise', code: '36' },
  { councilAr: 'طب الأطفال', nameAr: 'الامراض التنفسية لدى الأطفال', nameEn: 'Pediatric Pulmonology', type: 'precise', code: '48' },
  { councilAr: 'طب الأطفال', nameAr: 'الأمراض المعدية لدى الاطفال', nameEn: 'Pediatric Infectious Disease', type: 'precise', code: '49' },
  { councilAr: 'طب الأطفال', nameAr: 'أمراض الغدد الصم لدى الأطفال', nameEn: 'Pediatric Endocrinology', type: 'precise', code: '50' },
  { councilAr: 'طب الطوارئ', nameAr: 'طب الطوارئ', nameEn: 'Emergency Medicine', type: 'main', code: '16' },
  { councilAr: 'طب الطوارئ', nameAr: 'طب طوارئ الأطفال', nameEn: 'Pediatric Emergency Medicine', type: 'precise', code: '51' },
  { councilAr: 'طب العيون وجراحتها', nameAr: 'طب العيون وجراحتها', nameEn: 'Ophthalmology', type: 'main', code: '11' },
  { councilAr: 'طب المجتمع', nameAr: 'طب المجتمع', nameEn: 'Community Medicine', type: 'main', code: '06' },
  { councilAr: 'علم الأمراض', nameAr: 'علم الامراض التشريحي', nameEn: 'Anatomic Pathology', type: 'main', code: '23' },
  { councilAr: 'علم الأمراض', nameAr: 'علم الأمراض السريري العام', nameEn: 'Clinical Pathology', type: 'main', code: '38' },
  { councilAr: 'علم الأمراض', nameAr: 'علم أمراض الدم (الطب المخبري)', nameEn: 'Hematology (Laboratory Medicine)', type: 'main', code: '39' },
  { councilAr: 'علم الأمراض', nameAr: 'علم الكيمياء الحيوية السريرية (الطب المخبري)', nameEn: 'Clinical biochemistry (Laboratory medicine)', type: 'main', code: '66' },
  { councilAr: 'علم الأمراض', nameAr: 'علم الاحياء الدقية (الطب المخبري)', nameEn: 'Microbiology (Laboratory medicine)', type: 'main', code: '67' },
  { councilAr: 'علم الأمراض', nameAr: 'علم نقل الدم (الطب المخبري)', nameEn: 'Transfusion medicine (Laboratory medicine)', type: 'main', code: '68' },
];

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required in backend/.env');
    process.exit(1);
  }
  if (!DRY_RUN && !CONFIRMED) {
    console.error('ERROR: Apply mode requires CONFIRM_SEED_SPECIALTIES=yes');
    console.error('Use: DRY_RUN=false CONFIRM_SEED_SPECIALTIES=yes node backend/migrations/seedCouncilsSpecialties.js');
    process.exit(1);
  }

  const mainCount = SPECIALTIES.filter(s => s.type === 'main').length;
  const preciseCount = SPECIALTIES.filter(s => s.type === 'precise').length;
  const distinctCouncils = new Set(SPECIALTIES.map(s => normalizeArabic(s.councilAr))).size;

  console.log(`Councils/Specialties seed. DRY_RUN=${DRY_RUN} CONFIRM_SEED_SPECIALTIES=${CONFIRMED}`);
  await mongoose.connect(process.env.MONGO_URI);

  // 1) Councils — upsert by normalized Arabic name.
  const councilIdByNorm = {};
  for (const c of COUNCILS) {
    const norm = normalizeArabic(c.ar);
    if (DRY_RUN) {
      const existing = await ScientificCouncil.findOne({ normalizedName: norm }).select('_id');
      councilIdByNorm[norm] = existing ? existing._id : null;
      console.log(`[DRY RUN] council upsert: ${c.ar} — ${c.en}${existing ? ' (exists)' : ' (new)'}`);
    } else {
      const doc = await ScientificCouncil.findOneAndUpdate(
        { normalizedName: norm },
        { $set: { name: c.ar, nameEn: c.en, isDefault: true }, $setOnInsert: { normalizedName: norm } },
        { upsert: true, new: true }
      );
      councilIdByNorm[norm] = doc._id;
      console.log(`[APPLY] council upsert: ${c.ar} — ${c.en}`);
    }
  }

  // 2) Specialties — upsert by code, linking councilId.
  let unmatched = 0;
  for (const s of SPECIALTIES) {
    const councilId = councilIdByNorm[normalizeArabic(s.councilAr)] || null;
    if (!councilId) unmatched++;
    if (DRY_RUN) {
      console.log(`[DRY RUN] specialty upsert: [${s.code}] ${s.nameEn} (${s.type})${councilId ? '' : ' — council pending'}`);
    } else {
      await Specialty.findOneAndUpdate(
        { code: s.code },
        { $set: { name: s.nameAr, nameEn: s.nameEn, type: s.type, councilId, code: s.code, track: 'advanced', isActive: true } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`[APPLY] specialty upsert: [${s.code}] ${s.nameEn}`);
    }
  }

  console.log('\n── Summary ──');
  console.log(`councils: ${COUNCILS.length}`);
  console.log(`specialties: ${SPECIALTIES.length} (main ${mainCount} / precise ${preciseCount})`);
  console.log(`distinct councils referenced by specialties: ${distinctCouncils}`);
  if (DRY_RUN && unmatched) {
    console.log(`(dry run) specialties whose council does not yet exist in the DB: ${unmatched} — they will be linked on apply.`);
  }
  if (!DRY_RUN) {
    console.log(`specialties with an unresolved council after apply: ${unmatched}`);
  }
  if (DRY_RUN) {
    console.log('\nDRY RUN — no writes performed. To apply:');
    console.log('  DRY_RUN=false CONFIRM_SEED_SPECIALTIES=yes node backend/migrations/seedCouncilsSpecialties.js');
  }

  await mongoose.disconnect();
}

// Only connect + seed when run directly; `require()` exposes the data for tests.
if (require.main === module) {
  main().catch(async err => {
    console.error('Councils/Specialties seed failed:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { COUNCILS, SPECIALTIES };
