const { typetermModel } = require('../models/typeterm');
const { loanTypeModel } = require('../models/loanType');
const { loanTermModel } = require('../models/loanTerm');

// Create type-term combination (Admin only)
exports.createTypeTerm = async (req, res) => {
  try {
    const { loanTypeID, loanTermID, interestRate } = req.body;
    
    // Verify loan type and term exist
    const [loanType, loanTerm] = await Promise.all([
      loanTypeModel.findById(loanTypeID),
      loanTermModel.findById(loanTermID)
    ]);
    
    if (!loanType || !loanTerm) {
      return res.status(400).json({ error: 'Invalid loan type or term' });
    }
    
    const typeTerm = new typetermModel({
      loanTypeID,
      loanTermID,
      interestRate
    });
    
    await typeTerm.save();
    res.status(201).json(typeTerm);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

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

// Update type-term combination (Admin only)
exports.updateTypeTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const typeTerm = await typetermModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    })
    .populate('loanTypeID')
    .populate('loanTermID');
    
    if (!typeTerm) {
      return res.status(404).json({ error: 'Type-term combination not found' });
    }
    
    res.json(typeTerm);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete type-term combination (Admin only)
exports.deleteTypeTerm = async (req, res) => {
  try {
    const { id } = req.params;
    const typeTerm = await typetermModel.findByIdAndDelete(id);
    
    if (!typeTerm) {
      return res.status(404).json({ error: 'Type-term combination not found' });
    }
    
    res.json({ message: 'Type-term combination deleted' });
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