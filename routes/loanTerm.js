const express = require('express');
const router = express.Router();
const loanTermController = require('../controllers/loanTermController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', loanTermController.getAllLoanTerms);
router.get('/:id', loanTermController.getLoanTermById);

// Admin routes
router.post('/', authenticate, requireAdmin, loanTermController.createLoanTerm);
router.put('/:id', authenticate, requireAdmin, loanTermController.updateLoanTerm);
router.delete('/:id', authenticate, requireAdmin, loanTermController.deleteLoanTerm);

module.exports = router;