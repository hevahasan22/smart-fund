const mongoose=require('mongoose');
const Joi=require('joi')
const loanTermSchema=new mongoose.Schema({
    type:{
        type:String,
        trim:true,
        required:true,
        unique:true,
        minlength:4,
        maxlength:20
    },
    maxTerm:{
        type:Number,
        trim:true,
        required:true
    },
    minTerm:{
        type:Number,
        trim:true,
        required:true,
    },
})


const loanTermValidation = Joi.object({
    type: Joi.string().required(),
    maxTerm: Joi.number().min(0).required(),
    minTerm: Joi.number().min(0).required()
  });

  const loanTermUpdateValidation = Joi.object({
    type: Joi.string().required(),
    maxTerm: Joi.number().min(0).required(),
    minTerm: Joi.number().min(0).required()
  });

  
const loanTermModel=mongoose.model('loanTerm',loanTermSchema)
module.exports={
  loanTermModel,
  loanTermValidation,
  loanTermUpdateValidation
}