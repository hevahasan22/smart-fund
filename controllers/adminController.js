const { User, Contract, Payment, Investor } = require('../models/index');
const { loanTypeModel } = require('../models/loanType');
const { loanTermModel } = require('../models/loanTerm');

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