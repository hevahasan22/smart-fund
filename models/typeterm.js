const mongoose= require('mongoose')
const Joi=require('joi')
const typetermSchema=new mongoose.Schema({
    name:{
      type: String,
      required:true
    },
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

const typetermModel=mongoose.model('typeterm',typetermSchema)

module.exports={
  typetermModel
}