const express = require('express');
const router = express.Router();
const loanTermController = require('../controllers/loanTermController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', loanTermController.getAllLoanTerms);
router.get('/:id', loanTermController.getLoanTermById);

module.exports = router;