const Contract = require('../models/contract');
const User = require('../models/user');
const Loan = require('../models/loan');
const TypeTerm = require('../models/typeterm');
const AdditionalDocument = require('../models/additionalDocument');
const AdditionalDocumentType = require('../models/additionalDocumentType');

exports.createContract = async (req, res) => {
  try {
    const { typeTermID, loanAmount, loanTermMonths, sponsorID_1, 
      sponsorID_2, startDate } = req.body;
    const userId = req.user.id;
    
     // 1. Validate typeTermID
    const typeTerm = await TypeTerm.findById(typeTermID)
      .populate('loanTypeID')
      .populate('loanTermID');
    
    if (!typeTerm) {
      return res.status(400).json({ error: 'Invalid loan' });
    }

    // 2. Validate loan parameters
    if (loanAmount < typeTerm.loanTypeID.minAmount || 
        loanAmount > typeTerm.loanTypeID.maxAmount) {
      return res.status(400).json({ 
        error: `Loan amount must be between ${typeTerm.loanTypeID.minAmount} and ${typeTerm.loanTypeID.maxAmount}` 
      });
    }

    if (loanTermMonths < typeTerm.loanTermID.minTerm || 
        loanTermMonths > typeTerm.loanTermID.maxTerm) {
      return res.status(400).json({ 
        error: `Loan term must be between ${typeTerm.loanTermID.minTerm} and ${typeTerm.loanTermID.maxTerm} months` 
      });
    }

    // 3. Validate sponsors
    const [sponsor1, sponsor2] = await Promise.all([
      User.findById(sponsorID_1),
      User.findById(sponsorID_2)
    ]);
    
    if (!sponsor1 || !sponsor2) {
      return res.status(400).json({ error: 'One or both sponsors not found' });
    }
    
    if (sponsor1.status !== 'eligible' || sponsor2.status !== 'eligible') {
      return res.status(400).json({ error: 'One or both sponsors are not eligible' });
    }

    // 4. Create contract
    const contract = new Contract({
      userID: userId,
      sponsorID_1,
      sponsorID_2,
      typeTermID,
      loanTermMonths,
      loanAmount,
      startDate: startDate || new Date(),
      status: 'pending_sponsor_approval',
      priority: typeTerm.loanTypeID.priority,
      sponsor1Approved: false,
      sponsor2Approved: false,
      sponsorApprovalRequestedAt: new Date()

    });

    await contract.save();

    // Notify sponsors by updating their user records
    await notifySponsors(contract);
    
    // Start approval process
    processContractApproval(contract);
    
    res.status(201).json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Notify sponsors by adding pending approvals to their user records
const notifySponsors = async (contract) => {
  try {
    // Add contract to sponsor1's pendingApprovals
    await User.findByIdAndUpdate(contract.sponsorID_1, {
      $push: {
        pendingApprovals: {
          contractId: contract._id,
          borrowerId: contract.userID,
          requestedAt: new Date()
        }
      }
    });
    
    // Add contract to sponsor2's pendingApprovals
    await User.findByIdAndUpdate(contract.sponsorID_2, {
      $push: {
        pendingApprovals: {
          contractId: contract._id,
          borrowerId: contract.userID,
          requestedAt: new Date()
        }
      }
    });
    
    console.log(`Sponsors notified for contract: ${contract._id}`);
  } catch (error) {
    console.error('Error notifying sponsors:', error);
  }
};

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
    if (!contract.sponsorID_1.equals(sponsorId) && 
        !contract.sponsorID_2.equals(sponsorId)) {
      return res.status(403).json({ error: 'You are not a sponsor for this contract' });
    }
    
    // Update approval status
    if (contract.sponsorID_1.equals(sponsorId)) {
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
    }
    
    res.json({ message: 'Sponsor approval recorded', contract });
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
    
    // Add notification to borrower
    await User.findByIdAndUpdate(contract.userID, {
      $push: {
        notifications: {
          type: 'contract_rejected',
          message: `Your contract was rejected by a sponsor: ${contract.rejectionReason}`,
          contractId: contract._id,
          createdAt: new Date()
        }
      }
    });
    
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
          updatedContract.status = 'rejected';
          updatedContract.rejectionReason = 'Missing required documents';
          await updatedContract.save();
          
          // Notify borrower
          await User.findByIdAndUpdate(updatedContract.userID, {
            $push: {
              notifications: {
                type: 'contract_rejected',
                message: 'Contract rejected: Missing required documents',
                contractId: updatedContract._id,
                createdAt: new Date()
              }
            }
          });
          return;
        }
        
        // 2. Check sponsor availability
        
        const sponsor1Count = await Contract.countDocuments({
          $or: [
            { sponsorID_1: contract.sponsorID_1 }, 
            { sponsorID_2: contract.sponsorID_1 }
          ],
          status: 'approved'
        });
        
        const sponsor2Count = await Contract.countDocuments({
          $or: [
            { sponsorID_1: contract.sponsorID_2 }, 
            { sponsorID_2: contract.sponsorID_2 }
          ],
          status: 'approved'
        });
        
        if (sponsor1Count >= 2 || sponsor2Count >= 2) {
          updatedContract.status = 'rejected';
          updatedContract.rejectionReason = 'Sponsor unavailable';
          await updatedContract.save()
          
          // Notify borrower
          await User.findByIdAndUpdate(updatedContract.userID, {
            $push: {
              notifications: {
                type: 'contract_rejected',
                message: 'Contract rejected: Sponsor unavailable',
                contractId: updatedContract._id,
                createdAt: new Date()
              }
            }
          });
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
          updatedContract.status = 'rejected';
          updatedContract.rejectionReason = 'Monthly approval limit reached';
          await updatedContract.save();
          
          // Notify borrower
          await User.findByIdAndUpdate(updatedContract.userID, {
            $push: {
              notifications: {
                type: 'contract_rejected',
                message: 'Contract rejected: Monthly approval limit reached',
                contractId: updatedContract._id,
                createdAt: new Date()
              }
            }
          });
          return;
        }
        
        // 4. Approve contract
        updatedContract.status = 'approved';
        updatedContract.approvedAt = new Date();
        await updatedContract.save();
        
        // 5. Create loan after approval
        const loanController = require('./loanController');
        await loanController.createLoan(updatedContract);

        // Notify borrower
        await User.findByIdAndUpdate(updatedContract.userID, {
          $push: {
            notifications: {
              type: 'contract_approved',
              message: 'Your contract has been approved!',
              contractId: updatedContract._id,
              createdAt: new Date()
            }
          }
        });
        
      } catch (error) {
        console.error('Contract approval error:', error);
      }
    }, delay);
  } catch (error) {
    console.error('Error in approval process:', error);
  }
};

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