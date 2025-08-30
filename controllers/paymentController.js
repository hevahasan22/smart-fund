const {Payment,Loan,User,Contract,PaymentVisit} = require('../models/index');
const cron = require('node-cron');
const moment = require('moment');
const notificationService = require('../services/notificationService');

// Initialize payment reminder scheduler
exports.initScheduler = () => {
  // Schedule daily check for upcoming payments (runs at 9 AM daily)
  cron.schedule('0 9 * * *', () => {
    checkUpcomingPayments();
    checkLatePayments();
  });
  console.log('Payment reminder scheduler initialized');
};

// Check for payments due in 3 days
const checkUpcomingPayments = async () => {
  try {
    const threeDaysFromNow = moment().add(3, 'days').startOf('day').toDate();
    const payments = await Payment.find({
      dueDate: threeDaysFromNow,
      status: 'pending'
    }).populate({
      path: 'loanID',
      populate: { path: 'userID' }
    });

    for (const payment of payments) {
      const user = payment.loanID.userID;
      
      // STEP 6: Send 3-day payment reminder
      await notificationService.sendPaymentReminderNotification(
        user._id, 
        payment.loanID._id, 
        payment.amount, 
        payment.dueDate.toDateString()
      );
    }
  } catch (error) {
    console.error('Payment reminder error:', error);
  }
};

// Check for late payments
const checkLatePayments = async () => {
  try {
    const yesterday = moment().subtract(1, 'days').endOf('day').toDate();
    const payments = await Payment.find({
      dueDate: { $lte: yesterday },
      status: 'pending'
    });

    for (const payment of payments) {
      payment.status = 'late';
      await payment.save();
      
      // Notify borrower about late payment
      const loan = await Loan.findById(payment.loanID).populate('userID');
      const penalty = Math.round(payment.amount * 0.05); // 5% late fee
      
      // STEP 6: Send late payment notification
      await notificationService.sendLatePaymentNotification(
        loan.userID._id, 
        payment.loanID._id, 
        payment.amount, 
        penalty
      );
    }
  } catch (error) {
    console.error('Late payment check error:', error);
  }
};

// Process payment via QR confirmation
exports.processPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    // Validate input
    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    // Fetch the user making the payment
    const user = await User.findById(userId);

    // Get payment and related loan
    const payment = await Payment.findById(paymentId).populate('loanID');
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Prevent double payment
    if (payment.status === 'paid') {
      return res.status(400).json({ error: 'This payment has already been paid.' });
    }
    // Optionally, prevent paying non-pending payments
    if (payment.status !== 'pending') {
      return res.status(400).json({ error: 'This payment cannot be paid in its current status.' });
    }

    const loan = payment.loanID;

    // Find contract by loanID
    const contract = await Contract.findOne({ loanID: loan._id });
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found for this loan' });
    }
    const borrowerId = contract.userID;

    // Verify authorization - borrower or sponsors can pay
    const isBorrower = borrowerId.equals(userId);
    const isSponsor1 = contract?.sponsorID_1.equals(userId);
    const isSponsor2 = contract?.sponsorID_2.equals(userId);

    if (!(isBorrower || isSponsor1 || isSponsor2)) {
      return res.status(403).json({ error: 'Unauthorized to make this payment' });
    }

    // All checks passed, now mark as paid
    payment.status = 'paid';
    payment.paidAt = new Date();
    await payment.save();

    // Check if loan is fully paid
    const remainingPayments = await Payment.countDocuments({
      loanID: loan._id,
      status: { $in: ['pending', 'late'] }
    });

    if (remainingPayments === 0) {
      loan.status = 'completed';
      await loan.save();
      
      // STEP 7: Notify all parties about loan completion
      await Promise.all([
        notificationService.sendLoanCompletionNotification(borrowerId, loan._id),
        notificationService.sendSponsorCompletionNotification(contract.sponsorID_1, borrowerId, loan._id),
        notificationService.sendSponsorCompletionNotification(contract.sponsorID_2, borrowerId, loan._id),
        notificationService.sendAdminCompletionNotification(loan._id, borrowerId)
      ]);
    } else {
      // STEP 6: Send payment confirmation
      const nextPayment = await Payment.findOne({
        loanID: loan._id,
        status: 'pending'
      }).sort({ dueDate: 1 });
      
      if (nextPayment) {
        await notificationService.sendPaymentConfirmationNotification(
          borrowerId, 
          loan._id, 
          payment.amount, 
          nextPayment.dueDate.toDateString()
        );
      }
    }

    // Create receipt
    const receipt = {
      paymentId: payment._id,
      loanId: loan._id,
      amount: payment.amount,
      paidAt: payment.paidAt,
      paidBy: user.userFirstName + ' ' + user.userLastName, // Use correct field names
      loanStatus: loan.status
    };

    // Notify all parties about payment
    await notifyPayment(payment, loan, userId);

    res.json(receipt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Public QR visit endpoint: logs visit, marks payment paid, returns HTML
exports.visitAndPay = async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(400).send('Invalid payment link');
    }

    // Log visit
    await PaymentVisit.create({
      paymentId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    const payment = await Payment.findById(paymentId).populate('loanID');
    if (!payment) {
      return res.status(404).send('Payment not found');
    }

    if (payment.status === 'paid') {
      return res.send('<html><body><h2>Payment already processed</h2></body></html>');
    }

    // Mark as paid
    payment.status = 'paid';
    payment.payedDate = new Date();
    await payment.save();

    // If all paid, mark loan completed
    const remaining = await Payment.countDocuments({
      loanID: payment.loanID,
      status: { $in: ['pending', 'late'] }
    });
    if (remaining === 0) {
      const loan = await Loan.findById(payment.loanID);
      if (loan) {
        loan.status = 'completed';
        await loan.save();
      }
    }

    return res.redirect('http://localhost:3000/payment-success/${paymentId}');
  } catch (error) {
    console.error('QR visit error:', error);
    return res.status(500).send('An error occurred processing the payment');
  }
};

