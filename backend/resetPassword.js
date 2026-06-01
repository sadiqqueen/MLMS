require('dotenv').config();
const readline = require('readline');

const NEW_PASSWORD = process.argv[2];
if (!NEW_PASSWORD || NEW_PASSWORD.length < 12) {
  console.error('ERROR: Pass a strong password (12+ chars) as first argument');
  console.error('Usage: node resetPassword.js "MyNewPassword123!"');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(`Type CONFIRM to reset ALL passwords to "${NEW_PASSWORD}": `, async (answer) => {
  if (answer !== 'CONFIRM') {
    console.log('Aborted.');
    process.exit(0);
  }
  rl.close();

  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const User = require('./models/User');

  await mongoose.connect(process.env.MONGO_URI);
  const hash = await bcrypt.hash(NEW_PASSWORD, 10);
  const result = await User.updateMany({}, { password: hash });
  console.log(`Reset ${result.modifiedCount} passwords.`);
  await mongoose.disconnect();
  process.exit(0);
});
