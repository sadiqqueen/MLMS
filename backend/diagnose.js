require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const admin = mongoose.connection.db.admin();

  // List all databases
  const { databases } = await admin.listDatabases();
  console.log('\n=== Databases on this MongoDB ===');
  databases.forEach(db => console.log(' -', db.name, `(${db.sizeOnDisk} bytes)`));

  // Check each non-system database for a users collection
  for (const db of databases) {
    if (['admin', 'local', 'config'].includes(db.name)) continue;
    const conn = mongoose.connection.useDb(db.name);
    const collections = await conn.db.listCollections().toArray();
    const hasUsers = collections.some(c => c.name === 'users');
    if (hasUsers) {
      const users = await conn.db.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
      console.log(`\n=== Users in database "${db.name}" ===`);
      users.forEach(u => console.log(` - ${u.email} (${u.role})`));
    }
  }

  process.exit();
}).catch(err => {
  console.error('Connection failed:', err.message);
  process.exit(1);
});
