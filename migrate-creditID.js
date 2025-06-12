// migrate-creditID.js
require('dotenv').config();
const mongoose = require('mongoose');
const { userModel } = require('./models/user'); 

async function cleanNullCreditIDs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('🚀 Connected to MongoDB');
    
    // Find all users with creditID: null
    const users = await userModel.find({ creditID: null });
    console.log(`🔍 Found ${users.length} users with null creditID`);
    
    // Convert null to undefined
    for (const user of users) {
      user.creditID = undefined; // Convert to undefined
      await user.save();
    }
    
    console.log(`✅ Successfully cleaned ${users.length} records`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

cleanNullCreditIDs();