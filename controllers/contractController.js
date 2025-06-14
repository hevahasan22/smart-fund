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
      status: 'pending',
      priority: typeTerm.loanTypeID.priority

    });

    await contract.save();
    
    // Start approval process
    processContractApproval(contract);
    
    res.status(201).json(contract);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Approval processing logic
const processContractApproval = async (contract) => {
  try {
    // Get loan type name for priority
    const typeTerm = await TypeTerm.findById(contract.typeTermID)
      .populate('loanTypeID');
    
    if (!typeTerm) {
      console.error('TypeTerm not found for contract:', contract._id);
      return;
    }
    
    const loanTypeName = typeTerm.loanTypeID.loanName.toLowerCase();
    
    // Priority processing (medical > educational > personal)
    const priorityDelays = {
      medical: 5000,    // 5 seconds
      educational: 10000, // 10 seconds
      personal: 15000    // 15 seconds
    };
    
    const delay = priorityDelays[loanTypeName] || 15000;
    
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
          return;
        }
        
        // 2. Check sponsor availability
        const loanTypeId = typeTerm.loanTypeID._id;
        
        const sponsor1Count = await Contract.countDocuments({
          $or: [{ sponsorID_1: contract.sponsorID_1 }, { sponsorID_2: contract.sponsorID_1 }],
          status: 'approved',
          'typeTermID.loanTypeID': loanTypeId
        });
        
        const sponsor2Count = await Contract.countDocuments({
          $or: [{ sponsorID_1: contract.sponsorID_2 }, { sponsorID_2: contract.sponsorID_2 }],
          status: 'approved',
          'typeTermID.loanTypeID': loanTypeId
        });
        
        if (sponsor1Count >= 2 || sponsor2Count >= 2) {
          updatedContract.status = 'rejected';
          updatedContract.rejectionReason = 'Sponsor unavailable';
          await updatedContract.save();
          return;
        }
        
        // 3. Approve contract
        updatedContract.status = 'approved';
        await updatedContract.save();
        
        // 4. Create loan after approval
        const loanController = require('./loanController');
        await loanController.createLoan(updatedContract);
        
      } catch (error) {
        console.error('Contract approval error:', error);
      }
    }, delay);
  } catch (error) {
    console.error('Error in approval process:', error);
  }
};


exports.getUserContracts = async (req, res) => {
  try {
    const contracts = await Contract.find({ userID: req.user.id });
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Helper to create loan
const createLoan = require('./loanController').createLoan;