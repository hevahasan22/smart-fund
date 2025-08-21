const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter;
try {
  transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  transporter.verify(function(error) {
    if (error) {
      console.error('Email configuration error:', error);
    } else {
      console.log('Email server is ready to send messages');
    }
  });
} catch (error) {
  console.error('Failed to create email transporter:', error);
  transporter = null;
}

module.exports = { transporter }; 