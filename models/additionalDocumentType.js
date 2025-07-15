const mongoose=require('mongoose')
const Joi=require('joi')
const additionalDocumentTypeSchema=mongoose.Schema({
    documentName:
    {
       type:String,
       required: true,
       unique: true
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
})

const additionalDocumentTypeModel=mongoose.model('additionalDocumentType',additionalDocumentTypeSchema)

// Validation function
const validateDocumentType = (data) => {
    const schema = Joi.object({
        documentName: Joi.string().required(),
        description: Joi.string().optional()
    });
    return schema.validate(data);
};

module.exports = {
  additionalDocumentTypeModel,
  validateDocumentType
};