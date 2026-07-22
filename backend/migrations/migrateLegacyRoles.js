require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');

const ROLE_MIGRATIONS = {
  doctor: 'trainer',
  student: 'trainee',
  director: 'president',
  admin: 'developer',
};

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const professorCount = await User.countDocuments({ role: 'professor' });
  if (professorCount > 0) {
    console.error(`STOP: Found ${professorCount} user(s) with legacy role "professor".`);
    console.error('Review these accounts and manually choose the correct V2 role before rerunning.');
    const professors = await User.find({ role: 'professor' }).select('name email role').lean();
    professors.forEach(user => console.error(`- ${user.email} (${user.name})`));
    await mongoose.disconnect();
    process.exit(1);
  }

  for (const [fromRole, toRole] of Object.entries(ROLE_MIGRATIONS)) {
    const result = await User.updateMany({ role: fromRole }, { $set: { role: toRole } });
    console.log(`${fromRole} -> ${toRole}: ${result.modifiedCount || 0} user(s) updated`);
  }

  await mongoose.disconnect();
  console.log('Legacy role migration complete.');
}

main().catch(async err => {
  console.error('Legacy role migration failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
