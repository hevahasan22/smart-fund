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

     // Get user contracts
     router.get(
       '/my-contracts',
       authenticate,
       contractController.getUserContracts
     );

     // Get sponsor contracts
     router.get(
       '/sponsor-contracts',
       authenticate,
       contractController.getSponsorContracts
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

     // Notification endpoints
     router.get(
       '/notifications',
       authenticate,
       contractController.getUserNotifications
     );

     router.post(
       '/notifications/:notificationId/read',
       authenticate,
       contractController.markNotificationAsRead
     );

     router.post(
       '/notifications/read-all',
       authenticate,
       contractController.markAllNotificationsAsRead
     );

     router.get(
       '/pending-approvals',
       authenticate,
       contractController.getPendingApprovals
     );

     router.get(
       '/notification-count',
       authenticate,
       contractController.getNotificationCount
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

    /*
 
    */

     module.exports = router;