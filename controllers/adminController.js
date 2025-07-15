const { User, Contract, Payment, Investor } = require('../models/index');
const { loanTypeModel } = require('../models/loanType');
const { loanTermModel } = require('../models/loanTerm');
const { typetermModel,validateTypeTerm } = require('../models/typeterm');
const { additionalDocumentModel } = require('../models/additionalDocument');
const { additionalDocumentTypeModel } = require('../models/additionalDocumentType');
const { documentTypeTermRelationModel } = require('../models/documentTypeTermRelation');
const notificationService = require('../services/notificationService');

// Get all active users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ status: { $ne: 'inactive' } })
      .select('userFirstName userLastName email role createdAt status')
      .lean();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching users', details: error.message });
  }
};

// Get user details
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findById(userId)
      .select('-password -__v')
      .lean();
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get contracts where user is borrower OR sponsor
    const contracts = await Contract.find({
      $or: [
        { borrower: userId },
        { sponsors: userId }
      ]
    })
    .populate('loanType')
    .populate('sponsors', 'userFirstName userLastName email')
    .populate('borrower', 'userFirstName userLastName email')
    .lean();

    // Get payments for all contracts
    const paymentPromises = contracts.map(contract => 
      Payment.find({ contract: contract._id }).lean()
    );
    const payments = await Promise.all(paymentPromises);

    res.json({
      success: true,
      user,
      contracts,
      payments
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching user details', details: error.message });
  }
};

// Delete user (set status to inactive)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }

    // Check active contracts
    const activeContracts = await Contract.find({ 
      borrower: userId,
      status: { $in: ['pending', 'approved', 'active'] }
    });

    if (activeContracts.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete user with active contracts' 
      });
    }

    // Perform hard deletion
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Also delete related data
    await Contract.deleteMany({ borrower: userId });
    await Payment.deleteMany({ user: userId });
    
    res.json({ 
      success: true, 
      message: 'User permanently deleted'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reactivate user - NEW FUNCTION
exports.reactivateUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { status: 'eligible' } },
      { new: true }
    ).select('-password -__v');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'User reactivated',
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Review contract
exports.reviewContract = async (req, res) => {
  try {
    const contractId = req.params.contractId;
    
    const contract = await Contract.findById(contractId)
      .populate('borrower', 'userFirstName userLastName email')
      .populate('sponsors', 'userFirstName userLastName email')
      .populate('loanType')
      .lean();

    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    const payments = await Payment.find({ contract: contractId }).lean();

    res.json({
      success: true,
      contract,
      documents: contract.documents,
      payments
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error reviewing contract', details: error.message });
  }
};

// Update contract status
exports.updateContractStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const contractId = req.params.contractId;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updateData = { 
      status,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    };
    
    if (status === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    const contract = await Contract.findByIdAndUpdate(
      contractId,
      updateData,
      { new: true }
    )
    .populate('borrower', 'userFirstName userLastName email');

    if (!contract) {
      return res.status(404).json({ success: false, error: 'Contract not found' });
    }

    res.json({ 
      success: true, 
      message: 'Contract status updated', 
      contract 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error updating contract status', details: error.message });
  }
};

// Add new investor
exports.addInvestor = async (req, res) => {
  try {
    const { name, email, investmentCapacity } = req.body;
    
    if (!name || !email || !investmentCapacity) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, email, and investment capacity are required' 
      });
    }

    const investor = new Investor({
      name,
      email,
      investmentCapacity,
      status: 'active'
    });

    await investor.save();
    res.status(201).json({ 
      success: true, 
      message: 'Investor added successfully', 
      investor 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Error adding investor', 
      details: error.message 
    });
  }
};

// Get all investors
exports.getAllInvestors = async (req, res) => {
  try {
    const investors = await Investor.find().lean();
    res.json({ success: true, investors });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching investors', 
      details: error.message 
    });
  }
};

// Create loan type
exports.createLoanType = async (req, res) => {
  try {
    const { loanName, maxAmount, minAmount, description, priority } = req.body;
    
    const loanType = new loanTypeModel({
      loanName,
      maxAmount,
      minAmount,
      description,
      priority
    });
    
    await loanType.save();
    res.status(201).json(loanType);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update loan type 
exports.updateLoanType = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const loanType = await loanTypeModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });
    
    if (!loanType) {
      return res.status(404).json({ error: 'Loan type not found' });
    }
    
    res.json(loanType);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete loan type 
