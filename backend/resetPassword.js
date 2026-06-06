require('dotenv').config();
const readline = require('readline');

const TARGET_EMAIL = process.env.RESET_PASSWORD_USER_EMAIL;
const NEW_PASSWORD = process.env.RESET_PASSWORD_NEW_PASSWORD;
const CONFIRMED = process.env.CONFIRM_RESET_PASSWORD === 'true';

if (!TARGET_EMAIL) {
  console.error('ERROR: RESET_PASSWORD_USER_EMAIL is required.');
  process.exit(1);
}
if (!NEW_PASSWORD || NEW_PASSWORD.length < 12) {
  console.error('ERROR: RESET_PASSWORD_NEW_PASSWORD is required and must be at least 12 characters.');
  process.exit(1);
}
if (!CONFIRMED) {
  console.error('ERROR: CONFIRM_RESET_PASSWORD=true is required.');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.error('ERROR: MONGO_URI is required.');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Type CONFIRM to reset the specified user password: ', async (answer) => {
  if (answer !== 'CONFIRM') {
    console.log('Aborted.');
    process.exit(0);
  }
  rl.close();

  const mongoose = require('mongoose');
  const bcrypt = require('bcryptjs');
  const User = require('./models/User');

  await mongoose.connect(process.env.MONGO_URI);
  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  const result = await User.updateOne({ email: TARGET_EMAIL.toLowerCase() }, { password: hash });
  if (result.matchedCount === 0) {
    console.error('No matching user found.');
  } else {
    console.log('Password reset complete for one user.');
  }
  await mongoose.disconnect();
  process.exit(0);
});
