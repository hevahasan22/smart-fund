const mongoose= require('mongoose')
const joi=require('joi')
const loanSchema=new mongoose.Schema({
    loanAmount:
    {
        type:Number,
        required:true,
        trim:true
    },
    loanTerm:
    {
        type:Number,
        required:true,
        trim:true
    },
    interestRate:
    {
        type:Number,
        required:true,
        trim:true
    },
    startDate:
    {
        type:Date,
        required:true
    },
    endDate:
    {
        type:Date,
        required:true
    },
    typeterm:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'typeterm',
        required:true
    },
    investor:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'investor',
        required:true
    }
  },
  {
    timestamps:true
  }
)

const loanModel=mongoose.model('loan',loanSchema)

module.exports={
  loanModel
}