const { User, Contract, Payment, Investor, Loan } = require('../models/index');
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
    const users = await User.find({ status: { $ne: 'inactive' }, role: 'user' })
      .select('-password -__v -notifications');
    
    // Update loan roles for all users and return updated data
    const usersWithUpdatedRoles = await Promise.all(users.map(async (user) => {
      try {
        const roleUpdateResult = await user.updateLoanRole();
        return {
          _id: user._id,
          userFirstName: user.userFirstName,
          userLastName: user.userLastName,
          email: user.email,
          role: user.role,
          status: user.status,
          isActive: user.isActive,
          loanRole: roleUpdateResult.loanRole,
          borrowerContracts: roleUpdateResult.borrowerContracts,
          sponsorContracts: roleUpdateResult.sponsorContracts,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        };
      } catch (roleUpdateError) {
        console.error(`Error updating loan role for user ${user._id}:`, roleUpdateError);
        // Return user data even if role update fails
        return {
          _id: user._id,
          userFirstName: user.userFirstName,
          userLastName: user.userLastName,
          email: user.email,
          role: user.role,
          status: user.status,
          isActive: user.isActive,
          loanRole: user.loanRole || ['borrower'], // fallback to default
          borrowerContracts: 0,
          sponsorContracts: 0,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          roleUpdateError: roleUpdateError.message
        };
      }
    }));
    
    console.log(`Fetched and updated loan roles for ${usersWithUpdatedRoles.length} users`);
    res.json({ success: true, users: usersWithUpdatedRoles });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Error fetching users', details: error.message });
  }
};

