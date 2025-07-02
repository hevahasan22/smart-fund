const express = require('express');
const router = express.Router();
const typeTermController = require('../controllers/typeTermController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.get('/', typeTermController.getAllTypeTerms);
router.get('/:id', typeTermController.getTypeTermById); // New route

// Admin routes
router.post('/', authenticate, requireAdmin, typeTermController.createTypeTerm);
router.put('/:id', authenticate, requireAdmin, typeTermController.updateTypeTerm);
router.delete('/:id', authenticate, requireAdmin, typeTermController.deleteTypeTerm);

module.exports = router;