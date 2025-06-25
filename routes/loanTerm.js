const express = require('express');
const router = express.Router();
const loanTermController = require('../controllers/loanTermController');
const {authorizeUserOrAdmin,requireAdmin} = require('../middleware/auth');

router.post('/', requireAdmin, loanTermController.createLoanTerm);
router.get('/',requireAdmin,authorizeUserOrAdmin, loanTermController.getLoanTerms);

module.exports = router;