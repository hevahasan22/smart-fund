const mongoose=require('mongoose');
const joi=require('joi')
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

const loanTermModel=mongoose.model('loanTerm',loanTermSchema)
module.exports={
  loanTermModel
}