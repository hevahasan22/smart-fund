const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Process payment via QR confirmation
router.post('/process/:paymentId', 
    authenticate, 
    paymentController.processPayment
);

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

/*
// Admin routes
router.get('/admin/all', 
    authenticate, 
    requireAdmin, 
    paymentController.getAllPayments
);

router.get('/admin/loan/:loanId', 
    authenticate, 
    requireAdmin, 
    paymentController.getPaymentsByLoanIdAdmin
);

router.get('/admin/user/:userId', 
    authenticate, 
    requireAdmin, 
    paymentController.getUserPaymentsAdmin
);
*/


module.exports = router;