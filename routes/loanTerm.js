const express = require('express');
const router = express.Router();
const loanTermController = require('../controllers/loanTermController');
const auth = require('../middleware/auth');

router.post('/', auth, loanTermController.createLoanTerm);
router.get('/', auth, loanTermController.getLoanTerms);

module.exports = router;