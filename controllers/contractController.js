const mongoose = require('mongoose');
const cloudinary = require('../utils/cloudinary');
const upload = require('../middleware/multer');
const notificationService = require('../services/notificationService');

// Import all models at the top
const { User } = require('../models/user');
const { Contract } = require('../models/contract');
const { Loan } = require('../models/loan');
const { Payment } = require('../models/payment');
const { loanTermModel } = require('../models/loanTerm');
const { loanTypeModel } = require('../models/loanType');
const { typetermModel } = require('../models/typeterm');
const { additionalDocumentTypeModel } = require('../models/additionalDocumentType');
const { additionalDocumentModel } = require('../models/additionalDocument');
const { documentTypeTermRelationModel } = require('../models/documentTypeTermRelation');

// Helper to transform contract for user response (no IDs, only names)
function contractToUserView(contract) {
  // Defensive: handle both Mongoose docs and plain objects
  const get = (obj, path, fallback = undefined) => {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : fallback), obj);
  };
  return {
    status: contract.status,
    employmentStatus: contract.employmentStatus,
    sponsor1: contract.sponsorID_1 ? {
      firstName: get(contract, 'sponsorID_1.userFirstName'),
      lastName: get(contract, 'sponsorID_1.userLastName')
    } : undefined,
    sponsor2: contract.sponsorID_2 ? {
      firstName: get(contract, 'sponsorID_2.userFirstName'),
      lastName: get(contract, 'sponsorID_2.userLastName')
    } : undefined,
    typeTerm: contract.typeTermID ? {
      name: get(contract, 'typeTermID.name'),
      loanType: get(contract, 'typeTermID.loanTypeID.loanName'),
      loanTerm: get(contract, 'typeTermID.loanTermID.type')
    } : undefined,
    loanAmount: contract.tempLoanAmount,
    loanTermMonths: contract.tempLoanTermMonths,
    startDate: contract.tempStartDate,
    sponsor1Approved: contract.sponsor1Approved,
    sponsor2Approved: contract.sponsor2Approved,
    priority: contract.priority,
    approvedAt: contract.approvedAt,
    rejectionReason: contract.rejectionReason,
    // Add more fields as needed, but avoid IDs
  };
}

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

    // Check if user has an active loan (borrowers with active loans cannot apply for new contracts)
    const userActiveLoans = await Contract.countDocuments({
      userID: userId,
      status: { $in: ['approved', 'active'] }
    });
    
    if (userActiveLoans > 0) {
      return res.status(400).json({ 
        error: 'You cannot apply for a new loan while you have an active loan',
        details: 'Borrowers with active (uncompleted) loans cannot apply for new contracts until their current loan is completed'
      });
    }

    // Check if user has any late payments (borrowers with late payments cannot apply for new contracts)
    // This check covers completed loans that might still have late payments
    const userContractsWithLoans = await Contract.find({
      userID: userId,
      loanID: { $ne: null }
    }).select('loanID');

    if (userContractsWithLoans.length > 0) {
      const loanIds = userContractsWithLoans.map(contract => contract.loanID);
      
      // Check for any late payments in these loans
      const latePaymentsCount = await Payment.countDocuments({
        loanID: { $in: loanIds },
        status: 'late'
      });
      
      if (latePaymentsCount > 0) {
        return res.status(400).json({ 
          error: 'You cannot apply for a new loan while you have overdue payments',
          details: 'Borrowers with late/overdue payments must clear all outstanding payments before applying for new contracts',
          latePaymentsCount: latePaymentsCount
        });
      }
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

    // 7. Check if sponsors have active loans (borrowers with active loans cannot be sponsors)
    const [sponsor1ActiveLoans, sponsor2ActiveLoans] = await Promise.all([
      Contract.countDocuments({
        userID: sponsor1._id,
        status: { $in: ['approved', 'active'] }
      }),
      Contract.countDocuments({
        userID: sponsor2._id,
        status: { $in: ['approved', 'active'] }
      })
    ]);
    
    const sponsorsWithActiveLoans = [];
    if (sponsor1ActiveLoans > 0) sponsorsWithActiveLoans.push(sponsorEmail1);
    if (sponsor2ActiveLoans > 0) sponsorsWithActiveLoans.push(sponsorEmail2);
    
    if (sponsorsWithActiveLoans.length > 0) {
      return res.status(400).json({ 
        error: 'One or both sponsors have active loans and cannot sponsor other loans',
        sponsorsWithActiveLoans,
        details: 'Borrowers with active (uncompleted) loans cannot be sponsors for other loans until their current loan is completed'
      });
    }

    // 8. Check if sponsors are trying to sponsor their own contract (self-sponsorship prevention)
    const selfSponsorshipAttempts = [];
    if (sponsor1._id.equals(userId)) selfSponsorshipAttempts.push(sponsorEmail1);
    if (sponsor2._id.equals(userId)) selfSponsorshipAttempts.push(sponsorEmail2);
    
    if (selfSponsorshipAttempts.length > 0) {
      return res.status(400).json({ 
        error: 'You cannot be your own sponsor',
        selfSponsorshipAttempts,
        details: 'Borrowers cannot sponsor their own loan contracts'
      });
    }

    // 9. Check total sponsor limit (maximum 2 loans ever, across all loan types)
    const [sponsor1TotalCount, sponsor2TotalCount] = await Promise.all([
      Contract.countDocuments({
        $or: [{ sponsorID_1: sponsor1._id }, { sponsorID_2: sponsor1._id }],
        status: { $in: ['approved', 'active'] }
      }),
      Contract.countDocuments({
        $or: [{ sponsorID_1: sponsor2._id }, { sponsorID_2: sponsor2._id }],
        status: { $in: ['approved', 'active'] }
      })
    ]);
    
    const sponsorsAtLimit = [];
    if (sponsor1TotalCount >= 2) sponsorsAtLimit.push(sponsorEmail1);
    if (sponsor2TotalCount >= 2) sponsorsAtLimit.push(sponsorEmail2);
    
    if (sponsorsAtLimit.length > 0) {
      return res.status(400).json({
        error: 'One or both sponsors have reached their maximum sponsorship limit (2 loans)',
        sponsorsAtLimit,
        details: 'Sponsors can only sponsor a maximum of 2 loans across all loan types'
      });
    }

    // 10. Get required document types using junction table
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

    // 11. Create contract
    const contract = new Contract({
      userID: userId,
      sponsorID_1: sponsor1._id,
      sponsorID_2: sponsor2._id,
      typeTermID: typeTerm._id,
      tempLoanAmount: loanAmount,
      tempLoanTermMonths: loanTermMonths,
      tempStartDate: new Date(),
      employmentStatus,
      // status will be set below
      priority: loanTypeRecord.priority
    });

    // Set status based on document requirements
    if (requiredDocTypes.length > 0) {
      contract.status = 'pending_document_upload';
      await contract.save();
      
      // STEP 2: Notify borrower about contract submission
      await notificationService.sendContractSubmissionNotification(userId, contract._id);
      
      // STEP 2: Notify admin about new application
      await notificationService.sendNewApplicationNotification(contract._id);
      
      return res.status(201).json({
        message: 'Contract created. Please upload required documents.',
        contractId: contract._id,
        contract: contractToUserView(contract),
        requiredDocuments: requiredDocTypes.map(dt => ({
          id: dt._id,
          name: dt.documentName,
          description: dt.description || 'Required document'
        })),
        nextStep: 'Upload all required documents using the provided contract ID.'
      });
    } else {
      contract.status = 'pending_sponsor_approval';
      await contract.save();
      
      // STEP 2: Notify borrower about contract submission
      await notificationService.sendContractSubmissionNotification(userId, contract._id);
      
      // STEP 2: Notify admin about new application
      await notificationService.sendNewApplicationNotification(contract._id);
    }

    // 11. Notify sponsors using notification service
    const borrower = await User.findById(userId);
    const loanDetails = {
      type: loanTypeRecord.loanName,
      amount: loanAmount,
      term: `${loanTermMonths} months`
    };

    // If no documents required, start sponsor approval process immediately
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
      // STEP 3: Send sponsorship request notifications
      notificationService.sendSponsorshipRequestNotification(sponsor1._id, userId, contract._id),
      notificationService.sendSponsorshipRequestNotification(sponsor2._id, userId, contract._id)
    ]);
    await processContractApproval(contract);
    res.status(201).json({
      message: 'Contract created successfully. Waiting for sponsor approvals.',
      contract: contractToUserView(contract),
      documents: []
    });
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
    
    // Get sponsor name for notification
    const sponsor = await User.findById(sponsorId);
    const sponsorName = `${sponsor.userFirstName} ${sponsor.userLastName}`;
    
    // Check if both approved
    if (contract.sponsor1Approved && contract.sponsor2Approved) {
      console.log(`Both sponsors approved contract ${contract._id}, starting processing...`);
      contract.status = 'pending_processing'; // Move to processing stage
      await contract.save();
      
      // STEP 4: Notify borrower about sponsor approval
      await notificationService.sendSponsorApprovalNotification(contract.userID, contract._id, sponsorName, 0);
      
      // Send processing notification to borrower
      await notificationService.sendContractProcessingNotification(contract.userID, contract._id);
      
      // Start approval process
      console.log(`Calling processContractApproval for contract ${contract._id}`);
      await processContractApproval(contract);
    } else {
      console.log(`Partial approval for contract ${contract._id} - Sponsor1: ${contract.sponsor1Approved}, Sponsor2: ${contract.sponsor2Approved}`);
      await contract.save();

      // STEP 4: Notify borrower about partial approval
      const remainingSponsors = contract.sponsor1Approved && contract.sponsor2Approved ? 0 : 1;
      await notificationService.sendSponsorApprovalNotification(contract.userID, contract._id, sponsorName, remainingSponsors);
      
      // Notify other sponsor about the approval
      const otherSponsorId = isSponsor1 ? contract.sponsorID_2 : contract.sponsorID_1;
      const approvedCount = 1;
      const totalCount = 2;
      await notificationService.sendSponsorReminderNotification(otherSponsorId, contract.userID, contract._id, approvedCount, totalCount);
      
    }
    
    res.json({ 
      message: 'Sponsor approval recorded', 
      contract: contractToUserView(contract),
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
    
    // Get sponsor name for notification
    const sponsor = await User.findById(sponsorId);
    const sponsorName = `${sponsor.userFirstName} ${sponsor.userLastName}`;
    
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
    
    // STEP 4: Send rejection notifications
    await Promise.all([
      // Notify the borrower about sponsor rejection
      notificationService.sendSponsorRejectionNotification(contract.userID, contract._id, sponsorName),
      // Notify the other sponsor about rejection
      notificationService.sendSponsorRejectionUpdateNotification(
        contract.sponsorID_1.equals(sponsorId) ? contract.sponsorID_2 : contract.sponsorID_1,
        contract.userID,
        contract._id
      )
    ]);
    
    res.json({ message: 'Contract rejected', contract: contractToUserView(contract) });
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
    // Helper to delay between processing contracts
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Promote queued contracts whose available date has arrived to pending_processing
    const nowForQueue = new Date();
    const promoted = await Contract.updateMany(
      { status: 'queued_next_month', availableAt: { $lte: nowForQueue } },
      { $set: { status: 'pending_processing' } }
    );
    if (promoted && promoted.modifiedCount) {
      console.log(`Promoted ${promoted.modifiedCount} queued contracts to pending_processing`);
    }

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
    
    const totalToProcess = pendingContracts.length;
    let processedCounter = 0;
    for (const contract of pendingContracts) {
      try {
        console.log(`Processing contract ${contract._id} with priority ${contract.priority}`);
        await processSingleContract(contract);
        processedCounter += 1;
        if (processedCounter < totalToProcess) {
          console.log('Waiting 3 minutes before processing next contract...');
          await delay(3 * 60 * 1000);
        }
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

  // Prevent duplicate loan creation
  if (contract.loanID) {
    console.log('Loan already created for this contract, skipping...');
    return;
  }
  
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
      
      // Update contract status to wait for document approval or re-upload
      if (contract.status !== 'pending_document_approval' && contract.status !== 'pending_document_reupload') {
        // Check if there are any rejected documents that need re-upload
        const hasRejectedDocs = documents.some(doc => doc.status === 'rejected');
        if (hasRejectedDocs) {
          contract.status = 'pending_document_reupload';
        } else {
          contract.status = 'pending_document_approval';
        }
        await contract.save();
        console.log(`Contract ${contract._id} status updated to ${contract.status}`);
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
    console.log('Monthly approval limit reached, queuing contract for next month');
    const nextMonthAvailableAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    contract.status = 'queued_next_month';
    contract.queuedAt = new Date();
    contract.availableAt = nextMonthAvailableAt;
    await contract.save();
    return;
  }
  
  // 4. Approve contract
  console.log('Approving contract...');
  contract.status = 'approved';
  contract.approvedAt = new Date();
  await contract.save();

  // 5. Create loan after approval using loanController
  const { createLoan } = require('./loanController');
  const loan = await createLoan(contract);

  // Link loan to contract
  contract.loanID = loan._id;
  await contract.save();

  // 6. Notify all parties about contract activation
  console.log('Sending activation notifications...');
  const firstPaymentDate = new Date(loan.startDate);
  firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
  
  await Promise.all([
    // STEP 5: Notify borrower about contract activation
    notificationService.sendContractActivationNotification(contract.userID, contract._id, firstPaymentDate.toDateString()),
    // STEP 5: Notify sponsors about contract activation
    notificationService.sendSponsorActivationNotification(contract.sponsorID_1, contract.userID, contract._id, firstPaymentDate.toDateString()),
    notificationService.sendSponsorActivationNotification(contract.sponsorID_2, contract.userID, contract._id, firstPaymentDate.toDateString()),
    // STEP 5: Notify admin about contract activation
    notificationService.sendAdminActivationNotification(contract._id, contract.userID)
  ]);

  console.log(`Contract ${contract._id} successfully approved and loan created`);
};

// Helper function to reject contract
async function rejectContract(contract, reason, details = '') {
  contract.status = 'rejected';
  contract.rejectionReason = reason;
  await contract.save();
  
  // STEP 5: Notify borrower about contract rejection
  await notificationService.sendContractRejectionNotification(contract.userID, contract._id, reason);
  
  // STEP 5: Notify sponsors about contract rejection
  await Promise.all([
    notificationService.sendSponsorRejectionUpdateNotification(contract.sponsorID_1, contract.userID, contract._id),
    notificationService.sendSponsorRejectionUpdateNotification(contract.sponsorID_2, contract.userID, contract._id)
  ]);
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

// Get user contracts that are still not approved
exports.getUserPendingContracts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('Getting pending contracts for user:', userId);
    
    // Find all contracts for the user that are not approved
    const pendingContracts = await Contract.find({ 
      userID: userId, 
      status: { $ne: 'approved' } 
    })
    .populate([
      { path: 'sponsorID_1', select: 'userFirstName userLastName email' },
      { path: 'sponsorID_2', select: 'userFirstName userLastName email' },
      {
        path: 'typeTermID',
        populate: [
          { path: 'loanTypeID', select: 'loanName minAmount maxAmount' },
          { path: 'loanTermID', select: 'termName minTerm maxTerm' }
        ]
      }
    ])
    .sort({ createdAt: -1 }); // Newest contracts first
    
    console.log(`Found ${pendingContracts.length} pending contracts for user ${userId}`);
    
    // Transform contracts to user-friendly format
    const transformedContracts = pendingContracts.map(contract => contractToUserView(contract));
    
    res.json({
      pendingContracts: transformedContracts,
      count: pendingContracts.length
    });
  } catch (error) {
    console.error('Error in getUserPendingContracts:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
        contract: contractToUserView(contract),
        borrower: approval.borrowerId ? {
          firstName: approval.borrowerId.userFirstName,
          lastName: approval.borrowerId.userLastName,
          email: approval.borrowerId.email
        } : undefined,
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

// Edit contract (only if not approved yet)
exports.editContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;
    
    console.log(`User ${userId} attempting to edit contract ${contractId}`);
    
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
    
    // Find the contract
    const contract = await Contract.findById(contractId);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check if user owns this contract
    if (!contract.userID.equals(userId)) {
      return res.status(403).json({ error: 'You can only edit your own contracts' });
    }
    
    // Check if contract can be edited (not approved yet)
    const editableStatuses = [
      'pending_sponsor_approval',
      'pending_document_approval', 
      'pending',
      'pending_processing',
      'rejected',
      'pending_document_upload',
      'pending_document_reupload',
      'queued_next_month'
    ];
    
    if (!editableStatuses.includes(contract.status)) {
      return res.status(400).json({ 
        error: 'Contract cannot be edited',
        details: `Contracts with status '${contract.status}' cannot be edited. Only contracts that haven't been approved yet can be edited.`,
        currentStatus: contract.status,
        editableStatuses
      });
    }

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

    // 7. Check if sponsors have active loans (borrowers with active loans cannot be sponsors)
    const [sponsor1ActiveLoans, sponsor2ActiveLoans] = await Promise.all([
      Contract.countDocuments({
        userID: sponsor1._id,
        status: { $in: ['approved', 'active'] }
      }),
      Contract.countDocuments({
        userID: sponsor2._id,
        status: { $in: ['approved', 'active'] }
      })
    ]);
    
    const sponsorsWithActiveLoans = [];
    if (sponsor1ActiveLoans > 0) sponsorsWithActiveLoans.push(sponsorEmail1);
    if (sponsor2ActiveLoans > 0) sponsorsWithActiveLoans.push(sponsorEmail2);
    
    if (sponsorsWithActiveLoans.length > 0) {
      return res.status(400).json({ 
        error: 'One or both sponsors have active loans and cannot sponsor other loans',
        sponsorsWithActiveLoans,
        details: 'Borrowers with active (uncompleted) loans cannot be sponsors for other loans until their current loan is completed'
      });
    }

    // 8. Check if sponsors are trying to sponsor their own contract (self-sponsorship prevention)
    const selfSponsorshipAttempts = [];
    if (sponsor1._id.equals(userId)) selfSponsorshipAttempts.push(sponsorEmail1);
    if (sponsor2._id.equals(userId)) selfSponsorshipAttempts.push(sponsorEmail2);
    
    if (selfSponsorshipAttempts.length > 0) {
      return res.status(400).json({ 
        error: 'You cannot be your own sponsor',
        selfSponsorshipAttempts,
        details: 'Borrowers cannot sponsor their own loan contracts'
      });
    }

    // 9. Check total sponsor limit (maximum 2 loans ever, across all loan types)
    // Exclude current contract from the count
    const [sponsor1TotalCount, sponsor2TotalCount] = await Promise.all([
      Contract.countDocuments({
        $or: [{ sponsorID_1: sponsor1._id }, { sponsorID_2: sponsor1._id }],
        status: { $in: ['approved', 'active'] },
        _id: { $ne: contract._id } // Exclude current contract
      }),
      Contract.countDocuments({
        $or: [{ sponsorID_1: sponsor2._id }, { sponsorID_2: sponsor2._id }],
        status: { $in: ['approved', 'active'] },
        _id: { $ne: contract._id } // Exclude current contract
      })
    ]);
    
    const sponsorsAtLimit = [];
    if (sponsor1TotalCount >= 2) sponsorsAtLimit.push(sponsorEmail1);
    if (sponsor2TotalCount >= 2) sponsorsAtLimit.push(sponsorEmail2);
    
    if (sponsorsAtLimit.length > 0) {
      return res.status(400).json({
        error: 'One or both sponsors have reached their maximum sponsorship limit (2 loans)',
        sponsorsAtLimit,
        details: 'Sponsors can only sponsor a maximum of 2 loans across all loan types'
      });
    }

    // Store old sponsor IDs for cleanup
    const oldSponsor1Id = contract.sponsorID_1;
    const oldSponsor2Id = contract.sponsorID_2;
    const sponsorsChanged = !oldSponsor1Id.equals(sponsor1._id) || !oldSponsor2Id.equals(sponsor2._id);

    // 10. Get required document types using junction table
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

    // 11. Update contract fields
    contract.sponsorID_1 = sponsor1._id;
    contract.sponsorID_2 = sponsor2._id;
    contract.typeTermID = typeTerm._id;
    contract.tempLoanAmount = loanAmount;
    contract.tempLoanTermMonths = loanTermMonths;
    contract.tempStartDate = new Date();
    contract.employmentStatus = employmentStatus;
    contract.priority = loanTypeRecord.priority;
    
    // Reset sponsor approvals if sponsors changed
    if (sponsorsChanged) {
      contract.sponsor1Approved = false;
      contract.sponsor2Approved = false;
      contract.status = 'pending_sponsor_approval';
    }

    // Set status based on document requirements
    if (requiredDocTypes.length > 0 && contract.status !== 'pending_sponsor_approval') {
      contract.status = 'pending_document_upload';
    }

    await contract.save();

    // 12. Handle sponsor changes - cleanup old sponsors and notify new ones
    if (sponsorsChanged) {
      // Remove from old sponsors' pending approvals
      await Promise.all([
        User.findByIdAndUpdate(oldSponsor1Id, {
          $pull: { pendingApprovals: { contractId: contract._id } }
        }),
        User.findByIdAndUpdate(oldSponsor2Id, {
          $pull: { pendingApprovals: { contractId: contract._id } }
        })
      ]);

      // Add to new sponsors' pending approvals
      await Promise.all([
        User.findByIdAndUpdate(sponsor1._id, {
          $push: {
            pendingApprovals: {
              contractId: contract._id,
              borrowerId: userId,
              requestedAt: new Date()
            }
          }
        }),
        User.findByIdAndUpdate(sponsor2._id, {
          $push: {
            pendingApprovals: {
              contractId: contract._id,
              borrowerId: userId,
              requestedAt: new Date()
            }
          }
        })
      ]);

      // Notify new sponsors about sponsorship request
      await Promise.all([
        notificationService.sendSponsorshipRequestNotification(sponsor1._id, userId, contract._id),
        notificationService.sendSponsorshipRequestNotification(sponsor2._id, userId, contract._id)
      ]);

      // Notify old sponsors about contract update (if they're different)
      if (!oldSponsor1Id.equals(sponsor1._id)) {
        await notificationService.sendContractUpdateNotification(oldSponsor1Id, userId, contract._id, 'sponsor_removed');
      }
      if (!oldSponsor2Id.equals(sponsor2._id)) {
        await notificationService.sendContractUpdateNotification(oldSponsor2Id, userId, contract._id, 'sponsor_removed');
      }
    }

    // 13. Notify borrower about contract update
    await notificationService.sendContractUpdateNotification(userId, userId, contract._id, 'contract_updated');

    // 14. Return response based on status
    if (requiredDocTypes.length > 0 && contract.status === 'pending_document_upload') {
      return res.status(200).json({
        message: 'Contract updated successfully. Please upload required documents.',
        contractId: contract._id,
        contract: contractToUserView(contract),
        requiredDocuments: requiredDocTypes.map(dt => ({
          id: dt._id,
          name: dt.documentName,
          description: dt.description || 'Required document'
        })),
        nextStep: 'Upload all required documents using the provided contract ID.'
      });
    } else {
      return res.status(200).json({
        message: 'Contract updated successfully. Waiting for sponsor approvals.',
        contract: contractToUserView(contract),
        documents: []
      });
    }
  } catch (error) {
    console.error('Error editing contract:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Delete contract (only if not approved yet)
exports.deleteContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;
    
    console.log(`User ${userId} attempting to delete contract ${contractId}`);
    
    // Find the contract
    const contract = await Contract.findById(contractId);
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    // Check if user owns this contract
    if (!contract.userID.equals(userId)) {
      return res.status(403).json({ error: 'You can only delete your own contracts' });
    }
    
    // Check if contract can be deleted (not approved yet)
    const deletableStatuses = [
      'pending_sponsor_approval',
      'pending_document_approval', 
      'pending',
      'pending_processing',
      'rejected',
      'pending_document_upload',
      'pending_document_reupload',
      'queued_next_month'
    ];
    
    if (!deletableStatuses.includes(contract.status)) {
      return res.status(400).json({ 
        error: 'Contract cannot be deleted',
        details: `Contracts with status '${contract.status}' cannot be deleted. Only contracts that haven't been approved yet can be deleted.`,
        currentStatus: contract.status,
        deletableStatuses
      });
    }
    
    // Remove contract from sponsors' pending approvals and notifications
    await Promise.all([
      User.findByIdAndUpdate(contract.sponsorID_1, {
        $pull: { 
          pendingApprovals: { contractId: contract._id },
          notifications: { contractId: contract._id }
        }
      }),
      User.findByIdAndUpdate(contract.sponsorID_2, {
        $pull: { 
          pendingApprovals: { contractId: contract._id },
          notifications: { contractId: contract._id }
        }
      }),
      // Also remove notifications from the borrower
      User.findByIdAndUpdate(contract.userID, {
        $pull: { notifications: { contractId: contract._id } }
      })
    ]);
    
    // Delete any uploaded documents for this contract
    await additionalDocumentModel.deleteMany({ contractID: contract._id });
    
    // Delete the contract
    await Contract.findByIdAndDelete(contractId);
    
    console.log(`Contract ${contractId} successfully deleted by user ${userId}`);
    
    res.json({ 
      message: 'Contract deleted successfully',
      contractId: contractId,
      deletedAt: new Date()
    });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};