const { documentTypeTermRelationModel, validateDocumentTypeTermRelation } = require('../models/documentTypeTermRelation');
const { additionalDocumentTypeModel } = require('../models/additionalDocumentType');
const { typetermModel } = require('../models/typeterm');
const Joi = require('joi');

// Create a new document type term relationship
exports.createRelation = async (req, res) => {
  try {
    const { error } = validateDocumentTypeTermRelation(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const { documentTypeID, typeTermID, name, isRequired } = req.body;
    
    // Check if document type exists
    const docType = await additionalDocumentTypeModel.findById(documentTypeID);
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    // Check if type term exists
    const typeTerm = await typetermModel.findById(typeTermID);
    if (!typeTerm) {
      return res.status(404).json({ error: 'Type term not found' });
    }
    
    // Check if relationship already exists
    const existingRelation = await documentTypeTermRelationModel.findOne({
      documentTypeID,
      typeTermID
    });
    
    if (existingRelation) {
      return res.status(400).json({ 
        error: 'Relationship between this document type and type term already exists',
        existingRelation: existingRelation._id
      });
    }
    
    // Create relationship
    const relation = new documentTypeTermRelationModel({
      documentTypeID,
      typeTermID,
      name: name || docType.documentName, // Use document name as default if not provided
      isRequired: isRequired !== undefined ? isRequired : true
    });
    
    await relation.save();
    
    // Populate the created relation for response
    const populatedRelation = await documentTypeTermRelationModel.findById(relation._id)
      .populate('documentTypeID')
      .populate('typeTermID');
    
    res.status(201).json({
      message: 'Document type relationship created successfully',
      relation: {
        id: populatedRelation._id,
        documentType: {
          id: populatedRelation.documentTypeID._id,
          name: populatedRelation.documentTypeID.documentName,
          description: populatedRelation.documentTypeID.description
        },
        typeTerm: {
          id: populatedRelation.typeTermID._id,
          name: populatedRelation.typeTermID.name
        },
        name: populatedRelation.name,
        isRequired: populatedRelation.isRequired,
        createdAt: populatedRelation.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating document type relationship:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all relationships
exports.getAllRelations = async (req, res) => {
  try {
    const { page = 1, limit = 20, documentTypeID, typeTermID, isRequired } = req.query;
    
    // Build query
    const query = {};
    if (documentTypeID) query.documentTypeID = documentTypeID;
    if (typeTermID) query.typeTermID = typeTermID;
    if (isRequired !== undefined) query.isRequired = isRequired === 'true';
    
    const relations = await documentTypeTermRelationModel.find(query)
      .populate('documentTypeID')
      .populate('typeTermID')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await documentTypeTermRelationModel.countDocuments(query);
    
    res.json({
      relations: relations.map(relation => ({
        id: relation._id,
        documentType: {
          id: relation.documentTypeID._id,
          name: relation.documentTypeID.documentName,
          description: relation.documentTypeID.description
        },
        typeTerm: {
          id: relation.typeTermID._id,
          name: relation.typeTermID.name
        },
        name: relation.name,
        isRequired: relation.isRequired,
        createdAt: relation.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error getting document type relationships:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get relationships by document type ID
exports.getRelationsByDocumentType = async (req, res) => {
  try {
    const { documentTypeID } = req.params;
    
    // Check if document type exists
    const docType = await additionalDocumentTypeModel.findById(documentTypeID);
    if (!docType) {
      return res.status(404).json({ error: 'Document type not found' });
    }
    
    const relations = await documentTypeTermRelationModel.find({ documentTypeID })
      .populate('documentTypeID')
      .populate('typeTermID')
      .sort({ createdAt: -1 });
    
    res.json({
      documentType: {
        id: docType._id,
        name: docType.documentName,
        description: docType.description
      },
      relations: relations.map(relation => ({
        id: relation._id,
        typeTerm: {
          id: relation.typeTermID._id,
          name: relation.typeTermID.name
        },
        name: relation.name,
        isRequired: relation.isRequired,
        createdAt: relation.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting relations by document type:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get relationships by type term ID
exports.getRelationsByTypeTerm = async (req, res) => {
  try {
    const { typeTermID } = req.params;
    
    // Check if type term exists
    const typeTerm = await typetermModel.findById(typeTermID);
    if (!typeTerm) {
      return res.status(404).json({ error: 'Type term not found' });
    }
    
    const relations = await documentTypeTermRelationModel.find({ typeTermID })
      .populate('documentTypeID')
      .populate('typeTermID')
      .sort({ createdAt: -1 });
    
    res.json({
      typeTerm: {
        id: typeTerm._id,
        name: typeTerm.name
      },
      relations: relations.map(relation => ({
        id: relation._id,
        documentType: {
          id: relation.documentTypeID._id,
          name: relation.documentTypeID.documentName,
          description: relation.documentTypeID.description
        },
        name: relation.name,
        isRequired: relation.isRequired,
        createdAt: relation.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting relations by type term:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single relationship by ID
exports.getRelationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const relation = await documentTypeTermRelationModel.findById(id)
      .populate('documentTypeID')
      .populate('typeTermID');
    
    if (!relation) {
      return res.status(404).json({ error: 'Document type relationship not found' });
    }
    
    res.json({
      id: relation._id,
      documentType: {
        id: relation.documentTypeID._id,
        name: relation.documentTypeID.documentName,
        description: relation.documentTypeID.description
      },
      typeTerm: {
        id: relation.typeTermID._id,
        name: relation.typeTermID.name
      },
      name: relation.name,
      isRequired: relation.isRequired,
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt
    });
  } catch (error) {
    console.error('Error getting document type relationship:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update relationship
exports.updateRelation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate update data
    const schema = {
      name: Joi.string().optional(),
      isRequired: Joi.boolean().optional()
    };
    
    const { error } = Joi.object(schema).validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    
    const relation = await documentTypeTermRelationModel.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    ).populate('documentTypeID').populate('typeTermID');
    
    if (!relation) {
      return res.status(404).json({ error: 'Document type relationship not found' });
    }
    
    res.json({
      message: 'Document type relationship updated successfully',
      relation: {
        id: relation._id,
        documentType: {
          id: relation.documentTypeID._id,
          name: relation.documentTypeID.documentName,
          description: relation.documentTypeID.description
        },
        typeTerm: {
          id: relation.typeTermID._id,
          name: relation.typeTermID.name
        },
        name: relation.name,
        isRequired: relation.isRequired,
        updatedAt: relation.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating document type relationship:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete relationship
exports.deleteRelation = async (req, res) => {
  try {
    const { id } = req.params;
    
    const relation = await documentTypeTermRelationModel.findByIdAndDelete(id);
    
    if (!relation) {
      return res.status(404).json({ error: 'Document type relationship not found' });
    }
    
    res.json({ 
      message: 'Document type relationship deleted successfully',
      deletedRelation: {
        id: relation._id,
        documentTypeID: relation.documentTypeID,
        typeTermID: relation.typeTermID
      }
    });
  } catch (error) {
    console.error('Error deleting document type relationship:', error);
    res.status(500).json({ error: error.message });
  }
};