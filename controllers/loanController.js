const {Loan,Payment,typetermModel,Contract} = require('../models/index');

const createLoan = async (contract) => {
  try {
    // Get the typeTerm details to access interestRate
    const typeTerm = await typetermModel.findById(contract.typeTermID)
      .populate('loanTypeID')
      .populate('loanTermID');
    
    if (!typeTerm) throw new Error('TypeTerm combination not found');
    
    // Calculate end date based on contract's term months
    const endDate = new Date(contract.tempStartDate);
    endDate.setMonth(endDate.getMonth() + contract.tempLoanTermMonths);
    
    // Create loan
    const loan = new Loan({
      typeTermID: contract.typeTermID,
      loanAmount: contract.tempLoanAmount,
      loanTermMonths: contract.tempLoanTermMonths,
      startDate: contract.tempStartDate,
      endDate,
      status: 'active',
      interestRate: typeTerm.interestRate
    });
    
    await loan.save();
    
    // Defensive check before creating payment schedule
    console.log('Creating payment schedule:', {
      loanAmount: loan.loanAmount,
      interestRate: loan.interestRate,
      termMonths: loan.loanTermMonths
    });
    if (
      typeof loan.loanAmount !== 'number' ||
      typeof loan.interestRate !== 'number' ||
      typeof loan.loanTermMonths !== 'number' ||
      isNaN(loan.loanAmount) ||
      isNaN(loan.interestRate) ||
      isNaN(loan.loanTermMonths)
    ) {
      throw new Error('Invalid input for payment calculation');
    }
    // Create payment schedule
    await createPaymentSchedule(loan, loan.loanTermMonths);
    
    return loan;
  } catch (error) {
    console.error('Loan creation error:', error);
    throw error; // Rethrow to handle in calling function
  }
};

// Get user loans
exports.getUserLoans = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const loans = await Loan.find({ userID: userId })
      .populate({
        path: 'contractID',
        populate: [
          { path: 'sponsorID_1', select: 'firstName lastName' },
          { path: 'sponsorID_2', select: 'firstName lastName' },
          { 
            path: 'typeTermID',
            populate: [
              { path: 'loanTypeID', select: 'loanName' },
              { path: 'loanTermID', select: 'termName' }
            ]
          }
        ]
      })
      .populate('payments') // Assuming you have payments referenced in Loan model
      .sort({ startDate: -1 }); // Newest loans first

    res.json(loans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get loan by ID
exports.getLoanById = async (req, res) => {
  try {
    const loanId = req.params.id;
    
    const loan = await Loan.findById(loanId)
      .populate({
        path: 'contractID',
        populate: [
          { path: 'sponsorID_1', select: 'firstName lastName' },
          { path: 'sponsorID_2', select: 'firstName lastName' },
          { 
            path: 'typeTermID',
            populate: [
              { path: 'loanTypeID', select: 'loanName minAmount maxAmount' },
              { path: 'loanTermID', select: 'termName minTerm maxTerm' }
            ]
          }
        ]
      })
      .populate({
        path: 'payments',
        options: { sort: { dueDate: 1 } } // Sort payments by due date
      })
      .populate('userID', 'firstName lastName email'); // Include borrower info

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Ensure loan status is 'completed' if all payments are paid
    const allPaid = loan.payments.length > 0 && loan.payments.every(payment => payment.status === 'paid');
    if (allPaid && loan.status !== 'completed') {
      loan.status = 'completed';
      await loan.save();
    }

    // Calculate loan summary
    const totalAmount = loan.loanAmount;
    const paidAmount = loan.payments.reduce((sum, payment) => 
      payment.status === 'paid' ? sum + payment.amount : sum, 0);
    const remainingAmount = totalAmount - paidAmount;
    
    // Add calculated fields to response
    const loanWithSummary = {
      ...loan.toObject(),
      totalAmount,
      paidAmount,
      remainingAmount
    };

    res.json(loanWithSummary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createPaymentSchedule = async (loan, termMonths) => {
  const monthlyPayment = calculateMonthlyPayment(
    loan.loanAmount, 
    loan.interestRate, 
    termMonths
  );
  
  const payments = [];
  const paymentDate = new Date(loan.startDate);
  
  for (let i = 0; i < termMonths; i++) {
    paymentDate.setMonth(paymentDate.getMonth() + 1);
    
    payments.push({
      loanID: loan._id,
      dueDate: new Date(paymentDate),
      amount: monthlyPayment,
      status: 'pending'
    });
  }
  
  await Payment.insertMany(payments);
};

// Payment calculation
const calculateMonthlyPayment = (principal, annualRate, termMonths) => {
  const monthlyRate = annualRate / 100 / 12;
  return principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
    (Math.pow(1 + monthlyRate, termMonths) - 1);
};

module.exports = {
  createLoan,
  getUserLoans: exports.getUserLoans,
  getLoanById: exports.getLoanById
};