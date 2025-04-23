const mongoose=require('mongoose')
const joi=require('joi')
const additionalDocumentTypeSchema=mongoose.Schema({
    documentName:
    {
       type:String,
       trim:true
    },
    loanTerm:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'loanTerm',
        required:true
    },
    isRequred:
    {
        type:Boolean,
        required:true
    }
})

module.exports = {
    AdditionalDocumentType: mongoose.model('AdditionalDocumentType', additionalDocumentTypeSchema)
  };