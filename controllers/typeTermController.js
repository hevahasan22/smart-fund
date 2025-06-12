const { TypeTerm, validateTypeTerm } = require('../models/typeterm');

exports.createTypeTerm = async (req, res) => {
  const { error } = validateTypeTerm(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const typeTerm = new TypeTerm(req.body);
  await typeTerm.save();
  res.send(typeTerm);
};