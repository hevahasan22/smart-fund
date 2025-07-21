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

    // Link the contract to the loan by setting loanID
    const { Contract } = require('../models/contract');
    await Contract.findByIdAndUpdate(contract._id, { loanID: loan._id });
    
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

    // 1. Find all contracts for the user that have a loanID set
    const { Contract } = require('../models/contract');
    const contracts = await Contract.find({ userID: userId, loanID: { $ne: null } })
      .populate([
        { path: 'sponsorID_1', select: 'firstName lastName' },
        { path: 'sponsorID_2', select: 'firstName lastName' },
        { path: 'userID', select: 'firstName lastName email' },
        {
          path: 'typeTermID',
          populate: [
            { path: 'loanTypeID', select: 'loanName' },
            { path: 'loanTermID', select: 'termName' }
          ]
        }
      ]);

    // 2. Get all loan IDs from these contracts
    const loanIds = contracts.map(contract => contract.loanID).filter(Boolean);

    // 3. Find all loans with those IDs
    const loans = await Loan.find({ _id: { $in: loanIds } })
      .sort({ startDate: -1 }); // Newest loans first

    // 4. Fetch all payments for these loans
    const payments = await Payment.find({ loanID: { $in: loanIds } });

    // 5. Group payments by loanID
    const paymentsByLoan = payments.reduce((acc, payment) => {
      const key = payment.loanID.toString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(payment);
      return acc;
    }, {});

    // 6. Join contract data and payments to each loan, and add summary fields
    const loansWithContracts = loans.map(loan => {
      const contract = contracts.find(c => c.loanID && c.loanID.equals(loan._id));
      const payments = paymentsByLoan[loan._id.toString()] || [];
      const totalAmount = loan.loanAmount;
      const paidAmount = payments.reduce((sum, payment) => payment.status === 'paid' ? sum + payment.amount : sum, 0);
      const remainingAmount = totalAmount - paidAmount;
      const loanObj = loan.toObject();
      // Replace typeTermID with the name if available
      if (contract && contract.typeTermID && contract.typeTermID.name) {
        loanObj.typeTermID = contract.typeTermID.name;
      } else {
        delete loanObj.typeTermID;
      }
      return {
        ...loanObj,
        contract: contract ? contract.toObject() : null,
        payments,
        totalAmount,
        paidAmount,
        remainingAmount
      };
    });

    res.json(loansWithContracts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get loan by ID
exports.getLoanById = async (req, res) => {
  try {
    const loanId = req.params.id;

    // Find the loan by ID
    const loan = await Loan.findById(loanId);

    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    // Fetch payments for this loan
    const payments = await Payment.find({ loanID: loan._id }).sort({ dueDate: 1 });

    // Find the contract that references this loan
    const { Contract } = require('../models/contract');
    const contract = await Contract.findOne({ loanID: loan._id })
      .populate([
        { path: 'sponsorID_1', select: 'firstName lastName' },
        { path: 'sponsorID_2', select: 'firstName lastName' },
        { path: 'userID', select: 'firstName lastName email' },
        {
          path: 'typeTermID',
          populate: [
            { path: 'loanTypeID', select: 'loanName minAmount maxAmount' },
            { path: 'loanTermID', select: 'termName minTerm maxTerm' }
          ]
        }
      ]);
    // Do not return error if contract is not found; just continue

    // Ensure loan status is 'completed' if all payments are paid
    const allPaid = payments.length > 0 && payments.every(payment => payment.status === 'paid');
    if (allPaid && loan.status !== 'completed') {
      loan.status = 'completed';
      await loan.save();
    }

    // Calculate loan summary
    const totalAmount = loan.loanAmount;
    const paidAmount = payments.reduce((sum, payment) => 
      payment.status === 'paid' ? sum + payment.amount : sum, 0);
    const remainingAmount = totalAmount - paidAmount;
    
    // Add calculated fields and contract to response
    const loanWithSummary = {
      ...loan.toObject(),
      totalAmount,
      paidAmount,
      remainingAmount,
      contract: contract ? contract.toObject() : null,
      payments
    };

    // Replace typeTermID with the name if available
    if (contract && contract.typeTermID && contract.typeTermID.name) {
      loanWithSummary.typeTermID = contract.typeTermID.name;
    } else {
      delete loanWithSummary.typeTermID;
    }

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

// Get the active loan for the logged-in user
exports.getActiveLoanForUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find contracts for the user with a loanID set
    const { Contract } = require('../models/contract');
    const contracts = await Contract.find({ userID: userId, loanID: { $ne: null } });

    // Get all loan IDs from these contracts
    const loanIds = contracts.map(contract => contract.loanID).filter(Boolean);

    // Find the active loan (assuming only one active at a time)
    const loan = await Loan.findOne({ _id: { $in: loanIds }, status: 'active' });
    if (!loan) return res.json(null);

    // Fetch payments for this loan
    const payments = await Payment.find({ loanID: loan._id }).sort({ dueDate: 1 });

    // Calculate summary
    const totalAmount = loan.loanAmount;
    const paidAmount = payments.reduce((sum, payment) => payment.status === 'paid' ? sum + payment.amount : sum, 0);
    const remainingAmount = totalAmount - paidAmount;

    // Remove _id and __v from loan
    const { _id, __v, ...loanWithoutIds } = loan.toObject();
    // Remove _id and __v from each payment
    const paymentsClean = payments.map(({ _id, __v, ...rest }) => rest);

    res.json({
      loan: loanWithoutIds,
      totalAmount,
      paidAmount,
      remainingAmount,
      paymentSchedule: paymentsClean
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createLoan,
  getUserLoans: exports.getUserLoans,
  getLoanById: exports.getLoanById,
  getActiveLoanForUser: exports.getActiveLoanForUser
};