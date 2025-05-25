const { Investor, validateInvestor } = require('../models/investor');

exports.createInvestor = async (req, res) => {
  const { error } = validateInvestor(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const investor = new Investor(req.body);
  await investor.save();
  res.send(investor);
};