const { Payment, validatePayment } = require('../models/payment');
const { Loan } = require('../models/loan');

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
    // TODO: Send warning notification
  }

  res.send(payment);
};