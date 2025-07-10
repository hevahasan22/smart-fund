const { loanTermModel } = require('../models/loanTerm');

// Get all loan terms
exports.getAllLoanTerms = async (req, res) => {
  try {
    const loanTerms = await loanTermModel.find();
    res.json(loanTerms);
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