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
    contractID:
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
        type:Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: String
 },{timestamps:true}
)

// Document validation middleware
additionalDocumentSchema.pre('save', async function(next) {
  const docType = await mongoose.model('AdditionalDocumentType').findById(this.typeID);
  const contract = await mongoose.model('Contract').findById(this.contractID)
    .populate({
      path: 'loanID',
      populate: {
        path: 'typeTermID',
        populate: 'loanTypeID'
      }
    });
  
  // 1. Verify document matches loan type-term
  if (!contract.loanID.typeTermID._id.equals(docType.typeTermID)) {
    throw new Error('Document type does not match loan type-term combination');
  }
  
  // 2. Check if file URL is provided
  if (!this.documentFile) {
    throw new Error('Document file is required');
  }
  
  next();
});

const additionalDocumentModel=mongoos.model('additionalDocument',additionalDocumentSchema);

module.exports={
  additionalDocumentModel
}