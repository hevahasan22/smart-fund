const { typetermModel } = require('../models/typeterm');
const { loanTypeModel } = require('../models/loanType');
const { loanTermModel } = require('../models/loanTerm');

// Get all type-term combinations
exports.getAllTypeTerms = async (req, res) => {
  try {
    const typeTerms = await typetermModel.find()
      .populate('loanTypeID')
      .populate('loanTermID');
      
    res.json(typeTerms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single type-term by ID
exports.getTypeTermById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const typeTerm = await typetermModel.findById(id)
      .populate('loanTypeID')
      .populate('loanTermID');
      
    if (!typeTerm) {
      return res.status(404).json({ error: 'Type-term combination not found' });
    }
    
    res.json(typeTerm);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};