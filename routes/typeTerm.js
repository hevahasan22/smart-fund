const express = require('express');
const router = express.Router();
const typeTermController = require('../controllers/typeTermController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', typeTermController.getAllTypeTerms);
router.get('/:id', typeTermController.getTypeTermById); 

module.exports = router;