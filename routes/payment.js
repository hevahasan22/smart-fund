const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const {verifyTokenAndAuthorization} = require('../middleware/auth');

router.post('/', verifyTokenAndAuthorization, paymentController.createPayment);

module.exports = router;