// Notify all parties about payment
const notifyPayment = async (payment, loan, payerId) => {
  try {
    const payer = await User.findById(payerId);
    const contract = await Contract.findById(loan.contractID)
      .populate('sponsorID_1')
      .populate('sponsorID_2')
      .populate('userID');

    if (!contract) return;

    const parties = [
      contract.userID, // Borrower
      contract.sponsorID_1,
      contract.sponsorID_2
    ].filter(user => user); // Remove nulls

    const payerName = payer.firstName + ' ' + payer.lastName;
    const message = `Payment of $${Math.round(payment.amount)} for loan ${loan._id} was made by ${payerName}`;

    await Promise.all(parties.map(user => 
      User.findByIdAndUpdate(user._id, {
        $push: {
          notifications: {
            type: 'payment_made',
            message,
            paymentId: payment._id,
            loanId: loan._id,
            amount: payment.amount,
            createdAt: new Date()
          }
        }
      })
    ));
  } catch (error) {
    console.error('Payment notification error:', error);
  }
};

// Get all payments for a loan
exports.getPaymentsByLoanId = async (req, res) => {
  try {
    const loanId = req.params.loanId;
    const userId = req.user.id;

    // Verify loan ownership/authorization
    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({ error: 'Loan not found' });
    }

    const contract = await Contract.findById(loan.contractID);
    const isBorrower = loan.userID.equals(userId);
    const isSponsor1 = contract?.sponsorID_1.equals(userId);
    const isSponsor2 = contract?.sponsorID_2.equals(userId);

    if (!(isBorrower || isSponsor1 || isSponsor2)) {
      return res.status(403).json({ error: 'Unauthorized to view these payments' });
    }

   
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
  try {
    const paymentId = req.params.id;
    const userId = req.user.id;

    const payment = await Payment.findById(paymentId).populate('loanID');
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify authorization
    const loan = await Loan.findById(payment.loanID);
    const contract = await Contract.findById(loan.contractID);
    const isBorrower = loan.userID.equals(userId);
    const isSponsor1 = contract?.sponsorID_1.equals(userId);
    const isSponsor2 = contract?.sponsorID_2.equals(userId);

    if (!(isBorrower || isSponsor1 || isSponsor2)) {
      return res.status(403).json({ error: 'Unauthorized to view this payment' });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};