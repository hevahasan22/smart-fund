const express = require('express');
const router = express.Router();
const documentController = require('../controllers/additionalDocumentController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/multer');

// User routes 
router.post('/upload/:contractID', authenticate, upload.single('documentFile'), documentController.uploadDocument);
router.get('/contract/:contractID', authenticate, documentController.getDocumentsByContract);
router.get('/:id', authenticate, documentController.getDocument);
router.delete('/:id', authenticate, documentController.deleteDocument);

module.exports = router;