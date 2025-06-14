const Loan = require('../models/loan');
const Payment = require('../models/payment');
const TypeTerm = require('../models/typeterm');

exports.createLoan = async (contract) => {
  try {
    // Get the typeTerm details to access interestRate
    const typeTerm = await TypeTerm.findById(contract.typeTermID)
      .populate('loanTypeID')
      .populate('loanTermID');
    
    if (!typeTerm) throw new Error('TypeTerm combination not found');
    
    // Calculate end date based on contract's term months
    const endDate = new Date(contract.startDate);
    endDate.setMonth(endDate.getMonth() + contract.loanTermMonths);
    
    // Create loan
    const loan = new Loan({
      contractID: contract._id,
      typeTermID: contract.typeTermID,
      userID: contract.userID,
      loanAmount: contract.loanAmount,
      loanTermMonths: contract.loanTermMonths,
      interestRate: typeTerm.interestRate,
      startDate: contract.startDate,
      endDate,
      status: 'active'
    });
    
    await loan.save();
    
    // Create payment schedule
    await createPaymentSchedule(loan, termMonths);
    
    return loan;
  } catch (error) {
    console.error('Loan creation error:', error);
    throw error; // Rethrow to handle in calling function
  }
};

const createPaymentSchedule = async (loan) => {
  const monthlyPayment = calculateMonthlyPayment(
    loan.loanAmount, 
    loan.interestRate, 
    loan.loanTermMonths
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