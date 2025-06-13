const Contract = require('../models/contract');
const Sponsor = require('../models/sponsor');
const Loan = require('../models/loan');

exports.createContract = async (req, res) => {
  try {
    const { loanType, loanTerm, sponsors, documents } = req.body;
    const userId = req.user.id;
    
    // Create contract
    const contract = new Contract({
      userID: userId,
      sponsorID_1: sponsors[0],
      sponsorID_2: sponsors[1],
      loanType,
      loanTerm,
      status: 'pending'
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
    // Priority processing (medical > educational > personal)
    const priority = {
      medical: 1,
      educational: 2,
      personal: 3
    };
    
    const delay = priority[contract.loanType] * 5000; // Simulated priority delay
    
    setTimeout(async () => {
      const updatedContract = await Contract.findById(contract._id);
      if (updatedContract.status === 'pending') {
        updatedContract.status = 'approved';
        await updatedContract.save();
        
        // Create loan after approval
        const loan = await createLoan(updatedContract);
      }
    }, delay);
  } catch (error) {
    console.error('Contract approval error:', error);
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