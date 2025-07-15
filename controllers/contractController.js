const mongoose = require('mongoose');
const cloudinary = require('../utils/cloudinary');
const upload = require('../middleware/multer');
const notificationService = require('../services/notificationService');

// Import all models at the top
const { User } = require('../models/user');
const { Contract } = require('../models/contract');
const { Loan } = require('../models/loan');
const { loanTermModel } = require('../models/loanTerm');
const { loanTypeModel } = require('../models/loanType');
const { typetermModel } = require('../models/typeterm');
const { additionalDocumentTypeModel } = require('../models/additionalDocumentType');
const { additionalDocumentModel } = require('../models/additionalDocument');
const { documentTypeTermRelationModel } = require('../models/documentTypeTermRelation');

exports.createContract = async (req, res) => {
  try {
    // Parse form data
    const files = req.files || [];
    const body = req.body;

    const { 
      loanType, 
      loanTerm, 
      loanAmount, 
      loanTermMonths, 
      employmentStatus, 
      sponsorEmail1, 
      sponsorEmail2,
    } = body;
    
    const userId = req.user.id;

    // Input validation
    if (!loanType || !loanTerm || !loanAmount || !loanTermMonths || !employmentStatus || !sponsorEmail1 || !sponsorEmail2) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['loanType', 'loanTerm', 'loanAmount', 'loanTermMonths', 'employmentStatus', 'sponsorEmail1', 'sponsorEmail2']
      });
    }

    // Validate numeric fields
    if (isNaN(loanAmount) || loanAmount <= 0) {
      return res.status(400).json({ error: 'Invalid loan amount' });
    }

    if (isNaN(loanTermMonths) || loanTermMonths <= 0) {
      return res.status(400).json({ error: 'Invalid loan term months' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sponsorEmail1) || !emailRegex.test(sponsorEmail2)) {
      return res.status(400).json({ error: 'Invalid email format for sponsors' });
    }

    // Check if sponsors are the same
    if (sponsorEmail1 === sponsorEmail2) {
      return res.status(400).json({ error: 'Sponsors must be different individuals' });
    }

    // Check if user is trying to sponsor themselves
    const user = await User.findById(userId);
    if (user.email === sponsorEmail1 || user.email === sponsorEmail2) {
      return res.status(400).json({ error: 'You cannot be your own sponsor' });
    }

    // 1. Find loan type by name
    const loanTypeRecord = await loanTypeModel.findOne({ loanName: loanType });
    if (!loanTypeRecord) {
      return res.status(400).json({ 
        error: 'Invalid loan type',
        validTypes: await loanTypeModel.find().distinct('loanName')
      });
    }

    // 2. Find loan term by type
    const loanTermRecord = await loanTermModel.findOne({ type: loanTerm });
    if (!loanTermRecord) {
      return res.status(400).json({ 
        error: 'Invalid loan term',
        validTerms: await loanTermModel.find().distinct('type')
      });
    }

    // 3. Find typeTerm that matches both loan type and term
    const typeTerm = await typetermModel.findOne({
      loanTypeID: loanTypeRecord._id,
      loanTermID: loanTermRecord._id
    })
      .populate('loanTypeID')
      .populate('loanTermID');

    if (!typeTerm) {
      return res.status(400).json({ 
        error: 'No loan product found for this type and term combination',
        validCombinations: await getValidTypeTermCombinations()
      });
    }

    // 4. Validate loan parameters
    if (loanAmount < typeTerm.minAmount || 
        loanAmount > typeTerm.maxAmount) {
      return res.status(400).json({ 
        error: `Loan amount must be between ${typeTerm.minAmount} and ${typeTerm.maxAmount}`,
        minAmount: typeTerm.minAmount,
        maxAmount: typeTerm.maxAmount
      });
    }

    if (loanTermMonths < loanTermRecord.minTerm || 
        loanTermMonths > loanTermRecord.maxTerm) {
      return res.status(400).json({ 
        error: `Loan term must be between ${loanTermRecord.minTerm} and ${loanTermRecord.maxTerm} months`,
        minTerm: loanTermRecord.minTerm,
        maxTerm: loanTermRecord.maxTerm
      });
    }

     // 5. Find sponsors by email
    const [sponsor1, sponsor2] = await Promise.all([
      User.findOne({ email: sponsorEmail1 }),
      User.findOne({ email: sponsorEmail2 })
    ]);
    
    if (!sponsor1 || !sponsor2) {
      const missingSponsors = [];
      if (!sponsor1) missingSponsors.push(sponsorEmail1);
      if (!sponsor2) missingSponsors.push(sponsorEmail2);
      
      return res.status(400).json({ 
        error: 'One or both sponsors not found',
        missingSponsors
      });
    }
    
    // 6. Validate sponsor eligibility
    const ineligibleSponsors = [];
    if (sponsor1.status !== 'eligible') ineligibleSponsors.push(sponsorEmail1);
    if (sponsor2.status !== 'eligible') ineligibleSponsors.push(sponsorEmail2);
    
    if (ineligibleSponsors.length > 0) {
      return res.status(400).json({ 
        error: 'One or both sponsors are not eligible',
        ineligibleSponsors
      });
    }

    // 7. Check sponsor availability for loan type
    const [sponsor1Count, sponsor2Count] = await Promise.all([
      Contract.countDocuments({
        $or: [{ sponsorID_1: sponsor1._id }, { sponsorID_2: sponsor1._id }],
        status: { $in: ['approved', 'active'] },
        'typeTermID.loanTypeID': loanTypeRecord._id
      }),
      Contract.countDocuments({
        $or: [{ sponsorID_1: sponsor2._id }, { sponsorID_2: sponsor2._id }],
        status: { $in: ['approved', 'active'] },
        'typeTermID.loanTypeID': loanTypeRecord._id
      })
    ]);
    
    const unavailableSponsors = [];
    if (sponsor1Count >= 2) unavailableSponsors.push(sponsorEmail1);
    if (sponsor2Count >= 2) unavailableSponsors.push(sponsorEmail2);
    
    if (unavailableSponsors.length > 0) {
      return res.status(400).json({
        error: 'One or both sponsors have reached their guarantee limit for this loan type',
        unavailableSponsors
      });
    }

    // 8. Get required document types using junction table
    const requiredDocTypeRelations = await documentTypeTermRelationModel.find({
      typeTermID: typeTerm._id,
      isRequired: true
    }).populate('documentTypeID');

    const requiredDocTypes = requiredDocTypeRelations.map(relation => ({
      _id: relation.documentTypeID._id,
      documentName: relation.documentTypeID.documentName,
      description: relation.documentTypeID.description,
      isRequired: relation.isRequired
    }));

    console.log(`Found ${requiredDocTypes.length} required document types for this loan type`);

    // 9. Create contract
    const contract = new Contract({
      userID: userId,
      sponsorID_1: sponsor1._id,
      sponsorID_2: sponsor2._id,
      typeTermID: typeTerm._id,
      tempLoanAmount: loanAmount,
      tempLoanTermMonths: loanTermMonths,
      tempStartDate: new Date(),
      employmentStatus,
      status: 'pending_sponsor_approval', 
      priority: loanTypeRecord.priority
    });

    await contract.save();

    // 10. Handle document uploads (required)
    const uploadedDocuments = [];
    
    if (requiredDocTypes.length > 0) {
      console.log(`Processing ${files ? files.length : 0} uploaded files`);
      
      // Check if files were provided
      if (!files || files.length === 0) {
        return res.status(400).json({ 
          error: 'Documents are required for this loan type',
          message: 'Please upload all required documents to complete your application',
          requiredDocuments: requiredDocTypes.map(dt => ({
            id: dt._id,
            name: dt.documentName,
            description: dt.description || 'Required document'
          })),
          instructions: {
            howToUpload: 'Send files using multipart/form-data with field names like "doc_[documentTypeId]"',
            example: `For document type ${requiredDocTypes[0].documentName}, use field name "doc_${requiredDocTypes[0]._id}"`
          }
        });
      }
      
      for (const docType of requiredDocTypes) {
        const file = files.find(f => f.fieldname === `doc_${docType._id}`);
        if (!file) {
          return res.status(400).json({ 
            error: `Missing required document: ${docType.documentName}`,
            message: 'All required documents must be uploaded to complete your application',
            missingDocument: {
              id: docType._id,
              name: docType.documentName,
              description: docType.description || 'Required document'
            },
            requiredDocuments: requiredDocTypes.map(dt => ({
              id: dt._id,
              name: dt.documentName,
              description: dt.description || 'Required document',
              provided: files.some(f => f.fieldname === `doc_${dt._id}`)
            })),
            instructions: {
              fieldName: `doc_${docType._id}`,
              howToUpload: 'Send files using multipart/form-data with the correct field names'
            }
          });
        }

        try {
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

          // Create document record with pending status for admin review
          const document = new additionalDocumentModel({
            typeID: docType._id,
            contractID: contract._id,
            documentFile: {
              url: result.secure_url,
              public_id: result.public_id
            },
            uploadedBy: userId,
            status: 'pending'
          });

          await document.save();
          uploadedDocuments.push(document);
          console.log(`Document ${docType.documentName} uploaded successfully and pending admin review`);
          
          // Notify admin about new document pending review
          await notificationService.sendDocumentPendingReview(document._id);
        } catch (uploadError) {
          console.error(`Error uploading document ${docType.documentName}:`, uploadError);
          return res.status(500).json({ 
            error: `Failed to upload document: ${docType.documentName}`,
            message: 'There was an error uploading your document. Please try again.',
            documentName: docType.documentName,
            uploadError: uploadError.message
          });
        }
      }
    } else {
      console.log('No documents required for this loan type');
    }

    // 11. Notify sponsors using notification service
    const borrower = await User.findById(userId);
    const loanDetails = {
      type: loanTypeRecord.loanName,
      amount: loanAmount,
      term: `${loanTermMonths} months`
    };

    // Add contract to sponsors' pending approvals and send notifications
    await Promise.all([
      // Add to sponsor1's pending approvals
      User.findByIdAndUpdate(sponsor1._id, {
        $push: {
          pendingApprovals: {
            contractId: contract._id,
            borrowerId: userId,
            requestedAt: new Date()
          }
        }
      }),
      // Add to sponsor2's pending approvals
      User.findByIdAndUpdate(sponsor2._id, {
        $push: {
          pendingApprovals: {
            contractId: contract._id,
            borrowerId: userId,
            requestedAt: new Date()
          }
        }
      }),
      // Send dual notifications (in-app + email) to both sponsors
      notificationService.sendSponsorRequest(sponsor1, borrower, loanDetails),
      notificationService.sendSponsorRequest(sponsor2, borrower, loanDetails)
    ]);
    
    // 10. Set contract status based on document requirements
    if (requiredDocTypes.length > 0) {
      // If documents are required, contract waits for admin approval of documents
      contract.status = 'pending_document_approval';
      await contract.save();
      
      res.status(201).json({
        message: 'Contract created successfully. Documents uploaded and pending admin review.',
        contract,
        documents: uploadedDocuments.map(doc => doc._id),
        nextStep: 'Admin will review your documents before sponsor approval process begins'
      });
    } else {
      // If no documents required, start sponsor approval process immediately
      processContractApproval(contract);
      
      res.status(201).json({
        message: 'Contract created successfully. Waiting for sponsor approvals.',
        contract,
        documents: uploadedDocuments.map(doc => doc._id)
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function to get valid type-term combinations
async function getValidTypeTermCombinations() {
  const combinations = await typetermModel.aggregate([
    {
      $lookup: {
        from: 'loantypes',
        localField: 'loanTypeID',
        foreignField: '_id',
        as: 'loanType'
      }
    },
    {
      $lookup: {
        from: 'loanterms',
        localField: 'loanTermID',
        foreignField: '_id',
        as: 'loanTerm'
      }
    },
    {
      $unwind: '$loanType'
    },
    {
      $unwind: '$loanTerm'
    },
    {
      $project: {
        _id: 0,
        loanType: '$loanType.loanName',
        loanTerm: '$loanTerm.type'
      }
    }
  ]);
  
  return combinations;
}

// Sponsor approval endpoint
exports.approveContractAsSponsor = async (req, res) => {
  try {
    const { contractId } = req.params;
    const sponsorId = req.user.id;
    
    const contract = await Contract.findById(contractId);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Validate sponsor
    const isSponsor1 = contract.sponsorID_1.equals(sponsorId);
    const isSponsor2 = contract.sponsorID_2.equals(sponsorId);
    
    if (!isSponsor1 && !isSponsor2) {
      return res.status(403).json({ error: 'You are not a sponsor for this contract' });
    }
    
    // Check if already approved
    if ((isSponsor1 && contract.sponsor1Approved) || (isSponsor2 && contract.sponsor2Approved)) {
      return res.status(400).json({ error: 'You have already approved this contract' });
    }
    
    // Update approval status
    if (isSponsor1) {
      contract.sponsor1Approved = true;
    } else {
      contract.sponsor2Approved = true;
    }
    
    // Remove from user's pending approvals
    await User.findByIdAndUpdate(sponsorId, {
      $pull: { pendingApprovals: { contractId: contract._id } }
    });
    
    // Send approval notification to the sponsor
    await notificationService.sendSponsorApprovalNotification(sponsorId, contract._id, true);
    
    // Check if both approved
    if (contract.sponsor1Approved && contract.sponsor2Approved) {
      console.log(`Both sponsors approved contract ${contract._id}, starting processing...`);
      contract.status = 'pending_processing'; // Move to processing stage
      await contract.save();
      
      // Send processing notification to borrower
      await notificationService.sendContractProcessingNotification(contract.userID, contract._id);
      
      // Start approval process
      console.log(`Calling processContractApproval for contract ${contract._id}`);
      processContractApproval(contract);
    } else {
      console.log(`Partial approval for contract ${contract._id} - Sponsor1: ${contract.sponsor1Approved}, Sponsor2: ${contract.sponsor2Approved}`);
      await contract.save();

      // Notify other sponsor about the approval
      const otherSponsorId = isSponsor1 ? contract.sponsorID_2 : contract.sponsorID_1;
      await notificationService.sendSponsorApprovalNotification(otherSponsorId, contract._id, false);
      
      // Notify borrower about partial approval
      await notificationService.sendPartialApprovalNotification(contract.userID, contract._id);
    }
    
    res.json({ 
      message: 'Sponsor approval recorded', 
      contract,
      nextStatus: contract.status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Sponsor rejection endpoint
exports.rejectContractAsSponsor = async (req, res) => {
  try {
    const { contractId } = req.params;
    const sponsorId = req.user.id;
    const { reason } = req.body; // Get rejection reason from request body
    
    const contract = await Contract.findById(contractId);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Validate sponsor
    if (!contract.sponsorID_1.equals(sponsorId) && 
        !contract.sponsorID_2.equals(sponsorId)) {
      return res.status(403).json({ error: 'You are not a sponsor for this contract' });
    }
    
    // Update contract status
    contract.status = 'rejected';
    contract.rejectionReason = `Rejected by sponsor ${sponsorId}: ${reason || 'No reason provided'}`;
    await contract.save();
    
    // Remove from both sponsors' pending approvals
    await Promise.all([
      User.findByIdAndUpdate(contract.sponsorID_1, {
        $pull: { pendingApprovals: { contractId: contract._id } }
      }),
      User.findByIdAndUpdate(contract.sponsorID_2, {
        $pull: { pendingApprovals: { contractId: contract._id } }
      })
    ]);
    
    // Send rejection notifications to all parties
    await Promise.all([
      // Notify the rejecting sponsor
      notificationService.sendContractRejectionNotification(sponsorId, contract._id, reason, true),
      // Notify the other sponsor
      notificationService.sendContractRejectionNotification(
        contract.sponsorID_1.equals(sponsorId) ? contract.sponsorID_2 : contract.sponsorID_1,
        contract._id,
        `Rejected by co-sponsor: ${reason || 'No reason provided'}`,
        false
      ),
      // Notify the borrower
      notificationService.sendContractRejectionNotification(contract.userID, contract._id, reason, false)
    ]);
    
    res.json({ message: 'Contract rejected', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approval processing logic - improved version
const processContractApproval = async (contract) => {
  try {
    console.log(`Starting approval process for contract ${contract._id}`);
    
    // Get loan type details
    const typeTerm = await typetermModel.findById(contract.typeTermID)
      .populate('loanTypeID')
      .populate('loanTermID');
    
    if (!typeTerm) {
      console.error('TypeTerm not found for contract:', contract._id);
      await rejectContract(contract, 'Invalid loan configuration');
      return;
    }
    
    const loanTypeName = typeTerm.loanTypeID.loanName.toLowerCase();
    console.log(`Loan type: ${loanTypeName}`);
    
    // Calculate priority score
    const priorityScore = await calculatePriorityScore(contract, loanTypeName);
    console.log(`Calculated priority score: ${priorityScore}`);
    
    // Update contract with priority score for processing
    await Contract.findByIdAndUpdate(contract._id, {
      priority: priorityScore,
      status: 'pending_processing'
    });
    
    console.log(`Contract ${contract._id} updated with priority ${priorityScore}`);
    
    // Process immediately if no other pending contracts
    console.log('Calling processPendingContracts...');
    await processPendingContracts();
    
  } catch (error) {
    console.error('Error in approval process:', error);
    await rejectContract(contract, 'Processing error');
  }
};

// Calculate priority score for a contract
const calculatePriorityScore = async (contract, loanTypeName) => {
  let score = 0;
  
  // 1. Loan type priority (medical > educational > project)
  const typeWeights = { medical: 100, educational: 50, project: 0 };
  score += typeWeights[loanTypeName] || 0;
  
  // 2. Borrower history priority (new borrowers get higher priority)
  const previousLoans = await Contract.countDocuments({
    userID: contract.userID,
    status: 'approved'
  });
  score += previousLoans === 0 ? 75 : 0;
  
  // 3. Application date priority (earlier applications get higher priority)
  const timeDiff = new Date() - contract.createdAt;
  const hoursSinceApplication = timeDiff / (1000 * 60 * 60);
  score += Math.max(0, 50 - (hoursSinceApplication * 2));
  
  return score;
};

// Process all pending contracts in priority order
const processPendingContracts = async () => {
  try {
    console.log('Starting to process pending contracts...');
    
    // Get all pending contracts sorted by priority (highest first)
    const pendingContracts = await Contract.find({
      status: 'pending_processing'
    })
    .populate({
      path: 'typeTermID',
      populate: { path: 'loanTypeID' }
    })
    .sort({ priority: -1, createdAt: 1 }); // Priority first, then FIFO
    
    console.log(`Found ${pendingContracts.length} contracts pending processing`);
    
    for (const contract of pendingContracts) {
      try {
        console.log(`Processing contract ${contract._id} with priority ${contract.priority}`);
        await processSingleContract(contract);
      } catch (error) {
        console.error(`Error processing contract ${contract._id}:`, error);
        await rejectContract(contract, 'Processing failed');
      }
    }
    
    console.log('Finished processing pending contracts');
  } catch (error) {
    console.error('Error in processPendingContracts:', error);
  }
};

// Process a single contract
const processSingleContract = async (contract) => {
  console.log(`Processing contract ${contract._id}...`);
  
  // 1. Check all required documents are approved by admin
  const requiredDocTypes = await documentTypeTermRelationModel.find({
    typeTermID: contract.typeTermID,
    isRequired: true
  }).populate('documentTypeID');

  const requiredDocTypesList = requiredDocTypes.map(relation => ({
    _id: relation.documentTypeID._id,
    documentName: relation.documentTypeID.documentName,
    description: relation.documentTypeID.description,
    isRequired: relation.isRequired
  }));
  
  console.log(`Found ${requiredDocTypesList.length} required document types`);
  
  if (requiredDocTypesList.length > 0) {
    const documents = await additionalDocumentModel.find({ 
      contractID: contract._id 
    });
    
    console.log(`Found ${documents.length} uploaded documents`);
    
    // Check if all required documents are approved (only approved status is accepted)
    const allApproved = requiredDocTypesList.every(docType => 
      documents.some(doc => 
        doc.typeID.equals(docType._id) && doc.status === 'approved'
      )
    );
    
    if (!allApproved) {
      console.log('Contract processing paused: Waiting for admin document approval');
      
      // Find which documents are missing or not approved
      const pendingDocs = requiredDocTypesList.filter(docType => {
        const doc = documents.find(d => doc.typeID.equals(docType._id));
        return !doc || doc.status !== 'approved';
      });
      
      // Update contract status to wait for document approval
      if (contract.status !== 'pending_document_approval') {
        contract.status = 'pending_document_approval';
        await contract.save();
        console.log(`Contract ${contract._id} status updated to pending_document_approval`);
      }
      
      console.log(`Waiting for admin approval of documents: ${pendingDocs.map(d => d.documentName).join(', ')}`);
      return;
    }
    
    console.log('All required documents approved by admin');
  } else {
    console.log('No documents required for this contract type');
  }
  
  // 2. Check sponsor availability
  const typeTerm = await typetermModel.findById(contract.typeTermID)
    .populate('loanTypeID');
  
  const [sponsor1Count, sponsor2Count] = await Promise.all([
    Contract.countDocuments({
      $or: [
        { sponsorID_1: contract.sponsorID_1 }, 
        { sponsorID_2: contract.sponsorID_1 }
      ],
      status: 'approved',
      'typeTermID.loanTypeID': typeTerm.loanTypeID._id
    }),
    Contract.countDocuments({
      $or: [
        { sponsorID_1: contract.sponsorID_2 }, 
        { sponsorID_2: contract.sponsorID_2 }
      ],
      status: 'approved',
      'typeTermID.loanTypeID': typeTerm.loanTypeID._id
    })
  ]);
  
  console.log(`Sponsor counts - Sponsor1: ${sponsor1Count}, Sponsor2: ${sponsor2Count}`);
  
  if (sponsor1Count >= 2 || sponsor2Count >= 2) {
    console.log('Contract rejected: Sponsor unavailable');
    await rejectContract(
      contract, 
      'Sponsor unavailable',
      'One or both sponsors have reached their guarantee limit'
    );
    return;
  }

  // 3. Check monthly approval limit (5 contracts per month)
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const monthlyApprovedCount = await Contract.countDocuments({
    status: 'approved',
    approvedAt: { 
      $gte: startOfMonth,
      $lte: endOfMonth
    }
  });
  
  console.log(`Monthly approved count: ${monthlyApprovedCount}`);
  
  if (monthlyApprovedCount >= 5) {
    console.log('Contract rejected: Monthly approval limit reached');
    await rejectContract(
      contract, 
      'Monthly approval limit reached',
      'Please try again next month'
    );
    return;
  }
  
  // 4. Approve contract
  console.log('Approving contract...');
  contract.status = 'approved';
  contract.approvedAt = new Date();
  await contract.save();
  
  // 5. Create loan after approval
  const loan = new Loan({
    loanAmount: contract.tempLoanAmount,
    loanTermMonths: contract.tempLoanTermMonths,
    startDate: contract.tempStartDate,
    typeTermID: contract.typeTermID,
    status: 'active'
  });
  
  // Calculate end date
  const endDate = new Date(contract.tempStartDate);
  endDate.setMonth(endDate.getMonth() + contract.tempLoanTermMonths);
  loan.endDate = endDate;
  
  await loan.save();
  console.log(`Loan created: ${loan._id}`);
  
  // Link loan to contract
  contract.loanID = loan._id;
  await contract.save();

  // 6. Notify all parties
  console.log('Sending approval notifications...');
  await Promise.all([
    notificationService.sendContractApprovalNotification(contract.userID, contract._id),
    notificationService.sendContractApprovalNotification(contract.sponsorID_1, contract._id),
    notificationService.sendContractApprovalNotification(contract.sponsorID_2, contract._id)
  ]);
  
  console.log(`Contract ${contract._id} successfully approved and loan created`);
};

// Helper function to reject contract
async function rejectContract(contract, reason, details = '') {
  contract.status = 'rejected';
  contract.rejectionReason = reason;
  await contract.save();
  
  await notificationService.sendContractRejectionNotification(
    contract.userID, 
    contract._id, 
    `${reason}: ${details}`,
    false
  );
}

// Scheduled job to process pending contracts (call this every 5 minutes)
exports.processPendingContractsJob = async () => {
  try {
    console.log('Running scheduled contract processing job...');
    await processPendingContracts();
  } catch (error) {
    console.error('Error in scheduled contract processing job:', error);
  }
};

// Manual trigger for processing pending contracts (for admin use)
exports.triggerContractProcessing = async (req, res) => {
  try {
    console.log('Manual trigger for contract processing initiated');
    
    // Get count of pending contracts before processing
    const pendingCount = await Contract.countDocuments({ status: 'pending_processing' });
    console.log(`Found ${pendingCount} contracts pending processing`);
    
    await processPendingContracts();
    
    // Get count after processing
    const remainingCount = await Contract.countDocuments({ status: 'pending_processing' });
    const processedCount = pendingCount - remainingCount;
    
    res.json({ 
      message: 'Contract processing triggered successfully',
      processed: processedCount,
      remaining: remainingCount,
      total: pendingCount
    });
  } catch (error) {
    console.error('Error in manual trigger:', error);
    res.status(500).json({ error: error.message });
  }
};


// Get all user contracts
exports.getUserContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({ userID: req.user.id })
      .populate('sponsorID_1', 'userFirstName userLastName') // Sponsor 1 info
      .populate('sponsorID_2', 'userFirstName userLastName') // Sponsor 2 info
      .populate({
        path: 'typeTermID',
        populate: [
          { path: 'loanTypeID', select: 'loanName minAmount maxAmount priority' },
          { path: 'loanTermID', select: 'termName minTerm maxTerm' }
        ]
      })
      .sort({ createdAt: -1 }); // Newest first

    // Add loan details to response for frontend display
    const contractsWithLoanDetails = contracts.map(contract => {
      const contractObj = contract.toObject();
      return {
        ...contractObj,
        loanAmount: contract.tempLoanAmount,
        loanTermMonths: contract.tempLoanTermMonths,
        startDate: contract.tempStartDate
      };
    });

    res.json(contractsWithLoanDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all contracts where the user is a sponsor
exports.getSponsorContracts = async (req, res) => {
  try {
    const sponsorId = req.user.id;
    
    // Find contracts where user is either sponsor1 or sponsor2
    const contracts = await Contract.find({
      $or: [
        { sponsorID_1: sponsorId },
        { sponsorID_2: sponsorId }
      ]
    })
    .populate('userID', 'userFirstName userLastName') // Borrower info
    .populate('typeTermID')
    .populate('sponsorID_1', 'userFirstName userLastName') // Sponsor 1 info
    .populate('sponsorID_2', 'userFirstName userLastName') // Sponsor 2 info
    .sort({ createdAt: -1 }); // Newest first

    // Add loan details to response for frontend display
    const contractsWithLoanDetails = contracts.map(contract => {
      const contractObj = contract.toObject();
      return {
        ...contractObj,
        loanAmount: contract.tempLoanAmount,
        loanTermMonths: contract.tempLoanTermMonths,
        startDate: contract.tempStartDate
      };
    });

    res.json(contractsWithLoanDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, unreadOnly = false } = req.query;
    
    console.log('Getting notifications for user:', userId);
    
    const user = await User.findById(userId).select('notifications');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let notifications = user.notifications || [];
    notifications = notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    if (unreadOnly === 'true') {
      notifications = notifications.filter(n => !n.isRead);
    }
    
    notifications = notifications.slice(0, parseInt(limit));
    
    console.log(`Found ${notifications.length} notifications for user ${userId}`);
    
    res.json({
      notifications,
      totalCount: user.notifications ? user.notifications.length : 0,
      unreadCount: user.notifications ? user.notifications.filter(n => !n.isRead).length : 0
    });
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Mark notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;
    
    const result = await User.updateOne(
      { _id: userId, 'notifications._id': notificationId },
      { $set: { 'notifications.$.isRead': true } }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    await User.updateOne(
      { _id: userId },
      { $set: { 'notifications.$[].isRead': true } }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get pending approvals for sponsors
exports.getPendingApprovals = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('Getting pending approvals for user:', userId);
    
    const user = await User.findById(userId)
      .populate({
        path: 'pendingApprovals.contractId',
        populate: [
          { path: 'userID', select: 'userFirstName userLastName email' },
          { path: 'typeTermID', populate: { path: 'loanTypeID', select: 'loanName' } }
        ]
      })
      .populate('pendingApprovals.borrowerId', 'userFirstName userLastName email');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const pendingApprovals = (user.pendingApprovals || []).map(approval => {
      const contract = approval.contractId;
      if (!contract) {
        console.warn('Contract not found for approval:', approval._id);
        return null;
      }
      
      return {
        id: approval._id,
        contract: {
          ...contract.toObject(),
          loanAmount: contract.tempLoanAmount,
          loanTermMonths: contract.tempLoanTermMonths,
          startDate: contract.tempStartDate
        },
        borrower: approval.borrowerId,
        requestedAt: approval.requestedAt
      };
    }).filter(Boolean); // Remove null entries
    
    console.log(`Found ${pendingApprovals.length} pending approvals for user ${userId}`);
    
    res.json({
      pendingApprovals,
      count: pendingApprovals.length
    });
  } catch (error) {
    console.error('Error in getPendingApprovals:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get notification count for header/badge
exports.getNotificationCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('Getting notification count for user:', userId);
    
    const user = await User.findById(userId).select('notifications pendingApprovals');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const unreadNotifications = (user.notifications || []).filter(n => !n.isRead).length;
    const pendingApprovals = (user.pendingApprovals || []).length;
    
    console.log(`User ${userId} has ${unreadNotifications} unread notifications and ${pendingApprovals} pending approvals`);
    
    res.json({
      unreadNotifications,
      pendingApprovals,
      total: unreadNotifications + pendingApprovals
    });
  } catch (error) {
    console.error('Error in getNotificationCount:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Diagnostic endpoint to test connections
exports.testConnections = async (req, res) => {
  try {
    console.log('Testing connections...');
    
    // Test database connection
    const dbTest = await User.findOne().select('_id').limit(1);
    console.log('Database connection: OK');
    
    // Test email connection if available
    let emailTest = 'Not configured';
    if (transporter) {
      try {
        await transporter.verify();
        emailTest = 'OK';
        console.log('Email connection: OK');
      } catch (emailError) {
        emailTest = `Error: ${emailError.message}`;
        console.log('Email connection: FAILED');
      }
    }
    
    res.json({
      status: 'success',
      database: 'OK',
      email: emailTest,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in testConnections:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      database: 'FAILED',
      email: 'Unknown',
      timestamp: new Date().toISOString()
    });
  }
};

// Get required documents for a loan type
exports.getRequiredDocuments = async (req, res) => {
  try {
    const { loanTypeId } = req.params;
    
    // Find the typeterm that matches this loan type
    const typeTerm = await typetermModel.findOne({ loanTypeID: loanTypeId });
    
    if (!typeTerm) {
      return res.status(404).json({ error: 'Loan type not found' });
    }
    
    // Get required documents for this typeterm
    const requiredDocuments = await documentTypeTermRelationModel.find({
      typeTermID: typeTerm._id,
      isRequired: true
    }).populate('documentTypeID');

    const requiredDocumentsList = requiredDocuments.map(relation => ({
      _id: relation.documentTypeID._id,
      documentName: relation.documentTypeID.documentName,
      description: relation.documentTypeID.description,
      isRequired: relation.isRequired
    }));
    
    res.json({
      loanTypeId,
      typeTermId: typeTerm._id,
      requiredDocuments: requiredDocumentsList,
      totalRequired: requiredDocumentsList.length
    });
  } catch (error) {
    console.error('Error getting required documents:', error);
    res.status(500).json({ error: error.message });
  }
};