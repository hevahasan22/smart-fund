const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const auth = require('../middleware/auth');

router.post('/', auth, contractController.createContract);

module.exports = router;