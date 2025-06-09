const mongoose= require('mongoose')
const joi=require('joi')
const loanSchema=new mongoose.Schema({
    loanAmount:
    {
        type:Number,
        required:true,
        validate: {
          validator: async function(value) {
            const loanType = await mongoose.model('LoanType').findById(this.typeTermID.loanTypeID);
            return value >= loanType.minAmount && value <= loanType.maxAmount;
          },
          message: 'Loan amount is outside the allowed range'
        }
    },
    loanTermMonths:
    {
        type:Number,
        required:true,
        min: [1, 'Loan term must be at least 1 month'],
        validate: {
          validator: async function(value) {
            const loanTerm = await mongoose.model('LoanTerm').findById(this.typeTermID.loanTermID);
            return value >= loanTerm.minTerm && value <= loanTerm.maxTerm;
          },
          message: 'Loan term is outside the allowed duration'
        }
    },
    startDate:
    {
        type:Date,
        required:true
    },
    endDate:
    {
        type:Date,
        required:true,
        validate: {
          validator: async function(value) {
            const loanTerm = await mongoose.model('LoanTerm').findById(this.typeTermID.loanTermID);
            const minEndDate = new Date(this.startDate);
            minEndDate.setMonth(minEndDate.getMonth() + loanTerm.minTerm);
            const maxEndDate = new Date(this.startDate);
            maxEndDate.setMonth(maxEndDate.getMonth() + loanTerm.maxTerm);
            return value >= minEndDate && value <= maxEndDate;
          },
          message: 'Loan end date is invalid for the selected term'
        }
    },
    typeTermID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'typeterm',
        required:true
    },
    investorID:
    {
        type:mongoose.Schema.Types.ObjectId,
        ref:'investor',
        required:true
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'defaulted'],
      default: 'pending'
    },
    rejectionReason: String
  },
  {
    timestamps:true
  }
)

// Pre-save hook to auto-set end date if not provided
loanSchema.pre('save', function(next) {
  if (!this.endDate && this.loanTermMonths) {
    const endDate = new Date(this.startDate);
    endDate.setMonth(endDate.getMonth() + this.loanTermMonths);
    this.endDate = endDate;
  }
  next();
});

// Get interest rate from loan typeterm
loanSchema.methods.getInterestRate = async function() {
  const typeTerm = await mongoose.model('typeterm')
    .findById(this.typeTermID);
  
  return typeTerm.interestRate;
};

const loanModel=mongoose.model('loan',loanSchema)

module.exports={
  loanModel
}