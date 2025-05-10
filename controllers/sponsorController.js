const { Sponsor, validateSponsor } = require('../models/sponsor');
const { Contract } = require('../models/contract');

exports.createSponsor = async (req, res) => {
  const { error } = validateSponsor(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const sponsor = new Sponsor(req.body);
  await sponsor.save();
  res.send(sponsor);
};

exports.checkSponsorAvailability = async (req, res) => {
  const { sponsorID } = req.params;
  const contracts = await Contract.find({
    $or: [{ sponsorID_1: sponsorID }, { sponsorID_2: sponsorID }]
  });

  if (contracts.length >= 2) {
    return res.status(400).send('Sponsor has reached maximum contract limit');
  }
  res.send({ available: true, currentContracts: contracts.length });
};