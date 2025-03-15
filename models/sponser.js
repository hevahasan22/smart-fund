const mongoose=require('mongoose')
const joi=require('joi')
const sponserSchema=new mongoose.Schema(
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

const sponserModel=mongoose.model('sponser',sponserSchema)
module.exports={
  sponserModel
}
