const express = require('express');
const router = express.Router();
const loanTypeController = require('../controllers/loanTypeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', loanTypeController.getAllLoanTypes);
router.get('/:id', loanTypeController.getLoanTypeById);

module.exports = router;