const express = require('express');
const router = express.Router();
const loanTermController = require('../controllers/loanTermController');
const {verifyTokenAndAuthorization,verifyTokenAndAdmin} = require('../middleware/auth');

router.post('/', verifyTokenAndAdmin, loanTermController.createLoanTerm);
router.get('/',verifyTokenAndAdmin,verifyTokenAndAuthorization, loanTermController.getLoanTerms);

module.exports = router;