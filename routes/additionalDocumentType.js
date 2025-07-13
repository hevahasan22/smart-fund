const express = require('express');
const router = express.Router();
const documentTypeController = require('../controllers/additionalDocumentTypeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/create-type', authenticate, requireAdmin, documentTypeController.createDocumentType);
router.put('/:id', authenticate, requireAdmin, documentTypeController.updateDocumentType);
router.delete('/:id', authenticate, requireAdmin, documentTypeController.deleteDocumentType);

// Public routes
router.get('/type-term/:typeTermID', authenticate, documentTypeController.getDocumentTypesByTypeTerm);

module.exports = router;