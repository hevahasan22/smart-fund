const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');
const {verifyTokenAndAdmin} = require('../middleware/auth');

router.post('/', verifyTokenAndAdmin, investorController.createInvestor);

module.exports = router;