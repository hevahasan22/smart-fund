const express = require('express');
const router = express.Router();
const loanTypeController = require('../controllers/loanTypeController');
const {verifyTokenAndAdmin,verifyTokenAndAuthorization} = require('../middleware/auth');

router.post('/', verifyTokenAndAdmin, loanTypeController.createLoanType);
router.get('/', verifyTokenAndAdmin,verifyTokenAndAuthorization, loanTypeController.getLoanTypes);

module.exports = router;