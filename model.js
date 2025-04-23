const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// User Schema
const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  employmentStatus: { type: String, enum: ['employed', 'self-employed', 'unemployed'], required: true },
  createdAt: { type: Date, default: Date.now }
});

// Sponsor Schema
const SponsorSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  guaranteedLoans: [{
    loanType: { type: String, enum: ['medical', 'personal', 'educational'], required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true } // Added loanId for tracking
  }],
  createdAt: { type: Date, default: Date.now }
});

// Document Schema
const DocumentSchema = new Schema({
  name: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'jpg', 'png'], required: true },
  fileUrl: { type: String, required: true },
  loanType: { type: String, enum: ['medical', 'personal', 'educational'], required: true },
  verified: { type: Boolean, default: false },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now }
});

// Payment Schema
const PaymentSchema = new Schema({
  loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  paymentDate: { type: Date },
  status: { type: String, enum: ['pending', 'completed', 'overdue'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Contract Schema
const ContractSchema = new Schema({
  loanId: { type: Schema.Types.ObjectId, ref: 'Loan', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sponsors: [{ type: Schema.Types.ObjectId, ref: 'Sponsor', required: true }],
  signedAt: { type: Date },
  status: { type: String, enum: ['pending', 'signed', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Loan Schema
const LoanSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  loanType: { type: String, enum: ['medical', 'personal', 'educational'], required: true },
  term: { type: String, enum: ['short-term', 'long-term'], required: true },
  amount: { type: Number, required: true },
  sponsors: [{ type: Schema.Types.ObjectId, ref: 'Sponsor', required: true }],
  documents: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'contracted', 'completed'], 
    default: 'pending' 
  },
  priority: { type: Number, default: 0 }, // Higher number = higher priority (e.g., medical = 3, personal = 1)
  rejectionReason: { type: String },
  submittedAt: { type: Date, default: Date.now },
  approvedAt: { type: Date }
});

// Sponsor Validation: Check active loans only
SponsorSchema.pre('save', async function (next) {
  const sponsor = this;
  // Fetch loans to check their status
  const activeLoans = await mongoose.model('Loan').find({
    _id: { $in: sponsor.guaranteedLoans.map(loan => loan.loanId) },
    status: { $ne: 'completed' } // Only count non-completed loans
  });

  const loanCounts = activeLoans.reduce((acc, loan) => {
    const loanType = sponsor.guaranteedLoans.find(l => l.loanId.equals(loan._id)).loanType;
    acc[loanType] = (acc[loanType] || 0) + 1;
    return acc;
  }, {});

  for (const loanType in loanCounts) {
    if (loanCounts[loanType] > 2) {
      return next(new Error(`Sponsor cannot guarantee more than 2 active ${loanType} loans`));
    }
  }
  next();
});

// Update Sponsor when Loan is completed
LoanSchema.post('save', async function (doc, next) {
  if (doc.status === 'completed') {
    // Remove completed loan from sponsors' guaranteedLoans
    await mongoose.model('Sponsor').updateMany(
      { 'guaranteedLoans.loanId': doc._id },
      { $pull: { guaranteedLoans: { loanId: doc._id } } }
    );
  }
  next();
});

// Add indexes for efficient querying
LoanSchema.index({ userId: 1, submittedAt: 1 });
PaymentSchema.index({ loanId: 1, dueDate: 1 });

// Export models
module.exports = {
  User: mongoose.model('User', UserSchema),
  Sponsor: mongoose.model('Sponsor', SponsorSchema),
  Document: mongoose.model('Document', DocumentSchema),
  Payment: mongoose.model('Payment', PaymentSchema),
  Contract: mongoose.model('Contract', ContractSchema),
  Loan: mongoose.model('Loan', LoanSchema)
};