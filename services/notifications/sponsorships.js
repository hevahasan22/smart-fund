const { User } = require('../../models/user');
const { createInAppNotification, sendEmail } = require('./helpers');
const { getContractDetails } = require('./contracts');

async function sendSponsorshipRequestNotification(sponsorId, borrowerId, contractId) {
  const details = await getContractDetails(contractId);
  const borrower = await User.findById(borrowerId);
  const message = `Action Required: ${borrower.userFirstName} ${borrower.userLastName} has requested you to sponsor their $${details.amount} ${details.loanType} (${details.term} months)`;
  const emailSubject = 'Sponsorship Request - Action Required';
  const emailHtml = `
    <p>Hello,</p>
    <p>${borrower.userFirstName} ${borrower.userLastName} has requested you to sponsor their loan:</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
    </ul>
    <p>Please log in to the platform to accept or decline this sponsorship request.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  // Stop adding sponsorship requests to generic notifications; only send email
  await sendEmail(sponsorId, emailSubject, emailHtml);
}

async function sendSponsorApprovalNotification(borrowerId, contractId, sponsorName, remainingSponsors) {
  const details = await getContractDetails(contractId);
  const message = `${sponsorName} approved your ${details.loanType} (${details.term} months)! Waiting on ${remainingSponsors} more sponsors.`;
  await createInAppNotification(borrowerId, 'sponsor_approved', message, contractId);
}

async function sendSponsorReminderNotification(sponsorId, borrowerId, contractId, approvedCount, totalCount) {
  const details = await getContractDetails(contractId);
  const borrower = await User.findById(borrowerId);
  const message = `Reminder: ${borrower.userFirstName} ${borrower.userLastName} needs your sponsorship for ${details.loanType} (${details.term} months) - ${approvedCount}/${totalCount} approved`;
  const emailSubject = 'Sponsorship Reminder - Action Required';
  const emailHtml = `
    <p>Hello,</p>
    <p>This is a reminder that ${borrower.userFirstName} ${borrower.userLastName} needs your sponsorship for their loan:</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
    </ul>
    <p>Status: ${approvedCount}/${totalCount} sponsors have approved</p>
    <p>Please log in to the platform to make your decision.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(sponsorId, 'sponsorship_reminder', message, contractId);
  await sendEmail(sponsorId, emailSubject, emailHtml);
}

async function sendSponsorRejectionNotification(borrowerId, contractId, sponsorName) {
  const details = await getContractDetails(contractId);
  const message = `Sponsor Declined: ${sponsorName} can't support your ${details.loanType} (${details.term} months).`;
  const emailSubject = 'Sponsor Declined - Action Required';
  const emailHtml = `
    <p>Hello,</p>
    <p>Unfortunately, ${sponsorName} has declined to sponsor your loan application.</p>
    <p><strong>Loan Details:</strong></p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
    </ul>
    <p>You may need to find an alternative sponsor or contact our support team for assistance.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(borrowerId, 'sponsor_declined', message, contractId);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

async function sendSponsorRejectionUpdateNotification(sponsorId, borrowerId, contractId) {
  const details = await getContractDetails(contractId);
  const borrower = await User.findById(borrowerId);
  const message = `Update: ${borrower.userFirstName} ${borrower.userLastName}'s ${details.loanType} (${details.term} months) requires alternate sponsor.`;
  await createInAppNotification(sponsorId, 'sponsor_rejection_update', message, contractId);
}

async function sendSponsorActivationNotification(sponsorId, borrowerId, contractId, firstPaymentDate) {
  const details = await getContractDetails(contractId);
  const borrower = await User.findById(borrowerId);
  const message = `You're now sponsoring ${borrower.userFirstName} ${borrower.userLastName}'s ${details.loanType} (${details.term} months)! First payment: ${firstPaymentDate}.`;
  const emailSubject = 'Sponsorship Activated - Loan Live';
  const emailHtml = `
    <p>Hello,</p>
    <p>You are now officially sponsoring ${borrower.userFirstName} ${borrower.userLastName}'s loan:</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
      <li>First Payment Due: ${firstPaymentDate}</li>
    </ul>
    <p>You will be notified of all payment activities for this loan.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(sponsorId, 'sponsorship_activated', message, contractId);
  await sendEmail(sponsorId, emailSubject, emailHtml);
}

module.exports = {
  sendSponsorshipRequestNotification,
  sendSponsorApprovalNotification,
  sendSponsorReminderNotification,
  sendSponsorRejectionNotification,
  sendSponsorRejectionUpdateNotification,
  sendSponsorActivationNotification
}; 