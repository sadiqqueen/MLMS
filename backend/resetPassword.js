require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const hash = await bcrypt.hash('Admin123!', 12);
  await User.updateOne(
    { email: 'superadmin@medlearn.com' },
    { $set: { password: hash } }
  );
  console.log('Password reset done!');
  process.exit();
});
