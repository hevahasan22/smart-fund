const mongoose=require('mongoose');
const joi=require('joi')
const investorSchema=new mongoose.Schema(
    {
      name:
      {
        type:String,
        trim:true,
        required:true,
        unique:true,
        minlength:4,
        maxlength:20
      },
      ContactEmail:
      {
        type:String,
        trim:true,
        required:true,
        minlength:8,
        maxlength:20,
        unique:true,
        validate: {
          validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
          message: 'Invalid email format'
        }
      },
      contactPhone:
      {
        type:Number,
        required:true,
        unique:true,
        validate: {
          validator: (v) => /^[0-9]{10,15}$/.test(v),
          message: 'Phone number must be 10-15 digits'
        }
      }
    },
    {
        timestamps:true
    }
)

const investorModel=mongoose.model('investor',investorSchema)

module.exports={
  investorModel
}