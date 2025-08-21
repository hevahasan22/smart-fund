const { User } = require('../../models/user');
const { Contract } = require('../../models/contract');
const { createInAppNotification, sendEmail } = require('./helpers');

async function getContractDetails(contractId) {
  const contract = await Contract.findById(contractId)
    .populate({ path: 'typeTermID', populate: { path: 'loanTypeID', select: 'loanName' } });
  return contract ? {
    loanType: contract.typeTermID?.loanTypeID?.loanName,
    amount: contract.tempLoanAmount,
    term: contract.tempLoanTermMonths
  } : {};
}

async function sendContractSubmissionNotification(borrowerId, contractId) {
  const details = await getContractDetails(contractId);
  const message = `Your ${details.loanType} (${details.term} months) application was submitted! Status: Awaiting Document Verification.`;
  const emailSubject = 'Loan Application Submitted';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your loan application has been successfully submitted!</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Term: ${details.term} months</li>
      <li>Amount: $${details.amount}</li>
    </ul>
    <p>Status: Awaiting Document Verification</p>
    <p>You will be notified once your documents have been reviewed.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;

  await createInAppNotification(borrowerId, 'contract_submitted', message, contractId);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

async function sendNewApplicationNotification(contractId) {
  const details = await getContractDetails(contractId);
  const message = `New application: ${details.loanType} (${details.term} months) requires document review.`;
  const emailSubject = 'New Loan Application - Document Review Required';
  const emailHtml = `
    <p>Hello Admin,</p>
    <p>A new loan application has been submitted and requires document review:</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Term: ${details.term} months</li>
      <li>Amount: $${details.amount}</li>
    </ul>
    <p>Please log in to the admin panel to review the submitted documents.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;

  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await createInAppNotification(admin._id, 'new_application', message, contractId);
    await sendEmail(admin._id, emailSubject, emailHtml);
  }
}

async function sendContractActivationNotification(borrowerId, contractId, firstPaymentDate) {
  const details = await getContractDetails(contractId);
  const message = `Loan Activated! Your ${details.loanType} (${details.term} months) is live. First payment due: ${firstPaymentDate}.`;
  const emailSubject = 'Loan Activated - Payment Schedule Available';
  const emailHtml = `
    <p>Congratulations!</p>
    <p>Your loan has been successfully activated!</p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
      <li>First Payment Due: ${firstPaymentDate}</li>
    </ul>
    <p>Please log in to view your complete payment schedule and make your first payment on time.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;

  await createInAppNotification(borrowerId, 'contract_activated', message, contractId);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

async function sendAdminActivationNotification(contractId, borrowerId) {
  const details = await getContractDetails(contractId);
  const borrower = await User.findById(borrowerId);
  const message = `Contract Activated: ${details.loanType} (${details.term} months) for ${borrower.userFirstName} ${borrower.userLastName}`;
  const emailSubject = 'Contract Activated - New Loan Live';
  const emailHtml = `
    <p>Hello Admin,</p>
    <p>A new contract has been activated:</p>
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
    await createInAppNotification(admin._id, 'contract_activated_admin', message, contractId);
    await sendEmail(admin._id, emailSubject, emailHtml);
  }
}

async function sendContractRejectionNotification(borrowerId, contractId, reason) {
  const details = await getContractDetails(contractId);
  const message = `Application Declined: ${details.loanType} (${details.term} months) - ${reason}.`;
  const emailSubject = 'Loan Application Declined';
  const emailHtml = `
    <p>Hello,</p>
    <p>Unfortunately, your loan application has been declined.</p>
    <p><strong>Loan Details:</strong></p>
    <ul>
      <li>Loan Type: ${details.loanType}</li>
      <li>Amount: $${details.amount}</li>
      <li>Term: ${details.term} months</li>
    </ul>
    <p><strong>Reason for Decline:</strong> ${reason}</p>
    <p>Please contact our support team if you have any questions.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;

  await createInAppNotification(borrowerId, 'contract_rejected', message, contractId);
  await sendEmail(borrowerId, emailSubject, emailHtml);
}

module.exports = {
  getContractDetails,
  sendContractSubmissionNotification,
  sendNewApplicationNotification,
  sendContractActivationNotification,
  sendAdminActivationNotification,
  sendContractRejectionNotification
}; 