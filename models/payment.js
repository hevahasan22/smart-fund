const mongoose= require('mongoose')
const joi=require('joi')
const paymentSchema=new mongoose.Schema({
    dueDate:
    {
        type:Date,
        required:true
    },
    payedDate:
    {
        type:Date
    },
    paymentMethod:
    {
        type:String,
        trim:true
    },
    statues:
    {
        type:Boolean,
        required:true
    },
    loan:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'loan',
        required:true
    }
  },
  {
    timestamps:true
  }
)
const paymentModel=mongoose.model('payment',paymentSchema)

module.exports={
  paymentModel
}