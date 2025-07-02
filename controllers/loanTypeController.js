const { loanTypeModel } = require('../models/loanType');

// Create loan type (Admin only)
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

// Get all loan types
exports.getAllLoanTypes = async (req, res) => {
  try {
    const loanTypes = await loanTypeModel.find();
    res.json(loanTypes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update loan type (Admin only)
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

// Delete loan type (Admin only)
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

// Get a single Loan Type by ID
exports.getLoanTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const loanType = await loanTypeModel.findById(id);
    
    if (!loanType) {
      return res.status(404).json({ error: 'Loan type not found' });
    }
    
    res.json(loanType);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};