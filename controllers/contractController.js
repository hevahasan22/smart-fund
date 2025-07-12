const { User, Contract,Loan } = require('../models/index');
const {loanTermModel}=require('../models/loanTerm')
const {loanTypeModel}=require('../models/loanType')
const {typetermModel}=require('../models/typeterm')
const {additionalDocumentTypeModel}=require('../models/additionalDocumentType')
const {additionalDocumentModel}=require('../models/additionalDocument')
const cloudinary=require('../utils/cloudinary')
const upload=require('../middleware/multer')
const notificationService = require('../services/notificationService');


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
    if (loanAmount < loanTypeRecord.minAmount || 
        loanAmount > loanTypeRecord.maxAmount) {
      return res.status(400).json({ 
        error: `Loan amount must be between ${loanTypeRecord.minAmount} and ${loanTypeRecord.maxAmount}`,
        minAmount: loanTypeRecord.minAmount,
        maxAmount: loanTypeRecord.maxAmount
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

    // 8. Get required document types
    const requiredDocTypes = await additionalDocumentTypeModel.find({
      typeTermID: typeTerm._id,
      isRequired: true
    });

    // 9. Create contract
    const contract = new Contract({
      userID: userId,
      sponsorID_1: sponsor1._id,
      sponsorID_2: sponsor2._id,
      typeTermID: typeTerm._id,
      loanAmount,
      loanTermMonths,
      employmentStatus,
      startDate: new Date(),
      status: 'pending_sponsor_approval', 
      priority: loanTypeRecord.priority
    });

    await contract.save();

    // 10. Handle document uploads
    const uploadedDocuments = [];
    
    for (const docType of requiredDocTypes) {
      const file = files.find(f => f.fieldname === `doc_${docType._id}`);
      if (!file) {
        return res.status(400).json({ 
          error: `Missing required document: ${docType.documentName}`,
          requiredDocuments: requiredDocTypes.map(dt => dt.documentName)
        });
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
        typeID: docType._id,
        contractID: contract._id,
        documentFile: {
          url: result.secure_url,
          public_id: result.public_id
        },
        status: 'pending'
      });

      await document.save();
      uploadedDocuments.push(document);
    }

    // 11. Notify sponsors using notification service
    await Promise.all([
      notificationService.sendSponsorRequest(sponsor1._id, userId, contract._id),
      notificationService.sendSponsorRequest(sponsor2._id, userId, contract._id)
    ]);
    
    // 10. Start approval process
    processContractApproval(contract);
    
    res.status(201).json({
      message: 'Contract created successfully. Waiting for sponsor approvals.',
      contract,
      documents: uploadedDocuments.map(doc => doc._id)
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
    
    // Check if both approved
    if (contract.sponsor1Approved && contract.sponsor2Approved) {
      contract.status = 'pending'; // Move to next approval stage
      await contract.save();
      processContractApproval(contract); // Start approval process
    } else {
      await contract.save();

      // Notify other sponsor
      const otherSponsorId = isSponsor1 ? contract.sponsorID_2 : contract.sponsorID_1;
      await notificationService.sendNotification(
        otherSponsorId,
        'sponsor_approved',
        `Your co-sponsor has approved contract ${contractId}`
      );
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
    
    // Notify borrower and other sponsor
    await Promise.all([
      notificationService.sendContractUpdate(
        contract.userID, 
        contract._id, 
        'rejected', 
        contract.rejectionReason
      ),
      notificationService.sendNotification(
        contract.sponsorID_1.equals(sponsorId) ? contract.sponsorID_2 : contract.sponsorID_1,
        'contract_rejected',
        `Contract rejected by co-sponsor: ${contract.rejectionReason}`
      )
    ]);
    
    res.json({ message: 'Contract rejected', contract });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approval processing logic
const processContractApproval = async (contract) => {
  try {
     // Get loan type details
    const typeTerm = await TypeTerm.findById(contract.typeTermID)
      .populate('loanTypeID')
      .populate('loanTermID');
    
    if (!typeTerm) {
      console.error('TypeTerm not found for contract:', contract._id);
      await rejectContract(contract, 'Invalid loan configuration');
      return;
    }
    
    const loanTypeName = typeTerm.loanTypeID.loanName.toLowerCase();
    
    // Base priority delays
    const basePriorityDelays = {
      medical: 5000,    // 5 seconds
      educational: 10000, // 10 seconds
      project: 15000    // 15 seconds
    };
    
    // Calculate enhanced priority score
    const calculatePriorityScore = async (contract) => {
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
      // Calculate as inverse of time since application (more recent = lower score)
      const timeDiff = new Date() - contract.createdAt;
      const hoursSinceApplication = timeDiff / (1000 * 60 * 60);
      score += Math.max(0, 50 - (hoursSinceApplication * 2));
      
      return score;
    };
    
    // Calculate priority score for this contract
    const priorityScore = await calculatePriorityScore(contract);
    
    // Get all pending contracts to determine relative priority
    const pendingContracts = await Contract.find({
      status: 'pending',
      _id: { $ne: contract._id } // Exclude current contract
    }).populate({
      path: 'typeTermID',
      populate: { path: 'loanTypeID' }
    });
    
    // Calculate scores for all pending contracts
    const pendingScores = await Promise.all(
      pendingContracts.map(async (c) => ({
        contract: c,
        score: await calculatePriorityScore(c)
      }))
    );
    
    // Find how many contracts have higher priority
    const higherPriorityCount = pendingScores.filter(
      ps => ps.score > priorityScore
    ).length;
    
    // Calculate delay based on:
    // 1. Base delay for loan type
    // 2. Number of higher priority contracts (each adds 5 seconds)
    const baseDelay = basePriorityDelays[loanTypeName] || 15000;
    const priorityDelay = higherPriorityCount * 5000;
    const totalDelay = baseDelay + priorityDelay;
    
    console.log(`Processing contract ${contract._id} with delay: ${totalDelay}ms, ` +
               `Priority score: ${priorityScore}, ` +
               `Higher priority contracts: ${higherPriorityCount}`);
    
    setTimeout(async () => {
      try {
        const updatedContract = await Contract.findById(contract._id);
        
        // Skip if already processed
        if (updatedContract.status !== 'pending') return;
        
        // 1. Check all required documents are approved
        const requiredDocTypes = await AdditionalDocumentType.find({
          typeTermID: contract.typeTermID,
          isRequired: true
        });
        
        const documents = await AdditionalDocument.find({ 
          contractID: contract._id 
        });
        
        // Check if all required documents are uploaded and approved
        const allApproved = requiredDocTypes.every(docType => 
          documents.some(doc => 
            doc.typeID.equals(docType._id) && doc.status === 'approved'
          )
        );
        
        if (!allApproved) {
          await rejectContract(
            updatedContract, 
            'Missing required documents',
            'Please ensure all required documents are uploaded and approved'
          );
          return;
        }
        
        // 2. Check sponsor availability
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
        
        if (sponsor1Count >= 2 || sponsor2Count >= 2) {
          await rejectContract(
            updatedContract, 
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
        
        if (monthlyApprovedCount >= 5) {
          await rejectContract(
            updatedContract, 
            'Monthly approval limit reached',
            'Please try again next month'
          );
          return;
        }
        
        // 4. Approve contract
        updatedContract.status = 'approved';
        updatedContract.approvedAt = new Date();
        await updatedContract.save();
        
        // 5. Create loan after approval
        const loan = new Loan({
          loanAmount: updatedContract.loanAmount,
          loanTermMonths: updatedContract.loanTermMonths,
          startDate: updatedContract.startDate,
          typeTermID: updatedContract.typeTermID,
          status: 'active'
        });
        
        // Calculate end date
        const endDate = new Date(updatedContract.startDate);
        endDate.setMonth(endDate.getMonth() + updatedContract.loanTermMonths);
        loan.endDate = endDate;
        
        await loan.save();
        
        // Link loan to contract
        updatedContract.loanID = loan._id;
        await updatedContract.save();

        // 6. Notify all parties
        await Promise.all([
          notificationService.sendContractUpdate(
            updatedContract.userID, 
            updatedContract._id, 
            'approved'
          ),
          notificationService.sendNotification(
            updatedContract.sponsorID_1,
            'contract_approved',
            `Contract you sponsored has been approved`
          ),
          notificationService.sendNotification(
            updatedContract.sponsorID_2,
            'contract_approved',
            `Contract you sponsored has been approved`
          )
        ]);
        
      } catch (error) {
        console.error('Contract approval error:', error);
      }
    }, totalDelay);
  } catch (error) {
    console.error('Error in approval process:', error);
  }
};

// Helper function to reject contract
async function rejectContract(contract, reason, details = '') {
  contract.status = 'rejected';
  contract.rejectionReason = reason;
  await contract.save();
  
  await notificationService.sendContractUpdate(
    contract.userID, 
    contract._id, 
    'rejected', 
    `${reason}: ${details}`
  );
}


// Get all user contracts
exports.getUserContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({ userID: req.user.id })
      .populate('sponsorID_1', 'firstName lastName') // Sponsor 1 info
      .populate('sponsorID_2', 'firstName lastName') // Sponsor 2 info
      .populate({
        path: 'typeTermID',
        populate: [
          { path: 'loanTypeID', select: 'loanName minAmount maxAmount priority' },
          { path: 'loanTermID', select: 'termName minTerm maxTerm' }
        ]
      })
      .sort({ createdAt: -1 }); // Newest first

    res.json(contracts);
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
    .populate('userID', 'firstName lastName') // Borrower info
    .populate('typeTermID')
    .populate('sponsorID_1', 'firstName lastName') // Sponsor 1 info
    .populate('sponsorID_2', 'firstName lastName') // Sponsor 2 info
    .sort({ createdAt: -1 }); // Newest first

    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper to create loan
const createLoan = require('./loanController').createLoan; 