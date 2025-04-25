const cloudinary=require('cloudinary');
const Joi = require('joi');
const mongoos=require('mongoose');
const additionalDocumentSchema=new mongoos.Schema({
    typeID:
    {
        type:mongoos.Schema.Types.ObjectId,
        ref:'additionalDocumentType',
        required:true
    },
    contract:
    {
        type:mongoos.Schema.Types.ObjectId,
        ref:'contract',
        required:true
    },
    documentFile:
    {
        url:
        {
            type:String,
            required:true
        }
    },
    uploadedAt:
    {
        type:Date
    }
 },{timestamps:true}
)

const additionalDocumentValidation = Joi.object({
    documentFile: Joi.string().required(),
    uploadedAt: Joi.date()
  });

const additionalDocumentUpdateValidation = Joi.object({
    documentFile: Joi.string().required(),
    uploadedAt: Joi.date()
  });

const additionalDocumentModel=mongoos.model('additionalDocument',additionalDocumentSchema)
module.exports={
    additionalDocumentModel,
    additionalDocumentValidation,
    additionalDocumentUpdateValidation
}
