const Payment = require('../models/payment');
const Loan = require('../models/loan');
const notificationService = require('../services/notificationService');

exports.createPayment = async (req, res) => {
  const { error } = validatePayment(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const payment = new Payment(req.body);
  await payment.save();

  // Check if all payments for the loan are completed
  const payments = await Payment.find({ loanID: req.body.loanID });
  const allCompleted = payments.every(p => p.status === 'completed');
  if (allCompleted) {
    await Loan.findOneAndUpdate({ loanID: req.body.loanID }, { status: 'completed' });
    // TODO: Send check to user
  }

  // Check for overdue payments
  if (new Date() > payment.dueDate && payment.status !== 'completed') {
    try {
      // Get loan with populated user data
      const loan = await Loan.findOne({ loanID: payment.loanID }).populate('user', 'email firstName');
      
      if (loan && loan.user) {
        // Send payment reminder email
        await notificationService.sendPaymentReminder(payment, loan.user);
      }
    } catch (err) {
      console.error('Failed to send payment reminder:', err);
    }
  }

  res.send(payment);
};