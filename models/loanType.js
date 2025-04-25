const mongoose=require('mongoose');
const Joi=require('joi')
const loanTypeSchema=new mongoose.Schema({
    loanName:{
        type:String,
        trim:true,
        required:true,
        unique:true,
        minlength:4,
        maxlength:20
    },
    interestRate:{
        type:Number,
        trim:true,
        required:true,
    },
    maxAmount:{
        type:Number,
        trim:true,
        required:true
    },
    minAmount:{
        type:Number,
        trim:true,
        required:true,
    },
    description:{
        type:String,
    }
  },{timestamps:true}
)


const loanTypeValidation = Joi.object({
    loanName: Joi.string().required(),
    interestRate: Joi.number().min(0).required(),
    maxAmount: Joi.number().min(0).required(),
    minAmount: Joi.number().min(0).required(),
    description: Joi.string()
  });

  const loanTypeUpdateValidation = Joi.object({
    loanName: Joi.string().required(),
    interestRate: Joi.number().min(0).required(),
    maxAmount: Joi.number().min(0).required(),
    minAmount: Joi.number().min(0).required(),
    description: Joi.string()
  });

const loanTypeModel=mongoose.model('loanType',loanTypeSchema)
module.exports={
  loanTypeModel,
  loanTypeValidation,
  loanTypeUpdateValidation
}