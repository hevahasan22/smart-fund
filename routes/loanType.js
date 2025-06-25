const express = require('express');
const router = express.Router();
const loanTypeController = require('../controllers/loanTypeController');
const {requireAdmin,authorizeUserOrAdmin} = require('../middleware/auth');

router.post('/', requireAdmin, loanTypeController.createLoanType);
router.get('/', requireAdmin, authorizeUserOrAdmin, loanTypeController.getLoanTypes);

module.exports = router;