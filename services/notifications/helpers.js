const mongoose = require('mongoose');
const { User } = require('../../models/user');
const { transporter } = require('./email');

async function createInAppNotification(userId, type, message, contractId = null) {
  try {
    console.log('Creating notification:', { userId, type, message, contractId });
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found for notification:', userId);
      return;
    }
    
    const result = await User.findByIdAndUpdate(userId, {
      $push: {
        notifications: {
          _id: new mongoose.Types.ObjectId(),
          type,
          message,
          contractId: contractId ? new mongoose.Types.ObjectId(contractId) : null,
          createdAt: new Date(),
          isRead: false
        }
      }
    });
    console.log('Notification creation result:', result ? 'Success' : 'Failed');
    
    // Verify the notification was added
    const updatedUser = await User.findById(userId).select('notifications');
    console.log('Total notifications after creation:', updatedUser?.notifications?.length || 0);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

async function sendEmail(userId, subject, html) {
  try {
    if (!subject || !html || !transporter) return false;
    const user = await User.findById(userId);
    if (!user || !user.email) return false;

    const mailOptions = { to: user.email, subject, html };
    const emailPromise = transporter.sendMail(mailOptions);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email timeout')), 10000);
    });
    await Promise.race([emailPromise, timeoutPromise]);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

module.exports = {
  createInAppNotification,
  sendEmail
}; 