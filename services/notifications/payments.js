const { createInAppNotification, sendEmail } = require('./helpers');
const { Loan } = require('../../models/loan');
const { User } = require('../../models/user');

async function getLoanDetails(loanId) {
  const loan = await Loan.findById(loanId)
    .populate({ path: 'typeTermID', populate: { path: 'loanTypeID', select: 'loanName' } });
  return loan ? {
    loanType: loan.typeTermID?.loanTypeID?.loanName,
    amount: loan.loanAmount,
    term: loan.loanTermMonths
  } : {};
}

async function sendPaymentReminderNotification(borrowerId, loanId, amount, dueDate) {
  const details = await getLoanDetails(loanId);
  const message = `Upcoming Payment: $${amount} for ${details.loanType} (${details.term} months) due in 3 days.`;
  const emailSubject = 'Payment Reminder - Due in 3 Days';
  const emailHtml = `
    <p>Hello,</p>
    <p>This is a friendly reminder that your payment is due soon:</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount Due: $${amount}</li>
      <li>Due Date: ${dueDate}</li>
    </ul>
    <p>Please make your payment on time to avoid late fees.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(borrowerId, 'payment_reminder', message, null);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

async function sendPaymentConfirmationNotification(borrowerId, loanId, amount, nextPaymentDate) {
  const details = await getLoanDetails(loanId);
  const message = `Payment Confirmed: $${amount} applied to ${details.loanType} (${details.term} months). Next due: ${nextPaymentDate}.`;
  const emailSubject = 'Payment Confirmed';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your payment has been successfully processed!</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount Paid: $${amount}</li>
      <li>Next Payment Due: ${nextPaymentDate}</li>
    </ul>
    <p>Thank you for your timely payment!</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(borrowerId, 'payment_confirmed', message, null);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

async function sendLatePaymentNotification(borrowerId, loanId, amount, penalty) {
  const details = await getLoanDetails(loanId);
  const message = `URGENT: $${penalty} late fee applied to ${details.loanType} (${details.term} months). Pay now to avoid penalties.`;
  const emailSubject = 'URGENT: Late Payment Fee Applied';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your payment is overdue and a late fee has been applied:</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Original Amount: $${amount}</li>
      <li>Late Fee: $${penalty}</li>
      <li>Total Due: $${amount + penalty}</li>
    </ul>
    <p>Please make your payment immediately to avoid additional penalties.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(borrowerId, 'late_payment', message, null);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

async function sendLoanCompletionNotification(borrowerId, loanId) {
  const details = await getLoanDetails(loanId);
  const message = `Congratulations! Your ${details.loanType} (${details.term} months) is fully paid. Thank you!`;
  const emailSubject = 'Congratulations! Loan Fully Paid';
  const emailHtml = `
    <p>Congratulations!</p>
    <p>You have successfully completed your loan!</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
    </ul>
    <p>Thank you for choosing Smart Fund for your financial needs.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(borrowerId, 'loan_completed', message, null);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

async function sendSponsorCompletionNotification(sponsorId, borrowerId, loanId) {
  const details = await getLoanDetails(loanId);
  const borrower = await User.findById(borrowerId);
  const message = `🎉 You've helped ${borrower.userFirstName} ${borrower.userLastName} complete their ${details.loanType} (${details.term} months)!`;
  const emailSubject = '🎉 Loan Successfully Completed!';
  const emailHtml = `
    <p>Hello,</p>
    <p>Congratulations! You have successfully helped ${borrower.userFirstName} ${borrower.userLastName} complete their loan!</p>
    <ul>
      <li>Borrower: ${borrower.userFirstName} ${borrower.userLastName}</li>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
    </ul>
    <p>Thank you for your sponsorship and support!</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(sponsorId, 'sponsorship_completed', message, null);
  await sendEmail(sponsorId, emailSubject, emailHtml);
}

async function sendAdminCompletionNotification(loanId, borrowerId) {
  const details = await getLoanDetails(loanId);
  const borrower = await User.findById(borrowerId);
  const message = `Loan Completed: ${details.loanType} (${details.term} months) for ${borrower.userFirstName} ${borrower.userLastName}`;
  const emailSubject = 'Loan Successfully Completed';
  const emailHtml = `
    <p>Hello Admin,</p>
    <p>A loan has been successfully completed:</p>
    <ul>
      <li>Borrower: ${borrower.userFirstName} ${borrower.userLastName}</li>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
    </ul>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await createInAppNotification(admin._id, 'loan_completed_admin', message, null);
    await sendEmail(admin._id, emailSubject, emailHtml);
  }
}

module.exports = {
  getLoanDetails,
  sendPaymentReminderNotification,
  sendPaymentConfirmationNotification,
  sendLatePaymentNotification,
  sendLoanCompletionNotification,
  sendSponsorCompletionNotification,
  sendAdminCompletionNotification
}; 