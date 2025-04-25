const mongoose= require('mongoose')
const Joi=require('joi')
const typetermSchema=new mongoose.Schema({
    loanType:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'loanType',
        required:true
    },
    loanTerm:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'loanTerm',
        required:true
    }   
})


const typetermModel=mongoose.model('typeterm',typetermSchema)

module.exports={
  typetermModel
}