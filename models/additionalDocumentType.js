const mongoose=require('mongoose')
const Joi=require('joi')
const additionalDocumentTypeSchema=mongoose.Schema({
    documentName:
    {
       type:String,
       trim:true
    },
    LoanType:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'LoanType',
        required:true
    },
    isRequred:
    {
        type:Boolean,
        required:true
    }
})
const additionalDocumentTypeValidation = Joi.object({
    documentName: Joi.string().required(),
    isRequired: Joi.boolean().required(),
  });

  const additionalDocumentTypeUpdateValidation = Joi.object({
    documentName: Joi.string().required(),
    isRequired: Joi.boolean().required(),
  });
  
const additionalDocumentTypeModel=mongoose.model('additionalDocumentType',additionalDocumentTypeSchema)
module.exports = {
  additionalDocumentTypeModel,
  additionalDocumentTypeValidation,
  additionalDocumentTypeUpdateValidation
  };