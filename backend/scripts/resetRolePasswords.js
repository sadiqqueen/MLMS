// Bulk-set password to 123456 for selected roles.
// DRY-RUN by default. Apply with:  CONFIRM=YES node backend/scripts/resetRolePasswords.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
if (!process.env.MONGO_URI) require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');

const ROLES = ['trainee', 'trainer', 'program_director', 'odio', 'secretary', 'asg1', 'asg2', 'developer'];
const NEW_PASSWORD = '123456';
const APPLY = process.env.CONFIRM === 'YES';

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const filter = { role: { $in: ROLES } };

  console.log('\nMode:', APPLY ? 'APPLY (will write)' : 'DRY-RUN (no changes)');
  console.log('Target password: ' + NEW_PASSWORD + '\n');

  let total = 0;
  for (const role of ROLES) {
    const c = await User.countDocuments({ role });
    total += c;
    console.log(`  ${role.padEnd(18)} ${c}`);
  }
  console.log(`  ${'TOTAL'.padEnd(18)} ${total}\n`);

  if (!APPLY) {
    console.log('Dry-run only. Re-run with CONFIRM=YES to apply.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const hashed = await bcrypt.hash(NEW_PASSWORD, 12);
  const res = await User.updateMany(filter, {
    $set: { password: hashed },
    $unset: { loginAttempts: '', lockUntil: '' }, // clear any lockouts too
  });
  console.log('Matched:', res.matchedCount, ' Modified:', res.modifiedCount);
  console.log('✅ Done. All listed roles now use password: ' + NEW_PASSWORD);

  await mongoose.disconnect();
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
