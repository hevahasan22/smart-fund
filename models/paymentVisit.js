const mongoose = require('mongoose');

const paymentVisitSchema = new mongoose.Schema(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan', // We'll still log by paymentId value; not populating
      required: true
    },
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

const PaymentVisit = mongoose.model('PaymentVisit', paymentVisitSchema);

module.exports = { PaymentVisit };


