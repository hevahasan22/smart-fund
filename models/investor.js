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
        unique:true
      },
      contactPhone:
      {
        type:Number,
        required:true,
        unique:true
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
//hgfjf