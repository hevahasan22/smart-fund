const mongoose = require('mongoose');
const { User } = require('../../models/user');
const { transporter } = require('./email');

async function createInAppNotification(userId, type, message, contractId = null) {
  try {
    await User.findByIdAndUpdate(userId, {
      $push: {
        notifications: {
          _id: new mongoose.Types.ObjectId(),
          type,
          message,
          contractId,
          createdAt: new Date(),
          isRead: false
        }
      }
    });
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