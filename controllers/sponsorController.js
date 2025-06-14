const User = require('../models/user');
const Contract = require('../models/contract');
const TypeTerm = require('../models/typeterm');

exports.createSponsor = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Update user to add sponsor role
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { loanRole: 'sponsor' }, status: 'eligible' },
      { new: true }
    );
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkSponsorAvailability = async (req, res) => {
  try {
    const { sponsorID, loanTypeID } = req.params;
    
    // Get loan type ID
    const typeTerm = await TypeTerm.findOne({ 'loanTypeID': loanTypeID });
    if (!typeTerm) return res.status(400).json({ error: 'Loan type not found' });
    
    const activeContracts = await Contract.countDocuments({
      $or: [{ sponsorID_1: sponsorID }, { sponsorID_2: sponsorID }],
      status: 'approved',
      typeTermID: typeTerm._id
    });
    
    res.json({ 
      available: activeContracts < 2,
      currentContracts: activeContracts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};