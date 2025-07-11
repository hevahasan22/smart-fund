const { additionalDocumentTypeModel } = require('../models/additionalDocumentType');
const { typetermModel } = require('../models/typeterm');
const Joi = require('joi');

// Create document type
exports.createDocumentType = async (req, res) => {
  try {
    // Validate input
    const schema = Joi.object({
      documentName: Joi.string().required(),
      typeTermID: Joi.string().hex().length(24).required(),
      isRequired: Joi.boolean().default(true)
    });
    
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { documentName, typeTermID, isRequired } = req.body;
    
    // Check if typeTerm exists
    const typeTerm = await typetermModel.findById(typeTermID);
    if (!typeTerm) {
      return res.status(404).json({ error: 'Loan type-term combination not found' });
    }
    
    // Create document type
    const docType = new additionalDocumentTypeModel({
      documentName,
      typeTermID,
      isRequired
    });
    
    await docType.save();
    
    res.status(201).json({
      message: 'Document type created successfully',
      documentType: docType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get document types for a loan type-term
exports.getDocumentTypesByTypeTerm = async (req, res) => {
  try {
    const { typeTermID } = req.params;
    
    const documentTypes = await additionalDocumentTypeModel.find({
      typeTermID
    });
    
    res.json(documentTypes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update document type
exports.updateDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate input
    const schema = Joi.object({
      documentName: Joi.string(),
      isRequired: Joi.boolean()
    });
    
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const docType = await additionalDocumentTypeModel.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );
    
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    res.json({
      message: 'Document type updated successfully',
      documentType: docType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete document type
exports.deleteDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    
    const docType = await additionalDocumentTypeModel.findByIdAndDelete(id);
    
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    res.json({ message: 'Document type deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};