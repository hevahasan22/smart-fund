const express = require('express');
const router = express.Router();
const relationController = require('../controllers/documentTypeTermRelationController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes (authenticated users can view)
router.get('/', authenticate, relationController.getAllRelations);
router.get('/document-type/:documentTypeID', authenticate, relationController.getRelationsByDocumentType);
router.get('/type-term/:typeTermID', authenticate, relationController.getRelationsByTypeTerm);
router.get('/:id', authenticate, relationController.getRelationById);

// Admin-only routes
router.post('/create-relation', authenticate, requireAdmin, relationController.createRelation);
router.put('/:id', authenticate, requireAdmin, relationController.updateRelation);
router.delete('/:id', authenticate, requireAdmin, relationController.deleteRelation);

module.exports = router; 