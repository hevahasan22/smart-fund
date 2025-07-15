const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// User Management
router.get('/users', authenticate, requireAdmin, adminController.getAllUsers);
router.get('/users/:userId', authenticate, requireAdmin, adminController.getUserDetails);
router.delete('/users/:userId', authenticate, requireAdmin, adminController.deleteUser);
router.put('/users/:userId/reactivate', authenticate, requireAdmin, adminController.reactivateUser);

// Contract Management
router.get('/contracts/:contractId/review', authenticate, requireAdmin, adminController.reviewContract);
router.put('/contracts/:contractId/status', authenticate, requireAdmin, adminController.updateContractStatus);

// Investor Management
router.post('/investors', authenticate, requireAdmin, adminController.addInvestor);
router.get('/investors', authenticate, requireAdmin, adminController.getAllInvestors);

// Loan Configuration
router.post('/loan-types', authenticate, requireAdmin, adminController.createLoanType);
router.put('/loan-types/:typeId', authenticate, requireAdmin, adminController.updateLoanType);
router.delete('/loan-types/:typeId', authenticate, requireAdmin, adminController.deleteLoanType);
router.post('/loan-terms', authenticate, requireAdmin, adminController.createLoanTerm);
router.put('/loan-terms/:termId', authenticate, requireAdmin, adminController.updateLoanTerm);
router.delete('/loan-terms/:termId', authenticate, requireAdmin, adminController.deleteLoanTerm);
router.post('/type-terms', authenticate, requireAdmin, adminController.createTypeTerm);
router.put('/type-terms/:typetermId', authenticate, requireAdmin, adminController.updateTypeTerm);
router.delete('/type-terms/:typetermId', authenticate, requireAdmin, adminController.deleteTypeTerm);

// Document Management
router.put('/documents/:id/review', authenticate, requireAdmin, adminController.reviewDocument);
router.get('/documents/pending', authenticate, requireAdmin, adminController.getPendingDocuments);
router.get('/documents/stats', authenticate, requireAdmin, adminController.getDocumentStats);
router.get('/documents', authenticate, requireAdmin, adminController.getAllDocuments);
// Document Type Management
router.get('/document-types', authenticate, requireAdmin, adminController.getDocumentTypes);
router.post('/document-types', authenticate, requireAdmin, adminController.createDocumentType);
router.put('/document-types/:id', authenticate, requireAdmin, adminController.updateDocumentType);
router.delete('/document-types/:id', authenticate, requireAdmin, adminController.deleteDocumentType);

module.exports = router;
