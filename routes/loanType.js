const express = require('express');
const router = express.Router();
const loanTypeController = require('../controllers/loanTypeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', loanTypeController.getAllLoanTypes);
router.get('/:id', loanTypeController.getLoanTypeById);

// Admin routes
router.post('/create', authenticate, requireAdmin, loanTypeController.createLoanType);
router.put('/:id', authenticate, requireAdmin, loanTypeController.updateLoanType);
router.delete('/:id', authenticate, requireAdmin, loanTypeController.deleteLoanType);

module.exports = router;