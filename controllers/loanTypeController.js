const { loanTypeModel } = require('../models/loanType');

// Get all loan types
exports.getAllLoanTypes = async (req, res) => {
  try {
    const loanTypes = await loanTypeModel.find();
    res.json(loanTypes);
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