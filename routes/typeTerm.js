const express = require('express');
const router = express.Router();
const typeTermController = require('../controllers/typeTermController');
const {requireAdmin} = require('../middleware/auth');

router.post('/', requireAdmin, typeTermController.createTypeTerm);

module.exports = router;