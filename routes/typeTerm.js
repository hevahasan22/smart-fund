const express = require('express');
const router = express.Router();
const typeTermController = require('../controllers/typeTermController');
const {verifyTokenAndAdmin} = require('../middleware/auth');

router.post('/', verifyTokenAndAdmin, typeTermController.createTypeTerm);

module.exports = router;