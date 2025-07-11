const express = require('express');
const router = express.Router();
const documentController = require('../controllers/additionalDocumentController');
const { authenticate, requireAdmin, authorizeDocumentAccess } = require('../middleware/auth');

// User routes 
router.post('/upload', authenticate, documentController.handleUpload, documentController.uploadDocument);
router.get('/contract/:contractID', authenticate, documentController.getDocumentsByContract);
router.get('/:id', authenticate, authorizeDocumentAccess, documentController.getDocument);
router.delete('/:id', authenticate, authorizeDocumentAccess, documentController.deleteDocument);

// Admin routes
router.put('/review/:id', authenticate, requireAdmin, documentController.reviewDocument);

module.exports = router;