exports.deleteLoanType = async (req, res) => {
  try {
    const { id } = req.params;
    const loanType = await loanTypeModel.findByIdAndDelete(id);
    
    if (!loanType) {
      return res.status(404).json({ error: 'Loan type not found' });
    }
    
    res.json({ message: 'Loan type deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create loan term
exports.createLoanTerm = async (req, res) => {
  try {
    const { type, maxTerm, minTerm } = req.body;
    
    const loanTerm = new loanTermModel({
      type,
      maxTerm,
      minTerm
    });
    
    await loanTerm.save();
    res.status(201).json(loanTerm);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update loan term 
exports.updateLoanTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const loanTerm = await loanTermModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });
    
    if (!loanTerm) {
      return res.status(404).json({ error: 'Loan term not found' });
    }
    
    res.json(loanTerm);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete loan term 
exports.deleteLoanTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const loanTerm = await loanTermModel.findByIdAndDelete(id);
    
    if (!loanTerm) {
      return res.status(404).json({ error: 'Loan term not found' });
    }
    
    res.json({ message: 'Loan term deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create type-term combination
exports.createTypeTerm = async (req, res) => {
  try {
    const { name, loanTypeID, loanTermID, interestRate } = req.body;

    // Validate input with Joi
    const { error } = validateTypeTerm(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check for existing combination (manual validation)
    const existing = await typetermModel.findOne({ 
      loanTypeID, 
      loanTermID 
    });
    
    if (existing) {
      return res.status(400).json({
        error: 'This loan type and term combination already exists'
      });
    }
    
    // Verify loan type and term exist
    const [loanType, loanTerm] = await Promise.all([
      loanTypeModel.findById(loanTypeID),
      loanTermModel.findById(loanTermID)
    ]);
    
    if (!loanType || !loanTerm) {
      return res.status(400).json({ error: 'Invalid loan type or term' });
    }
    
    const typeTerm = new typetermModel({
      name,
      loanTypeID,
      loanTermID,
      interestRate
    });
    
    await typeTerm.save();
    res.status(201).json(typeTerm);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update type-term combination
exports.updateTypeTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate input with Joi
    if (updates.loanTypeID || updates.loanTermID) {
      const { error } = validateTypeTerm(updates);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
    }
    
    // If changing type/term, check for existing combination
    if (updates.loanTypeID || updates.loanTermID) {
      const existing = await typetermModel.findOne({
        loanTypeID: updates.loanTypeID,
        loanTermID: updates.loanTermID,
        _id: { $ne: id } // Exclude current document
      });
      
      if (existing) {
        return res.status(400).json({
          error: 'This loan type and term combination already exists'
        });
      }
    }
    
    const typeTerm = await typetermModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
    .populate('loanTypeID')
    .populate('loanTermID');
    
    if (!typeTerm) {
      return res.status(404).json({ error: 'Type-term combination not found' });
    }
    
    res.json(typeTerm);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete type-term combination
exports.deleteTypeTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const typeTerm = await typetermModel.findByIdAndDelete(id);
    
    if (!typeTerm) {
      return res.status(404).json({ error: 'Type-term combination not found' });
    }
    
    res.json({ message: 'Type-term combination deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== DOCUMENT MANAGEMENT FUNCTIONS ====================

// Admin: Review and approve/reject document
exports.reviewDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason, adminNotes } = req.body;
    const adminId = req.user.id;
    
    console.log(`Document review request - Document: ${id}, Status: ${status}, Admin: ${adminId}`);
    
    // Validate input
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "approved" or "rejected"' });
    }
    
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required when rejecting a document' });
    }
    
    // Find and update document
    const document = await additionalDocumentModel.findById(id)
      .populate('contractID')
      .populate({ path: 'uploadedBy', model: 'User' })
      .populate('typeID');
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Check if document is already reviewed
    if (document.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Document has already been reviewed',
        currentStatus: document.status
      });
    }
    
    // Update document status
    document.status = status;
    document.reviewedBy = adminId;
    document.reviewedAt = new Date();
    
    if (status === 'rejected') {
      document.rejectionReason = rejectionReason;
    }
    
    if (adminNotes) {
      document.adminNotes = adminNotes;
    }
    
    await document.save();
    
    console.log(`Document ${id} ${status} by admin ${adminId}`);
    
    // Send notification to document uploader
    if (document.uploadedBy) {
      if (status === 'approved') {
        await notificationService.sendDocumentApprovalNotification(
          document.uploadedBy._id, 
          document._id, 
          document.typeID.documentName
        );
      } else {
        await notificationService.sendDocumentRejectionNotification(
          document.uploadedBy._id, 
          document._id, 
          document.typeID.documentName,
          rejectionReason
        );
      }
    }
    
    // Check if all required documents for this contract are now approved
    if (status === 'approved') {
      await checkContractDocumentCompletion(document.contractID);
    }
    
    res.json({
      message: `Document ${status} successfully`,
      document: {
        id: document._id,
        status: document.status,
        reviewedBy: adminId,
        reviewedAt: document.reviewedAt,
        rejectionReason: document.rejectionReason,
        adminNotes: document.adminNotes
      }
    });
  } catch (error) {
    console.error('Error reviewing document:', error);
    res.status(500).json({ error: error.message });
  }
};

// Check if all required documents for a contract are approved
const checkContractDocumentCompletion = async (contractId) => {
  try {
    console.log(`Checking document completion for contract ${contractId}`);
    
    const contract = await Contract.findById(contractId);
    if (!contract) {
      console.error('Contract not found for document completion check');
      return;
    }
    
    // Get all required document types for this contract using junction table
    const requiredDocTypeRelations = await documentTypeTermRelationModel.find({
      typeTermID: contract.typeTermID,
      isRequired: true
    }).populate('documentTypeID');

    const requiredDocTypes = requiredDocTypeRelations.map(relation => ({
      _id: relation.documentTypeID._id,
      documentName: relation.documentTypeID.documentName,
      description: relation.documentTypeID.description,
      isRequired: relation.isRequired
    }));
    
    if (requiredDocTypes.length === 0) {
      console.log('No required documents for this contract type');
      return;
    }
    
    // Get all documents for this contract
    const documents = await additionalDocumentModel.find({ contractID: contractId });
    
    // Check if all required documents are approved
    const allApproved = requiredDocTypes.every(docType => 
      documents.some(doc => 
        doc.typeID.equals(docType._id) && doc.status === 'approved'
      )
    );
    
    if (allApproved) {
      console.log(`All documents approved for contract ${contractId}, triggering contract processing`);
      
      // Update contract status to pending processing if it was waiting for documents
      if (contract.status === 'pending_document_approval') {
        contract.status = 'pending_sponsor_approval';
        await contract.save();
        
        // Notify user that all documents are approved and contract is proceeding
        await notificationService.sendContractDocumentCompletionNotification(contract.userID, contract._id);
        
        // Trigger contract processing
        const { processContractApproval } = require('./contractController');
        await processContractApproval(contract);
      }
    } else {
      console.log(`Not all documents approved for contract ${contractId}`);
    }
  } catch (error) {
    console.error('Error checking document completion:', error);
  }
};

// Admin: Get all pending documents for review
exports.getPendingDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 20, contractId } = req.query;
    
    console.log(`Getting pending documents - Page: ${page}, Limit: ${limit}, Contract: ${contractId}`);
    
    const query = { status: 'pending' };
    if (contractId) {
      query.contractID = contractId;
    }
    
    const documents = await additionalDocumentModel.find(query)
      .populate('typeID')
      .populate({ path: 'contractID', model: 'Contract' })
      .populate({ path: 'uploadedBy', model: 'User' })
      .sort({ uploadedAt: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await additionalDocumentModel.countDocuments(query);
    
    console.log(`Found ${documents.length} pending documents out of ${total} total`);
    
    res.json({
      documents: documents.map(doc => ({
        id: doc._id,
        type: doc.typeID.documentName,
        contractId: doc.contractID._id,
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt,
        documentFile: doc.documentFile
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting pending documents:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get document statistics for admin dashboard
exports.getDocumentStats = async (req, res) => {
  try {
    console.log('Getting document statistics for admin dashboard');
    
    const [pendingCount, approvedCount, rejectedCount, totalCount] = await Promise.all([
      additionalDocumentModel.countDocuments({ status: 'pending' }),
      additionalDocumentModel.countDocuments({ status: 'approved' }),
      additionalDocumentModel.countDocuments({ status: 'rejected' }),
      additionalDocumentModel.countDocuments({})
    ]);
    
    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUploads = await additionalDocumentModel.countDocuments({
      uploadedAt: { $gte: sevenDaysAgo }
    });
    
    const recentReviews = await additionalDocumentModel.countDocuments({
      reviewedAt: { $gte: sevenDaysAgo }
    });
    
    res.json({
      total: totalCount,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      recentActivity: {
        uploads: recentUploads,
        reviews: recentReviews
      },
      percentages: {
        pending: totalCount > 0 ? Math.round((pendingCount / totalCount) * 100) : 0,
        approved: totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0,
        rejected: totalCount > 0 ? Math.round((rejectedCount / totalCount) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting document statistics:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Get all documents with filtering and pagination
exports.getAllDocuments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      contractId, 
      uploadedBy,
      sortBy = 'uploadedAt',
      sortOrder = 'desc'
    } = req.query;
    
    console.log(`Getting all documents with filters - Status: ${status}, Contract: ${contractId}`);
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (contractId) query.contractID = contractId;
    if (uploadedBy) query.uploadedBy = uploadedBy;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const documents = await additionalDocumentModel.find(query)
      .populate('typeID')
      .populate({ path: 'contractID', model: 'Contract' })
      .populate({ path: 'uploadedBy', model: 'User' })
      .populate({ path: 'reviewedBy', model: 'User' })
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await additionalDocumentModel.countDocuments(query);
    
    res.json({
      documents: documents.map(doc => ({
        id: doc._id,
        type: doc.typeID.documentName,
        contractId: doc.contractID._id,
        status: doc.status,
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt,
        reviewedBy: doc.reviewedBy,
        reviewedAt: doc.reviewedAt,
        rejectionReason: doc.rejectionReason,
        adminNotes: doc.adminNotes,
        documentFile: doc.documentFile
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        status,
        contractId,
        uploadedBy
      }
    });
  } catch (error) {
    console.error('Error getting all documents:', error);
    res.status(500).json({ error: error.message });
  }
};
// Admin: Get document types management
exports.getDocumentTypes = async (req, res) => {
  try {
    const documentTypes = await additionalDocumentTypeModel.find()
      .sort({ documentName: 1 });
    
    // Get all relationships
    const relations = await documentTypeTermRelationModel.find()
      .populate('documentTypeID')
      .populate('typeTermID');
    
    res.json({
      documentTypes: documentTypes.map(dt => ({
        id: dt._id,
        name: dt.documentName,
        description: dt.description,
        createdAt: dt.createdAt,
        relations: relations
          .filter(r => r.documentTypeID._id.equals(dt._id))
          .map(r => ({
            relationId: r._id,
            typeTermId: r.typeTermID._id,
            typeTermName: r.typeTermID.name,
            isRequired: r.isRequired
          }))
      }))
    });
  } catch (error) {
    console.error('Error getting document types:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Create document type
exports.createDocumentType = async (req, res) => {
  try {
    const { documentName, description } = req.body;
    
    if (!documentName) {
      return res.status(400).json({ error: 'Document name is required' });
    }
    
    // Check for duplicate document type
    const existing = await additionalDocumentTypeModel.findOne({ documentName });
    
    if (existing) {
      return res.status(400).json({ error: 'Document type with this name already exists' });
    }
    
    const documentType = new additionalDocumentTypeModel({
      documentName,
      description
    });
    
    await documentType.save();
    
    res.status(201).json({
      message: 'Document type created successfully',
      documentType
    });
  } catch (error) {
    console.error('Error creating document type:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Update document type
exports.updateDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const documentType = await additionalDocumentTypeModel.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!documentType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    res.json({
      message: 'Document type updated successfully',
      documentType
    });
  } catch (error) {
    console.error('Error updating document type:', error);
    res.status(500).json({ error: error.message });
  }
};

// Admin: Delete document type
exports.deleteDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if document type is being used in relationships
    const relationsCount = await documentTypeTermRelationModel.countDocuments({ documentTypeID: id });
    if (relationsCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete document type that is associated with type terms',
        relationsCount
      });
    }
    
    // Check if document type is being used by existing documents
    const documentsUsingType = await additionalDocumentModel.countDocuments({ typeID: id });
    if (documentsUsingType > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete document type that is being used by existing documents',
        documentsCount: documentsUsingType
      });
    }
    
    const documentType = await additionalDocumentTypeModel.findByIdAndDelete(id);
    
    if (!documentType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    res.json({ message: 'Document type deleted successfully' });
  } catch (error) {
    console.error('Error deleting document type:', error);
    res.status(500).json({ error: error.message });
  }
};