// Get user details
exports.getUserDetails = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findById(userId)
      .select('-password -__v');
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update user's loan role
    let roleUpdateResult;
    try {
      roleUpdateResult = await user.updateLoanRole();
    } catch (roleUpdateError) {
      console.error(`Error updating loan role for user ${userId}:`, roleUpdateError);
      roleUpdateResult = {
        loanRole: user.loanRole || ['borrower'],
        borrowerContracts: 0,
        sponsorContracts: 0
      };
    }

    // Get contracts where user is borrower OR sponsor
    const contracts = await Contract.find({
      $or: [
        { userID: userId },
        { sponsorID_1: userId },
        { sponsorID_2: userId }
      ]
    })
    .populate('userID', 'userFirstName userLastName email')
    .populate('sponsorID_1', 'userFirstName userLastName email')
    .populate('sponsorID_2', 'userFirstName userLastName email')
    .populate({
      path: 'typeTermID',
      populate: [
        { path: 'loanTypeID', select: 'loanName' },
        { path: 'loanTermID', select: 'type' }
      ]
    })
    .lean();

    // Get payments for all contracts
    const paymentPromises = contracts.map(contract => 
      Payment.find({ contractID: contract._id }).lean()
    );
    const payments = await Promise.all(paymentPromises);

    res.json({
      success: true,
      user: {
        _id: user._id,
        userFirstName: user.userFirstName,
        userLastName: user.userLastName,
        email: user.email,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
        loanRole: roleUpdateResult.loanRole,
        borrowerContracts: roleUpdateResult.borrowerContracts,
        sponsorContracts: roleUpdateResult.sponsorContracts,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
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
      { $set: { status: 'eligible', isActive: true } },
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

// Update loan role for a specific user
exports.updateUserLoanRole = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const result = await user.updateLoanRole();
    
    res.json({
      success: true,
      message: 'User loan role updated successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.userFirstName,
        lastName: user.userLastName,
        loanRole: result.loanRole,
        borrowerContracts: result.borrowerContracts,
        sponsorContracts: result.sponsorContracts
      }
    });
  } catch (error) {
    console.error('Error updating user loan role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update loan roles for all users
exports.updateAllUsersLoanRoles = async (req, res) => {
  try {
    console.log('Starting bulk update of all users loan roles...');
    
    const users = await User.find({ status: { $ne: 'inactive' } });
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        const result = await user.updateLoanRole();
        results.push({
          userId: user._id,
          email: user.email,
          success: true,
          loanRole: result.loanRole,
          borrowerContracts: result.borrowerContracts,
          sponsorContracts: result.sponsorContracts
        });
        successCount++;
      } catch (error) {
        console.error(`Error updating loan role for user ${user._id}:`, error);
        results.push({
          userId: user._id,
          email: user.email,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }
    
    console.log(`Bulk update completed: ${successCount} successful, ${errorCount} errors`);
    
    res.json({
      success: true,
      message: `Loan roles updated for ${successCount} users`,
      summary: {
        totalUsers: users.length,
        successCount,
        errorCount
      },
      results: results.slice(0, 50) // Limit results to first 50 for response size
    });
  } catch (error) {
    console.error('Error in bulk update of loan roles:', error);
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

// Get contracts with pending document approval status
exports.getContractsWithPendingDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    console.log(`Getting contracts with pending documents - Page: ${page}, Limit: ${limit}`);
    
    // Find contracts with pending document approval status
    const contracts = await Contract.find({
      status: 'pending_document_approval'
    })
    .populate('userID', 'userFirstName userLastName email')
    .populate('sponsorID_1', 'userFirstName userLastName email')
    .populate('sponsorID_2', 'userFirstName userLastName email')
    .populate({
      path: 'typeTermID',
      populate: [
        { path: 'loanTypeID', select: 'loanName' },
        { path: 'loanTermID', select: 'type' }
      ]
    })
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Contract.countDocuments({
      status: 'pending_document_approval'
    });
    
    // Get basic contract information with pending document count
    const contractsWithBasicInfo = await Promise.all(contracts.map(async (contract) => {
      // Get pending documents count for this contract
      const pendingDocumentsCount = await additionalDocumentModel.countDocuments({
        contractID: contract._id,
        status: 'pending'
      });
      
      return {
        id: contract._id,
        status: contract.status,
        createdAt: contract.createdAt,
        borrower: {
          firstName: contract.userID.userFirstName,
          lastName: contract.userID.userLastName,
          email: contract.userID.email
        },
        loanDetails: {
          typeTermName: contract.typeTermID.name,
          type: contract.typeTermID.loanTypeID.loanName,
          term: contract.typeTermID.loanTermID.type,
          amount: contract.tempLoanAmount,
          termMonths: contract.tempLoanTermMonths
        },
        pendingDocumentsCount
      };
    }));
    
    console.log(`Found ${contracts.length} contracts with pending documents out of ${total} total`);
    
    res.json({
      success: true,
      contracts: contractsWithBasicInfo,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting contracts with pending documents:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching contracts with pending documents', 
      details: error.message 
    });
  }
};

// Get count of contracts with pending document approval status
exports.getContractsWithPendingDocumentsCount = async (req, res) => {
  try {
    console.log('Getting count of contracts with pending documents');
    
    const [pendingDocumentApproval, totalPendingDocuments] = await Promise.all([
      Contract.countDocuments({ status: 'pending_document_approval' }),
      Contract.countDocuments({ status: 'pending_document_approval' })
    ]);
    
    // Get additional statistics
    const [totalContracts, totalDocuments, pendingDocuments] = await Promise.all([
      Contract.countDocuments({}),
      additionalDocumentModel.countDocuments({}),
      additionalDocumentModel.countDocuments({ status: 'pending' })
    ]);
    
    console.log(`Found ${totalPendingDocuments} contracts with pending documents`);
    
    res.json({
      success: true,
      counts: {
        pendingDocumentApproval,
        totalPendingDocuments
      },
      additionalStats: {
        totalContracts,
        totalDocuments,
        pendingDocuments
      },
      percentages: {
        pendingDocumentApprovalPercentage: totalContracts > 0 ? Math.round((pendingDocumentApproval / totalContracts) * 100) : 0,
        pendingDocumentsPercentage: totalDocuments > 0 ? Math.round((pendingDocuments / totalDocuments) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error getting contracts with pending documents count:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching contracts with pending documents count', 
      details: error.message 
    });
  }
};

// Get pending documents for a specific contract
exports.getPendingDocumentsForContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { page = 1, limit = 20, sortBy = 'uploadedAt', sortOrder = 'desc' } = req.query;
    
    console.log(`Getting pending documents for contract ${contractId} - Page: ${page}, Limit: ${limit}`);
    
    // First, verify the contract exists and is in pending_document_approval status
    const contract = await Contract.findById(contractId)
      .populate('userID', 'userFirstName userLastName email');
    
    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        error: 'Contract not found' 
      });
    }
    
    if (contract.status !== 'pending_document_approval') {
      return res.status(400).json({ 
        success: false, 
        error: 'Contract is not in pending document approval status',
        currentStatus: contract.status
      });
    }
    
    // Get only pending documents for this contract
    const pendingDocuments = await additionalDocumentModel.find({ 
      contractID: contractId,
      status: 'pending'
    })
      .populate('typeID')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await additionalDocumentModel.countDocuments({ 
      contractID: contractId,
      status: 'pending'
    });
    
    console.log(`Found ${pendingDocuments.length} pending documents for contract ${contractId}`);
    
    res.json({
      success: true,
      contract: {
        id: contract._id,
        borrower: {
          firstName: contract.userID.userFirstName,
          lastName: contract.userID.userLastName,
          email: contract.userID.email
        }
      },
      pendingDocuments: pendingDocuments.map(doc => ({
        id: doc._id,
        type: doc.typeID.documentName,
        documentFile: doc.documentFile,
        uploadedAt: doc.uploadedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting pending documents for contract:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching pending documents for contract', 
      details: error.message 
    });
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
    const { loanName, description, priority } = req.body;
    
    const loanType = new loanTypeModel({
      loanName,
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
    const { name, loanTypeID, loanTermID, interestRate, minAmount, maxAmount } = req.body;

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
      interestRate,
      minAmount,
      maxAmount
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
    const { error } = validateTypeTerm(updates);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
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
    
    // Handle contract status based on document review result
    if (status === 'approved') {
      // Check if all required documents for this contract are now approved
      await checkContractDocumentCompletion(document.contractID);
    } else if (status === 'rejected') {
      // When a document is rejected, set contract to pending_document_reupload
      // This allows the user to re-upload the rejected document
      const contract = await Contract.findById(document.contractID);
      if (contract && contract.status === 'pending_document_approval') {
        contract.status = 'pending_document_reupload';
        await contract.save();
        console.log(`Contract ${document.contractID} status updated to pending_document_reupload due to document rejection`);
        
        // Notify user that they need to re-upload the rejected document
        await notificationService.sendDocumentRejectionRequiresReuploadNotification(
          document.uploadedBy._id,
          document.contractID,
          document.typeID.documentName,
          rejectionReason
        );
      }
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
      console.log(`All documents approved for contract ${contractId}, triggering sponsor approval requests`);
      // Update contract status to pending_sponsor_approval if it was waiting for documents
      if (contract.status === 'pending_document_upload' || contract.status === 'pending_document_approval' || contract.status === 'pending_document_reupload') {
        contract.status = 'pending_sponsor_approval';
        await contract.save();
        // Notify user that all documents are approved and contract is proceeding
        await notificationService.sendContractDocumentCompletionNotification(contract.userID, contract._id);
        // Add contract to sponsors' pending approvals and send notifications
        const User = require('../models/user').User;
        const borrower = await User.findById(contract.userID);
        const sponsor1 = await User.findById(contract.sponsorID_1);
        const sponsor2 = await User.findById(contract.sponsorID_2);
        // Populate loanTypeID if not populated
        let loanTypeRecord;
        if (contract.typeTermID && contract.typeTermID.loanTypeID) {
          loanTypeRecord = contract.typeTermID.loanTypeID;
        } else {
          // Fetch typeTerm and populate loanTypeID
          const typetermModel = require('../models/typeterm').typetermModel;
          const typeTerm = await typetermModel.findById(contract.typeTermID).populate('loanTypeID');
          loanTypeRecord = typeTerm ? typeTerm.loanTypeID : undefined;
        }
        const loanDetails = {
          type: loanTypeRecord ? loanTypeRecord.loanName : '',
          amount: contract.tempLoanAmount,
          term: `${contract.tempLoanTermMonths} months`
        };
        await Promise.all([
          User.findByIdAndUpdate(sponsor1._id, {
            $push: {
              pendingApprovals: {
                contractId: contract._id,
                borrowerId: contract.userID,
                requestedAt: new Date()
              }
            }
          }),
          User.findByIdAndUpdate(sponsor2._id, {
            $push: {
              pendingApprovals: {
                contractId: contract._id,
                borrowerId: contract.userID,
                requestedAt: new Date()
              }
            }
          }),
          notificationService.sendSponsorRequest(sponsor1, borrower, loanDetails),
          notificationService.sendSponsorRequest(sponsor2, borrower, loanDetails)
        ]);
      }
    } else {
      // If not all approved, but all required docs are uploaded, set status to pending_document_approval
      if (contract.status === 'pending_document_upload' || contract.status === 'pending_document_reupload') {
        contract.status = 'pending_document_approval';
        await contract.save();
      }
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

// Admin: Get comprehensive dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('Getting comprehensive dashboard statistics');
    
    // Get basic counts
    const [totalUsers, totalContracts, approvedContracts, rejectedContracts] = await Promise.all([
      User.countDocuments({ status: { $ne: 'inactive' } }),
      Contract.countDocuments({}),
      Contract.countDocuments({ status: { $in: ['approved', 'active'] } }),
      Contract.countDocuments({ status: 'rejected' })
    ]);
    
    // Get loan type statistics
    const contractsWithLoanTypes = await Contract.find({})
      .populate({
        path: 'typeTermID',
        populate: {
          path: 'loanTypeID',
          select: 'loanName'
        }
      })
      .lean();
    
    // Calculate loan type percentages
    const loanTypeStats = {};
    let totalContractsWithLoanTypes = 0;
    
    contractsWithLoanTypes.forEach(contract => {
      if (contract.typeTermID && contract.typeTermID.loanTypeID) {
        const loanTypeName = contract.typeTermID.loanTypeID.loanName;
        if (!loanTypeStats[loanTypeName]) {
          loanTypeStats[loanTypeName] = {
            count: 0,
            percentage: 0
          };
        }
        loanTypeStats[loanTypeName].count++;
        totalContractsWithLoanTypes++;
      }
    });
    
    // Calculate percentages
    Object.keys(loanTypeStats).forEach(loanType => {
      loanTypeStats[loanType].percentage = totalContractsWithLoanTypes > 0 
        ? Math.round((loanTypeStats[loanType].count / totalContractsWithLoanTypes) * 100) 
        : 0;
    });
    
    // Get additional statistics
    const [pendingContracts, activeContracts, completedContracts] = await Promise.all([
      Contract.countDocuments({ 
        status: { 
          $in: ['pending', 'pending_sponsor_approval', 'pending_document_approval', 'pending_processing', 'pending_document_upload', 'pending_document_reupload'] 
        } 
      }),
      Contract.countDocuments({ status: 'active' }),
      Contract.countDocuments({ status: 'completed' })
    ]);

    // Calculate total funded amount from active and completed loans
    const totalFundedAmount = await Loan.aggregate([
      {
        $match: {
          status: { $in: ['active', 'completed'] }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$loanAmount' }
        }
      }
    ]);

    const fundedAmount = totalFundedAmount.length > 0 ? totalFundedAmount[0].totalAmount : 0;
    
    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [recentUsers, recentContracts, recentApprovals, recentRejections] = await Promise.all([
      User.countDocuments({ 
        createdAt: { $gte: thirtyDaysAgo },
        status: { $ne: 'inactive' }
      }),
      Contract.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Contract.countDocuments({ 
        status: { $in: ['approved', 'active'] },
        approvedAt: { $gte: thirtyDaysAgo }
      }),
      Contract.countDocuments({ 
        status: 'rejected',
        updatedAt: { $gte: thirtyDaysAgo }
      })
    ]);
    
    // Generate monthly contract rate data for line chart (last 12 months)
    const monthlyContractData = [];
    const currentDate = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);
      
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      // Get contracts for this month
      const [monthlyTotal, monthlyApproved, monthlyPending, monthlyRejected] = await Promise.all([
        Contract.countDocuments({
          createdAt: { $gte: monthDate, $lt: nextMonthDate }
        }),
        Contract.countDocuments({
          createdAt: { $gte: monthDate, $lt: nextMonthDate },
          status: { $in: ['approved', 'active', 'completed'] }
        }),
        Contract.countDocuments({
          createdAt: { $gte: monthDate, $lt: nextMonthDate },
          status: { $in: ['pending', 'pending_sponsor_approval', 'pending_document_approval', 'pending_processing', 'pending_document_upload', 'pending_document_reupload'] }
        }),
        Contract.countDocuments({
          createdAt: { $gte: monthDate, $lt: nextMonthDate },
          status: 'rejected'
        })
      ]);
      
      monthlyContractData.push({
        month: monthName,
        total: monthlyTotal,
        approved: monthlyApproved,
        pending: monthlyPending,
        rejected: monthlyRejected
      });
    }
    
    console.log(`Dashboard stats calculated - Users: ${totalUsers}, Contracts: ${totalContracts}, Approved: ${approvedContracts}, Rejected: ${rejectedContracts}, Total Funded: ${fundedAmount}`);
    
    res.json({
      success: true,
      statistics: {
        users: {
          total: totalUsers,
          recent: recentUsers
        },
        contracts: {
          total: totalContracts,
          approved: approvedContracts,
          rejected: rejectedContracts,
          pending: pendingContracts,
          active: activeContracts,
          completed: completedContracts,
          recent: recentContracts
        },
        loans: {
          total: approvedContracts + activeContracts, // Total approved loans
          recent: recentApprovals,
          totalFundedAmount: fundedAmount
        },
        recentActivity: {
          approvals: recentApprovals,
          rejections: recentRejections
        }
      },
      loanTypeDistribution: {
        totalContracts: totalContractsWithLoanTypes,
        types: loanTypeStats
      },
      percentages: {
        approvalRate: totalContracts > 0 ? Math.round((approvedContracts / totalContracts) * 100) : 0,
        rejectionRate: totalContracts > 0 ? Math.round((rejectedContracts / totalContracts) * 100) : 0,
        pendingRate: totalContracts > 0 ? Math.round((pendingContracts / totalContracts) * 100) : 0
      },
      monthlyContractTrends: {
        data: monthlyContractData,
        summary: {
          totalApplications: monthlyContractData.reduce((sum, month) => sum + month.total, 0),
          averageMonthlyApplications: Math.round(monthlyContractData.reduce((sum, month) => sum + month.total, 0) / 12),
          highestMonth: monthlyContractData.reduce((max, month) => month.total > max.total ? month : max, monthlyContractData[0]),
          lowestMonth: monthlyContractData.reduce((min, month) => month.total < min.total ? month : min, monthlyContractData[0])
        }
      }
    });
  } catch (error) {
    console.error('Error getting dashboard statistics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching dashboard statistics', 
      details: error.message 
    });
  }
};

// Get active loans for each user
exports.getUserActiveLoans = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    console.log(`Getting active loans for user ${userId}`);
    
    // First, verify the user exists
    const user = await User.findById(userId)
      .select('userFirstName userLastName email role')
      .lean();
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Step 1: get user's contracts that have loans and extract loan IDs
    const userContracts = await Contract.find({
      $or: [
        { userID: userId },
        { sponsorID_1: userId },
        { sponsorID_2: userId }
      ],
      loanID: { $exists: true, $ne: null }
    })
    .select('_id loanID')
    .lean();

    const loanIds = userContracts.map(c => c.loanID).filter(Boolean);

    // Step 2: count active loans directly
    const total = loanIds.length
      ? await Loan.countDocuments({ 
          _id: { $in: loanIds }, 
          status: 'active' 
        })
      : 0;

    // Step 3: fetch paginated active loans with type term info
    const activeLoans = loanIds.length
      ? await Loan.find({ 
          _id: { $in: loanIds }, 
          status: 'active' 
        })
        .populate({
          path: 'typeTermID',
          populate: [
            { path: 'loanTypeID', select: 'loanName' },
            { path: 'loanTermID', select: 'type' }
          ]
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean()
      : [];

    // Step 4: get corresponding contracts for participants info
    const activeLoanIds = activeLoans.map(l => l._id);
    const contracts = await Contract.find({ loanID: { $in: activeLoanIds } })
      .populate('userID', 'userFirstName userLastName email')
      .populate('sponsorID_1', 'userFirstName userLastName email')
      .populate('sponsorID_2', 'userFirstName userLastName email')
      .lean();

    const contractByLoanId = Object.fromEntries(
      contracts.map(c => [String(c.loanID), c])
    );
    
    // Get payment information for each loan
    const loansWithPayments = await Promise.all(activeLoans.map(async (loan) => {
      const contract = contractByLoanId[String(loan._id)];
      let payments = [];
      
      payments = await Payment.find({ loanID: loan._id })
        .sort({ dueDate: 1 })
        .lean();

      // Determine user's role in this contract
      let userRole = 'unknown';
      let roleDescription = '';
      if (contract.userID._id.toString() === userId) {
        userRole = 'borrower';
        roleDescription = 'Primary borrower of this loan';
      } else if (contract.sponsorID_1._id.toString() === userId) {
        userRole = 'sponsor_1';
        roleDescription = 'Primary sponsor/guarantor for this loan';
      } else if (contract.sponsorID_2._id.toString() === userId) {
        userRole = 'sponsor_2';
        roleDescription = 'Secondary sponsor/guarantor for this loan';
      }

      // Calculate payment statistics
      const totalPayments = payments.length;
      const paidPayments = payments.filter(p => p.status === 'paid').length;
      const overduePayments = payments.filter(p => 
        p.status === 'unpaid' && new Date(p.dueDate) < new Date()
      ).length;

      // Calculate balances using scheduled payments (includes interest)
      const totalScheduledAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
      const remainingBalance = Math.max(0, totalScheduledAmount - paidAmount);

      // Calculate loan progress
      const progressPercentage = totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 0;

      return {
        contractId: contract._id,
        userRole,
        roleDescription,
        loanDetails: {
          loanId: loan._id,
          amount: loan.loanAmount,
          termMonths: loan.loanTermMonths,
          startDate: loan.startDate,
          endDate: loan.endDate,
          interestRate: loan.interestRate,
          status: loan.status,
          remainingBalance: remainingBalance,
          totalBalance: totalScheduledAmount,
          typeTermName: loan.typeTermID ? loan.typeTermID.name : null
        },
        loanType: {
          name: loan.typeTermID.name,
          type: loan.typeTermID.loanTypeID.loanName,
          term: loan.typeTermID.loanTermID.type
        },
        participants: {
          borrower: {
            id: contract.userID._id,
            firstName: contract.userID.userFirstName,
            lastName: contract.userID.userLastName,
            email: contract.userID.email
          },
          sponsor1: {
            id: contract.sponsorID_1._id,
            firstName: contract.sponsorID_1.userFirstName,
            lastName: contract.sponsorID_1.userLastName,
            email: contract.sponsorID_1.email
          },
          sponsor2: {
            id: contract.sponsorID_2._id,
            firstName: contract.sponsorID_2.userFirstName,
            lastName: contract.sponsorID_2.userLastName,
            email: contract.sponsorID_2.email
          }
        },
        paymentStats: {
          total: totalPayments,
          paid: paidPayments,
          unpaid: totalPayments - paidPayments,
          overdue: overduePayments,
          progressPercentage
        },
        payments: payments.map(p => ({
          id: p._id,
          amount: p.amount,
          dueDate: p.dueDate,
          payedDate: p.payedDate,
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        })),
        contractStatus: contract.status,
        createdAt: contract.createdAt,
        approvedAt: contract.approvedAt
      };
    }));
    
    console.log(`Found ${activeLoans.length} active loans for user ${userId}`);
    
    // Calculate summary statistics
    const borrowerLoans = loansWithPayments.filter(loan => loan.userRole === 'borrower');
    const sponsorLoans = loansWithPayments.filter(loan => loan.userRole.startsWith('sponsor'));

    // Totals including interest (sum of scheduled payment amounts)
    const totalBorrowedAmount = borrowerLoans.reduce((sum, loan) => sum + (loan.loanDetails.totalBalance || 0), 0);
    const totalSponsoredAmount = sponsorLoans.reduce((sum, loan) => sum + (loan.loanDetails.totalBalance || 0), 0);
    const totalRemainingBalance = loansWithPayments.reduce((sum, loan) => sum + (loan.loanDetails.remainingBalance || 0), 0);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.userFirstName,
        lastName: user.userLastName,
        email: user.email,
        role: user.role
      },
      summary: {
        totalActiveLoans: loansWithPayments.length,
        asBorrower: {
          count: borrowerLoans.length,
          totalAmount: totalBorrowedAmount
        },
        asSponsor: {
          count: sponsorLoans.length,
          totalSponsoredAmount: totalSponsoredAmount
        },
        totalRemainingBalance
      },
      activeLoans: loansWithPayments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting user active loans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching user active loans', 
      details: error.message 
    });
  }
};

// Get all users with their active loans summary
exports.getAllUsersWithActiveLoans = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    console.log(`Getting all users with active loans summary - Page: ${page}, Limit: ${limit}`);
    
    // Build user query
    const userQuery = { status: { $ne: 'inactive' } };
    if (search) {
      userQuery.$or = [
        { userFirstName: { $regex: search, $options: 'i' } },
        { userLastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get users with pagination
    const users = await User.find(userQuery)
      .select('userFirstName userLastName email role createdAt status')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalUsers = await User.countDocuments(userQuery);
    
    // Get active loans count and update loan roles for each user
    const usersWithLoanCounts = await Promise.all(users.map(async (user) => {
      const [borrowerLoans, sponsorLoans] = await Promise.all([
        Contract.countDocuments({ userID: user._id, status: 'active' }),
        Contract.countDocuments({
          $or: [{ sponsorID_1: user._id }, { sponsorID_2: user._id }],
          status: 'active'
        })
      ]);
      
      const totalActiveLoans = borrowerLoans + sponsorLoans;
      
      // Update user's loan role
      let roleUpdateResult;
      try {
        roleUpdateResult = await user.updateLoanRole();
      } catch (roleUpdateError) {
        console.error(`Error updating loan role for user ${user._id}:`, roleUpdateError);
        roleUpdateResult = {
          loanRole: user.loanRole || ['borrower'],
          borrowerContracts: 0,
          sponsorContracts: 0
        };
      }
      
      return {
        _id: user._id,
        userFirstName: user.userFirstName,
        userLastName: user.userLastName,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        loanRole: roleUpdateResult.loanRole,
        borrowerContracts: roleUpdateResult.borrowerContracts,
        sponsorContracts: roleUpdateResult.sponsorContracts,
        activeLoans: {
          asBorrower: borrowerLoans,
          asSponsor: sponsorLoans,
          total: totalActiveLoans
        }
      };
    }));
    
    console.log(`Found ${users.length} users with active loans summary`);
    
    res.json({
      success: true,
      users: usersWithLoanCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / parseInt(limit))
      },
      filters: {
        search
      }
    });
  } catch (error) {
    console.error('Error getting all users with active loans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching users with active loans', 
      details: error.message 
    });
  }
};

