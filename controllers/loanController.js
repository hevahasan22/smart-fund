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

    // 1. Find all contracts where user is either borrower or sponsor
    const { Contract } = require('../models/contract');
    const contracts = await Contract.find({
      $or: [
        { userID: userId, loanID: { $ne: null } }, // User as borrower
        { sponsorID_1: userId, loanID: { $ne: null } }, // User as sponsor 1
        { sponsorID_2: userId, loanID: { $ne: null } }  // User as sponsor 2
      ]
    })
    .populate([
      { path: 'userID', select: 'userFirstName userLastName' },
      { path: 'sponsorID_1', select: 'userFirstName userLastName' },
      { path: 'sponsorID_2', select: 'userFirstName userLastName' },
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

    // 3. Find all loans with those IDs, but only select startDate and _id
    const loans = await Loan.find({ _id: { $in: loanIds } })
      .select('startDate _id')
      .sort({ startDate: -1 }); // Newest loans first

    // 4. Create simplified response with start date, loan type name, loan ID, and user role
    const simplifiedLoans = loans.map(loan => {
      const contract = contracts.find(c => c.loanID && c.loanID.equals(loan._id));
      const loanTypeName = contract?.typeTermID?.loanTypeID?.loanName || 'Unknown';
      
      // Determine user's role in this loan
      let userRole = 'unknown';
      let borrowerName = '';
      let sponsorNames = [];
      
      if (contract) {
        if (contract.userID && contract.userID._id.equals(userId)) {
          userRole = 'borrower';
          borrowerName = `${contract.userID.userFirstName} ${contract.userID.userLastName}`;
          // Get sponsor names
          if (contract.sponsorID_1) {
            sponsorNames.push(`${contract.sponsorID_1.userFirstName} ${contract.sponsorID_1.userLastName}`);
          }
          if (contract.sponsorID_2) {
            sponsorNames.push(`${contract.sponsorID_2.userFirstName} ${contract.sponsorID_2.userLastName}`);
          }
        } else if (contract.sponsorID_1 && contract.sponsorID_1._id.equals(userId)) {
          userRole = 'sponsor';
          borrowerName = `${contract.userID.userFirstName} ${contract.userID.userLastName}`;
          // Get other sponsor name
          if (contract.sponsorID_2) {
            sponsorNames.push(`${contract.sponsorID_2.userFirstName} ${contract.sponsorID_2.userLastName}`);
          }
        } else if (contract.sponsorID_2 && contract.sponsorID_2._id.equals(userId)) {
          userRole = 'sponsor';
          borrowerName = `${contract.userID.userFirstName} ${contract.userID.userLastName}`;
          // Get other sponsor name
          if (contract.sponsorID_1) {
            sponsorNames.push(`${contract.sponsorID_1.userFirstName} ${contract.sponsorID_1.userLastName}`);
          }
        }
      }
      
      return {
        loanId: loan._id,
        startDate: loan.startDate,
        loanTypeName: loanTypeName,
        userRole: userRole,
        borrowerName: borrowerName,
        sponsorNames: sponsorNames
      };
    });

    res.json(simplifiedLoans);
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
        { path: 'sponsorID_1', select: 'userFirstName userLastName email' },
        { path: 'sponsorID_2', select: 'userFirstName userLastName email' },
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
    const paidAmount = Math.round(payments.reduce((sum, payment) => 
      payment.status === 'paid' ? sum + payment.amount : sum, 0));
    const remainingAmount = Math.round(totalAmount - paidAmount);
    
    // Prepare sponsor info
    let sponsors = [];
    if (contract) {
      if (contract.sponsorID_1) {
        sponsors.push({
          id: contract.sponsorID_1._id,
          name: `${contract.sponsorID_1.userFirstName} ${contract.sponsorID_1.userLastName}`,
          email: contract.sponsorID_1.email
        });
      }
      if (contract.sponsorID_2) {
        sponsors.push({
          id: contract.sponsorID_2._id,
          name: `${contract.sponsorID_2.userFirstName} ${contract.sponsorID_2.userLastName}`,
          email: contract.sponsorID_2.email
        });
      }
    }
    
    
    const loanWithSummary = {
      _id: loan._id, 
      loan: {
        loanAmount: loan.loanAmount,
        loanTermMonths: loan.loanTermMonths,
        startDate: loan.startDate,
        endDate: loan.endDate,
        interestRate: loan.interestRate,
        typeTermID: loan.typeTermID,
        status: loan.status,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt
      },
      totalAmount,
      paidAmount,
      remainingAmount,
      payments,
      sponsors
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
  const payment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(payment); // Round to nearest integer
};

// Get the latest loan for the logged-in user
exports.getLatestLoanForUser = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find contracts for the user with a loanID set
    const { Contract } = require('../models/contract');
    const contracts = await Contract.find({ userID: userId, loanID: { $ne: null } });

    // Get all loan IDs from these contracts
    const loanIds = contracts.map(contract => contract.loanID).filter(Boolean);

    // Find the latest loan by start date (most recent)
    const loan = await Loan.findOne({ _id: { $in: loanIds } })
      .sort({ startDate: -1 }); // Sort by start date descending to get the latest
    if (!loan) return res.json(null);

    // Fetch the contract for this latest loan, and populate sponsors
    const contract = await Contract.findOne({ loanID: loan._id })
      .populate([
        { path: 'sponsorID_1', select: 'userFirstName userLastName email' },
        { path: 'sponsorID_2', select: 'userFirstName userLastName email' }
      ]);

    // Fetch payments for this loan
    const payments = await Payment.find({ loanID: loan._id }).sort({ dueDate: 1 });

    // Calculate summary
    const totalAmount = loan.loanAmount;
    const paidAmount = Math.round(payments.reduce((sum, payment) => payment.status === 'paid' ? sum + payment.amount : sum, 0));
    const remainingAmount = Math.round(totalAmount - paidAmount);

    // Remove _id and __v from loan
    const { _id, __v, ...loanWithoutIds } = loan.toObject();

    // Prepare sponsor info
    let sponsors = [];
    if (contract) {
      if (contract.sponsorID_1) {
        sponsors.push({
          id: contract.sponsorID_1._id,
          name: `${contract.sponsorID_1.userFirstName} ${contract.sponsorID_1.userLastName}`,
          email: contract.sponsorID_1.email
        });
      }
      if (contract.sponsorID_2) {
        sponsors.push({
          id: contract.sponsorID_2._id,
          name: `${contract.sponsorID_2.userFirstName} ${contract.sponsorID_2.userLastName}`,
          email: contract.sponsorID_2.email
        });
      }
    }

    res.json({
      loan: loanWithoutIds,
      totalAmount,
      paidAmount,
      remainingAmount,
      payments,
      sponsors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createLoan,
  getUserLoans: exports.getUserLoans,
  getLoanById: exports.getLoanById,
  getLatestLoanForUser: exports.getLatestLoanForUser
};