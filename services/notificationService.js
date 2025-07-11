const nodemailer = require('nodemailer');
require('dotenv').config()
// Email configuration
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Send payment reminder
exports.sendPaymentReminder = async (payment, user) => {
  const mailOptions = {
    to: user.email,
    subject: 'Payment Due Reminder',
    html: `
      <p>Hello ${user.firstName},</p>
      <p>Your payment of $${payment.amount} is due on ${payment.dueDate.toDateString()}</p>
      <p>Please make your payment on time to avoid late fees.</p>
    `
  };
  
  await transporter.sendMail(mailOptions);
};

// Send sponsor request
exports.sendSponsorRequest = async (sponsor, user, loanDetails) => {
  const mailOptions = {
    to: sponsor.email,
    subject: 'Loan Guarantee Request',
    html: `
      <p>Hello ${sponsor.fullName},</p>
      <p>${user.firstName} ${user.lastName} has requested you to be a sponsor for their loan:</p>
      <ul>
        <li>Loan Type: ${loanDetails.type}</li>
        <li>Amount: $${loanDetails.amount}</li>
        <li>Term: ${loanDetails.term}</li>
      </ul>
      <p>Please log in to the platform to accept or decline this request.</p>
    `
  };
  
  await transporter.sendMail(mailOptions);
};

// Send document rejection notification
exports.sendDocumentRejection = async (user, documentId, reason) => {
  const mailOptions = {
    to: user.email,
    subject: 'Document Rejection Notice',
    html: `
      <p>Hello ${user.firstName},</p>
      <p>Your document (ID: ${documentId}) has been rejected.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please review the requirements and re-upload the document.</p>
    `
  };
  
  await transporter.sendMail(mailOptions);
};