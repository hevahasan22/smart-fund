const { LoanTerm, validateLoanTerm } = require('../models/loanTerm');

exports.createLoanTerm = async (req, res) => {
  const { error } = validateLoanTerm(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const loanTerm = new LoanTerm(req.body);
  await loanTerm.save();
  res.send(loanTerm);
};

exports.getLoanTerms = async (req, res) => {
  const loanTerms = await LoanTerm.find();
  res.send(loanTerms);
};