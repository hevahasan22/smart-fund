const express = require('express');
     const router = express.Router();
     const contractController = require('../controllers/contractController');
     const { authenticate, requireAdmin, authorizeUserOrAdmin } = require('../middleware/auth');

     // Apply for new loan contract
     router.post(
       '/apply',
       authenticate,
       contractController.createContract
     );

     // Sponsor approves a contract
     router.post(
       '/:contractId/approve',
       authenticate,
       contractController.approveContractAsSponsor
     );

     // Sponsor rejects a contract
     router.post(
       '/:contractId/reject',
       authenticate,
       contractController.rejectContractAsSponsor
     );

     router.get(
       '/pending-approvals',
       authenticate,
       contractController.getPendingApprovals
     );

     // Admin endpoint to trigger contract processing
     router.post(
       '/trigger-processing',
       authenticate,
       requireAdmin,
       contractController.triggerContractProcessing
     );

     // Diagnostic endpoint to test connections
     router.get(
       '/test-connections',
       contractController.testConnections
     );

     // Get required documents for a loan type
     router.get(
       '/required-documents/:loanTypeId',
       contractController.getRequiredDocuments
     );

    // Get user contracts that are still not approved
    router.get(
      '/pending-contracts',
      authenticate,
      contractController.getUserPendingContracts
    );

    // Edit contract (only if not approved yet)
    router.put(
      '/:contractId',
      authenticate,
      contractController.editContract
    );

    // Delete contract (only if not approved yet)
    router.delete(
      '/:contractId',
      authenticate,
      contractController.deleteContract
    );

   /*

   */

    module.exports = router;