// backend/seeds/countries.seed.js
//
// Seeds the 22 Arab League countries (source: "أسماء الدول العربية.xlsx"), in the
// exact order of that sheet's التسلسل (sequence) column, stored on `order` so the
// app ranks them identically. `name` is the short Arabic name (app default language
// is Arabic/RTL) and `code` is the ISO 3166-1 alpha-2 code.
//
// Idempotent & additive only — never deletes or renames:
//   • a country missing entirely is created with its name/code/order,
//   • a country that already exists (matched by code OR name) keeps its data but
//     has its `order` backfilled if it doesn't have one yet.
// Run:  node backend/seeds/countries.seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Country  = require('../models/Country');

// order = sheet sequence (التسلسل) · name = short Arabic · code = ISO alpha-2
const COUNTRIES = [
  { order: 1,  name: 'الأردن',      code: 'JO' },
  { order: 2,  name: 'الإمارات',    code: 'AE' },
  { order: 3,  name: 'البحرين',     code: 'BH' },
  { order: 4,  name: 'تونس',        code: 'TN' },
  { order: 5,  name: 'الجزائر',     code: 'DZ' },
  { order: 6,  name: 'جيبوتي',      code: 'DJ' },
  { order: 7,  name: 'السعودية',    code: 'SA' },
  { order: 8,  name: 'السودان',     code: 'SD' },
  { order: 9,  name: 'سوريا',       code: 'SY' },
  { order: 10, name: 'الصومال',     code: 'SO' },
  { order: 11, name: 'العراق',      code: 'IQ' },
  { order: 12, name: 'عُمان',       code: 'OM' },
  { order: 13, name: 'فلسطين',      code: 'PS' },
  { order: 14, name: 'قطر',         code: 'QA' },
  { order: 15, name: 'جزر القمر',   code: 'KM' },
  { order: 16, name: 'الكويت',      code: 'KW' },
  { order: 17, name: 'لبنان',       code: 'LB' },
  { order: 18, name: 'ليبيا',       code: 'LY' },
  { order: 19, name: 'مصر',         code: 'EG' },
  { order: 20, name: 'المغرب',      code: 'MA' },
  { order: 21, name: 'موريتانيا',   code: 'MR' },
  { order: 22, name: 'اليمن',       code: 'YE' },
];

async function seed() {
  let created = 0, updated = 0, skipped = 0;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    for (const { order, name, code } of COUNTRIES) {
      const existing = await Country.findOne({ $or: [{ code }, { name }] }).select('_id order');
      if (!existing) {
        await Country.create({ name, code, order, isActive: true });
        console.log(`✅ Created: ${order}. ${name} / ${code}`);
        created++;
      } else if (existing.order == null || existing.order === 9999) {
        await Country.updateOne({ _id: existing._id }, { $set: { order } });
        console.log(`↻  Ranked existing: ${order}. ${name} / ${code}`);
        updated++;
      } else {
        console.log(`⏭  Skipped (exists, ranked): ${name} / ${code}`);
        skipped++;
      }
    }

    console.log(`✅ Countries seed complete — created ${created}, ranked ${updated}, skipped ${skipped}, total ${COUNTRIES.length}`);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
}

seed();
