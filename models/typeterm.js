const mongoose= require('mongoose')
const Joi=require('joi')
const typetermSchema=new mongoose.Schema({
    loanTypeID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'loanType',
        required:true
    },
    loanTermID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'loanTerm',
        required:true
    } ,
      interestRate:{
        type:Number,
        required:true,
        min: [0, 'Interest rate cannot be negative']
    },  
}, { timestamps: true })

// Ensure unique combination of loan type and term
typetermSchema.index(
  { loanTypeID: 1, loanTermID: 1 }, 
  { unique: true }
);

const typetermModel=mongoose.model('typeterm',typetermSchema)

module.exports={
  typetermModel
}