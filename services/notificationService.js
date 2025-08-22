const { User } = require('../models/user');
require('dotenv').config();

// Facade modules
const contracts = require('./notifications/contracts');
const documents = require('./notifications/documents');
const sponsorships = require('./notifications/sponsorships');
const payments = require('./notifications/payments');
const { createInAppNotification } = require('./notifications/helpers');
const { Contract } = require('../models/contract');

// Backward compatible core helpers
exports.createNotification = createInAppNotification;

exports.sendDualNotification = async (userId, type, message, contractId = null, emailSubject = null, emailHtml = null) => {
  try {
    // Do not create in-app entries for sponsorship request types
    if (type !== 'sponsorship_request' && type !== 'sponsor_request') {
      await createInAppNotification(userId, type, message, contractId);
    }
    if (emailSubject && emailHtml) {
      // Lazy import to avoid circular
      const { sendEmail } = require('./notifications/helpers');
      await sendEmail(userId, emailSubject, emailHtml);
    }
  } catch (error) {
    console.error('Error sending dual notification:', error);
  }
};

exports.sendInAppOnly = async (userId, type, message, contractId = null) => {
  // Skip in-app for sponsorship request types
  if (type === 'sponsorship_request' || type === 'sponsor_request') return;
  await createInAppNotification(userId, type, message, contractId);
};

