const mongoose=require('mongoose');
const joi=require('joi')
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
})

const loanTypeModel=mongoose.model('loanType',loanTypeSchema)
module.exports={
  loanTypeModel
}