// Get all completed loans for a user (basic information without payments)
exports.getUserCompletedLoans = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    console.log(`Getting completed loans for user ${userId}`);
    
    // First, verify the user exists
    const user = await User.findById(userId)
      .select('userFirstName userLastName email role')
      .lean();
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Step 1: get user's contracts that have loans and extract loan IDs
    const userContracts = await Contract.find({
      $or: [
        { userID: userId },
        { sponsorID_1: userId },
        { sponsorID_2: userId }
      ],
      loanID: { $exists: true, $ne: null }
    })
    .select('_id loanID')
    .lean();

    const loanIds = userContracts.map(c => c.loanID).filter(Boolean);

    // Step 2: count completed loans directly
    const total = loanIds.length
      ? await Loan.countDocuments({ 
          _id: { $in: loanIds }, 
          status: 'completed' 
        })
      : 0;

    // Step 3: fetch paginated completed loans with type term info
    const completedLoanDocuments = loanIds.length
      ? await Loan.find({ 
          _id: { $in: loanIds }, 
          status: 'completed' 
        })
        .populate({
          path: 'typeTermID',
          populate: [
            { path: 'loanTypeID', select: 'loanName' },
            { path: 'loanTermID', select: 'type' }
          ]
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit))
        .lean()
      : [];
    
    // Step 4: get corresponding contracts for participants info
    const completedLoanIds = completedLoanDocuments.map(l => l._id);
    const contracts = await Contract.find({ loanID: { $in: completedLoanIds } })
      .populate('userID', 'userFirstName userLastName email')
      .populate('sponsorID_1', 'userFirstName userLastName email')
      .populate('sponsorID_2', 'userFirstName userLastName email')
      .lean();

    const contractByLoanId = Object.fromEntries(
      contracts.map(c => [String(c.loanID), c])
    );
    
    // Process completed loans with basic information (no payment details)
    const completedLoansWithDetails = completedLoanDocuments.map((loan) => {
      const contract = contractByLoanId[String(loan._id)];
      
      // Determine user's role in this contract
      let userRole = 'unknown';
      let roleDescription = '';
      if (contract.userID._id.toString() === userId) {
        userRole = 'borrower';
        roleDescription = 'Primary borrower of this loan';
      } else if (contract.sponsorID_1._id.toString() === userId) {
        userRole = 'sponsor_1';
        roleDescription = 'Primary sponsor/guarantor for this loan';
      } else if (contract.sponsorID_2._id.toString() === userId) {
        userRole = 'sponsor_2';
        roleDescription = 'Secondary sponsor/guarantor for this loan';
      }
      
      return {
        contractId: contract._id,
        userRole,
        roleDescription,
        loanDetails: {
          loanId: loan._id,
          amount: loan.loanAmount,
          termMonths: loan.loanTermMonths,
          startDate: loan.startDate,
          endDate: loan.endDate,
          interestRate: loan.interestRate,
          status: loan.status
        },
        loanType: {
          name: loan.typeTermID.name,
          type: loan.typeTermID.loanTypeID.loanName,
          term: loan.typeTermID.loanTermID.type
        },
        participants: {
          borrower: {
            id: contract.userID._id,
            firstName: contract.userID.userFirstName,
            lastName: contract.userID.userLastName,
            email: contract.userID.email
          },
          sponsor1: {
            id: contract.sponsorID_1._id,
            firstName: contract.sponsorID_1.userFirstName,
            lastName: contract.sponsorID_1.userLastName,
            email: contract.sponsorID_1.email
          },
          sponsor2: {
            id: contract.sponsorID_2._id,
            firstName: contract.sponsorID_2.userFirstName,
            lastName: contract.sponsorID_2.userLastName,
            email: contract.sponsorID_2.email
          }
        },
        contractStatus: contract.status,
        createdAt: contract.createdAt,
        approvedAt: contract.approvedAt,
        completedAt: loan.updatedAt
      };
    });
    
    console.log(`Found ${completedLoanDocuments.length} completed loans for user ${userId}`);
    
    // Calculate summary statistics
    const borrowerLoans = completedLoansWithDetails.filter(loan => loan.userRole === 'borrower');
    const sponsorLoans = completedLoansWithDetails.filter(loan => loan.userRole.startsWith('sponsor'));
    
    const totalBorrowedAmount = borrowerLoans.reduce((sum, loan) => sum + loan.loanDetails.amount, 0);
    const totalSponsoredAmount = sponsorLoans.reduce((sum, loan) => sum + loan.loanDetails.amount, 0);
    
    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.userFirstName,
        lastName: user.userLastName,
        email: user.email,
        role: user.role
      },
      summary: {
        totalCompletedLoans: completedLoansWithDetails.length,
        asBorrower: {
          count: borrowerLoans.length,
          totalAmount: totalBorrowedAmount
        },
        asSponsor: {
          count: sponsorLoans.length,
          totalSponsoredAmount: totalSponsoredAmount
        }
      },
      completedLoans: completedLoansWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting user completed loans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching user completed loans', 
      details: error.message 
    });
  }
};

