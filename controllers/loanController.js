const Loan = require('../models/loan');
const Payment = require('../models/payment');
const LoanType = require('../models/loanType');

exports.createLoan = async (contract) => {
  try {
    const loanType = await LoanType.findById(contract.loanType);
    if (!loanType) throw new Error('Loan type not found');
    
    // Calculate loan details
    const termMonths = contract.loanTerm === 'short-term' ? 12 : 36;
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + termMonths);
    
    // Create loan
    const loan = new Loan({
      contractID: contract._id,
      loanAmount: contract.loanAmount,
      interestRate: loanType.interestRate,
      startDate: new Date(),
      endDate,
      status: 'active'
    });
    
    await loan.save();
    
    // Create payment schedule
    await createPaymentSchedule(loan, termMonths);
    
    return loan;
  } catch (error) {
    console.error('Loan creation error:', error);
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