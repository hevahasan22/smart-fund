// middlewares/sponsorValidator.js
const Contract = require('../models/contract');
const Loan = require('../models/loan');
const Sponsor=require('../models/user')


const validateSponsors = async (req, res, next) => {
  const { sponser1, sponser2, loanID } = req.body;
  
  try {
    // 1. Check sponsor IDs are distinct
    if (sponsorID_1.toString() === sponsorID_2.toString()) {
      return res.status(400).json({
        message: 'Sponsors must be different individuals'
      });
    }

    const loan = await Loan.findById(loanID).populate('typeID');
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const loanType = loan.typeID;
    
    // 2. Check sponsor availability
    const sponsors = [sponsorID_1, sponsorID_2];
    
    for (const sponsorId of sponsors) {
      const activeGuarantees = await Contract.countDocuments({
        $or: [{ sponsorID_1: sponsorId }, { sponsorID_2: sponsorId }],
        status: { $in: ['approved', 'active'] },
        'loanID': loan.loanID
      });

      if (activeGuarantees >= 2) {
        return res.status(400).json({
          message: `Sponsor ${sponsorId} has reached the maximum guarantees`
        });
      }
    }

    // 3. Check sponsors are not the applicant
    if (sponsorID_1.toString() === req.user.id || 
        sponsorID_2.toString() === req.user.id) {
      return res.status(400).json({
        message: 'You cannot be your own sponsor'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Sponsor validation failed', error });
  }
};

module.exports = validateSponsors;