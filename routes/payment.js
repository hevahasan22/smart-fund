const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Process payment via QR confirmation
router.post('/process/:paymentId', 
    authenticate, 
    paymentController.processPayment
);

// Public QR endpoint - no auth, used by QR scan
router.get('/visit/:paymentId', paymentController.visitAndPay);

// Get payments for a loan
router.get('/loan/:loanId', 
    authenticate, 
    paymentController.getPaymentsByLoanId
);

// Get specific payment
router.get('/:id', 
    authenticate, 
    paymentController.getPaymentById
);


module.exports = router;