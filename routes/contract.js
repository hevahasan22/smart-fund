const express = require('express');
     const router = express.Router();
     const contractController = require('../controllers/contractController');
     const sponsorValidator = require('../middleware/sponsorValidator');
     const { authenticate, requireAdmin, authorizeUserOrAdmin } = require('../middleware/auth');

     // Apply for new loan contract
     router.post(
       '/apply',
       authenticate,
       sponsorValidator,
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
    /*
 
    */

     module.exports = router;