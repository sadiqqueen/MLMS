require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./models/User');

const NEW_PASSWORD = '123456';

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const hash  = await bcrypt.hash(NEW_PASSWORD, 12);
  const users = await User.find({}, 'email role').lean();

  if (users.length === 0) {
    console.log('No users found in the database.');
    return process.exit();
  }

  await User.updateMany({}, { $set: { password: hash } });

  console.log(`\nReset ${users.length} user(s) to password: ${NEW_PASSWORD}\n`);
  users.forEach(u => console.log(`  [${u.role.padEnd(11)}] ${u.email}`));
  console.log('');
  process.exit();
}).catch(err => { console.error('Connection failed:', err.message); process.exit(1); });
