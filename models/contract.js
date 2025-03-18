const mongoose= require('mongoose')
const joi=require('joi')
const contractSchema=new mongoose.Schema({
    statues:
    {
        type:Boolean,
        required:true,
    },
    dateOfCreate:
    {
        type:Date,
        required:true,
    },
    user:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'user',
        required:true,
    },
    sponser1:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'sponser',
        required:true
    },
    sponser2:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'sponser',
        required:true
    }
  },
  {
    timestamps:true
  }
)
const contractModel=mongoose.model('contract',contractSchema)
module.exports={
  contractModel
}