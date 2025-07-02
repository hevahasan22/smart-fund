const { loanTermModel } = require('../models/loanTerm');

// Create loan term (Admin only)
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

// Get all loan terms
exports.getAllLoanTerms = async (req, res) => {
  try {
    const loanTerms = await loanTermModel.find();
    res.json(loanTerms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update loan term (Admin only)
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

// Delete loan term (Admin only)
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

// Get a single Loan Term by ID
exports.getLoanTermById = async (req, res) => {
  try {
    const { id } = req.params;
    const loanTerm = await loanTermModel.findById(id);
    
    if (!loanTerm) {
      return res.status(404).json({ error: 'Loan term not found' });
    }
    
    res.json(loanTerm);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};