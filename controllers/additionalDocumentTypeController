const { AdditionalDocumentType, validateAdditionalDocumentType } = require('../models/additionalDocumentType');

exports.createDocumentType = async (req, res) => {
  const { error } = validateAdditionalDocumentType(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const documentType = new AdditionalDocumentType(req.body);
  await documentType.save();
  res.send(documentType);
};