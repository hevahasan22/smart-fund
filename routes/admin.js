const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth'); 

// Get all users with their details
router.get('/users', authMiddleware.verifyToken, adminController.getAllUsers);

// Get specific user details including contracts and payment schedule
router.get('/users/:userId', authMiddleware.verifyAdmin, adminController.getUserDetails);

// Delete a user
router.delete('/users/:userId', authMiddleware.verifyAdmin, adminController.deleteUser);

// Review contract before approval
router.get('/contracts/:contractId/review', authMiddleware.verifyAdmin, adminController.reviewContract);

// Approve or reject contract
router.put('/contracts/:contractId/status', authMiddleware.verifyAdmin, adminController.updateContractStatus);

// Add new investor
router.post('/investors', authMiddleware.verifyAdmin, adminController.addInvestor);

// Get all investors
router.get('/investors', authMiddleware.verifyAdmin, adminController.getAllInvestors);

// Add new loan type
router.post('/loan-types', authMiddleware.verifyAdmin, adminController.addLoanType);

// Update loan type
router.put('/loan-types/:typeId', authMiddleware.verifyAdmin, adminController.updateLoanType);

// Add new loan term
router.post('/loan-terms', authMiddleware.verifyAdmin, adminController.addLoanTerm);

// Update loan term
router.put('/loan-terms/:termId', authMiddleware.verifyAdmin, adminController.updateLoanTerm);

module.exports = router;