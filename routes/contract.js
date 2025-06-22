const express = require('express');
     const router = express.Router();
     const contractController = require('../controllers/contractController');
     const sponsorValidator = require('../middleware/sponsorValidator');
     const { verifyTokenAndAuthorization } = require('../middleware/auth');

     // Apply for new loan contract
     router.post(
       '/apply',
       verifyTokenAndAuthorization, // Fixed: Use verifyTokenAndAuthorization
       sponsorValidator,
       contractController.createContract
     );

     // Get user contracts
     router.get(
       '/my-contracts',
       verifyTokenAndAuthorization,
       contractController.getUserContracts
     );

     // Get sponsor contracts
     router.get(
       '/sponsor-contracts',
       verifyTokenAndAuthorization,
       contractController.getSponsorContracts
     );

     module.exports = router;