const mongoose = require('mongoose');
const Joi = require('joi');

const documentTypeTermRelationSchema = new mongoose.Schema({
    documentTypeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'additionalDocumentType',
        required: true
    },
    typeTermID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'typeterm',
        required: true
    },
    name: {
        type: String
    },
    isRequired: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Create compound index to ensure unique relationships
documentTypeTermRelationSchema.index(
    { documentTypeID: 1, typeTermID: 1 }, 
    { unique: true }
);

const documentTypeTermRelationModel = mongoose.model('documentTypeTermRelation', documentTypeTermRelationSchema);

// Validation function
const validateDocumentTypeTermRelation = (data) => {
    const schema = Joi.object({
        documentTypeID: Joi.string().hex().length(24).required(),
        typeTermID: Joi.string().hex().length(24).required(),
        name: Joi.string(),
        isRequired: Joi.boolean().default(true)
    });
    return schema.validate(data);
};

module.exports = {
    documentTypeTermRelationModel,
    validateDocumentTypeTermRelation
}; 