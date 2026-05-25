// backend/seeds/specialties.seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose  = require('mongoose');
const Specialty = require('../models/Specialty');

const SPECIALTIES = [
  'Internal Medicine',
  'Surgery',
  'Pediatrics',
  'Obstetrics & Gynecology',
  'Emergency Medicine'
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    for (const name of SPECIALTIES) {
      const existing = await Specialty.findOne({ name });
      if (existing) {
        console.log(`⏭  Specialty already exists: ${name}`);
      } else {
        await Specialty.create({ name, isActive: true });
        console.log(`✅ Created specialty: ${name}`);
      }
    }

    console.log('✅ Specialties seed complete');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
