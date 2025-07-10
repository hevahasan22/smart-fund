require('dotenv').config();
const mongoose = require('mongoose');
const { typetermModel } = require('./models/typeterm');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Rebuilding indexes...');
    await typetermModel.syncIndexes();
    console.log('Indexes rebuilt successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();