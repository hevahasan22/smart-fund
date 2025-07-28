const nodemailer = require('nodemailer');
const { User } = require('../models/user');
require('dotenv').config()

// Email configuration with error handling
let transporter;
try {
  transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
  
  // Test email configuration
  transporter.verify(function(error, success) {
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

// Create in-app notification
exports.createNotification = async (userId, type, message, contractId = null) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $push: {
        notifications: {
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
};

// Send both in-app and email notification
exports.sendDualNotification = async (userId, type, message, contractId = null, emailSubject = null, emailHtml = null) => {
  try {
    // Create in-app notification first (this should always work)
    await this.createNotification(userId, type, message, contractId);
    console.log(`In-app notification created for user ${userId}: ${type}`);
    
    // Send email notification if email details provided and transporter is available
    if (emailSubject && emailHtml && transporter) {
      const user = await User.findById(userId);
      if (user && user.email) {
        const mailOptions = {
          to: user.email,
          subject: emailSubject,
          html: emailHtml
        };
        
        // Add timeout to prevent hanging connections
        const emailPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Email timeout')), 10000); // 10 second timeout
        });
        
        await Promise.race([emailPromise, timeoutPromise]);
        console.log(`Email sent to ${user.email}: ${emailSubject}`);
      } else {
        console.warn(`User ${userId} not found or has no email address`);
      }
    } else if (!transporter) {
      console.warn('Email transporter not available. Only in-app notification sent.');
    }
  } catch (error) {
    console.error('Error sending dual notification:', error);
    
    // Still try to send in-app notification even if email fails
    try {
      await this.createNotification(userId, type, message, contractId);
      console.log(`Fallback in-app notification sent for user ${userId}`);
    } catch (inAppError) {
      console.error('Failed to send in-app notification as fallback:', inAppError);
    }
  }
};

// Mark notification as read
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

// Get user notifications
exports.getUserNotifications = async (userId, limit = 50) => {
  try {
    const user = await User.findById(userId).select('notifications');
    return user.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return [];
  }
};

// Get unread notification count
exports.getUnreadNotificationCount = async (userId) => {
  try {
    const user = await User.findById(userId).select('notifications');
    return user.notifications.filter(n => !n.isRead).length;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
};

// Send sponsor request (both in-app and email)
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
  
  await this.sendDualNotification(sponsor._id, 'sponsor_request', message, null, emailSubject, emailHtml);
};

// Send sponsor approval notification
exports.sendSponsorApprovalNotification = async (sponsorId, contractId, isFirstApproval = false) => {
  const message = isFirstApproval 
    ? 'You have approved the contract request.'
    : 'Your co-sponsor has approved the contract. Waiting for your approval.';
  
  const emailSubject = isFirstApproval ? 'Contract Approval Confirmation' : 'Co-Sponsor Approval Notification';
  const emailHtml = `
    <p>Hello,</p>
    <p>${message}</p>
    <p>Please log in to the platform to view the contract details.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(sponsorId, 'sponsor_approved', message, contractId, emailSubject, emailHtml);
};

// Send contract rejection notification
exports.sendContractRejectionNotification = async (userId, contractId, reason, isSponsor = false) => {
  const message = isSponsor 
    ? `You have rejected the contract request for contract #${contractId}`
    : `Your contract has been rejected by a sponsor: ${reason}`;
  
  const emailSubject = 'Contract Rejection Notification';
  const emailHtml = `
    <p>Hello,</p>
    <p>${message}</p>
    <p>Please log in to the platform for more details.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(userId, 'contract_rejected', message, contractId, emailSubject, emailHtml);
};

// Send contract approval notification
exports.sendContractApprovalNotification = async (userId, contractId) => {
  const message = 'Your contract has been approved!';
  const emailSubject = 'Contract Approved!';
  const emailHtml = `
    <p>Congratulations!</p>
    <p>Your contract has been approved and is now active.</p>
    <p>Please log in to the platform to view your loan details and payment schedule.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(userId, 'contract_approved', message, contractId, emailSubject, emailHtml);
};

// Send contract processing notification
exports.sendContractProcessingNotification = async (userId, contractId) => {
  const message = 'Both sponsors have approved your contract. It is now being processed.';
  const emailSubject = 'Contract Processing';
  const emailHtml = `
    <p>Hello,</p>
    <p>${message}</p>
    <p>You will receive another notification once the processing is complete.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(userId, 'contract_processing', message, contractId, emailSubject, emailHtml);
};

// Send partial approval notification
exports.sendPartialApprovalNotification = async (userId, contractId) => {
  const message = "One sponsor has approved your contract. Waiting for the second sponsor's approval.";
  const emailSubject = 'Partial Contract Approval';
  const emailHtml = `
    <p>Hello,</p>
    <p>${message}</p>
    <p>You will be notified once both sponsors have made their decision.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(userId, 'partial_approval', message, contractId, emailSubject, emailHtml);
};

// Send payment reminder
exports.sendPaymentReminder = async (payment, user) => {
  const message = `Your payment of $${payment.amount} is due on ${payment.dueDate.toDateString()}`;
  const emailSubject = 'Payment Due Reminder';
  const emailHtml = `
    <p>Hello ${user.userFirstName},</p>
    <p>${message}</p>
    <p>Please make your payment on time to avoid late fees.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(user._id, 'payment_reminder', message, null, emailSubject, emailHtml);
};

// Send document rejection notification
exports.sendDocumentRejection = async (user, documentId, reason) => {
  const message = `Your document (ID: ${documentId}) has been rejected. Reason: ${reason}`;
  const emailSubject = 'Document Rejection Notice';
  const emailHtml = `
    <p>Hello ${user.userFirstName},</p>
    <p>Your document (ID: ${documentId}) has been rejected.</p>
    <p><strong>Reason:</strong> ${reason}</p>
    <p>Please review the requirements and re-upload the document.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(user._id, 'document_rejected', message, null, emailSubject, emailHtml);
};

// Send document pending review notification to admin
exports.sendDocumentPendingReview = async (documentId) => {
  try {
    // Get all admin users
    const admins = await User.find({ role: 'admin' });
    
    const message = `New document uploaded and pending review (ID: ${documentId})`;
    const emailSubject = 'Document Pending Review';
    const emailHtml = `
      <p>Hello Admin,</p>
      <p>A new document has been uploaded and is pending your review.</p>
      <p><strong>Document ID:</strong> ${documentId}</p>
      <p>Please log in to the admin panel to review this document.</p>
      <p>Best regards,<br>Smart Fund Team</p>
    `;
    
    // Send notification to all admins
    for (const admin of admins) {
      await this.sendDualNotification(admin._id, 'document_pending_review', message, null, emailSubject, emailHtml);
    }
    
    console.log(`Document pending review notification sent to ${admins.length} admins`);
  } catch (error) {
    console.error('Error sending document pending review notification:', error);
  }
};

// Send document approval notification to user
exports.sendDocumentApprovalNotification = async (userId, documentId, documentName) => {
  const message = `Your document "${documentName}" has been approved by admin`;
  const emailSubject = 'Document Approved';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your document "${documentName}" has been approved by our admin team.</p>
    <p>Your contract will now proceed to the next stage of processing.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(userId, 'document_approved', message, null, emailSubject, emailHtml);
};

// Send document rejection notification to user
exports.sendDocumentRejectionNotification = async (userId, documentId, documentName, rejectionReason) => {
  const message = `Your document "${documentName}" has been rejected. Reason: ${rejectionReason}`;
  const emailSubject = 'Document Rejected';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your document "${documentName}" has been rejected by our admin team.</p>
    <p><strong>Reason:</strong> ${rejectionReason}</p>
    <p>Please review the requirements and re-upload the document.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(userId, 'document_rejected', message, null, emailSubject, emailHtml);
};

// Send contract document completion notification
exports.sendContractDocumentCompletionNotification = async (userId, contractId) => {
  const message = 'All documents for your contract have been approved. Contract is now being processed.';
  const emailSubject = 'Documents Approved - Contract Processing';
  const emailHtml = `
    <p>Hello,</p>
    <p>${message}</p>
    <p>Your contract will now proceed to sponsor approval stage.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  
  await this.sendDualNotification(userId, 'documents_completed', message, contractId, emailSubject, emailHtml);
};

// Send contract update notification (legacy function for backward compatibility)
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
    
    await this.createNotification(userId, 'contract_update', message, contractId);
  } catch (error) {
    console.error('Error sending contract update notification:', error);
  }
};