require('dotenv').config();
const { MongoClient } = require('mongodb');

const LOCAL_URI   = 'mongodb://localhost:27017/medlearn';
const RAILWAY_URI = 'mongodb://mongo:piYMSBSgCJbhOqUtlVEGFbeBFBXPimOh@shinkansen.proxy.rlwy.net:52913/medlearn?authSource=admin';

const COLLECTIONS = [
  'users', 'hospitals', 'universities', 'rotations',
  'distributions', 'evaluations', 'certificates', 'notifications', 'reports'
];

async function sync() {
  const local   = new MongoClient(LOCAL_URI);
  const railway = new MongoClient(RAILWAY_URI);

  try {
    console.log('Connecting to local MongoDB...');
    await local.connect();
    console.log('Connecting to Railway MongoDB...');
    await railway.connect();
    console.log('Both connected.\n');

    const localDb   = local.db('medlearn');
    const railwayDb = railway.db('medlearn');

    for (const col of COLLECTIONS) {
      const docs = await localDb.collection(col).find({}).toArray();

      if (docs.length === 0) {
        console.log(`${col}: 0 documents locally — skipped`);
        continue;
      }

      await railwayDb.collection(col).deleteMany({});
      await railwayDb.collection(col).insertMany(docs);
      console.log(`${col}: synced ${docs.length} documents`);
    }

    console.log('\nSync complete.');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await local.close();
    await railway.close();
  }
}

sync();
