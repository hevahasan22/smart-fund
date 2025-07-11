const { additionalDocumentModel } = require('../models/additionalDocument');
const { Contract } = require('../models/contract');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage }).single('documentFile');

exports.handleUpload = upload; // Export middleware for use in routes

// Upload document
exports.uploadDocument = async (req, res) => {
  try {
    const { contractID, typeID } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Validate contract exists
    const contract = await Contract.findById(contractID);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Validate user has access to contract - UPDATED
    const hasAccess = auth.checkContractAccess(contract, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Unauthorized access to contract' });
    }
    
    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { resource_type: 'auto', folder: 'documents' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });
    
    // Create document record
    const document = new additionalDocumentModel({
      typeID,
      contractID,
      documentFile: {
        url: result.secure_url,
        public_id: result.public_id
      },
      uploadedBy: req.user._id,
      status: 'pending'
    });
    
    await document.save();
    
    res.status(201).json({
      message: 'Document uploaded successfully',
      document
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approve/reject document (admin)
exports.reviewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    
    // Validate input
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }
    
    const document = await additionalDocumentModel.findByIdAndUpdate(
      id,
      { status, rejectionReason },
      { new: true }
    ).populate('contractID uploadedBy');
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Notify user if rejected
    if (status === 'rejected' && document.uploadedBy) {
      notificationService.sendDocumentRejection(
        document.uploadedBy, 
        document._id, 
        rejectionReason
      );
    }
    
    res.json({
      message: `Document ${status} successfully`,
      document
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get documents for a contract
exports.getDocumentsByContract = async (req, res) => {
  try {
    const { contractID } = req.params;
    
    // Validate user has access to contract
    const contract = await Contract.findById(contractID);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const hasAccess = auth.checkContractAccess(contract, req.user);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Unauthorized access to contract documents' });
    }
    
    const documents = await additionalDocumentModel.find({ contractID })
      .populate('typeID uploadedBy');
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete document (user)
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await additionalDocumentModel.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Validate user owns the document or is admin
    const isOwner = document.uploadedBy.equals(req.user._id);
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this document' });
    }
    
    // Delete from Cloudinary
    await cloudinary.uploader.destroy(document.documentFile.public_id);
    
    // Delete from database
    await document.remove();
    
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single document
exports.getDocument = async (req, res) => {
  try {
    const document = await additionalDocumentModel.findById(req.params.id)
      .populate('typeID uploadedBy contractID');
      
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json(document);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};