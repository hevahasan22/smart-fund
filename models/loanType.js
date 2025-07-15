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
    description:{
        type:String,
    },
    priority: {
        type: Number,
        default: 3,
        min: [1, 'Priority must be at least 1 (highest)']
    }
  },{timestamps:true}
)

const loanTypeModel=mongoose.model('LoanType',loanTypeSchema) // Capital L and T
module.exports={
  loanTypeModel
}