const express = require('express');
const router = express.Router();
const loanTypeController = require('../controllers/loanTypeController');
const auth = require('../middleware/auth');

router.post('/', auth, loanTypeController.createLoanType);
router.get('/', auth, loanTypeController.getLoanTypes);

module.exports = router;