// Get all users with their completed loans summary
exports.getAllUsersWithCompletedLoans = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    console.log(`Getting all users with completed loans summary - Page: ${page}, Limit: ${limit}`);
    
    // Build user query
    const userQuery = { status: { $ne: 'inactive' } };
    if (search) {
      userQuery.$or = [
        { userFirstName: { $regex: search, $options: 'i' } },
        { userLastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get users with pagination
    const users = await User.find(userQuery)
      .select('userFirstName userLastName email role createdAt status')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const totalUsers = await User.countDocuments(userQuery);
    
    // Get completed loans count and update loan roles for each user
    const usersWithLoanCounts = await Promise.all(users.map(async (user) => {
      const [borrowerLoans, sponsorLoans] = await Promise.all([
        Contract.countDocuments({ userID: user._id, status: 'completed' }),
        Contract.countDocuments({
          $or: [{ sponsorID_1: user._id }, { sponsorID_2: user._id }],
          status: 'completed'
        })
      ]);
      
      const totalCompletedLoans = borrowerLoans + sponsorLoans;
      
      // Update user's loan role
      let roleUpdateResult;
      try {
        roleUpdateResult = await user.updateLoanRole();
      } catch (roleUpdateError) {
        console.error(`Error updating loan role for user ${user._id}:`, roleUpdateError);
        roleUpdateResult = {
          loanRole: user.loanRole || ['borrower'],
          borrowerContracts: 0,
          sponsorContracts: 0
        };
      }
      
      return {
        _id: user._id,
        userFirstName: user.userFirstName,
        userLastName: user.userLastName,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        loanRole: roleUpdateResult.loanRole,
        borrowerContracts: roleUpdateResult.borrowerContracts,
        sponsorContracts: roleUpdateResult.sponsorContracts,
        completedLoans: {
          asBorrower: borrowerLoans,
          asSponsor: sponsorLoans,
          total: totalCompletedLoans
        }
      };
    }));
    
    console.log(`Found ${users.length} users with completed loans summary`);
    
    res.json({
      success: true,
      users: usersWithLoanCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalUsers,
        pages: Math.ceil(totalUsers / parseInt(limit))
      },
      filters: {
        search
      }
    });
  } catch (error) {
    console.error('Error getting all users with completed loans:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching users with completed loans', 
      details: error.message 
    });
  }
};

