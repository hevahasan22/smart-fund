const mongoose=require('mongoose');
const Joi=require('joi')
const loanTermSchema=new mongoose.Schema({
    type:{
        type:String,
        enum: ['short-term', 'long-term'],
        required:true,
        unique:true
    },
    maxTerm:{
        type:Number,
        trim:true,
        required:true,
        validate: {
          validator: function(v) {
            return v > this.minTerm;
          },
          message: 'Max term must be greater than min term'
        }
    },
    minTerm:{
        type:Number,
        required:true,
        min: [1, 'Minimum term must be at least 1 month']
    },
})

  
const loanTermModel=mongoose.model('LoanTerm',loanTermSchema) // Capital L and T
module.exports={
  loanTermModel
}