exports.markNotificationAsRead = async (userId, notificationId) => {
  try {
    await User.updateOne(
      { _id: userId, 'notifications._id': notificationId },
      { $set: { 'notifications.$.isRead': true } }
    );
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

exports.getUserNotifications = async (userId, limit = 50) => {
  try {
    const user = await User.findById(userId).select('notifications');
    const excluded = new Set(['sponsorship_request', 'sponsor_request']);
    return (user.notifications || [])
      .filter(n => !excluded.has(n.type))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

exports.getUnreadNotificationCount = async (userId) => {
  try {
    const user = await User.findById(userId).select('notifications');
    const excluded = new Set(['sponsorship_request', 'sponsor_request']);
    return (user.notifications || []).filter(n => !n.isRead && !excluded.has(n.type)).length;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
};

// Domain re-exports (keep names as in existing controllers)
exports.checkPendingActions = async (userId) => {
  try {
    const user = await User.findById(userId);
    const excluded = new Set(['sponsorship_request', 'sponsor_request']);
    const unreadCount = (user.notifications || []).filter(n => !n.isRead && !excluded.has(n.type)).length;
    const pendingApprovals = user.pendingApprovals ? user.pendingApprovals.length : 0;
    return {
      hasPendingActions: unreadCount > 0 || pendingApprovals > 0,
      unreadNotifications: unreadCount,
      pendingApprovals: pendingApprovals
    };
  } catch (error) {
    console.error('Error checking pending actions:', error);
    return { hasPendingActions: false, unreadNotifications: 0, pendingApprovals: 0 };
  }
};

// Contracts
exports.sendContractSubmissionNotification = contracts.sendContractSubmissionNotification;
exports.sendNewApplicationNotification = contracts.sendNewApplicationNotification;
exports.sendContractActivationNotification = contracts.sendContractActivationNotification;
exports.sendSponsorActivationNotification = sponsorships.sendSponsorActivationNotification;
exports.sendAdminActivationNotification = contracts.sendAdminActivationNotification;
exports.sendContractRejectionNotification = contracts.sendContractRejectionNotification;

// Documents
exports.sendDocumentApprovalNotification = documents.sendDocumentApprovalNotification;
exports.sendDocumentRejectionNotification = documents.sendDocumentRejectionNotification;
exports.sendDocumentPendingReview = documents.sendDocumentPendingReview;
exports.sendContractDocumentCompletionNotification = documents.sendContractDocumentCompletionNotification;

// Sponsorships
exports.sendSponsorshipRequestNotification = sponsorships.sendSponsorshipRequestNotification;
exports.sendSponsorApprovalNotification = sponsorships.sendSponsorApprovalNotification;
exports.sendSponsorReminderNotification = sponsorships.sendSponsorReminderNotification;
exports.sendSponsorRejectionNotification = sponsorships.sendSponsorRejectionNotification;
exports.sendSponsorRejectionUpdateNotification = sponsorships.sendSponsorRejectionUpdateNotification;

// Payments
exports.sendPaymentReminderNotification = payments.sendPaymentReminderNotification;
exports.sendPaymentConfirmationNotification = payments.sendPaymentConfirmationNotification;
exports.sendLatePaymentNotification = payments.sendLatePaymentNotification;
exports.sendLoanCompletionNotification = payments.sendLoanCompletionNotification;
exports.sendSponsorCompletionNotification = payments.sendSponsorCompletionNotification;
exports.sendAdminCompletionNotification = payments.sendAdminCompletionNotification;

// Legacy functions preserved (aliases)
exports.sendSponsorRequest = async (sponsor, borrower, loanDetails) => {
  const message = `${borrower.userFirstName} ${borrower.userLastName} has requested you to sponsor their ${loanDetails.type} loan for $${loanDetails.amount}`;
  const emailSubject = 'Loan Guarantee Request';
  const emailHtml = `
    <p>Hello ${sponsor.userFirstName},</p>
    <p>${borrower.userFirstName} ${borrower.userLastName} has requested you to be a sponsor for their loan:</p>
    <ul>
      <li>Loan Type: ${loanDetails.type}</li>
      <li>Amount: $${loanDetails.amount}</li>
      <li>Term: ${loanDetails.term}</li>
    </ul>
    <p>Please log in to the platform to accept or decline this request.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  // Send only email; do not create in-app sponsorship notification
  const { sendEmail } = require('./notifications/helpers');
  await sendEmail(sponsor._id, emailSubject, emailHtml);
};

exports.sendContractProcessingNotification = async (userId, contractId) => {
  const details = await contracts.getContractDetails(contractId);
  // Fetch sponsor names
  let sponsorNames = '';
  try {
    const contract = await Contract.findById(contractId).select('sponsorID_1 sponsorID_2');
    if (contract) {
      const [s1, s2] = await Promise.all([
        User.findById(contract.sponsorID_1).select('userFirstName userLastName'),
        User.findById(contract.sponsorID_2).select('userFirstName userLastName')
      ]);
      const name1 = s1 ? `${s1.userFirstName} ${s1.userLastName}` : 'Sponsor 1';
      const name2 = s2 ? `${s2.userFirstName} ${s2.userLastName}` : 'Sponsor 2';
      sponsorNames = ` (${name1}, ${name2})`;
    }
  } catch (e) {
    // Fallback silently if name fetch fails
    sponsorNames = '';
  }
  const message = `Both sponsors${sponsorNames} have approved your contract for a ${details.loanType || ''} loan of $${details.amount || ''}. It is now being processed.`;
  await createInAppNotification(userId, 'contract_processing', message, contractId);
};

exports.sendPartialApprovalNotification = async (userId, contractId) => {
  const details = await contracts.getContractDetails(contractId);
  const message = `One sponsor has approved your contract for a ${details.loanType || ''} loan of $${details.amount || ''}. Waiting for the second sponsor's approval.`;
  await createInAppNotification(userId, 'partial_approval', message, contractId);
};

exports.sendContractUpdate = async (userId, contractId, status, details = '') => {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    const statusMessages = {
      'approved': 'Your contract has been approved!',
      'rejected': 'Your contract has been rejected.',
      'processing': 'Your contract is being processed.',
      'completed': 'Your contract has been completed.'
    };
    const message = `${statusMessages[status] || 'Your contract status has been updated.'} ${details}`;
    await createInAppNotification(userId, 'contract_update', message, contractId);
  } catch (error) {
    console.error('Error sending contract update notification:', error);
  }
};