// Get borrowers with late payments
exports.getBorrowersWithLatePayments = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const now = new Date();

    // Build user search filter if provided
    let userMatch = {};
    if (search) {
      userMatch = {
        $or: [
          { 'user.userFirstName': { $regex: search, $options: 'i' } },
          { 'user.userLastName': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } }
        ]
      };
    }

    const pipeline = [
      // Payments that are due and not paid
      {
        $match: {
          dueDate: { $lt: now },
          status: { $ne: 'paid' }
        }
      },
      // Join loan
      {
        $lookup: {
          from: 'loans',
          localField: 'loanID',
          foreignField: '_id',
          as: 'loan'
        }
      },
      { $unwind: '$loan' },
      // Join contract to find borrower
      {
        $lookup: {
          from: 'contracts',
          let: { loanId: '$loanID' },
          pipeline: [
            { $match: { $expr: { $eq: ['$loanID', '$$loanId'] } } },
            { $project: { userID: 1, status: 1 } }
          ],
          as: 'contract'
        }
      },
      { $unwind: '$contract' },
      // Only consider contracts that are approved/active
      {
        $match: {
          'contract.status': { $in: ['approved', 'active'] }
        }
      },
      // Group by borrower
      {
        $group: {
          _id: '$contract.userID',
          latePaymentsCount: { $sum: 1 },
          totalOverdueAmount: { $sum: '$amount' },
          oldestDueDate: { $min: '$dueDate' },
          latestDueDate: { $max: '$dueDate' },
          samplePayment: { $first: '$$ROOT' }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      // Optional search on user fields
      ...(search ? [{ $match: userMatch }] : []),
      // Sort by severity then recency
      { $sort: { latePaymentsCount: -1, totalOverdueAmount: -1, oldestDueDate: 1 } },
      // Pagination
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
      // Final shape
      {
        $project: {
          _id: 0,
          borrowerId: '$_id',
          user: {
            id: '$user._id',
            firstName: '$user.userFirstName',
            lastName: '$user.userLastName',
            email: '$user.email'
          },
          metrics: {
            latePaymentsCount: '$latePaymentsCount',
            totalOverdueAmount: '$totalOverdueAmount',
            oldestDueDate: '$oldestDueDate',
            latestDueDate: '$latestDueDate'
          }
        }
      }
    ];

    // Count pipeline for total
    const countPipeline = [
      { $match: { dueDate: { $lt: now }, status: { $ne: 'paid' } } },
      { $lookup: { from: 'loans', localField: 'loanID', foreignField: '_id', as: 'loan' } },
      { $unwind: '$loan' },
      { $lookup: { from: 'contracts', let: { loanId: '$loanID' }, pipeline: [ { $match: { $expr: { $eq: ['$loanID', '$$loanId'] } } }, { $project: { userID: 1, status: 1 } } ], as: 'contract' } },
      { $unwind: '$contract' },
      { $match: { 'contract.status': { $in: ['approved', 'active'] } } },
      { $group: { _id: '$contract.userID' } },
      { $count: 'total' }
    ];

    const [results, countRes] = await Promise.all([
      Payment.aggregate(pipeline),
      Payment.aggregate(countPipeline)
    ]);

    const total = countRes[0]?.total || 0;

    res.json({
      success: true,
      borrowers: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: { search }
    });
  } catch (error) {
    console.error('Error getting borrowers with late payments:', error);
    res.status(500).json({ success: false, error: 'Error fetching borrowers with late payments', details: error.message });
  }
};