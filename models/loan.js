const mongoose= require('mongoose')
const joi=require('joi')
const loanSchema=new mongoose.Schema({
    loanAmount:
    {
        type:Number,
        required:true,
        validate: {
          validator: async function(value) {
            const typeTerm = await mongoose.model('typeterm').findById(this.typeTermID);
            return value >= typeTerm.minAmount && value <= typeTerm.maxAmount;
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
            // Fetch typeterm document
            const typeTerm = await mongoose.model('typeterm').findById(this.typeTermID);
            if (!typeTerm || !typeTerm.loanTermID) return false;
            // Fetch LoanTerm document
            const loanTerm = await mongoose.model('LoanTerm').findById(typeTerm.loanTermID);
            if (!loanTerm) return false; // Loan term not found
            return value >= loanTerm.minTerm && value <= loanTerm.maxTerm;
          },
          message: 'Loan term is outside the allowed duration or loan term not found'
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
            // Fetch typeterm document
            const typeTerm = await mongoose.model('typeterm').findById(this.typeTermID);
            if (!typeTerm || !typeTerm.loanTermID) return false;
            // Fetch LoanTerm document
            const loanTerm = await mongoose.model('LoanTerm').findById(typeTerm.loanTermID);
            if (!loanTerm) return false; // Loan term not found
            const minEndDate = new Date(this.startDate);
            minEndDate.setMonth(minEndDate.getMonth() + loanTerm.minTerm);
            const maxEndDate = new Date(this.startDate);
            maxEndDate.setMonth(maxEndDate.getMonth() + loanTerm.maxTerm);
            return value >= minEndDate && value <= maxEndDate;
          },
          message: 'Loan end date is invalid for the selected term or loan term not found'
        }
    },
    interestRate: {
        type: Number,
        required: true
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
        required:false // Made optional since it might not be available at contract approval
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

const Loan=mongoose.model('Loan',loanSchema)

module.exports={
  Loan
}