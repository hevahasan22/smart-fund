const cloudinary = require('cloudinary');
const Joi = require('joi');
const mongoose = require('mongoose');

const additionalDocumentSchema = new mongoose.Schema({
    typeID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'additionalDocumentType',
        required: true
    },
    contractID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contract', // Capital C
        required: true
    },
    documentFile: {
        url: {
            type: String,
            required: true
        },
        public_id: {
            type: String,
            required: true
        }
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Capital U
        required: true
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: String,
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Capital U
    },
    reviewedAt: {
        type: Date
    },
    adminNotes: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Index for efficient queries
additionalDocumentSchema.index({ contractID: 1, status: 1 });
additionalDocumentSchema.index({ uploadedBy: 1, status: 1 });
additionalDocumentSchema.index({ reviewedBy: 1 });

const additionalDocumentModel = mongoose.model('additionalDocument', additionalDocumentSchema);

module.exports = {
    additionalDocumentModel
};