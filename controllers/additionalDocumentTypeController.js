const { additionalDocumentTypeModel, validateDocumentType } = require('../models/additionalDocumentType');
const Joi = require('joi');

// Create document type
exports.createDocumentType = async (req, res) => {
  try {
    const { error } = validateDocumentType(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { documentName, description } = req.body;
    
    // Check if document type already exists
    const existingDocType = await additionalDocumentTypeModel.findOne({ documentName });
    if (existingDocType) {
      return res.status(400).json({ error: 'Document type with this name already exists' });
    }
    
    // Create document type
    const docType = new additionalDocumentTypeModel({
      documentName,
      description
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

// Get all document types
exports.getAllDocumentTypes = async (req, res) => {
  try {
    const documentTypes = await additionalDocumentTypeModel.find()
      .sort({ documentName: 1 });
    
    res.json({
      documentTypes: documentTypes.map(dt => ({
        id: dt._id,
        documentName: dt.documentName,
        description: dt.description,
        createdAt: dt.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get document type by ID
exports.getDocumentTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const docType = await additionalDocumentTypeModel.findById(id);
    
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    res.json({
      id: docType._id,
      documentName: docType.documentName,
      description: docType.description,
      createdAt: docType.createdAt,
      updatedAt: docType.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update document type
exports.updateDocumentType = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = validateDocumentType(req.body);
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
    
    // Check if document type is used in any relationships
    const { documentTypeTermRelationModel } = require('../models/documentTypeTermRelation');
    const relations = await documentTypeTermRelationModel.find({ documentTypeID: id });
    if (relations.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete document type that is associated with type terms',
        relationsCount: relations.length
      });
    }
    
    const docType = await additionalDocumentTypeModel.findByIdAndDelete(id);
    
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    res.json({ message: 'Document type deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};