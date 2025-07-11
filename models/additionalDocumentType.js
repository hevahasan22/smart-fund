const mongoose=require('mongoose')
const Joi=require('joi')
const additionalDocumentTypeSchema=mongoose.Schema({
    documentName:
    {
       type:String,
       required: true
    },
    typeTermID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'typeterm',
        required:true
    },
    isRequired:
    {
        type:Boolean,
        default:true
    }
})
const additionalDocumentTypeModel=mongoose.model('additionalDocumentType',additionalDocumentTypeSchema)
module.exports = {
  additionalDocumentTypeModel
  };