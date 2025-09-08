const { additionalDocumentModel } = require('../models/additionalDocument');
const { additionalDocumentTypeModel } = require('../models/additionalDocumentType');
const { documentTypeTermRelationModel } = require('../models/documentTypeTermRelation');
const { Contract } = require('../models/contract');
const { User } = require('../models/user');
const cloudinary = require('../utils/cloudinary');
const notificationService = require('../services/notificationService');
const upload=require('../middleware/multer')

// Upload document for a contract
exports.uploadDocument = async (req, res) => {
  try {
    const { contractID } = req.params;
    const { documentName } = req.body; // <-- get documentName from body
    const file = req.file;
    const userId = req.user.id;
    
    if (!documentName) {
      return res.status(400).json({ error: 'documentName is required' });
    }
    
    if (!file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please upload a file using the field name "documentFile"',
        expectedField: 'documentFile',
        example: 'Use FormData with field name "documentFile" for the file'
      });
    }
    
    // Find the document type by documentName
    const docType = await additionalDocumentTypeModel.findOne({ documentName });
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found for the given documentName' });
    }
    
    // Validate contract exists and user has access
    const contract = await Contract.findById(contractID);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check if user is the contract owner
    if (!contract.userID.equals(userId)) {
      return res.status(403).json({ error: 'Unauthorized access to contract' });
    }
    
    // Check if contract is in a state where documents can be uploaded
    if (!['pending_sponsor_approval', 'pending_processing', 'pending_document_approval','pending','pending_document_upload', 'pending_document_reupload'].includes(contract.status)) {
      return res.status(400).json({ 
        error: 'Documents cannot be uploaded at this stage',
        currentStatus: contract.status
      });
    }
    
    // Check if document type is applicable for this contract's type term
    const docTypeRelation = await documentTypeTermRelationModel.findOne({
      documentTypeID: docType._id,
      typeTermID: contract.typeTermID
    });
    
    if (!docTypeRelation) {
      return res.status(400).json({ error: 'Document type not applicable to this contract' });
    }
    
    const typeID = docType._id;
    
    console.log(`Document upload request - Contract: ${contractID}, Type: ${typeID}, User: ${userId}`);
    
    // Check if document already exists for this type and contract
    // Allow re-upload if the existing document is rejected
    const existingDoc = await additionalDocumentModel.findOne({
      contractID,
      typeID,
      status: { $in: ['pending', 'approved'] }
    });
    
    if (existingDoc) {
      return res.status(400).json({ 
        error: 'Document of this type already exists for this contract',
        existingDocument: existingDoc._id,
        message: 'You can only re-upload rejected documents. Please delete the rejected document first or contact support.'
      });
    }

    // Check if there's a rejected document of this type that can be replaced
    const rejectedDoc = await additionalDocumentModel.findOne({
      contractID,
      typeID,
      status: 'rejected'
    });

    let documentToUpdate = null;
    if (rejectedDoc) {
      console.log(`Found rejected document ${rejectedDoc._id} for type ${typeID}, will replace it`);
      documentToUpdate = rejectedDoc;
    }
    
    // Upload to Cloudinary
    console.log('Uploading file to Cloudinary...');
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'documents' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });
    
    let document;
    if (documentToUpdate) {
      // Update existing rejected document
      console.log(`Updating rejected document ${documentToUpdate._id}`);
      
      // Delete old file from Cloudinary if it exists
      if (documentToUpdate.documentFile && documentToUpdate.documentFile.public_id) {
        try {
          await cloudinary.uploader.destroy(documentToUpdate.documentFile.public_id);
          console.log(`Deleted old file from Cloudinary: ${documentToUpdate.documentFile.public_id}`);
        } catch (cloudinaryError) {
          console.error('Error deleting old file from Cloudinary:', cloudinaryError);
          // Continue with update even if Cloudinary deletion fails
        }
      }
      
      // Update the document
      documentToUpdate.documentFile = {
        url: result.secure_url,
        public_id: result.public_id
      };
      documentToUpdate.uploadedBy = userId;
      documentToUpdate.status = 'pending';
      documentToUpdate.rejectionReason = undefined; // Clear rejection reason
      documentToUpdate.adminNotes = undefined; // Clear admin notes
      documentToUpdate.reviewedBy = undefined; // Clear reviewer
      documentToUpdate.reviewedAt = undefined; // Clear review date
      documentToUpdate.uploadedAt = new Date(); // Update upload date
      
      await documentToUpdate.save();
      document = documentToUpdate;
    } else {
      // Create new document record
      document = new additionalDocumentModel({
        typeID,
        contractID,
        documentFile: {
          url: result.secure_url,
          public_id: result.public_id
        },
        uploadedBy: userId,
        status: 'pending'
      });
      
      await document.save();
    }

    // After saving, check if all required documents are uploaded
    const requiredDocTypes = await documentTypeTermRelationModel.find({
      typeTermID: contract.typeTermID,
      isRequired: true
    }).populate('documentTypeID');

    const uploadedDocs = await additionalDocumentModel.find({
      contractID,
      status: { $in: ['pending', 'approved'] }
    });

    const allUploaded = requiredDocTypes.every(docType =>
      uploadedDocs.some(doc => doc.typeID.equals(docType.documentTypeID._id))
    );

    // Update contract status based on document upload
    if (allUploaded) {
      if (contract.status === 'pending_document_upload' || contract.status === 'pending_document_reupload') {
        contract.status = 'pending_document_approval';
        await contract.save();
        console.log(`Contract ${contractID} status updated to pending_document_approval`);
      }
    } else {
      // If not all documents uploaded, ensure contract is in correct status
      if (contract.status === 'pending_document_approval') {
        contract.status = 'pending_document_upload';
        await contract.save();
        console.log(`Contract ${contractID} status updated to pending_document_upload`);
      }
    }
    
    console.log(`Document uploaded successfully: ${document._id}`);
    
    // Notify admin about new document pending review
    await notificationService.sendDocumentPendingReview(document._id);
    
    const isReupload = documentToUpdate !== null;
    res.status(201).json({
      message: isReupload 
        ? 'Document re-uploaded successfully and pending admin review'
        : 'Document uploaded successfully and pending admin review',
      document: {
        id: document._id,
        type: docType.documentName,
        status: document.status,
        uploadedAt: document.uploadedAt,
        isReupload: isReupload
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get documents for a contract (with proper access control)
exports.getDocumentsByContract = async (req, res) => {
  try {
    const { contractID } = req.params;
    const userId = req.user.id;
    
    // Validate contract exists
    const contract = await Contract.findById(contractID);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check access: user must be contract owner, sponsor, or admin
    const isOwner = contract.userID.equals(userId);
    const isSponsor = contract.sponsorID_1.equals(userId) || contract.sponsorID_2.equals(userId);
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isSponsor && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized access to contract documents' });
    }
    
    const documents = await additionalDocumentModel.find({ contractID })
      .populate('typeID')
      .sort({ uploadedAt: -1 });
    
    res.json({
      contractId: contractID,
      documents: documents.map(doc => ({
        id: doc._id,
        type: doc.typeID?.documentName || '',
        status: doc.status,
        uploadedAt: doc.uploadedAt,
        reviewedAt: doc.reviewedAt,
        rejectionReason: doc.rejectionReason,
        adminNotes: doc.adminNotes,
        documentFile: doc.documentFile
      }))
    });
  } catch (error) {
    console.error('Error getting documents by contract:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete document (user can delete their own pending documents)
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`Delete document request - Document: ${id}, User: ${userId}`);
    
    const document = await additionalDocumentModel.findById(id)
      .populate({ path: 'contractID', model: 'Contract' });
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check permissions: user must own the document or be admin
    const isOwner = document.uploadedBy.equals(userId);
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this document' });
    }
    
    // Only allow deletion of pending documents (unless admin)
    if (document.status !== 'pending' && !isAdmin) {
      return res.status(400).json({ 
        error: 'Cannot delete reviewed documents',
        currentStatus: document.status
      });
    }
    
    // Delete from Cloudinary
    if (document.documentFile && document.documentFile.public_id) {
      try {
        await cloudinary.uploader.destroy(document.documentFile.public_id);
        console.log(`Deleted file from Cloudinary: ${document.documentFile.public_id}`);
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }
    
    // Delete from database
    await additionalDocumentModel.findByIdAndDelete(id);
    
    console.log(`Document ${id} deleted successfully`);
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single document with full details
exports.getDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const document = await additionalDocumentModel.findById(id)
      .populate('typeID')
      .populate({ path: 'contractID', model: 'Contract' });
      
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check access permissions
    const contract = document.contractID;
    const isOwner = contract.userID.equals(userId);
    const isSponsor = contract.sponsorID_1.equals(userId) || contract.sponsorID_2.equals(userId);
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isSponsor && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized access to document' });
    }
    
    res.json({
      id: document._id,
      type: document.typeID?.documentName || '',
      status: document.status,
      uploadedAt: document.uploadedAt,
      reviewedAt: document.reviewedAt,
      rejectionReason: document.rejectionReason,
      adminNotes: document.adminNotes,
      documentFile: document.documentFile,
      contract: {
        id: contract._id,
        status: contract.status
      }
    });
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ error: error.message });
  }
};