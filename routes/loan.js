const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { authenticate, authorizeLoanAccess, requireAdmin } = require('../middleware/auth');

// Route for user loans
router.get('/user-loans',
    authenticate,
    loanController.getUserLoans
);

// Loan by ID route
router.get('/:id',
    authenticate,
    authorizeLoanAccess, 
    loanController.getLoanById
);
/*
// Admin routes
router.get('/admin/all',
    authenticate, 
    requireAdmin, 
    loanController.getAllLoans
);

router.get('/admin/user/:userId', 
    authenticate, 
    requireAdmin, 
    loanController.getUserLoansAdmin
);
*/
 module.exports = router;