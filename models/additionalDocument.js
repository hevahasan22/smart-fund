const cloudinary=require('cloudinary');
const { ref } = require('joi');
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
        },
        fileType:
        {
            type:String
        }
    },
    uploadedAt:
    {
        type:Date
    }
})

const additionalDocumentModel=mongoos.model('additionalDocument',additionalDocumentSchema)
module.exports={
    additionalDocumentModel
}
