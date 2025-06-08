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
        required:true,
        min: [0, 'Interest rate cannot be negative']
    },
    maxAmount:{
        type:Number,
        required:true,
        validate: {
          validator: function(v) {
            return v > this.minAmount;
          },
          message: 'Max amount must be greater than min amount'
        }
    },
    minAmount:{
        type:Number,
        required:true,
        min: [0, 'Minimum amount cannot be negative']
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

const loanTypeModel=mongoose.model('loanType',loanTypeSchema)
module.exports={
  loanTypeModel
}