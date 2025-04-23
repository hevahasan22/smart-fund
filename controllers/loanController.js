const { Loan, validateLoan } = require('../models/loan');
const { Contract } = require('../models/contract');

exports.createLoan = async (req, res) => {
  const { error } = validateLoan(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const contract = await Contract.findOne({ contractID: req.body.contractID });
  if (!contract) return res.status(400).send('Contract not found');

  const loan = new Loan(req.body);
  await loan.save();
  res.send(loan);
};

exports.getLoansByPriority = async (req, res) => {
  const loans = await Loan.find()
    .populate('typeID')
    .sort({ 'typeID.priority': -1, createdAt: 1 });
  res.send(loans);
};