const { AdditionalDocument, validateAdditionalDocument } = require('../models/additionalDocument');

exports.uploadDocument = async (req, res) => {
  const { error } = validateAdditionalDocument(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const document = new AdditionalDocument(req.body);
  await document.save();
  res.send(document);
};