const mongoose=require('mongoose')
const Joi=require('joi')
const sponsorSchema=new mongoose.Schema(
    {
        fullName:
        {
          type:String,
          trim:true,
          required:true,
          unique:true,
          minlength:4,
          maxlength:20
        },
        email:
        {
          type:String,
          trim:true,
          required:true,
          minlength:8,
          maxlength:20,
          unique:true
        },
        phoneNumber:
        {
           type:Number,
           required:true,
           unique:true
        },
        status:
        {
          type:String,
          required:false,
          trim:true,
        },
        relationshipWithUser:
        {
          type:String,
          required:false,
          trim:true, 
        },
        income:
        {
          type:Number,
          required:true,
        }
    },
    {
        timestamps:true
    }
)

const sponsorValidationSchema = Joi.object({
  fullName: Joi.string().trim().required(),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s-]{10,}$/).required(),
  relationshipWithUser: Joi.string(),
  income: Joi.number().min(0).required(),
  status: Joi.string().valid('active', 'inactive', 'pending')
});

const sponsorModel=mongoose.model('sponsor',sponsorSchema)
module.exports={
  sponsorModel,
  validateSponsor: (data) => sponsorValidationSchema.validate(data)
}
