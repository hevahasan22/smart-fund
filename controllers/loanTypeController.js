const { LoanType, validateLoanType } = require('../models/loanType');

exports.createLoanType = async (req, res) => {
  const { error } = validateLoanType(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const loanType = new LoanType(req.body);
  await loanType.save();
  res.send(loanType);
};

exports.getLoanTypes = async (req, res) => {
  const loanTypes = await LoanType.find();
  res.send(loanTypes);
};