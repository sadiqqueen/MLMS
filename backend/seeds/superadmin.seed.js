// backend/seeds/superadmin.seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const email = process.env.SUPERADMIN_EMAIL || 'admin@mtms.com';

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.log(`⏭  Super admin already exists: ${email}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    const password = process.env.SUPERADMIN_PASSWORD;
    if (!password || password.length < 12) {
      console.error('ERROR: Set SUPERADMIN_PASSWORD to a strong password (12+ chars) before creating a super admin.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Build initials from email prefix
    const namePart = email.split('@')[0];
    const initials = namePart.slice(0, 2).toUpperCase();

    await User.create({
      name:          'Super Admin',
      email:         email.toLowerCase(),
      password:      password, // pre-save hook will hash it
      role:          'developer',
      initials,
      isActive:      true,
      loginAttempts: 0
    });

    console.log(`✅ Super admin created: ${email}`);
    console.log('   Password was read from SUPERADMIN_PASSWORD.');
    console.log('   ⚠️  Change this password after first login!');

  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
