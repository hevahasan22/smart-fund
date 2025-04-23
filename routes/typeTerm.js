const express = require('express');
const router = express.Router();
const typeTermController = require('../controllers/typeTermController');
const auth = require('../middleware/auth');

router.post('/', auth, typeTermController.createTypeTerm);

module.exports = router;