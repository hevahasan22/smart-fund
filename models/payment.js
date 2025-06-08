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
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Payment amount must be at least 0.01']
    },
    paymentMethod:
    {
        type:String,
        enum: ['credit_card', 'bank_transfer', 'cash', null],
        default: null
    },
    statues:
    {
        type: String, 
        enum: ['pending', 'completed', 'overdue'], 
        default: 'pending'
    },
    loanID:
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

// Auto-update status based on dates
paymentSchema.pre('save', function(next) {
  if (this.status === 'pending' && !this.payedDate && new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  next();
});

const paymentModel=mongoose.model('payment',paymentSchema)

module.exports={
  paymentModel
}