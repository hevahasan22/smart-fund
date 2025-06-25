const express = require('express');
     const router = express.Router();
     const adminController = require('../controllers/adminController');
     const { verifyTokenAndAdmin} = require('../middleware/auth'); // Destructure correct middleware

    
     // Get all users with their details
     router.get('/users', verifyTokenAndAdmin, adminController.getAllUsers);

     // Get specific user details including contracts and payment schedule
     router.get('/users/:userId', verifyTokenAndAdmin, adminController.getUserDetails);

     // Delete a user
     router.delete('/users/:userId', verifyTokenAndAdmin, adminController.deleteUser);

     // Review contract before approval
     router.get('/contracts/:contractId/review', verifyTokenAndAdmin, adminController.reviewContract);

     // Approve or reject contract
     router.put('/contracts/:contractId/status', verifyTokenAndAdmin, adminController.updateContractStatus);

     // Add new investor
     router.post('/investors', verifyTokenAndAdmin, adminController.addInvestor);

     // Get all investors
     router.get('/investors', verifyTokenAndAdmin, adminController.getAllInvestors);

     // Add new loan type
     router.post('/loan-types', verifyTokenAndAdmin, adminController.addLoanType);

     // Update loan type
     router.put('/loan-types/:typeId', verifyTokenAndAdmin, adminController.updateLoanType);

     // Add new loan term
     router.post('/loan-terms', verifyTokenAndAdmin, adminController.addLoanTerm);

     // Update loan term
     router.put('/loan-terms/:termId', verifyTokenAndAdmin, adminController.updateLoanTerm);

     module.exports = router;