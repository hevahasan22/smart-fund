const { User } = require('../../models/user');
const { createInAppNotification, sendEmail } = require('./helpers');
const { getContractDetails } = require('./contracts');

async function sendDocumentApprovalNotification(userId, documentId, documentName) {
  const message = `Your document "${documentName}" has been approved by admin`;
  const emailSubject = 'Document Approved';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your document "${documentName}" has been approved by our admin team.</p>
    <p>Your contract will now proceed to the next stage of processing.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(userId, 'document_approved', message, null);
  await sendEmail(userId, emailSubject, emailHtml);
}

async function sendDocumentRejectionNotification(userId, documentId, documentName, rejectionReason) {
  const message = `Your document "${documentName}" has been rejected. Reason: ${rejectionReason}`;
  const emailSubject = 'Document Rejected';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your document "${documentName}" has been rejected by our admin team.</p>
    <p><strong>Reason:</strong> ${rejectionReason}</p>
    <p>Please review the requirements and re-upload the document.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(userId, 'document_rejected', message, null);
  await sendEmail(userId, emailSubject, emailHtml);
}

async function sendDocumentPendingReview(documentId) {
  const admins = await User.find({ role: 'admin' });
  
  // Get document details to fetch document type name
  const { additionalDocumentModel } = require('../../models/additionalDocument');
  const document = await additionalDocumentModel.findById(documentId).populate('typeID');
  
  const documentTypeName = document && document.typeID ? document.typeID.documentName : 'Unknown Document Type';
  
  const message = `New document "${documentTypeName}" uploaded and pending review`;
  const emailSubject = 'Document Pending Review';
  const emailHtml = `
    <p>Hello Admin,</p>
    <p>A new document has been uploaded and is pending your review.</p>
    <p><strong>Document Type:</strong> ${documentTypeName}</p>
    <p><strong>Document ID:</strong> ${documentId}</p>
    <p>Please log in to the admin panel to review this document.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  for (const admin of admins) {
    await createInAppNotification(admin._id, 'document_pending_review', message, null);
    await sendEmail(admin._id, emailSubject, emailHtml);
  }
}

async function sendContractDocumentCompletionNotification(userId, contractId) {
  const details = await getContractDetails(contractId);
  const message = 'All documents for your contract have been approved. Contract is wainting for sponsors approval.';
  const emailSubject = 'Documents Approved - Contract Processing';
  const emailHtml = `
    <p>Hello,</p>
    <p>${message}</p>
    <p>Your contract will now proceed to sponsor approval stage.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(userId, 'documents_completed', message, contractId);
  await sendEmail(userId, emailSubject, emailHtml);
}

async function sendDocumentRejectionRequiresReuploadNotification(userId, contractId, documentName, rejectionReason) {
  const message = `Your document "${documentName}" has been rejected and needs to be re-uploaded. Reason: ${rejectionReason}`;
  const emailSubject = 'Document Rejected - Re-upload Required';
  const emailHtml = `
    <p>Hello,</p>
    <p>Your document "${documentName}" has been rejected by our admin team and needs to be re-uploaded.</p>
    <p><strong>Rejection Reason:</strong> ${rejectionReason}</p>
    <p>Please review the requirements and upload a corrected version of this document. Your contract will remain active while you re-upload the document.</p>
    <p>You can re-upload the document by logging into your account and going to your contract details.</p>
    <p>Best regards,<br>Smart Fund Team</p>
  `;
  await createInAppNotification(userId, 'document_rejection_reupload', message, contractId);
  await sendEmail(userId, emailSubject, emailHtml);
}

module.exports = {
  sendDocumentApprovalNotification,
  sendDocumentRejectionNotification,
  sendDocumentPendingReview,
  sendContractDocumentCompletionNotification,
  sendDocumentRejectionRequiresReuploadNotification
}; 