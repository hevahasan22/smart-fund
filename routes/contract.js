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
    /*
     // Admin routes
     router.get('/admin/all', 
      authenticate, 
      requireAdmin, 
      contractController.getAllContracts
    );
     
     router.get('/admin/user/:userId', 
      authenticate, 
      requireAdmin, 
      contractController.getUserContractsAdmin
    );
    */

     module.exports = router;