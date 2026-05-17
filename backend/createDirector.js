// One-time script to add a director user.
// Run from the server/ folder: node createDirector.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: 'director@medlearn.com' });
  if (existing) {
    await User.deleteOne({ email: 'director@medlearn.com' });
    console.log('Removed old director entry.');
  }

  await User.create({
    name:     'Director',
    email:    'director@medlearn.com',
    password: '123456',
    role:     'director',
    gender:   '',
    city:     '',
    phone:    '',
    photoUrl: '',
    locked:   false,
  });

  console.log('Director user created.');
  console.log('  Email:    director@medlearn.com');
  console.log('  Password: 123456');

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
