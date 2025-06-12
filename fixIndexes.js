require('dotenv').config();
const mongoose = require('mongoose');
const { userModel } = require('./models/user');

async function fixIndexes() {
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.db.collection('users');

  try {
    // Remove old index if exists
    await collection.dropIndex("creditID_1");
    console.log('Dropped old index');
  } catch (e) {
    if (e.code !== 27) console.error('Drop error:', e); // Ignore "not found"
  }

  // Create new index with explicit name
  await collection.createIndex(
    { creditID: 1 },
    {
      name: "creditID_unique_partial",
      unique: true,
      partialFilterExpression: { creditID: { $type: "string" } }
    }
  );
  console.log('Created new index');
  process.exit();
}

fixIndexes();