const express = require('express');
const router = express.Router();
const documentTypeController = require('../controllers/additionalDocumentTypeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Document type management routes
router.post('/create-type', authenticate, requireAdmin, documentTypeController.createDocumentType);
router.get('/all', authenticate, documentTypeController.getAllDocumentTypes);
router.get('/:id', authenticate, documentTypeController.getDocumentTypeById);
router.put('/:id', authenticate, requireAdmin, documentTypeController.updateDocumentType);
router.delete('/:id', authenticate, requireAdmin, documentTypeController.deleteDocumentType);

module.exports = router;