const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');
const auth = require('../middleware/auth');

router.post('/', auth, investorController.createInvestor);

module.exports = router;