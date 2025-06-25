const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');
const {requireAdmin} = require('../middleware/auth');

router.post('/', requireAdmin, investorController.createInvestor);

module.exports = router;