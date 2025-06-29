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
router.post('/loan-types', authenticate, requireAdmin, adminController.addLoanType);
router.put('/loan-types/:typeId', authenticate, requireAdmin, adminController.updateLoanType);
router.post('/loan-terms', authenticate, requireAdmin, adminController.addLoanTerm);
router.put('/loan-terms/:termId', authenticate, requireAdmin, adminController.updateLoanTerm);

module.exports = router;