// backend/seeds/countries.seed.js
//
// Seeds the 22 Arab League countries (source: "أسماء الدول العربية.xlsx"), with
// every column the add-country form now collects:
//   order          → التسلسل (sheet sequence, also the display rank)
//   officialNameAr → الاسم الرسمي بالعربية
//   shortNameAr    → الاسم المختصر بالعربية  (also mirrored to `name`)
//   officialNameEn → الاسم الرسمي بالإنجليزية
//   shortNameEn    → الاسم المختصر بالإنجليزية
//   code           → ISO 3166-1 alpha-2 (kept for display; the sheet has no code)
//
// Idempotent & additive only — never deletes or renames. A country missing
// entirely is created; a country that already exists (matched by code OR short
// Arabic name) keeps its data but has any MISSING field backfilled, so rows
// created by the earlier name+code+order seed gain the four name fields.
// Run:  node backend/seeds/countries.seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Country  = require('../models/Country');

const COUNTRIES = [
  { order: 1,  officialNameAr: 'المملكة الأردنية الهاشمية',              shortNameAr: 'الأردن',    officialNameEn: 'Hashemite Kingdom of Jordan',           shortNameEn: 'Jordan',       code: 'JO' },
  { order: 2,  officialNameAr: 'دولة الإمارات العربية المتحدة',          shortNameAr: 'الإمارات',  officialNameEn: 'United Arab Emirates',                  shortNameEn: 'UAE',          code: 'AE' },
  { order: 3,  officialNameAr: 'مملكة البحرين',                          shortNameAr: 'البحرين',   officialNameEn: 'Kingdom of Bahrain',                    shortNameEn: 'Bahrain',      code: 'BH' },
  { order: 4,  officialNameAr: 'الجمهورية التونسية',                     shortNameAr: 'تونس',      officialNameEn: 'Republic of Tunisia',                   shortNameEn: 'Tunisia',      code: 'TN' },
  { order: 5,  officialNameAr: 'الجمهورية الجزائرية الديمقراطية الشعبية', shortNameAr: 'الجزائر',   officialNameEn: "People's Democratic Republic of Algeria", shortNameEn: 'Algeria',    code: 'DZ' },
  { order: 6,  officialNameAr: 'جمهورية جيبوتي',                         shortNameAr: 'جيبوتي',    officialNameEn: 'Republic of Djibouti',                  shortNameEn: 'Djibouti',     code: 'DJ' },
  { order: 7,  officialNameAr: 'المملكة العربية السعودية',              shortNameAr: 'السعودية',  officialNameEn: 'Kingdom of Saudi Arabia',               shortNameEn: 'Saudi Arabia', code: 'SA' },
  { order: 8,  officialNameAr: 'جمهورية السودان',                        shortNameAr: 'السودان',   officialNameEn: 'Republic of Sudan',                     shortNameEn: 'Sudan',        code: 'SD' },
  { order: 9,  officialNameAr: 'الجمهورية العربية السورية',             shortNameAr: 'سوريا',     officialNameEn: 'Syrian Arab Republic',                  shortNameEn: 'Syria',        code: 'SY' },
  { order: 10, officialNameAr: 'جمهورية الصومال الفيدرالية',            shortNameAr: 'الصومال',   officialNameEn: 'Federal Republic of Somalia',           shortNameEn: 'Somalia',      code: 'SO' },
  { order: 11, officialNameAr: 'جمهورية العراق',                         shortNameAr: 'العراق',    officialNameEn: 'Republic of Iraq',                      shortNameEn: 'Iraq',         code: 'IQ' },
  { order: 12, officialNameAr: 'سلطنة عُمان',                            shortNameAr: 'عُمان',     officialNameEn: 'Sultanate of Oman',                     shortNameEn: 'Oman',         code: 'OM' },
  { order: 13, officialNameAr: 'دولة فلسطين',                           shortNameAr: 'فلسطين',    officialNameEn: 'State of Palestine',                    shortNameEn: 'Palestine',    code: 'PS' },
  { order: 14, officialNameAr: 'دولة قطر',                              shortNameAr: 'قطر',       officialNameEn: 'State of Qatar',                        shortNameEn: 'Qatar',        code: 'QA' },
  { order: 15, officialNameAr: 'جمهورية القمر المتحدة',                 shortNameAr: 'جزر القمر', officialNameEn: 'Federal Republic of Comoros',           shortNameEn: 'Comoros',      code: 'KM' },
  { order: 16, officialNameAr: 'دولة الكويت',                           shortNameAr: 'الكويت',    officialNameEn: 'State of Kuwait',                       shortNameEn: 'Kuwait',       code: 'KW' },
  { order: 17, officialNameAr: 'الجمهورية اللبنانية',                    shortNameAr: 'لبنان',     officialNameEn: 'Lebanese Republic',                     shortNameEn: 'Lebanon',      code: 'LB' },
  { order: 18, officialNameAr: 'دولة ليبيا',                            shortNameAr: 'ليبيا',     officialNameEn: 'State of Libya',                        shortNameEn: 'Libya',        code: 'LY' },
  { order: 19, officialNameAr: 'جمهورية مصر العربية',                   shortNameAr: 'مصر',       officialNameEn: 'Arab Republic of Egypt',                shortNameEn: 'Egypt',        code: 'EG' },
  { order: 20, officialNameAr: 'المملكة المغربية',                      shortNameAr: 'المغرب',    officialNameEn: 'Kingdom of Morocco',                    shortNameEn: 'Morocco',      code: 'MA' },
  { order: 21, officialNameAr: 'الجمهورية الإسلامية الموريتانية',        shortNameAr: 'موريتانيا', officialNameEn: 'Islamic Republic of Mauritania',        shortNameEn: 'Mauritania',   code: 'MR' },
  { order: 22, officialNameAr: 'الجمهورية اليمنية',                      shortNameAr: 'اليمن',     officialNameEn: 'Republic of Yemen',                     shortNameEn: 'Yemen',        code: 'YE' },
];

async function seed() {
  let created = 0, updated = 0, skipped = 0;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    for (const c of COUNTRIES) {
      const { order, officialNameAr, shortNameAr, officialNameEn, shortNameEn, code } = c;
      const existing = await Country.findOne({ $or: [{ code }, { name: shortNameAr }, { shortNameAr }] });

      if (!existing) {
        await Country.create({ order, officialNameAr, shortNameAr, officialNameEn, shortNameEn, name: shortNameAr, code, isActive: true });
        console.log(`✅ Created: ${order}. ${shortNameAr} / ${code}`);
        created++;
      } else {
        const set = {};
        if (!existing.officialNameAr) set.officialNameAr = officialNameAr;
        if (!existing.shortNameAr)    set.shortNameAr    = shortNameAr;
        if (!existing.officialNameEn) set.officialNameEn = officialNameEn;
        if (!existing.shortNameEn)    set.shortNameEn    = shortNameEn;
        if (!existing.name)           set.name           = shortNameAr;
        if (!existing.code && code)   set.code           = code;
        if (existing.order == null || existing.order === 9999) set.order = order;

        if (Object.keys(set).length) {
          await Country.updateOne({ _id: existing._id }, { $set: set });
          console.log(`↻  Backfilled: ${order}. ${shortNameAr} (${Object.keys(set).join(', ')})`);
          updated++;
        } else {
          console.log(`⏭  Skipped (complete): ${shortNameAr}`);
          skipped++;
        }
      }
    }

    console.log(`✅ Countries seed complete — created ${created}, backfilled ${updated}, skipped ${skipped}, total ${COUNTRIES.length}`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

seed();
